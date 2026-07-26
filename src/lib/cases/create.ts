import { applyAssignmentRules } from "@/lib/assignment/service";
import { canCreateCase } from "@/lib/auth/permissions";
import { recordAuditEntry } from "@/lib/cases/audit";
import { generateAccountId, generateReferenceId } from "@/lib/cases/ids";
import { getClock } from "@/lib/clock";
import { startCaseSlas } from "@/lib/sla/service";
import { createClient } from "@/lib/supabase/server";
import {
  createCaseSchema,
  type CreateCaseInput,
} from "@/lib/validations/case";
import type { ActionResult, Profile } from "@/types";

/** Shared create-case path for UI actions and public API (no redirect). */
export async function createCaseRecord(
  profile: Profile,
  input: CreateCaseInput
): Promise<ActionResult<{ id: string; case_number?: string }>> {
  if (!canCreateCase(profile.role)) {
    return { success: false, error: "Only requesters can create cases." };
  }

  if (!profile.organization_id) {
    return {
      success: false,
      error: "Your account is not linked to an organization.",
    };
  }

  const parsed = createCaseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid case data.",
    };
  }

  const supabase = await createClient();

  const { data: subcategory } = await supabase
    .from("subcategories")
    .select("id, category_id, organization_id")
    .eq("id", parsed.data.subcategory_id)
    .eq("organization_id", profile.organization_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!subcategory || subcategory.category_id !== parsed.data.category_id) {
    return { success: false, error: "Invalid category or subcategory." };
  }

  const dealerId = generateAccountId();
  const walletId = parsed.data.wallet_id ?? generateReferenceId();
  const startedAt = getClock().now();

  const { data, error } = await supabase
    .from("cases")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      dealer_id: dealerId,
      wallet_id: walletId,
      adjustment_amount: parsed.data.adjustment_amount,
      adjustment_type: parsed.data.adjustment_type,
      currency: parsed.data.currency,
      category_id: parsed.data.category_id,
      subcategory_id: parsed.data.subcategory_id,
      priority: parsed.data.priority,
      organization_id: profile.organization_id,
      requester_id: profile.id,
      status: "SUBMITTED",
      created_at: startedAt.toISOString(),
      updated_at: startedAt.toISOString(),
    })
    .select("id, status, created_at, case_number")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to create case." };
  }

  const auditError = await recordAuditEntry({
    caseId: data.id,
    eventType: "status_change",
    fromStatus: null,
    toStatus: "SUBMITTED",
    changedBy: profile.id,
    comment: "Case submitted by requester.",
  });

  if (auditError) {
    return { success: false, error: auditError };
  }

  const slaError = await startCaseSlas({
    caseId: data.id,
    organizationId: profile.organization_id,
    priority: parsed.data.priority,
    startedAt: new Date(data.created_at),
    actorId: profile.id,
  });

  if (slaError) {
    return { success: false, error: slaError };
  }

  const assignment = await applyAssignmentRules({
    caseId: data.id,
    organizationId: profile.organization_id,
    categoryId: parsed.data.category_id,
    subcategoryId: parsed.data.subcategory_id,
    priority: parsed.data.priority,
    actor: profile,
  });

  if (assignment.error) {
    return { success: false, error: assignment.error };
  }

  return {
    success: true,
    data: { id: data.id, case_number: data.case_number },
  };
}
