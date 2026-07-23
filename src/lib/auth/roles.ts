import type { CaseStatus, UserRole } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  requester: "Requester",
  operations_agent: "Operations Agent",
  approver: "Approver",
};

export const STATUS_LABELS: Record<CaseStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
};

export function isUserRole(value: string): value is UserRole {
  return ["requester", "operations_agent", "approver"].includes(value);
}

export function isCaseStatus(value: string): value is CaseStatus {
  return [
    "SUBMITTED",
    "UNDER_REVIEW",
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "RESOLVED",
  ].includes(value);
}
