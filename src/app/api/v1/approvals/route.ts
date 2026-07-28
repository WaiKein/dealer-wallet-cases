import type { ApiErrorCode } from "@/lib/api/errors";
import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { listPendingApprovals } from "@/lib/approvals/service";

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    const result = await listPendingApprovals(profile);
    if (!result.success) {
      return apiError({
        code: (result.code as ApiErrorCode) ?? "VALIDATION_ERROR",
        message: result.error ?? "Failed to load approvals.",
      });
    }
    return jsonOk(result.data);
  });
}
