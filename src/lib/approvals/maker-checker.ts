import type { ApprovalRule, Profile, UserRole } from "@/types";

export type MakerCheckerDenialCode =
  | "SELF_APPROVAL_REQUESTER"
  | "SELF_APPROVAL_CREATOR"
  | "MAKER_CHECKER_ASSIGNED_AGENT"
  | "ROLE_NOT_ALLOWED"
  | "ORG_MISMATCH"
  | "AMOUNT_EXCEEDS_LIMIT"
  | "APPROVED_AMOUNT_INVALID"
  | "REJECTION_REASON_REQUIRED"
  | "DECISION_IMMUTABLE"
  | "NO_ACTIVE_STEP"
  | "DELEGATION_INVALID";

export function evaluateMakerChecker(params: {
  actor: Profile;
  caseRequesterId: string;
  caseAssignedAgentId: string | null;
  requiredRole: UserRole | null;
  requestedAmount: number;
  approvedAmount?: number | null;
  approverLimit?: number | null;
  effectiveLimit?: number | null;
  isRejection: boolean;
  rejectionReason?: string | null;
  actingAsDelegatorId?: string | null;
}): { ok: true } | { ok: false; code: MakerCheckerDenialCode; message: string } {
  const { actor } = params;

  if (!actor.organization_id) {
    return {
      ok: false,
      code: "ORG_MISMATCH",
      message: "Your account is not linked to an organization.",
    };
  }

  if (actor.id === params.caseRequesterId) {
    return {
      ok: false,
      code: "SELF_APPROVAL_REQUESTER",
      message: "A requester cannot approve their own case.",
    };
  }

  // Creator is the requester in this domain model.
  if (actor.id === params.caseRequesterId) {
    return {
      ok: false,
      code: "SELF_APPROVAL_CREATOR",
      message: "A case creator cannot approve their own request.",
    };
  }

  if (
    params.caseAssignedAgentId &&
    actor.id === params.caseAssignedAgentId
  ) {
    return {
      ok: false,
      code: "MAKER_CHECKER_ASSIGNED_AGENT",
      message:
        "The assigned operations agent cannot approve this case (maker-checker).",
    };
  }

  const effectiveRole = params.actingAsDelegatorId
    ? params.requiredRole
    : actor.role;

  if (
    params.requiredRole &&
    !params.actingAsDelegatorId &&
    actor.role !== params.requiredRole &&
    actor.role !== "admin"
  ) {
    return {
      ok: false,
      code: "ROLE_NOT_ALLOWED",
      message: "You do not have the required approver role.",
    };
  }

  if (params.actingAsDelegatorId && params.requiredRole && effectiveRole) {
    // Delegation path: required role is checked against delegator at call site.
  }

  const limit =
    params.effectiveLimit != null
      ? Number(params.effectiveLimit)
      : params.approverLimit != null
        ? Number(params.approverLimit)
        : null;

  if (limit != null && params.requestedAmount > limit) {
    return {
      ok: false,
      code: "AMOUNT_EXCEEDS_LIMIT",
      message: "This amount exceeds the configured approval limit.",
    };
  }

  if (!params.isRejection) {
    const approved =
      params.approvedAmount == null
        ? params.requestedAmount
        : Number(params.approvedAmount);
    if (approved > params.requestedAmount) {
      return {
        ok: false,
        code: "APPROVED_AMOUNT_INVALID",
        message: "Approved amount cannot exceed the requested amount.",
      };
    }
    if (approved <= 0) {
      return {
        ok: false,
        code: "APPROVED_AMOUNT_INVALID",
        message: "Approved amount must be greater than zero.",
      };
    }
  }

  if (params.isRejection && !params.rejectionReason?.trim()) {
    return {
      ok: false,
      code: "REJECTION_REASON_REQUIRED",
      message: "A rejection reason is required.",
    };
  }

  return { ok: true };
}

export function ruleLimit(rule: ApprovalRule | null): number | null {
  if (!rule || rule.approver_limit == null) return null;
  return Number(rule.approver_limit);
}
