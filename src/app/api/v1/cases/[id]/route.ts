import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { getCaseById } from "@/lib/cases/queries";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withActor(request, async ({ profile }) => {
    const result = await getCaseById(id, profile);
    if (result.error || !result.data) {
      return apiError({
        code: "NOT_FOUND",
        message: result.error ?? "Case not found.",
      });
    }
    return jsonOk({ case: result.data });
  });
}
