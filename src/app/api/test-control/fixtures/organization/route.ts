import { apiError, jsonOk } from "@/lib/api/response";
import { isTestControlEnabled } from "@/lib/clock";
import { createServiceClient } from "@/lib/supabase/api";

function authorizeTestControl(request: Request): string | null {
  if (!isTestControlEnabled()) {
    return "Test control is disabled.";
  }
  const secret = request.headers.get("x-test-control-secret");
  if (!secret || secret !== process.env.TEST_CONTROL_SECRET) {
    return "Invalid test-control secret.";
  }
  return null;
}

/** Create a secondary organization for cross-org security scenarios. */
export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return apiError({ code: "FORBIDDEN", message: denied });
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
