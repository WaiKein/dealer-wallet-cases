import { canTransition } from "@/lib/auth/permissions";
import { recordAuditEntry } from "@/lib/cases/audit";
import { enqueueSlaRefresh } from "@/lib/jobs/domain-enqueue";
import { notifyUsers } from "@/lib/notifications/service";
import {
  completeSla,
  syncResolutionSlaForStatus,
} from "@/lib/sla/service";
import { createClient } from "@/lib/supabase/server";
import {
  statusTransitionSchema,
  type StatusTransitionInput,
} from "@/lib/validations/case";
import type { ActionResult, CaseStatus, Profile, UserRole } from "@/types";

export async function executeTransition(
  profile: Profile,
  input: StatusTransitionInput
): Promise<ActionResult<{ version: number }>> {
  const parsed = statusTransitionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid transition data.",
      code: "VALIDATION_ERROR",
    };
  }

  const supabase = await createClient();
  const { data: existingCase, error: fetchError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", parsed.data.caseId)
    .single();

  if (fetchError || !existingCase) {
    return { success: false, error: "Case not found.", code: "NOT_FOUND" };
  }

  if (
    profile.organization_id &&
    existingCase.organization_id !== profile.organization_id
  ) {
    return {
      success: false,
      error: "Case is outside your organization.",
      code: "FORBIDDEN",
    };
  }

  const currentVersion = Number(existingCase.version ?? 1);
  if (
    parsed.data.expectedVersion != null &&
    parsed.data.expectedVersion !== currentVersion
  ) {
    return {
      success: false,
      error: "This record was updated by someone else. Refresh and retry.",
      code: "VERSION_CONFLICT",
      details: {
        expectedVersion: parsed.data.expectedVersion,
        actualVersion: currentVersion,
      },
    };
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
      code: "FORBIDDEN",
    };
  }

  if (transition.requiresComment && !parsed.data.comment?.trim()) {
    return {
      success: false,
      error: "A comment is required for this action.",
      code: "VALIDATION_ERROR",
    };
  }

  const nextVersion = currentVersion + 1;
  const updatePayload: Record<string, unknown> = {
    status: parsed.data.nextStatus,
    version: nextVersion,
  };

  if (parsed.data.nextStatus === "UNDER_REVIEW") {
    updatePayload.assigned_agent_id =
      existingCase.assigned_agent_id ?? profile.id;
  }

  if (
    parsed.data.nextStatus === "APPROVED" ||
    parsed.data.nextStatus === "REJECTED"
  ) {
    updatePayload.approver_id = profile.id;
  }

  if (parsed.data.nextStatus === "REJECTED") {
    updatePayload.rejection_reason = parsed.data.rejection_reason?.trim();
  }

  if (parsed.data.nextStatus === "RESOLVED") {
    updatePayload.resolution_notes = parsed.data.resolution_notes?.trim();
  }

  let updateQuery = supabase
    .from("cases")
    .update(updatePayload)
    .eq("id", parsed.data.caseId)
    .eq("version", currentVersion)
    .select("id, version");

  const { data: updatedRows, error: updateError } = await updateQuery;

  if (updateError) {
    return {
      success: false,
      error: "Failed to update case.",
      code: "INTERNAL_ERROR",
    };
  }

  if (!updatedRows?.length) {
    return {
      success: false,
      error: "This record was updated by someone else. Refresh and retry.",
      code: "VERSION_CONFLICT",
      details: { expectedVersion: currentVersion },
    };
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
    metadata: { version: nextVersion },
  });

  if (auditError) {
    return { success: false, error: auditError, code: "INTERNAL_ERROR" };
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

    await enqueueSlaRefresh({
      organizationId: existingCase.organization_id,
      caseId: parsed.data.caseId,
      priority: existingCase.priority,
      assignedGroupId: existingCase.assigned_group_id,
      actorId: profile.id,
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

  return { success: true, data: { version: nextVersion } };
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
        recipients: [{ id: requester.id, role: requester.role as UserRole }],
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
        const memberProfile = Array.isArray(row.profile)
          ? row.profile[0]
          : row.profile;
        if (memberProfile) {
          recipients.push({
            id: memberProfile.id,
            role: memberProfile.role as UserRole,
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
