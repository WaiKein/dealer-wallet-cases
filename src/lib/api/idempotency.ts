import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { getCorrelationId } from "@/lib/observability/correlation";
import { createServiceClient } from "@/lib/supabase/api";

const IDEMPOTENCY_HEADER = "idempotency-key";
/** Pending claim lease — stale claims may be taken over after this window. */
export const IDEMPOTENCY_LEASE_SECONDS = 60;

export function getIdempotencyKey(request: Request): string | null {
  return request.headers.get(IDEMPOTENCY_HEADER)?.trim() || null;
}

export function hashRequestPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload ?? null))
    .digest("hex");
}

type IdempotencyRow = {
  id: string;
  request_hash: string;
  response_status: number | null;
  response_body: unknown;
  correlation_id: string | null;
  claimed_at?: string | null;
};

/**
 * Atomically claim the idempotency key before running the handler.
 * Stale pending claims (lease expired) may be taken over.
 */
export async function withIdempotency(params: {
  request: Request;
  organizationId: string;
  route: string;
  method: string;
  requestPayload: unknown;
  caseId?: string | null;
  handler: () => Promise<NextResponse>;
}): Promise<NextResponse> {
  const key = getIdempotencyKey(params.request);
  if (!key) {
    return params.handler();
  }

  const requestHash = hashRequestPayload(params.requestPayload);
  const service = createServiceClient();
  const correlationId = getCorrelationId();
  const claimedAt = new Date().toISOString();

  const { data: claimed, error: claimError } = await service
    .from("idempotency_keys")
    .insert({
      organization_id: params.organizationId,
      idempotency_key: key,
      route: params.route,
      method: params.method,
      request_hash: requestHash,
      response_status: null,
      response_body: null,
      case_id: params.caseId ?? null,
      correlation_id: correlationId,
      claimed_at: claimedAt,
    })
    .select(
      "id, request_hash, response_status, response_body, correlation_id, claimed_at"
    )
    .maybeSingle();

  let claimId = claimed?.id as string | undefined;

  if (claimError?.code === "23505") {
    const { data: existing } = await service
      .from("idempotency_keys")
      .select(
        "id, request_hash, response_status, response_body, correlation_id, claimed_at"
      )
      .eq("organization_id", params.organizationId)
      .eq("idempotency_key", key)
      .eq("route", params.route)
      .eq("method", params.method)
      .maybeSingle();

    const row = existing as IdempotencyRow | null;
    if (row?.response_status != null) {
      return replayOrConflict(row, requestHash, key, correlationId);
    }

    if (row && row.request_hash !== requestHash) {
      return apiError({
        code: "IDEMPOTENCY_KEY_REUSE",
        details: { idempotencyKey: key },
      });
    }

    const { data: taken } = await service.rpc("takeover_stale_idempotency_claim", {
      p_organization_id: params.organizationId,
      p_idempotency_key: key,
      p_route: params.route,
      p_method: params.method,
      p_request_hash: requestHash,
      p_correlation_id: correlationId,
      p_lease_seconds: IDEMPOTENCY_LEASE_SECONDS,
    });

    const takenRow = (Array.isArray(taken) ? taken[0] : taken) as
      | IdempotencyRow
      | null
      | undefined;

    if (!takenRow?.id) {
      return apiError({
        code: "CONFLICT",
        message: "Idempotency key is being processed. Retry shortly.",
      });
    }

    claimId = takenRow.id;
  } else if (claimError || !claimed) {
    return apiError({
      code: "INTERNAL_ERROR",
      message: claimError?.message ?? "Failed to claim idempotency key.",
    });
  }

  try {
    const response = await params.handler();
    const cloned = response.clone();
    const body = await cloned.json().catch(() => ({ success: false }));

    const { data: finalized, error: finalizeError } = await service
      .from("idempotency_keys")
      .update({
        response_status: response.status,
        response_body: body,
        case_id: params.caseId ?? null,
        correlation_id: correlationId,
      })
      .eq("id", claimId!)
      .is("response_status", null)
      .select("id")
      .maybeSingle();

    if (finalizeError || !finalized) {
      return apiError({
        code: "CONFLICT",
        message:
          "Idempotency claim was lost or already finalized. Retry shortly.",
      });
    }

    return response;
  } catch (error) {
    await service.from("idempotency_keys").delete().eq("id", claimId!);
    throw error;
  }
}

function replayOrConflict(
  existing: IdempotencyRow | null,
  requestHash: string,
  key: string,
  correlationId: string
): NextResponse {
  if (!existing) {
    return apiError({
      code: "CONFLICT",
      message: "Idempotency key is being processed. Retry shortly.",
    });
  }

  if (existing.request_hash !== requestHash) {
    return apiError({
      code: "IDEMPOTENCY_KEY_REUSE",
      details: { idempotencyKey: key },
    });
  }

  if (existing.response_status == null) {
    return apiError({
      code: "CONFLICT",
      message: "Idempotency key is being processed. Retry shortly.",
    });
  }

  return NextResponse.json(existing.response_body, {
    status: existing.response_status,
    headers: {
      "x-correlation-id": existing.correlation_id ?? correlationId,
    },
  });
}

export { IDEMPOTENCY_HEADER };
