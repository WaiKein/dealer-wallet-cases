import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { canAccessAdminConsole } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/api";

/** Admin/test helper: list email deliveries for a case. */
export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    if (
      !canAccessAdminConsole(profile.role) &&
      profile.role !== "operations_agent" &&
      profile.role !== "team_lead"
    ) {
      return apiError({ code: "FORBIDDEN", message: "Not allowed." });
    }

    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");
    const eventType = url.searchParams.get("eventType");
    if (!caseId) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: "caseId is required.",
      });
    }

    const service = createServiceClient();
    let query = service
      .from("notification_deliveries")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (profile.organization_id) {
      query = query.eq("organization_id", profile.organization_id);
    }
    if (eventType) {
      query = query.eq("event_type", eventType);
    }

    const { data, error } = await query;
    if (error) {
      return apiError({ code: "INTERNAL_ERROR", message: error.message });
    }
    return jsonOk({ deliveries: data ?? [] });
  });
}
