import type { ApiClient } from "../api/client.js";

/**
 * Failure injection via test-control only (never used for normal business actions).
 * Reserved for future fault types (forced RLS denial, delayed responses, etc.).
 */
export async function injectFailure(
  client: ApiClient,
  secret: string,
  payload: { type: string; caseId?: string; metadata?: Record<string, unknown> }
): Promise<unknown> {
  const result = await client.request(
    "POST",
    "/api/test-control/cleanup",
    {
      // Placeholder endpoint reuse until dedicated failure routes exist.
      prefix: `__failure_inject_${payload.type}__`,
    },
    { "x-test-control-secret": secret }
  );
  return result.raw;
}
