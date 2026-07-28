import { apiError, jsonOk } from "@/lib/api/response";
import { authorizeTestControl } from "@/lib/test-control/authorize";
import { createServiceClient } from "@/lib/supabase/api";

/** Insert a saved view in a target org for cross-tenant denial tests. */
export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
    name?: string;
    sharingScope?: "organization" | "system" | "personal";
  };

  if (!body.organizationId) {
    return apiError({
      code: "VALIDATION_ERROR",
      message: "organizationId is required.",
    });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("saved_case_views")
    .insert({
      organization_id: body.organizationId,
      name: body.name ?? `Foreign view ${Date.now()}`,
      sharing_scope: body.sharingScope ?? "organization",
      filters: {},
      sorting: { field: "updated_at", direction: "desc" },
      is_system: false,
      is_active: true,
    })
    .select("id, organization_id, name")
    .single();

  if (error || !data) {
    return apiError({
      code: "VALIDATION_ERROR",
      message: error?.message ?? "Failed to create fixture view.",
    });
  }

  return jsonOk({ view: data });
}
