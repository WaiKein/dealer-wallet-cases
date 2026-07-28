import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { canAccessManagementDashboard } from "@/lib/auth/permissions";
import { getManagementDashboard } from "@/lib/management/service";
import type { ApiErrorCode } from "@/lib/api/errors";

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    if (!canAccessManagementDashboard(profile.role)) {
      return apiError({
        code: "FORBIDDEN",
        message: "You cannot access the management dashboard.",
      });
    }

    const url = new URL(request.url);
    const result = await getManagementDashboard(profile, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    if (!result.data) {
      return apiError({
        code: (result.code as ApiErrorCode) ?? "VALIDATION_ERROR",
        message: result.error ?? "Failed to load dashboard.",
      });
    }

    return jsonOk({ snapshot: result.data });
  });
}
