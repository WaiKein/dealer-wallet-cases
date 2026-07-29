import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { getCorrelationId } from "@/lib/observability/correlation";
import { createServiceClient } from "@/lib/supabase/api";

const IDEMPOTENCY_HEADER = "idempotency-key";

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
};

/**
 * Atomically claim the idempotency key before running the handler.
 * Only the winner executes; losers replay a completed response or get CONFLICT
 * if another request is still in flight.
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
    })
    .select("id, request_hash, response_status, response_body, correlation_id")
    .maybeSingle();

  if (claimError?.code === "23505") {
    const { data: existing } = await service
      .from("idempotency_keys")
      .select("id, request_hash, response_status, response_body, correlation_id")
      .eq("organization_id", params.organizationId)
      .eq("idempotency_key", key)
      .eq("route", params.route)
      .eq("method", params.method)
      .maybeSingle();

    return replayOrConflict(
      existing as IdempotencyRow | null,
      requestHash,
      key,
      correlationId
    );
  }

  if (claimError || !claimed) {
    return apiError({
      code: "INTERNAL_ERROR",
      message: claimError?.message ?? "Failed to claim idempotency key.",
    });
  }

  try {
    const response = await params.handler();
    const cloned = response.clone();
    const body = await cloned.json().catch(() => ({ success: false }));

    await service
      .from("idempotency_keys")
      .update({
        response_status: response.status,
        response_body: body,
        case_id: params.caseId ?? null,
        correlation_id: correlationId,
      })
      .eq("id", claimed.id);

    return response;
  } catch (error) {
    // Release the claim so a retry can proceed after a crash mid-handler.
    await service.from("idempotency_keys").delete().eq("id", claimed.id);
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
