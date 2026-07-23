export type UserRole = "requester" | "operations_agent" | "approver";

export type CaseStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "RESOLVED";

export type AdjustmentType = "credit" | "debit";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface CaseRecord {
  id: string;
  case_number: string;
  title: string;
  description: string;
  dealer_id: string;
  wallet_id: string;
  adjustment_amount: number;
  adjustment_type: AdjustmentType;
  currency: string;
  status: CaseStatus;
  requester_id: string;
  assigned_agent_id: string | null;
  approver_id: string | null;
  rejection_reason: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseAuditEntry {
  id: string;
  case_id: string;
  from_status: CaseStatus | null;
  to_status: CaseStatus;
  changed_by: string;
  comment: string | null;
  created_at: string;
}

export interface CaseWithRelations extends CaseRecord {
  requester?: Pick<Profile, "id" | "full_name" | "email">;
  assigned_agent?: Pick<Profile, "id" | "full_name" | "email"> | null;
  approver?: Pick<Profile, "id" | "full_name" | "email"> | null;
  audit_history?: CaseAuditEntry[];
}

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
