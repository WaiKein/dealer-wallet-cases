import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { getLatestApprovalForCase } from "@/lib/approvals/service";
import { getCaseById } from "@/lib/cases/queries";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withActor(request, async ({ profile }) => {
    const caseResult = await getCaseById(id, profile);
    if (caseResult.error || !caseResult.data) {
      return apiError({
        code: "NOT_FOUND",
        message: caseResult.error ?? "Case not found.",
      });
    }

    const approval = await getLatestApprovalForCase(id);
    return jsonOk({
      caseId: id,
      approvalRequest: approval.request,
      approvalSteps: approval.steps,
    });
  });
}
