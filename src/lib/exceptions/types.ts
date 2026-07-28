export type ExceptionQueueType =
  | "integration_failed_final"
  | "integration_retry_pending"
  | "integration_unknown"
  | "approval_expired"
  | "approval_rejected"
  | "sla_breached"
  | "unassigned_case"
  | "duplicate_transaction_suspected"
  | "manual_reconciliation_required"
  | "dead_letter_job";

export type ExceptionItemStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "ESCALATED"
  | "RESOLVED"
  | "DISMISSED";

export const EXCEPTION_QUEUE_LABELS: Record<ExceptionQueueType, string> = {
  integration_failed_final: "Integration failed permanently",
  integration_retry_pending: "Integration retry pending",
  integration_unknown: "Integration result unknown",
  approval_expired: "Approval expired",
  approval_rejected: "Approval rejected",
  sla_breached: "SLA breached",
  unassigned_case: "Unassigned case",
  duplicate_transaction_suspected: "Duplicate transaction suspected",
  manual_reconciliation_required: "Manual reconciliation required",
  dead_letter_job: "Dead-letter background job",
};

export const OPEN_EXCEPTION_STATUSES: ExceptionItemStatus[] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "ESCALATED",
];

export interface OperationalException {
  id: string;
  organization_id: string;
  queue_type: ExceptionQueueType;
  status: ExceptionItemStatus;
  case_id: string | null;
  execution_id: string | null;
  job_id: string | null;
  source_ref: string;
  title: string | null;
  failure_category: string | null;
  assigned_owner_id: string | null;
  reconciliation_required: boolean;
  last_internal_note: string | null;
  resolution_note: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  version: number;
  correlation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExceptionQueueRow extends OperationalException {
  case_number?: string | null;
  case_title?: string | null;
  account_id?: string | null;
  requested_amount?: number | null;
  approved_amount?: number | null;
  case_status?: string | null;
  execution_status?: string | null;
  assigned_group_name?: string | null;
  assigned_agent_name?: string | null;
  last_attempt_at?: string | null;
  next_retry_at?: string | null;
  external_transaction_ref?: string | null;
  execution_correlation_id?: string | null;
  case_created_at?: string | null;
}
