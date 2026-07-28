import { apiError, jsonOk } from "@/lib/api/response";
import { authorizeTestControl } from "@/lib/test-control/authorize";
import { createServiceClient } from "@/lib/supabase/api";

/** Create a secondary organization for cross-org security scenarios. */
export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
  };

  const service = createServiceClient();
  const orgId = crypto.randomUUID();
  const { error } = await service.from("organizations").insert({
    id: orgId,
    name: body.name ?? `Simulator Org ${orgId.slice(0, 8)}`,
    lead_authorization_mode: "both",
  });

  if (error) {
    return apiError({
      code: "VALIDATION_ERROR",
      message: error.message,
    });
  }

  console.info("[test-control] fixtures.org", { orgId });
  return jsonOk({ organizationId: orgId });
}
