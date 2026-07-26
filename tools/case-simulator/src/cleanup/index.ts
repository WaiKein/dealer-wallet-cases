import type { ApiClient } from "../api/client.js";

export async function cleanupCases(
  client: ApiClient,
  secret: string,
  options: { caseIds?: string[]; prefix?: string }
): Promise<number> {
  const result = await client.request<{ deleted: number }>(
    "POST",
    "/api/test-control/cleanup",
    options,
    { "x-test-control-secret": secret }
  );
  return result.data?.deleted ?? 0;
}
