"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyAssignmentRules } from "@/lib/assignment/service";
import { canTransition, canCreateCase } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { recordAuditEntry } from "@/lib/cases/audit";
import { generateAccountId, generateReferenceId } from "@/lib/cases/ids";
import { notifyUsers } from "@/lib/notifications/service";
import {
  completeSla,
  refreshCaseSlaStates,
  startCaseSlas,
  syncResolutionSlaForStatus,
} from "@/lib/sla/service";
import { createClient } from "@/lib/supabase/server";
import {
  createCaseSchema,
  statusTransitionSchema,
  type CreateCaseInput,
  type StatusTransitionInput,
} from "@/lib/validations/case";
import type { ActionResult, CaseStatus, UserRole } from "@/types";

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

  if (!profile.organization_id) {
    return { success: false, error: "Your account is not linked to an organization." };
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

  if (
    !subcategory ||
    subcategory.category_id !== parsed.data.category_id
  ) {
    return { success: false, error: "Invalid category or subcategory." };
  }

  // Account ID is always system-assigned. Reference ID is optional: use the
  // provided external ID when present, otherwise generate a SILO local reference.
  const dealerId = generateAccountId();
  const walletId = parsed.data.wallet_id ?? generateReferenceId();

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
    })
    .select("id, status, created_at")
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

  if (
    profile.organization_id &&
    existingCase.organization_id !== profile.organization_id
  ) {
    return { success: false, error: "Case is outside your organization." };
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

  const eventType =
    existingCase.status === "RESOLVED" &&
    parsed.data.nextStatus === "UNDER_REVIEW"
      ? "case_reopened"
      : "status_change";

  const auditError = await recordAuditEntry({
    caseId: parsed.data.caseId,
    eventType,
    fromStatus: existingCase.status,
    toStatus: parsed.data.nextStatus,
    changedBy: profile.id,
    comment:
      parsed.data.comment?.trim() ??
      parsed.data.rejection_reason?.trim() ??
      parsed.data.resolution_notes?.trim(),
  });

  if (auditError) {
    return { success: false, error: auditError };
  }

  if (existingCase.organization_id) {
    await syncResolutionSlaForStatus({
      caseId: parsed.data.caseId,
      organizationId: existingCase.organization_id,
      priority: existingCase.priority,
      fromStatus: existingCase.status,
      toStatus: parsed.data.nextStatus,
      actorId: profile.id,
    });

    if (
      parsed.data.nextStatus === "RESOLVED" ||
      parsed.data.nextStatus === "REJECTED"
    ) {
      await completeSla({
        caseId: parsed.data.caseId,
        slaType: "resolution",
        actorId: profile.id,
      });
    }

    await refreshCaseSlaStates({
      caseId: parsed.data.caseId,
      organizationId: existingCase.organization_id,
      priority: existingCase.priority,
      assignedGroupId: existingCase.assigned_group_id,
      actor: profile,
    });
  }

  await emitTransitionNotifications({
    caseId: parsed.data.caseId,
    organizationId: existingCase.organization_id,
    fromStatus: existingCase.status as CaseStatus,
    toStatus: parsed.data.nextStatus,
    requesterId: existingCase.requester_id,
    assignedGroupId: existingCase.assigned_group_id,
    assignedAgentId: existingCase.assigned_agent_id,
    actor: profile,
  });

  revalidatePath("/cases");
  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/workspace");
  return { success: true };
}

async function emitTransitionNotifications(params: {
  caseId: string;
  organizationId: string | null;
  fromStatus: CaseStatus;
  toStatus: CaseStatus;
  requesterId: string;
  assignedGroupId: string | null;
  assignedAgentId: string | null;
  actor: { id: string; organization_id: string | null };
}) {
  if (!params.organizationId) {
    return;
  }

  const supabase = await createClient();

  if (params.toStatus === "PENDING_APPROVAL") {
    const { data: approvers } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("organization_id", params.organizationId)
      .eq("role", "approver");

    await notifyUsers({
      organizationId: params.organizationId,
      recipients: (approvers ?? []).map((row) => ({
        id: row.id,
        role: row.role as UserRole,
      })),
      caseId: params.caseId,
      type: "approval_request",
      title: "Approval requested",
      body: "A case is pending your approval.",
      suffix: params.toStatus,
    });
  }

  if (params.toStatus === "APPROVED" || params.toStatus === "REJECTED") {
    const recipients: { id: string; role: UserRole }[] = [];
    const { data: requester } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", params.requesterId)
      .maybeSingle();
    if (requester) {
      recipients.push({
        id: requester.id,
        role: requester.role as UserRole,
      });
    }
    if (params.assignedAgentId) {
      const { data: agent } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", params.assignedAgentId)
        .maybeSingle();
      if (agent) {
        recipients.push({ id: agent.id, role: agent.role as UserRole });
      }
    }

    await notifyUsers({
      organizationId: params.organizationId,
      recipients,
      caseId: params.caseId,
      type: "approval_decision",
      title: "Approval decision recorded",
      body: `Case was ${params.toStatus.toLowerCase()}.`,
      suffix: params.toStatus,
    });
  }

  if (params.toStatus === "RESOLVED") {
    const { data: requester } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", params.requesterId)
      .maybeSingle();

    if (requester) {
      await notifyUsers({
        organizationId: params.organizationId,
        recipients: [
          { id: requester.id, role: requester.role as UserRole },
        ],
        caseId: params.caseId,
        type: "case_resolution",
        title: "Case resolved",
        body: "Your case has been resolved.",
        suffix: "resolved",
      });
    }
  }

  if (params.fromStatus === "RESOLVED" && params.toStatus === "UNDER_REVIEW") {
    const recipients: { id: string; role: UserRole }[] = [];
    const { data: requester } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", params.requesterId)
      .maybeSingle();
    if (requester) {
      recipients.push({
        id: requester.id,
        role: requester.role as UserRole,
      });
    }
    if (params.assignedGroupId) {
      const { data: members } = await supabase
        .from("assignment_group_members")
        .select(
          "profile:profiles!assignment_group_members_user_id_fkey(id, role)"
        )
        .eq("group_id", params.assignedGroupId);
      for (const row of members ?? []) {
        const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
        if (profile) {
          recipients.push({
            id: profile.id,
            role: profile.role as UserRole,
          });
        }
      }
    }

    await notifyUsers({
      organizationId: params.organizationId,
      recipients,
      caseId: params.caseId,
      type: "case_reopening",
      title: "Case reopened",
      body: "A resolved case has been reopened.",
      suffix: "reopened",
    });
  }
}
