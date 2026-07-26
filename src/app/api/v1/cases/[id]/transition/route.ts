import { jsonError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { executeTransition } from "@/lib/cases/transitions";
import { statusTransitionSchema } from "@/lib/validations/case";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withActor(request, async ({ profile }) => {
    const body = await request.json().catch(() => null);
    const parsed = statusTransitionSchema.safeParse({
      caseId: id,
      nextStatus: body?.nextStatus,
      comment: body?.comment,
      rejection_reason: body?.rejection_reason,
      resolution_notes: body?.resolution_notes,
    });

    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "Invalid transition.",
        400
      );
    }

    const result = await executeTransition(profile, parsed.data);
    if (!result.success) {
      const denied =
        result.error?.includes("not allowed") ||
        result.error?.includes("outside your organization");
      return jsonError(result.error ?? "Transition failed.", denied ? 403 : 400);
    }

    return jsonOk({ caseId: id, status: parsed.data.nextStatus });
  });
}
