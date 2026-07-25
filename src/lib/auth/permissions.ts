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
    allowedRoles: ["operations_agent", "team_lead"],
  },
  {
    from: "UNDER_REVIEW",
    to: "PENDING_APPROVAL",
    allowedRoles: ["operations_agent", "team_lead"],
  },
  {
    from: "UNDER_REVIEW",
    to: "REJECTED",
    allowedRoles: ["operations_agent", "team_lead"],
    requiresComment: true,
  },
  {
    from: "UNDER_REVIEW",
    to: "WAITING_FOR_REQUESTER",
    allowedRoles: ["operations_agent", "team_lead"],
  },
  {
    from: "UNDER_REVIEW",
    to: "WAITING_FOR_EXTERNAL_PARTY",
    allowedRoles: ["operations_agent", "team_lead"],
  },
  {
    from: "WAITING_FOR_REQUESTER",
    to: "UNDER_REVIEW",
    allowedRoles: ["operations_agent", "team_lead", "requester"],
  },
  {
    from: "WAITING_FOR_EXTERNAL_PARTY",
    to: "UNDER_REVIEW",
    allowedRoles: ["operations_agent", "team_lead"],
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
    allowedRoles: ["operations_agent", "team_lead"],
  },
  {
    from: "RESOLVED",
    to: "UNDER_REVIEW",
    allowedRoles: ["operations_agent", "team_lead"],
    requiresComment: true,
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
  return (
    role === "operations_agent" ||
    role === "approver" ||
    role === "team_lead"
  );
}

export function canManageAssignmentGroups(role: UserRole): boolean {
  return role === "team_lead" || role === "operations_agent" || role === "approver";
}

export function canAcknowledgeCase(
  role: UserRole,
  assignedAgentId: string | null,
  userId: string
): boolean {
  return (
    (role === "operations_agent" || role === "team_lead") &&
    (assignedAgentId === null || assignedAgentId === userId)
  );
}

export function canCommentOnCase(role: UserRole): boolean {
  return (
    role === "requester" ||
    role === "operations_agent" ||
    role === "approver" ||
    role === "team_lead"
  );
}

export function canAccessAgentWorkspace(role: UserRole): boolean {
  return (
    role === "operations_agent" ||
    role === "team_lead" ||
    role === "approver"
  );
}
