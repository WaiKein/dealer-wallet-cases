import { apiError, jsonOk } from "@/lib/api/response";
import { authorizeTestControl } from "@/lib/test-control/authorize";
import { createServiceClient } from "@/lib/supabase/api";

/** Toggle org feature flags for simulator (service-role). */
export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    isEnabled?: boolean;
    organizationId?: string;
  };

  if (!body.code || typeof body.isEnabled !== "boolean") {
    return apiError({
      code: "VALIDATION_ERROR",
      message: "code and isEnabled are required.",
    });
  }

  const service = createServiceClient();
  let orgId = body.organizationId;
  if (!orgId) {
    const { data: org } = await service
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    orgId = org?.id;
  }
  if (!orgId) {
    return apiError({ code: "NOT_FOUND", message: "Organization not found." });
  }

  const { data, error } = await service
    .from("feature_flags")
    .update({ is_enabled: body.isEnabled })
    .eq("organization_id", orgId)
    .eq("code", body.code)
    .select("id, code, is_enabled")
    .maybeSingle();

  if (error || !data) {
    return apiError({
      code: "NOT_FOUND",
      message: error?.message ?? "Feature flag not found.",
    });
  }

  return jsonOk({ flag: data });
}
