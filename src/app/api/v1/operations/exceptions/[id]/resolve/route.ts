import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { canManageExceptions } from "@/lib/auth/permissions";
import { resolveExceptionItem } from "@/lib/exceptions/service";
import type { ApiErrorCode } from "@/lib/api/errors";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withActor(request, async ({ profile }) => {
    if (!canManageExceptions(profile.role)) {
      return apiError({ code: "FORBIDDEN", message: "Not allowed." });
    }

    const body = (await request.json().catch(() => ({}))) as {
      resolutionNote?: string;
      dismiss?: boolean;
    };

    const result = await resolveExceptionItem({
      profile,
      exceptionId: id,
      resolutionNote: body.resolutionNote ?? "Resolved by simulator",
      dismiss: Boolean(body.dismiss),
    });

    if (!result.success) {
      return apiError({
        code: (result.code as ApiErrorCode) ?? "VALIDATION_ERROR",
        message: result.error ?? "Failed to resolve exception.",
      });
    }

    return jsonOk(result.data);
  });
}
