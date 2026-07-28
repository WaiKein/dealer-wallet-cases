/**
 * Wallet adjustment provider contracts.
 * Domain code depends on this interface — never on a specific vendor SDK.
 */

export type WalletAdjustmentOutcomeCode =
  | "SUCCESS"
  | "TEMPORARY_FAILURE"
  | "PERMANENT_FAILURE"
  | "TIMEOUT_BEFORE_PROCESSING"
  | "TIMEOUT_AFTER_POSSIBLE_PROCESSING"
  | "DUPLICATE_REQUEST"
  | "DELAYED_COMPLETION"
  | "UNKNOWN_RESULT"
  | "MALFORMED_RESPONSE";

export type WalletStatusInquiryOutcomeCode =
  | "STATUS_SUCCESS"
  | "STATUS_NOT_FOUND"
  | "STATUS_TEMPORARY_FAILURE"
  | "STATUS_UNKNOWN";

export type WalletProcessingCertainty =
  | "NOT_PROCESSED"
  | "PROCESSED"
  | "UNCERTAIN";

export interface WalletAdjustmentCommand {
  idempotencyKey: string;
  correlationId: string;
  caseId: string;
  approvalRequestId: string;
  organizationId: string;
  requestedAmount: number;
  approvedAmount: number;
  /** Account ID (dealer / system account). */
  accountId: string;
  /** External reference ID. */
  referenceId: string;
  currency: string;
  adjustmentType: "credit" | "debit";
  /** Canonical hash of the financial request payload. */
  requestHash: string;
}

export interface WalletAdjustmentResult {
  outcome: WalletAdjustmentOutcomeCode;
  processingCertainty: WalletProcessingCertainty;
  /** Provider-side transaction / reference when known. */
  externalTransactionRef: string | null;
  /** Echo of our idempotency key. */
  idempotencyKey: string;
  responseCode: string | null;
  /** Sanitised summary — never include secrets or full account numbers. */
  sanitisedMessage: string;
  /** Raw provider payload omitted/redacted for logging. */
  retryable: boolean;
  /** When true, a later status inquiry is required before any retry. */
  requiresStatusInquiry: boolean;
  completed: boolean;
}

export interface WalletAdjustmentStatusRequest {
  organizationId: string;
  caseId: string;
  approvalRequestId: string;
  idempotencyKey: string;
  requestHash: string;
  correlationId: string;
  externalTransactionRef?: string | null;
  accountId: string;
  referenceId: string;
}

export interface WalletAdjustmentStatusResult {
  outcome: WalletStatusInquiryOutcomeCode;
  processingCertainty: WalletProcessingCertainty;
  externalTransactionRef: string | null;
  originalOutcome: WalletAdjustmentOutcomeCode | null;
  responseCode: string | null;
  sanitisedMessage: string;
  retryable: boolean;
  /** Safe to schedule a new execute attempt (confirmed non-processing). */
  safeToRetryExecute: boolean;
}

export interface WalletAdjustmentProvider {
  executeAdjustment(
    command: WalletAdjustmentCommand
  ): Promise<WalletAdjustmentResult>;

  getAdjustmentStatus(
    request: WalletAdjustmentStatusRequest
  ): Promise<WalletAdjustmentStatusResult>;
}
