import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { getCaseById } from "@/lib/cases/queries";
import { getLatestExecutionForCase } from "@/lib/executions/service";
import { maskExecutionPayloadForRole } from "@/lib/security/masking";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withActor(request, async ({ profile }) => {
    if (
      profile.role !== "operations_agent" &&
      profile.role !== "team_lead" &&
      profile.role !== "admin" &&
      profile.role !== "approver"
    ) {
      return apiError({ code: "FORBIDDEN", message: "Not allowed." });
    }

    const caseResult = await getCaseById(id, profile);
    if (caseResult.error || !caseResult.data) {
      return apiError({
        code: "NOT_FOUND",
        message: caseResult.error ?? "Case not found.",
      });
    }

    const { execution, attempts } = await getLatestExecutionForCase(id);
    const masked = maskExecutionPayloadForRole({
      execution,
      attempts,
      role: profile.role,
    });
    return jsonOk({
      caseId: id,
      execution: masked.execution,
      attempts: masked.attempts,
    });
  });
}
