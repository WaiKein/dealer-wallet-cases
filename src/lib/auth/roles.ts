import type { CaseStatus, UserRole } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  requester: "Requester",
  operations_agent: "Operations Agent",
  approver: "Approver",
  team_lead: "Team Lead",
};

export const STATUS_LABELS: Record<CaseStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  WAITING_FOR_REQUESTER: "Waiting for requester",
  WAITING_FOR_EXTERNAL_PARTY: "Waiting for external party",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
};

export const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
} as const;

export function isUserRole(value: string): value is UserRole {
  return [
    "requester",
    "operations_agent",
    "approver",
    "team_lead",
  ].includes(value);
}

export function isCaseStatus(value: string): value is CaseStatus {
  return [
    "SUBMITTED",
    "UNDER_REVIEW",
    "WAITING_FOR_REQUESTER",
    "WAITING_FOR_EXTERNAL_PARTY",
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "RESOLVED",
  ].includes(value);
}
