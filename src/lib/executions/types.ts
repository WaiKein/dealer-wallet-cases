import type { WalletAdjustmentOutcomeCode } from "@/lib/wallet/types";

export type IntegrationExecutionStatus =
  | "NOT_STARTED"
  | "QUEUED"
  | "IN_PROGRESS"
  | "SUCCEEDED"
  | "FAILED_RETRYABLE"
  | "FAILED_FINAL"
  | "UNKNOWN"
  | "CANCELLED";

export type IntegrationAttemptKind = "execute" | "status_inquiry";

export type FailureCategory =
  | "temporary"
  | "permanent"
  | "timeout_confirmed"
  | "timeout_uncertain"
  | "duplicate"
  | "delayed"
  | "unknown"
  | "malformed"
  | "validation";

export interface CaseIntegrationExecution {
  id: string;
  organization_id: string;
  case_id: string;
  approval_request_id: string;
  provider: string;
  operation: string;
  status: IntegrationExecutionStatus;
  idempotency_key: string;
  request_hash: string;
  correlation_id: string | null;
  internal_request_ref: string | null;
  external_transaction_ref: string | null;
  requested_amount: number;
  approved_amount: number;
  account_id: string;
  reference_id: string;
  currency: string;
  adjustment_type: "credit" | "debit";
  attempt_count: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  response_code: string | null;
  sanitised_response_summary: string | null;
  failure_category: string | null;
  failure_message: string | null;
  unknown_result_reason: string | null;
  requires_status_inquiry: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CaseIntegrationAttempt {
  id: string;
  organization_id: string;
  execution_id: string;
  attempt_no: number;
  kind: IntegrationAttemptKind;
  started_at: string;
  completed_at: string | null;
  outcome: string | null;
  processing_certainty: string | null;
  response_code: string | null;
  sanitised_error: string | null;
  correlation_id: string | null;
  worker_job_id: string | null;
  created_at: string;
}

export function mapExecuteOutcomeToExecution(params: {
  outcome: WalletAdjustmentOutcomeCode;
  requiresStatusInquiry: boolean;
}): {
  status: IntegrationExecutionStatus;
  failureCategory: FailureCategory | null;
  requiresStatusInquiry: boolean;
  scheduleExecuteRetry: boolean;
  scheduleStatusInquiry: boolean;
} {
  switch (params.outcome) {
    case "SUCCESS":
    case "DUPLICATE_REQUEST":
      return {
        status: "SUCCEEDED",
        failureCategory: params.outcome === "DUPLICATE_REQUEST" ? "duplicate" : null,
        requiresStatusInquiry: false,
        scheduleExecuteRetry: false,
        scheduleStatusInquiry: false,
      };
    case "TEMPORARY_FAILURE":
      return {
        status: "FAILED_RETRYABLE",
        failureCategory: "temporary",
        requiresStatusInquiry: false,
        scheduleExecuteRetry: true,
        scheduleStatusInquiry: false,
      };
    case "TIMEOUT_BEFORE_PROCESSING":
      return {
        status: "FAILED_RETRYABLE",
        failureCategory: "timeout_confirmed",
        requiresStatusInquiry: false,
        scheduleExecuteRetry: true,
        scheduleStatusInquiry: false,
      };
    case "PERMANENT_FAILURE":
      return {
        status: "FAILED_FINAL",
        failureCategory: "permanent",
        requiresStatusInquiry: false,
        scheduleExecuteRetry: false,
        scheduleStatusInquiry: false,
      };
    case "TIMEOUT_AFTER_POSSIBLE_PROCESSING":
      return {
        status: "UNKNOWN",
        failureCategory: "timeout_uncertain",
        requiresStatusInquiry: true,
        scheduleExecuteRetry: false,
        scheduleStatusInquiry: true,
      };
    case "DELAYED_COMPLETION":
      return {
        status: "UNKNOWN",
        failureCategory: "delayed",
        requiresStatusInquiry: true,
        scheduleExecuteRetry: false,
        scheduleStatusInquiry: true,
      };
    case "UNKNOWN_RESULT":
      return {
        status: "UNKNOWN",
        failureCategory: "unknown",
        requiresStatusInquiry: true,
        scheduleExecuteRetry: false,
        scheduleStatusInquiry: true,
      };
    case "MALFORMED_RESPONSE":
      return {
        status: "UNKNOWN",
        failureCategory: "malformed",
        requiresStatusInquiry: true,
        scheduleExecuteRetry: false,
        scheduleStatusInquiry: true,
      };
    default: {
      const _exhaustive: never = params.outcome;
      return _exhaustive;
    }
  }
}
