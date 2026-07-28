export const CORRELATION_HEADER = "x-correlation-id";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_KEY_REUSE"
  | "CONFLICT"
  | "EXECUTION_REQUIRED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "NOT_ALLOWED";

export const ERROR_HTTP_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSE: 409,
  CONFLICT: 409,
  EXECUTION_REQUIRED: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  NOT_ALLOWED: 403,
};

/** Safe public messages — never include stack traces or SQL internals. */
export const SAFE_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  UNAUTHORIZED: "Authentication required.",
  FORBIDDEN: "You are not allowed to perform this action.",
  NOT_FOUND: "Resource not found.",
  VERSION_CONFLICT: "This record was updated by someone else. Refresh and retry.",
  IDEMPOTENCY_KEY_REUSE:
    "Idempotency-Key was reused with a different request payload.",
  INTERNAL_ERROR: "An unexpected error occurred.",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable.",
};

export function sanitizePublicMessage(
  code: ApiErrorCode,
  message?: string
): string {
  if (SAFE_MESSAGES[code]) {
    // Prefer domain-safe message when provided and non-technical
    if (
      message &&
      !/stack|exception|permission denied|violates row-level|JWT|postgres/i.test(
        message
      )
    ) {
      return message;
    }
    return SAFE_MESSAGES[code]!;
  }
  if (
    message &&
    !/stack|exception|permission denied|violates row-level|JWT|postgres/i.test(
      message
    )
  ) {
    return message;
  }
  return SAFE_MESSAGES.INTERNAL_ERROR!;
}
