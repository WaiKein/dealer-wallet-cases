import { evaluateMakerChecker } from "@/lib/approvals/maker-checker";
import { matchApprovalRule } from "@/lib/approvals/matching";
import { buildApprovalStepDrafts } from "@/lib/approvals/steps";
import {
  selectDelegation,
  type ApprovalDelegationRecord,
} from "@/lib/approvals/delegation";
import { getCorrelationId } from "@/lib/observability/correlation";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  ApprovalRule,
  Profile,
  UserRole,
} from "@/types";

type CaseRow = {
  id: string;
  organization_id: string | null;
  status: string;
  requester_id: string;
  assigned_agent_id: string | null;
  assigned_group_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  priority: string;
  adjustment_amount: number;
  version: number;
};

export async function createApprovalRequestForCase(params: {
  profile: Profile;
  caseRow: CaseRow;
}): Promise<
  ActionResult<{
    approvalRequestId: string;
    approvalRuleId: string | null;
    approvalRuleVersion: number | null;
  }>
> {
  const { profile, caseRow } = params;
  if (!caseRow.organization_id || !profile.organization_id) {
    return { success: false, error: "Missing organization.", code: "FORBIDDEN" };
  }
  if (caseRow.organization_id !== profile.organization_id) {
    return {
      success: false,
      error: "Case is outside your organization.",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();

  const { data: openRequest } = await supabase
    .from("approval_requests")
    .select("id, status")
    .eq("case_id", caseRow.id)
    .eq("status", "PENDING")
    .maybeSingle();

  if (openRequest) {
    return {
      success: true,
      data: {
        approvalRequestId: openRequest.id,
        approvalRuleId: null,
        approvalRuleVersion: null,
      },
    };
  }

  const { data: requester } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", caseRow.requester_id)
    .single();

  const { data: rules } = await supabase
    .from("approval_rules")
    .select("*")
    .eq("organization_id", caseRow.organization_id)
    .eq("is_active", true)
    .order("sequence", { ascending: true });

  const matched = matchApprovalRule((rules ?? []) as ApprovalRule[], {
    categoryId: caseRow.category_id,
    subcategoryId: caseRow.subcategory_id,
    amount: Number(caseRow.adjustment_amount),
    priority: caseRow.priority as never,
    requesterRole: (requester?.role as UserRole) ?? "requester",
    assignmentGroupId: caseRow.assigned_group_id,
  });

  const levels = matched?.approval_levels ?? 1;
  const sequential = matched?.sequential_required ?? true;
  const requiredRole = matched?.required_approver_role ?? "approver";
  const requiredTeamId = matched?.required_approver_team_id ?? null;
  const limit = matched?.approver_limit != null ? Number(matched.approver_limit) : null;

  const { data: request, error: requestError } = await supabase
    .from("approval_requests")
    .insert({
      organization_id: caseRow.organization_id,
      case_id: caseRow.id,
      approval_rule_id: matched?.id ?? null,
      approval_rule_version: matched?.version ?? null,
      approval_rule_code: matched?.code ?? null,
      status: "PENDING",
      requested_amount: caseRow.adjustment_amount,
      approval_levels: levels,
      sequential_required: sequential,
      required_approver_role: requiredRole,
      required_approver_team_id: requiredTeamId,
      approver_limit: limit,
      requested_by: profile.id,
      version: 1,
      correlation_id: getCorrelationId(),
    })
    .select("id")
    .single();

  if (requestError || !request) {
    return {
      success: false,
      error: requestError?.message ?? "Failed to create approval request.",
      code: "VALIDATION_ERROR",
    };
  }

  const stepDrafts = buildApprovalStepDrafts({
    levels,
    sequentialRequired: sequential,
    requiredRole,
    requiredTeamId,
  });

  const steps = stepDrafts.map((draft) => ({
    organization_id: caseRow.organization_id,
    approval_request_id: request.id,
    case_id: caseRow.id,
    level_no: draft.level_no,
    status: draft.status,
    required_role: draft.required_role,
    required_team_id: draft.required_team_id,
    version: 1,
    correlation_id: getCorrelationId(),
  }));

  const { error: stepsError } = await supabase.from("approval_steps").insert(steps);
  if (stepsError) {
    return {
      success: false,
      error: stepsError.message,
      code: "VALIDATION_ERROR",
    };
  }

  await supabase
    .from("cases")
    .update({
      approval_rule_id: matched?.id ?? null,
      approval_rule_version: matched?.version ?? null,
      current_approval_request_id: request.id,
    })
    .eq("id", caseRow.id);

  return {
    success: true,
    data: {
      approvalRequestId: request.id,
      approvalRuleId: matched?.id ?? null,
      approvalRuleVersion: matched?.version ?? null,
    },
  };
}

export async function decideApprovalForCase(params: {
  profile: Profile;
  caseRow: CaseRow;
  decision: "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  comment?: string | null;
  approvedAmount?: number | null;
  expectedApprovalVersion?: number | null;
}): Promise<
  ActionResult<{
    approvalRequestId: string;
    approvalStatus: string;
    caseStatus: "APPROVED" | "REJECTED" | "PENDING_APPROVAL";
    approvalVersion: number;
  }>
> {
  const { profile, caseRow } = params;
  if (!caseRow.organization_id || profile.organization_id !== caseRow.organization_id) {
    return {
      success: false,
      error: "Case is outside your organization.",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();
  const { data: request, error: requestError } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("case_id", caseRow.id)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (requestError) {
    return {
      success: false,
      error: requestError.message,
      code: "INTERNAL_ERROR",
    };
  }
  if (!request) {
    return {
      success: false,
      error: "No pending approval request for this case.",
      code: "VALIDATION_ERROR",
    };
  }

  const currentVersion = Number(request.version ?? 1);
  if (
    params.expectedApprovalVersion != null &&
    params.expectedApprovalVersion !== currentVersion
  ) {
    return {
      success: false,
      error: "This approval was updated by someone else. Refresh and retry.",
      code: "VERSION_CONFLICT",
      details: {
        expectedVersion: params.expectedApprovalVersion,
        actualVersion: currentVersion,
      },
    };
  }

  const { data: steps } = await supabase
    .from("approval_steps")
    .select("*")
    .eq("approval_request_id", request.id)
    .order("level_no", { ascending: true });

  const pendingStep = (steps ?? []).find((step) => step.status === "PENDING");
  if (!pendingStep) {
    return {
      success: false,
      error: "There is no pending approval step.",
      code: "VALIDATION_ERROR",
    };
  }

  if (
    pendingStep.status === "APPROVED" ||
    pendingStep.status === "REJECTED"
  ) {
    return {
      success: false,
      error: "This approval decision is immutable.",
      code: "CONFLICT",
    };
  }

  const requiredRole = (pendingStep.required_role ??
    request.required_approver_role) as UserRole | null;

  let actingAsDelegatorId: string | null = null;
  let effectiveLimit =
    request.approver_limit != null ? Number(request.approver_limit) : null;

  const directRoleOk =
    profile.role === "admin" ||
    !requiredRole ||
    profile.role === requiredRole;

  if (!directRoleOk) {
    const { data: roleHolders } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", caseRow.organization_id)
      .eq("role", requiredRole)
      .eq("is_active", true);

    const { data: delegations } = await supabase
      .from("approval_delegations")
      .select("*")
      .eq("organization_id", caseRow.organization_id)
      .eq("delegate_id", profile.id)
      .eq("is_active", true);

    const selected = selectDelegation({
      delegations: (delegations ?? []) as ApprovalDelegationRecord[],
      actorId: profile.id,
      allowedDelegatorIds: (roleHolders ?? []).map((row) => row.id),
      requestedAmount: Number(request.requested_amount),
    });

    if (!selected) {
      return {
        success: false,
        error: "You are not allowed to approve this request.",
        code: "FORBIDDEN",
      };
    }
    actingAsDelegatorId = selected.delegator_id;
    if (selected.approval_limit != null) {
      effectiveLimit =
        effectiveLimit == null
          ? Number(selected.approval_limit)
          : Math.min(effectiveLimit, Number(selected.approval_limit));
    }
  }

  const check = evaluateMakerChecker({
    actor: profile,
    caseRequesterId: caseRow.requester_id,
    caseAssignedAgentId: caseRow.assigned_agent_id,
    requiredRole: actingAsDelegatorId ? null : requiredRole,
    requestedAmount: Number(request.requested_amount),
    approvedAmount: params.approvedAmount,
    approverLimit: request.approver_limit != null ? Number(request.approver_limit) : null,
    effectiveLimit,
    isRejection: params.decision === "REJECTED",
    rejectionReason: params.rejectionReason,
    actingAsDelegatorId,
  });

  if (!check.ok) {
    return { success: false, error: check.message, code: "FORBIDDEN" };
  }

  if (pendingStep.required_team_id) {
    const { data: membership } = await supabase
      .from("assignment_group_members")
      .select("id")
      .eq("group_id", pendingStep.required_team_id)
      .eq("user_id", actingAsDelegatorId ?? profile.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership && profile.role !== "admin") {
      return {
        success: false,
        error: "You are not a member of the required approver team.",
        code: "FORBIDDEN",
      };
    }
  }

  const nextStepVersion = Number(pendingStep.version ?? 1) + 1;
  const { data: stepped, error: stepUpdateError } = await supabase
    .from("approval_steps")
    .update({
      status: params.decision === "APPROVED" ? "APPROVED" : "REJECTED",
      decided_by: profile.id,
      decided_as_delegate_of: actingAsDelegatorId,
      decision_comment: params.comment ?? null,
      rejection_reason:
        params.decision === "REJECTED" ? params.rejectionReason?.trim() ?? null : null,
      version: nextStepVersion,
      decided_at: new Date().toISOString(),
      correlation_id: getCorrelationId(),
    })
    .eq("id", pendingStep.id)
    .eq("version", pendingStep.version)
    .eq("status", "PENDING")
    .select("id");

  if (stepUpdateError || !stepped?.length) {
    return {
      success: false,
      error: "This approval step was updated by someone else. Refresh and retry.",
      code: "VERSION_CONFLICT",
    };
  }

  if (params.decision === "REJECTED") {
    const nextRequestVersion = currentVersion + 1;
    const { data: updatedRequest, error } = await supabase
      .from("approval_requests")
      .update({
        status: "REJECTED",
        decided_by: profile.id,
        rejection_reason: params.rejectionReason?.trim() ?? null,
        version: nextRequestVersion,
        completed_at: new Date().toISOString(),
        correlation_id: getCorrelationId(),
      })
      .eq("id", request.id)
      .eq("version", currentVersion)
      .eq("status", "PENDING")
      .select("id, version")
      .single();

    if (error || !updatedRequest) {
      return {
        success: false,
        error: "Approval request conflict. Refresh and retry.",
        code: "VERSION_CONFLICT",
      };
    }

    return {
      success: true,
      data: {
        approvalRequestId: request.id,
        approvalStatus: "REJECTED",
        caseStatus: "REJECTED",
        approvalVersion: Number(updatedRequest.version),
      },
    };
  }

  // APPROVED path — advance sequential levels or complete request
  const remaining = (steps ?? []).filter(
    (step) => step.id !== pendingStep.id && step.status !== "APPROVED"
  );
  const nextSkipped = remaining
    .filter((step) => step.status === "SKIPPED")
    .sort((a, b) => a.level_no - b.level_no)[0];

  if (nextSkipped && request.sequential_required) {
    await supabase
      .from("approval_steps")
      .update({ status: "PENDING", correlation_id: getCorrelationId() })
      .eq("id", nextSkipped.id)
      .eq("status", "SKIPPED");

    const nextRequestVersion = currentVersion + 1;
    const { data: updatedRequest, error } = await supabase
      .from("approval_requests")
      .update({
        version: nextRequestVersion,
        correlation_id: getCorrelationId(),
      })
      .eq("id", request.id)
      .eq("version", currentVersion)
      .select("id, version")
      .single();

    if (error || !updatedRequest) {
      return {
        success: false,
        error: "Approval request conflict. Refresh and retry.",
        code: "VERSION_CONFLICT",
      };
    }

    return {
      success: true,
      data: {
        approvalRequestId: request.id,
        approvalStatus: "PENDING",
        caseStatus: "PENDING_APPROVAL",
        approvalVersion: Number(updatedRequest.version),
      },
    };
  }

  const stillPending = (steps ?? []).some(
    (step) =>
      step.id !== pendingStep.id &&
      (step.status === "PENDING" || step.status === "SKIPPED")
  );

  if (stillPending && !request.sequential_required) {
    const nextRequestVersion = currentVersion + 1;
    await supabase
      .from("approval_requests")
      .update({
        version: nextRequestVersion,
        correlation_id: getCorrelationId(),
      })
      .eq("id", request.id)
      .eq("version", currentVersion);

    return {
      success: true,
      data: {
        approvalRequestId: request.id,
        approvalStatus: "PENDING",
        caseStatus: "PENDING_APPROVAL",
        approvalVersion: nextRequestVersion,
      },
    };
  }

  const approvedAmount =
    params.approvedAmount == null
      ? Number(request.requested_amount)
      : Number(params.approvedAmount);

  const nextRequestVersion = currentVersion + 1;
  const { data: updatedRequest, error } = await supabase
    .from("approval_requests")
    .update({
      status: "APPROVED",
      approved_amount: approvedAmount,
      decided_by: profile.id,
      version: nextRequestVersion,
      completed_at: new Date().toISOString(),
      correlation_id: getCorrelationId(),
    })
    .eq("id", request.id)
    .eq("version", currentVersion)
    .eq("status", "PENDING")
    .select("id, version")
    .single();

  if (error || !updatedRequest) {
    return {
      success: false,
      error: "Approval request conflict. Refresh and retry.",
      code: "VERSION_CONFLICT",
    };
  }

  return {
    success: true,
    data: {
      approvalRequestId: request.id,
      approvalStatus: "APPROVED",
      caseStatus: "APPROVED",
      approvalVersion: Number(updatedRequest.version),
    },
  };
}

export async function getLatestApprovalForCase(caseId: string) {
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!request) {
    return { request: null, steps: [] as Record<string, unknown>[] };
  }

  const { data: steps } = await supabase
    .from("approval_steps")
    .select("*")
    .eq("approval_request_id", request.id)
    .order("level_no", { ascending: true });

  return { request, steps: steps ?? [] };
}

export async function listPendingApprovals(profile: Profile): Promise<
  ActionResult<{
    items: Array<{
      request: Record<string, unknown>;
      steps: Record<string, unknown>[];
      case: Record<string, unknown> | null;
    }>;
  }>
> {
  if (
    profile.role !== "approver" &&
    profile.role !== "team_lead" &&
    profile.role !== "admin"
  ) {
    return { success: false, error: "Not allowed.", code: "FORBIDDEN" };
  }

  if (!profile.organization_id) {
    return { success: false, error: "Organization required.", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select(
      `
      *,
      case:cases (
        id,
        case_number,
        title,
        status,
        adjustment_amount,
        priority,
        requester_id,
        assigned_agent_id
      ),
      steps:approval_steps (*)
    `
    )
    .eq("organization_id", profile.organization_id)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message, code: "VALIDATION_ERROR" };
  }

  const items = (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const caseRow = Array.isArray(record.case) ? record.case[0] : record.case;
    const steps = Array.isArray(record.steps) ? record.steps : [];
    return {
      request: record,
      steps: steps as Record<string, unknown>[],
      case: (caseRow as Record<string, unknown> | undefined) ?? null,
    };
  });

  return { success: true, data: { items } };
}
