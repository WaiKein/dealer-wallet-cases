import { getCorrelationId } from "@/lib/observability/correlation";
import { createServiceClient } from "@/lib/supabase/api";
import type { Profile } from "@/types";

export async function recordConfigurationAudit(params: {
  organizationId: string;
  configurationType: string;
  configurationId: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  actor: Profile;
  changeReason?: string | null;
}) {
  // Service role: approvers may create delegations but cannot INSERT audit via RLS.
  const supabase = createServiceClient();
  const { error } = await supabase.from("configuration_audit").insert({
    organization_id: params.organizationId,
    configuration_type: params.configurationType,
    configuration_id: params.configurationId,
    previous_value: params.previousValue,
    new_value: params.newValue,
    actor_id: params.actor.id,
    change_reason: params.changeReason ?? null,
    correlation_id: getCorrelationId(),
  });

  if (error) {
    // Never block the primary write because audit logging failed.
    console.error("[configuration_audit]", error.message);
  }
}