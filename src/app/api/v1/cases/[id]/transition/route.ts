import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { withIdempotency } from "@/lib/api/idempotency";
import { executeTransition } from "@/lib/cases/transitions";
import { statusTransitionSchema } from "@/lib/validations/case";
import type { ApiErrorCode } from "@/lib/api/errors";

const IDEMPOTENT_STATUSES = new Set([
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "RESOLVED",
  "UNDER_REVIEW", // reopen path also uses this
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withActor(request, async ({ profile }) => {
    if (!profile.organization_id) {
      return apiError({
        code: "FORBIDDEN",
        message: "Your account is not linked to an organization.",
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = statusTransitionSchema.safeParse({
      caseId: id,
      nextStatus: body?.nextStatus,
      comment: body?.comment,
      rejection_reason: body?.rejection_reason,
      resolution_notes: body?.resolution_notes,
      expectedVersion: body?.expectedVersion,
    });

    if (!parsed.success) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid transition.",
      });
    }

    const run = async () => {
      const result = await executeTransition(profile, parsed.data);
      if (!result.success) {
        return apiError({
          code: (result.code as ApiErrorCode) ?? "VALIDATION_ERROR",
          message: result.error ?? "Transition failed.",
          details: result.details,
        });
      }
      return jsonOk({
        caseId: id,
        status: parsed.data.nextStatus,
        version: result.data?.version,
      });
    };

    if (IDEMPOTENT_STATUSES.has(parsed.data.nextStatus)) {
      return withIdempotency({
        request,
        organizationId: profile.organization_id,
        route: `/api/v1/cases/${id}/transition`,
        method: "POST",
        requestPayload: parsed.data,
        caseId: id,
        handler: run,
      });
    }

    return run();
  });
}
