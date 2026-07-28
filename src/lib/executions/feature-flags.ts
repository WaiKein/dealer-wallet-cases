import { createServiceClient } from "@/lib/supabase/api";

/** Org-scoped feature flag lookup (service or session client both work). */
export async function isFeatureFlagEnabled(params: {
  organizationId: string;
  code: string;
}): Promise<boolean> {
  const service = createServiceClient();
  const now = new Date().toISOString();
  const { data } = await service
    .from("feature_flags")
    .select("is_enabled, is_active, effective_from, effective_to")
    .eq("organization_id", params.organizationId)
    .eq("code", params.code)
    .maybeSingle();

  if (!data || data.is_active === false) {
    return false;
  }
  if (data.effective_from && data.effective_from > now) {
    return false;
  }
  if (data.effective_to && data.effective_to <= now) {
    return false;
  }
  return Boolean(data.is_enabled);
}

export async function isRequireExecutionBeforeResolve(
  organizationId: string
): Promise<boolean> {
  return isFeatureFlagEnabled({
    organizationId,
    code: "require_execution_before_resolve",
  });
}
