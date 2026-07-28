import { apiError, jsonOk } from "@/lib/api/response";
import { authorizeTestControl } from "@/lib/test-control/authorize";
import { refreshCaseSlaStates } from "@/lib/sla/service";
import { createServiceClient } from "@/lib/supabase/api";
import { runWithSupabaseClient } from "@/lib/supabase/context";
import type { Profile } from "@/types";

export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    caseId?: string;
  };

  const service = createServiceClient();

  return runWithSupabaseClient(service, async () => {
    let query = service
      .from("cases")
      .select(
        "id, organization_id, priority, assigned_group_id, status"
      )
      .not("status", "in", "(RESOLVED,REJECTED)");

    if (body.caseId) {
      query = query.eq("id", body.caseId);
    }

    const { data: cases, error } = await query;
    if (error) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }

    const actor: Profile = {
      id: "22222222-2222-2222-2222-222222222222",
      email: "agent@example.com",
      full_name: "Test Control",
      role: "operations_agent",
      organization_id: cases?.[0]?.organization_id ?? null,
      created_at: new Date().toISOString(),
    };

    let processed = 0;
    for (const item of cases ?? []) {
      if (!item.organization_id) {
        continue;
      }
      await refreshCaseSlaStates({
        caseId: item.id,
        organizationId: item.organization_id,
        priority: item.priority,
        assignedGroupId: item.assigned_group_id,
        actor: { ...actor, organization_id: item.organization_id },
      });
      processed += 1;
    }

    console.info("[test-control] sla.refresh", { processed, caseId: body.caseId });
    return jsonOk({ processed });
  });
}
