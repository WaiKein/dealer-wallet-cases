import { canTransition } from "@/lib/auth/permissions";
import {
  createApprovalRequestForCase,
  decideApprovalForCase,
} from "@/lib/approvals/service";
import { recordAuditEntry } from "@/lib/cases/audit";
import {
  assertExecutionAllowsResolve,
  createExecutionForApprovedCase,
} from "@/lib/executions/service";
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
): Promise<ActionResult<{ version: number; approvalStatus?: string }>> {
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

  if (
    parsed.data.nextStatus === "RESOLVED" &&
    existingCase.organization_id
  ) {
    const gate = await assertExecutionAllowsResolve({
      organizationId: existingCase.organization_id,
      caseId: existingCase.id,
    });
    if (!gate.success) {
      return {
        success: false,
        error: gate.error ?? "Execution required before resolve.",
        code: gate.code ?? "EXECUTION_REQUIRED",
        details: gate.details,
      };
    }
  }

  let effectiveNextStatus = parsed.data.nextStatus;
  let approvalStatus: string | undefined;
  let decidedApprovalRequestId: string | undefined;

  if (
    existingCase.status === "PENDING_APPROVAL" &&
    (parsed.data.nextStatus === "APPROVED" ||
      parsed.data.nextStatus === "REJECTED")
  ) {
    const decision = await decideApprovalForCase({
      profile,
      caseRow: {
        id: existingCase.id,
        organization_id: existingCase.organization_id,
        status: existingCase.status,
        requester_id: existingCase.requester_id,
        assigned_agent_id: existingCase.assigned_agent_id,
        assigned_group_id: existingCase.assigned_group_id,
        category_id: existingCase.category_id,
        subcategory_id: existingCase.subcategory_id,
        priority: existingCase.priority,
        adjustment_amount: Number(existingCase.adjustment_amount),
        version: currentVersion,
      },
      decision: parsed.data.nextStatus,
      rejectionReason: parsed.data.rejection_reason,
      comment: parsed.data.comment,
      approvedAmount: parsed.data.approved_amount,
      expectedApprovalVersion: parsed.data.expectedApprovalVersion,
    });

    if (!decision.success || !decision.data) {
      return {
        success: false,
        error: decision.error ?? "Approval decision failed.",
        code: decision.code,
        details: decision.details,
      };
    }

    effectiveNextStatus = decision.data.caseStatus;
    approvalStatus = decision.data.approvalStatus;
    decidedApprovalRequestId = decision.data.approvalRequestId;
  }

  const nextVersion = currentVersion + 1;
  const updatePayload: Record<string, unknown> = {
    status: effectiveNextStatus,
    version: nextVersion,
  };

  if (effectiveNextStatus === "UNDER_REVIEW") {
    updatePayload.assigned_agent_id =
      existingCase.assigned_agent_id ?? profile.id;
  }

  if (
    effectiveNextStatus === "APPROVED" ||
    effectiveNextStatus === "REJECTED"
  ) {
    updatePayload.approver_id = profile.id;
  }

  if (effectiveNextStatus === "REJECTED") {
    updatePayload.rejection_reason = parsed.data.rejection_reason?.trim();
  }

  if (effectiveNextStatus === "RESOLVED") {
    updatePayload.resolution_notes = parsed.data.resolution_notes?.trim();
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("cases")
    .update(updatePayload)
    .eq("id", parsed.data.caseId)
    .eq("version", currentVersion)
    .select("id, version");

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

  if (effectiveNextStatus === "PENDING_APPROVAL") {
    const created = await createApprovalRequestForCase({
      profile,
      caseRow: {
        id: existingCase.id,
        organization_id: existingCase.organization_id,
        status: effectiveNextStatus,
        requester_id: existingCase.requester_id,
        assigned_agent_id: existingCase.assigned_agent_id,
        assigned_group_id: existingCase.assigned_group_id,
        category_id: existingCase.category_id,
        subcategory_id: existingCase.subcategory_id,
        priority: existingCase.priority,
        adjustment_amount: Number(existingCase.adjustment_amount),
        version: nextVersion,
      },
    });
    if (!created.success) {
      return {
        success: false,
        error: created.error ?? "Failed to create approval request.",
        code: created.code,
      };
    }
  }

  if (
    effectiveNextStatus === "REJECTED" &&
    existingCase.organization_id &&
    existingCase.status !== "REJECTED"
  ) {
    const { upsertOperationalException } = await import(
      "@/lib/exceptions/sync"
    );
    await upsertOperationalException({
      organizationId: existingCase.organization_id,
      queueType: "approval_rejected",
      sourceRef: `case:${existingCase.id}:approval_rejected`,
      caseId: existingCase.id,
      title: existingCase.title ?? "Approval rejected",
      failureCategory: "approval_rejected",
    });
  }

  if (
    effectiveNextStatus === "APPROVED" &&
    existingCase.organization_id &&
    existingCase.status !== "APPROVED"
  ) {
    const requestId =
      decidedApprovalRequestId ??
      existingCase.current_approval_request_id ??
      null;

    let approvalRequest: {
      id: string;
      requested_amount: number;
      approved_amount: number | null;
    } | null = null;

    if (requestId) {
      const { data } = await supabase
        .from("approval_requests")
        .select("id, requested_amount, approved_amount")
        .eq("id", requestId)
        .maybeSingle();
      approvalRequest = data;
    }

    if (!approvalRequest) {
      const { data } = await supabase
        .from("approval_requests")
        .select("id, requested_amount, approved_amount")
        .eq("case_id", existingCase.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      approvalRequest = data;
    }

    if (!approvalRequest) {
      return {
        success: false,
        error: "Approved case is missing an approval request for execution.",
        code: "INTERNAL_ERROR",
      };
    }

    const execution = await createExecutionForApprovedCase({
      caseRow: {
        id: existingCase.id,
        organization_id: existingCase.organization_id,
        dealer_id: existingCase.dealer_id,
        wallet_id: existingCase.wallet_id,
        adjustment_amount: Number(existingCase.adjustment_amount),
        adjustment_type: existingCase.adjustment_type,
        currency: existingCase.currency ?? "USD",
        current_approval_request_id: approvalRequest.id,
        requester_id: existingCase.requester_id,
        assigned_agent_id: existingCase.assigned_agent_id,
      },
      approvalRequestId: approvalRequest.id,
      requestedAmount: Number(approvalRequest.requested_amount),
      approvedAmount: Number(
        approvalRequest.approved_amount ?? approvalRequest.requested_amount
      ),
    });
    if (!execution.success) {
      return {
        success: false,
        error: execution.error ?? "Failed to queue wallet execution.",
        code: execution.code ?? "INTERNAL_ERROR",
      };
    }
  }

  const eventType =
    existingCase.status === "RESOLVED" &&
    effectiveNextStatus === "UNDER_REVIEW"
      ? "case_reopened"
      : "status_change";

  const auditError = await recordAuditEntry({
    caseId: parsed.data.caseId,
    eventType,
    fromStatus: existingCase.status,
    toStatus: effectiveNextStatus,
    changedBy: profile.id,
    comment:
      parsed.data.comment?.trim() ??
      parsed.data.rejection_reason?.trim() ??
      parsed.data.resolution_notes?.trim(),
    metadata: {
      version: nextVersion,
      approvalStatus,
      requestedStatus: parsed.data.nextStatus,
    },
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
      toStatus: effectiveNextStatus,
      actorId: profile.id,
    });

    if (
      effectiveNextStatus === "RESOLVED" ||
      effectiveNextStatus === "REJECTED"
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
    toStatus: effectiveNextStatus,
    requesterId: existingCase.requester_id,
    assignedGroupId: existingCase.assigned_group_id,
    assignedAgentId: existingCase.assigned_agent_id,
    actor: profile,
  });

  return {
    success: true,
    data: { version: nextVersion, approvalStatus },
  };
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
      emailEventType: "approval_requested",
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
      emailEventType:
        params.toStatus === "APPROVED"
          ? "approval_approved"
          : "approval_rejected",
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
        emailEventType: "case_resolved",
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
      emailEventType: "case_reopened",
    });
  }
}
