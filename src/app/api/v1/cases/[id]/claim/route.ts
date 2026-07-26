import { claimCase } from "@/lib/assignment/service";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withActor(request, async ({ profile }) => {
    const result = await claimCase({ caseId: id, actor: profile });
    if (result.error) {
      return jsonError(result.error, 403);
    }
    return jsonOk({ caseId: id, claimed: true });
  });
}
