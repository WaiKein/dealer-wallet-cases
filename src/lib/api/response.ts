import { NextResponse } from "next/server";
import {
  CORRELATION_HEADER,
  ERROR_HTTP_STATUS,
  type ApiErrorCode,
  sanitizePublicMessage,
} from "@/lib/api/errors";
import { getCorrelationId } from "@/lib/observability/correlation";

export type ApiErrorBody = {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  correlationId: string;
};

export type ApiOkBody<T> = {
  success: true;
  data: T;
  correlationId: string;
};

function withCorrelationHeaders(
  init: ResponseInit | undefined,
  correlationId: string
): ResponseInit {
  const headers = new Headers(init?.headers);
  headers.set(CORRELATION_HEADER, correlationId);
  return { ...init, headers };
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  const correlationId = getCorrelationId();
  return NextResponse.json(
    { success: true, data, correlationId } satisfies ApiOkBody<T>,
    withCorrelationHeaders(init, correlationId)
  );
}

/**
 * Standard error response.
 * Prefer `apiError({ code, message, details })`.
 * Legacy `jsonError(string, status)` remains for gradual migration.
 */
export function apiError(params: {
  code: ApiErrorCode;
  message?: string;
  details?: Record<string, unknown>;
  status?: number;
}): NextResponse {
  const correlationId = getCorrelationId();
  const status = params.status ?? ERROR_HTTP_STATUS[params.code] ?? 400;
  const body: ApiErrorBody = {
    success: false,
    error: {
      code: params.code,
      message: sanitizePublicMessage(params.code, params.message),
      ...(params.details ? { details: params.details } : {}),
    },
    correlationId,
  };
  return NextResponse.json(body, withCorrelationHeaders({ status }, correlationId));
}

/** @deprecated Prefer apiError — maps free-text to a best-effort code. */
export function jsonError(
  error: string,
  status = 400,
  extra?: Record<string, unknown>
) {
  const code = inferCode(error, status);
  return apiError({
    code,
    message: error,
    status,
    details: extra as Record<string, unknown> | undefined,
  });
}

function inferCode(message: string, status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status >= 500) return "INTERNAL_ERROR";
  if (/not allowed|outside your organization/i.test(message)) return "FORBIDDEN";
  if (/not found/i.test(message)) return "NOT_FOUND";
  if (/version|stale|conflict/i.test(message)) return "VERSION_CONFLICT";
  return "VALIDATION_ERROR";
}
