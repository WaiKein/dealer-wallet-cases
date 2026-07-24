import type { CaseStatus, UserRole } from "@/types";

export interface StatusTransition {
  from: CaseStatus;
  to: CaseStatus;
  allowedRoles: UserRole[];
  requiresComment?: boolean;
}

export const STATUS_TRANSITIONS: StatusTransition[] = [
  {
    from: "SUBMITTED",
    to: "UNDER_REVIEW",
    allowedRoles: ["operations_agent"],
  },
  {
    from: "UNDER_REVIEW",
    to: "PENDING_APPROVAL",
    allowedRoles: ["operations_agent"],
  },
  {
    from: "UNDER_REVIEW",
    to: "REJECTED",
    allowedRoles: ["operations_agent"],
    requiresComment: true,
  },
  {
    from: "PENDING_APPROVAL",
    to: "APPROVED",
    allowedRoles: ["approver"],
  },
  {
    from: "PENDING_APPROVAL",
    to: "REJECTED",
    allowedRoles: ["approver"],
    requiresComment: true,
  },
  {
    from: "APPROVED",
    to: "RESOLVED",
    allowedRoles: ["operations_agent"],
  },
];

export function getAvailableTransitions(
  currentStatus: CaseStatus,
  role: UserRole
): StatusTransition[] {
  return STATUS_TRANSITIONS.filter(
    (transition) =>
      transition.from === currentStatus &&
      transition.allowedRoles.includes(role)
  );
}

export function canTransition(
  currentStatus: CaseStatus,
  nextStatus: CaseStatus,
  role: UserRole
): StatusTransition | null {
  return (
    STATUS_TRANSITIONS.find(
      (transition) =>
        transition.from === currentStatus &&
        transition.to === nextStatus &&
        transition.allowedRoles.includes(role)
    ) ?? null
  );
}

export function canCreateCase(role: UserRole): boolean {
  return role === "requester";
}

export function canViewAllCases(role: UserRole): boolean {
  return role === "operations_agent" || role === "approver";
}

export function canAssignAgent(role: UserRole, status: CaseStatus): boolean {
  return (
    role === "operations_agent" &&
    (status === "SUBMITTED" || status === "UNDER_REVIEW")
  );
}

export function canCommentOnCase(role: UserRole): boolean {
  return (
    role === "requester" ||
    role === "operations_agent" ||
    role === "approver"
  );
}
