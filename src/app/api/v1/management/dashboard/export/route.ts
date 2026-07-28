import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { canAccessManagementDashboard } from "@/lib/auth/permissions";
import { exportManagementDashboardCsv } from "@/lib/management/service";
import type { ApiErrorCode } from "@/lib/api/errors";
import { getCorrelationId } from "@/lib/observability/correlation";
import { CORRELATION_HEADER } from "@/lib/api/errors";

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    if (!canAccessManagementDashboard(profile.role)) {
      return apiError({
        code: "FORBIDDEN",
        message: "You cannot export management dashboard data.",
      });
    }

    const url = new URL(request.url);
    const result = await exportManagementDashboardCsv(profile, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    if (!result.csv) {
      return apiError({
        code: (result.code as ApiErrorCode) ?? "VALIDATION_ERROR",
        message: result.error ?? "Failed to export.",
      });
    }

    const correlationId = getCorrelationId();
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="management-dashboard.csv"`,
        [CORRELATION_HEADER]: correlationId,
      },
    });
  });
}
