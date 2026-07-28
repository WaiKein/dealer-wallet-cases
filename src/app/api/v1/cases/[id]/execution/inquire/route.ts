import type { ApiErrorCode } from "@/lib/api/errors";
import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { requestStatusInquiry } from "@/lib/executions/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withActor(request, async ({ profile }) => {
    const body = (await request.json().catch(() => ({}))) as {
      expectedVersion?: number;
    };

    const result = await requestStatusInquiry({
      profile,
      caseId: id,
      expectedVersion: body.expectedVersion,
    });

    if (!result.success) {
      return apiError({
        code: (result.code as ApiErrorCode) ?? "INTERNAL_ERROR",
        message: result.error ?? "Status inquiry failed.",
        details: result.details,
      });
    }

    return jsonOk(result.data);
  });
}
