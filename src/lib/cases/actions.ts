"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canTransition, canCreateCase } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  createCaseSchema,
  statusTransitionSchema,
  type CreateCaseInput,
  type StatusTransitionInput,
} from "@/lib/validations/case";
import type { ActionResult, CaseStatus } from "@/types";

async function recordAuditEntry(params: {
  caseId: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus;
  changedBy: string;
  comment?: string | null;
}): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("case_audit_history").insert({
    case_id: params.caseId,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    changed_by: params.changedBy,
    comment: params.comment ?? null,
  });

  return error?.message ?? null;
}

export async function createCase(
  input: CreateCaseInput
): Promise<ActionResult<{ id: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  if (!canCreateCase(profile.role)) {
    return { success: false, error: "Only requesters can create cases." };
  }

  const parsed = createCaseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid case data.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      dealer_id: parsed.data.dealer_id,
      wallet_id: parsed.data.wallet_id,
      adjustment_amount: parsed.data.adjustment_amount,
      adjustment_type: parsed.data.adjustment_type,
      currency: parsed.data.currency,
      requester_id: profile.id,
      status: "SUBMITTED",
    })
    .select("id, status")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to create case." };
  }

  const auditError = await recordAuditEntry({
    caseId: data.id,
    fromStatus: null,
    toStatus: "SUBMITTED",
    changedBy: profile.id,
    comment: "Case submitted by requester.",
  });

  if (auditError) {
    return { success: false, error: auditError };
  }

  revalidatePath("/cases");
  redirect(`/cases/${data.id}`);
}

export async function transitionCaseStatus(
  input: StatusTransitionInput
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = statusTransitionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid transition data.",
    };
  }

  const supabase = await createClient();
  const { data: existingCase, error: fetchError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", parsed.data.caseId)
    .single();

  if (fetchError || !existingCase) {
    return { success: false, error: "Case not found." };
  }

  const transition = canTransition(
    existingCase.status,
    parsed.data.nextStatus,
    profile.role
  );

  if (!transition) {
    return {
      success: false,
      error: "You are not allowed to perform this status change.",
    };
  }

  if (transition.requiresComment && !parsed.data.comment?.trim()) {
    return { success: false, error: "A comment is required for this action." };
  }

  const updatePayload: Record<string, unknown> = {
    status: parsed.data.nextStatus,
  };

  if (parsed.data.nextStatus === "UNDER_REVIEW") {
    updatePayload.assigned_agent_id =
      existingCase.assigned_agent_id ?? profile.id;
  }

  if (parsed.data.nextStatus === "APPROVED" || parsed.data.nextStatus === "REJECTED") {
    updatePayload.approver_id = profile.id;
  }

  if (parsed.data.nextStatus === "REJECTED") {
    updatePayload.rejection_reason = parsed.data.rejection_reason?.trim();
  }

  if (parsed.data.nextStatus === "RESOLVED") {
    updatePayload.resolution_notes = parsed.data.resolution_notes?.trim();
  }

  const { error: updateError } = await supabase
    .from("cases")
    .update(updatePayload)
    .eq("id", parsed.data.caseId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const auditError = await recordAuditEntry({
    caseId: parsed.data.caseId,
    fromStatus: existingCase.status,
    toStatus: parsed.data.nextStatus,
    changedBy: profile.id,
    comment: parsed.data.comment?.trim() ?? parsed.data.rejection_reason?.trim() ?? parsed.data.resolution_notes?.trim(),
  });

  if (auditError) {
    return { success: false, error: auditError };
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${parsed.data.caseId}`);
  return { success: true };
}
