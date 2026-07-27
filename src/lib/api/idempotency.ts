import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, jsonOk } from "@/lib/api/response";
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

  const { data: existing } = await service
    .from("idempotency_keys")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("idempotency_key", key)
    .eq("route", params.route)
    .eq("method", params.method)
    .maybeSingle();

  if (existing) {
    if (existing.request_hash !== requestHash) {
      return apiError({
        code: "IDEMPOTENCY_KEY_REUSE",
        details: { idempotencyKey: key },
      });
    }
    return NextResponse.json(existing.response_body, {
      status: existing.response_status,
      headers: { "x-correlation-id": existing.correlation_id ?? correlationId },
    });
  }

  const response = await params.handler();
  const cloned = response.clone();
  const body = await cloned.json().catch(() => ({ success: false }));

  await service.from("idempotency_keys").upsert(
    {
      organization_id: params.organizationId,
      idempotency_key: key,
      route: params.route,
      method: params.method,
      request_hash: requestHash,
      response_status: response.status,
      response_body: body,
      case_id: params.caseId ?? null,
      correlation_id: correlationId,
    },
    { onConflict: "organization_id,idempotency_key,route,method" }
  );

  return response;
}

export { IDEMPOTENCY_HEADER, jsonOk };
