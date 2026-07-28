import type { ApiErrorCode } from "@/lib/api/errors";
import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { getIntegrationExecutionById } from "@/lib/executions/service";
import { maskExecutionPayloadForRole } from "@/lib/security/masking";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withActor(request, async ({ profile }) => {
    const result = await getIntegrationExecutionById({
      profile,
      executionId: id,
    });

    if (!result.success || !result.data) {
      return apiError({
        code: (result.code as ApiErrorCode) ?? "INTERNAL_ERROR",
        message: result.error ?? "Failed to load execution.",
        details: result.details,
      });
    }

    const { caseId, execution, attempts } = result.data;
    return jsonOk({
      caseId,
      ...maskExecutionPayloadForRole({
        execution,
        attempts,
        role: profile.role,
      }),
    });
  });
}
