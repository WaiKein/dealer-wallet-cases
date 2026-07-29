import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { getCorrelationId } from "@/lib/observability/correlation";
import { createServiceClient } from "@/lib/supabase/api";

const IDEMPOTENCY_HEADER = "idempotency-key";
/** Pending claim lease — stale claims may be taken over after this window. */
export const IDEMPOTENCY_LEASE_SECONDS = 60;
/** Renew claimed_at while the handler runs so healthy long requests keep ownership. */
const LEASE_HEARTBEAT_MS = 20_000;

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
  claim_token?: string | null;
};

type ClaimOwnership = {
  id: string;
  token: string;
};

/**
 * Atomically claim the idempotency key before running the handler.
 * Stale pending claims (lease expired) may be taken over with a new claim_token,
 * which fences the previous owner's finalize/delete updates.
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
  const claimToken = randomUUID();
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
      claim_token: claimToken,
    })
    .select(
      "id, request_hash, response_status, response_body, correlation_id, claimed_at, claim_token"
    )
    .maybeSingle();

  let ownership: ClaimOwnership | null = claimed?.id
    ? { id: claimed.id as string, token: claimToken }
    : null;

  if (claimError?.code === "23505") {
    const { data: existing } = await service
      .from("idempotency_keys")
      .select(
        "id, request_hash, response_status, response_body, correlation_id, claimed_at, claim_token"
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

    const takeoverToken = randomUUID();
    const { data: taken } = await service.rpc("takeover_stale_idempotency_claim", {
      p_organization_id: params.organizationId,
      p_idempotency_key: key,
      p_route: params.route,
      p_method: params.method,
      p_request_hash: requestHash,
      p_correlation_id: correlationId,
      p_lease_seconds: IDEMPOTENCY_LEASE_SECONDS,
      p_claim_token: takeoverToken,
    });

    const takenRow = (Array.isArray(taken) ? taken[0] : taken) as
      | IdempotencyRow
      | null
      | undefined;

    if (!takenRow?.id || takenRow.claim_token !== takeoverToken) {
      return apiError({
        code: "CONFLICT",
        message: "Idempotency key is being processed. Retry shortly.",
      });
    }

    ownership = { id: takenRow.id, token: takeoverToken };
  } else if (claimError || !ownership) {
    return apiError({
      code: "INTERNAL_ERROR",
      message: claimError?.message ?? "Failed to claim idempotency key.",
    });
  }

  const stopHeartbeat = startClaimHeartbeat(service, ownership);

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
      .eq("id", ownership.id)
      .eq("claim_token", ownership.token)
      .is("response_status", null)
      .select("id")
      .maybeSingle();

    if (finalizeError || !finalized) {
      // Lost ownership (taken over) or already finalized by another owner.
      return apiError({
        code: "CONFLICT",
        message:
          "Idempotency claim was lost or already finalized. Retry shortly.",
      });
    }

    return response;
  } catch (error) {
    // Only the current owner may release the pending claim.
    await service
      .from("idempotency_keys")
      .delete()
      .eq("id", ownership.id)
      .eq("claim_token", ownership.token)
      .is("response_status", null);
    throw error;
  } finally {
    stopHeartbeat();
  }
}

function startClaimHeartbeat(
  service: ReturnType<typeof createServiceClient>,
  ownership: ClaimOwnership
): () => void {
  const timer = setInterval(() => {
    void service
      .from("idempotency_keys")
      .update({ claimed_at: new Date().toISOString() })
      .eq("id", ownership.id)
      .eq("claim_token", ownership.token)
      .is("response_status", null);
  }, LEASE_HEARTBEAT_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return () => clearInterval(timer);
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
