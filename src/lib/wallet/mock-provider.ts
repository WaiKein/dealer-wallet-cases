import {
  getLastMockExecute,
  nextMockExecuteAttempt,
  rememberMockExecute,
  resolveMockWalletScenario,
} from "@/lib/wallet/mock-config";
import { maskAccountId } from "@/lib/wallet/hash";
import type {
  WalletAdjustmentCommand,
  WalletAdjustmentOutcomeCode,
  WalletAdjustmentProvider,
  WalletAdjustmentResult,
  WalletAdjustmentStatusRequest,
  WalletAdjustmentStatusResult,
  WalletProcessingCertainty,
} from "@/lib/wallet/types";

function mapExecuteOutcome(
  outcome: WalletAdjustmentOutcomeCode,
  command: WalletAdjustmentCommand
): WalletAdjustmentResult {
  const masked = maskAccountId(command.accountId);
  const base = {
    idempotencyKey: command.idempotencyKey,
    responseCode: null as string | null,
    sanitisedMessage: "",
    externalTransactionRef: null as string | null,
  };

  switch (outcome) {
    case "SUCCESS":
      return {
        ...base,
        outcome,
        processingCertainty: "PROCESSED",
        externalTransactionRef: `MOCK-TXN-${command.idempotencyKey.slice(0, 8)}`,
        responseCode: "200",
        sanitisedMessage: `Adjustment applied for account ${masked}.`,
        retryable: false,
        requiresStatusInquiry: false,
        completed: true,
      };
    case "TEMPORARY_FAILURE":
      return {
        ...base,
        outcome,
        processingCertainty: "NOT_PROCESSED",
        responseCode: "503",
        sanitisedMessage: "Provider temporarily unavailable.",
        retryable: true,
        requiresStatusInquiry: false,
        completed: false,
      };
    case "PERMANENT_FAILURE":
      return {
        ...base,
        outcome,
        processingCertainty: "NOT_PROCESSED",
        responseCode: "422",
        sanitisedMessage: "Provider rejected the adjustment permanently.",
        retryable: false,
        requiresStatusInquiry: false,
        completed: true,
      };
    case "TIMEOUT_BEFORE_PROCESSING":
      return {
        ...base,
        outcome,
        processingCertainty: "NOT_PROCESSED",
        responseCode: "504",
        sanitisedMessage:
          "Timeout before processing — confirmed not processed.",
        retryable: true,
        requiresStatusInquiry: false,
        completed: false,
      };
    case "TIMEOUT_AFTER_POSSIBLE_PROCESSING":
      return {
        ...base,
        outcome,
        processingCertainty: "UNCERTAIN",
        responseCode: "504",
        sanitisedMessage:
          "Timeout after possible processing — status inquiry required.",
        retryable: false,
        requiresStatusInquiry: true,
        completed: false,
      };
    case "DUPLICATE_REQUEST":
      return {
        ...base,
        outcome,
        processingCertainty: "PROCESSED",
        externalTransactionRef: `MOCK-TXN-DUP-${command.idempotencyKey.slice(0, 8)}`,
        responseCode: "409",
        sanitisedMessage: "Duplicate idempotency key — original accepted.",
        retryable: false,
        requiresStatusInquiry: false,
        completed: true,
      };
    case "DELAYED_COMPLETION":
      return {
        ...base,
        outcome,
        processingCertainty: "UNCERTAIN",
        responseCode: "202",
        sanitisedMessage: "Accepted for delayed completion.",
        retryable: false,
        requiresStatusInquiry: true,
        completed: false,
      };
    case "UNKNOWN_RESULT":
      return {
        ...base,
        outcome,
        processingCertainty: "UNCERTAIN",
        responseCode: "520",
        sanitisedMessage: "Unknown provider result — inquiry required.",
        retryable: false,
        requiresStatusInquiry: true,
        completed: false,
      };
    case "MALFORMED_RESPONSE":
      return {
        ...base,
        outcome,
        processingCertainty: "UNCERTAIN",
        responseCode: "502",
        sanitisedMessage: "Malformed provider response.",
        retryable: false,
        requiresStatusInquiry: true,
        completed: false,
      };
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

/**
 * Deterministic mock wallet provider for pilot / simulator use.
 * Outcomes are selected via mock-config (test-control), never by end users.
 */
export class MockWalletAdjustmentProvider implements WalletAdjustmentProvider {
  async executeAdjustment(
    command: WalletAdjustmentCommand
  ): Promise<WalletAdjustmentResult> {
    if (command.approvedAmount > command.requestedAmount) {
      return {
        outcome: "PERMANENT_FAILURE",
        processingCertainty: "NOT_PROCESSED",
        externalTransactionRef: null,
        idempotencyKey: command.idempotencyKey,
        responseCode: "422",
        sanitisedMessage: "Approved amount exceeds requested amount.",
        retryable: false,
        requiresStatusInquiry: false,
        completed: true,
      };
    }

    if (!command.requestHash || !command.idempotencyKey) {
      return {
        outcome: "PERMANENT_FAILURE",
        processingCertainty: "NOT_PROCESSED",
        externalTransactionRef: null,
        idempotencyKey: command.idempotencyKey,
        responseCode: "400",
        sanitisedMessage: "Missing idempotency key or request hash.",
        retryable: false,
        requiresStatusInquiry: false,
        completed: true,
      };
    }

    const scenario = resolveMockWalletScenario({
      idempotencyKey: command.idempotencyKey,
      caseId: command.caseId,
    });
    const attempt = nextMockExecuteAttempt(command.idempotencyKey);

    let outcome = scenario.executeOutcome;
    if (
      scenario.afterAttempts != null &&
      scenario.thenExecuteOutcome &&
      attempt >= scenario.afterAttempts
    ) {
      outcome = scenario.thenExecuteOutcome;
    }

    const result = mapExecuteOutcome(outcome, command);
    rememberMockExecute({
      idempotencyKey: command.idempotencyKey,
      outcome: result.outcome,
      externalTransactionRef: result.externalTransactionRef,
      requestHash: command.requestHash,
    });
    return result;
  }

  async getAdjustmentStatus(
    request: WalletAdjustmentStatusRequest
  ): Promise<WalletAdjustmentStatusResult> {
    const scenario = resolveMockWalletScenario({
      idempotencyKey: request.idempotencyKey,
      caseId: request.caseId,
    });
    const last = getLastMockExecute(request.idempotencyKey);
    const statusOutcome = scenario.statusOutcome ?? "STATUS_SUCCESS";

    if (statusOutcome === "STATUS_TEMPORARY_FAILURE") {
      return {
        outcome: "STATUS_TEMPORARY_FAILURE",
        processingCertainty: "UNCERTAIN",
        externalTransactionRef: last?.externalTransactionRef ?? null,
        originalOutcome: last?.outcome ?? null,
        responseCode: "503",
        sanitisedMessage: "Status inquiry temporarily failed.",
        retryable: true,
        safeToRetryExecute: false,
      };
    }

    if (statusOutcome === "STATUS_NOT_FOUND") {
      return {
        outcome: "STATUS_NOT_FOUND",
        processingCertainty: "NOT_PROCESSED",
        externalTransactionRef: null,
        originalOutcome: last?.outcome ?? null,
        responseCode: "404",
        sanitisedMessage: "No provider transaction found for this request.",
        retryable: false,
        safeToRetryExecute: true,
      };
    }

    if (statusOutcome === "STATUS_UNKNOWN") {
      return {
        outcome: "STATUS_UNKNOWN",
        processingCertainty: "UNCERTAIN",
        externalTransactionRef: last?.externalTransactionRef ?? null,
        originalOutcome: last?.outcome ?? null,
        responseCode: "520",
        sanitisedMessage: "Status inquiry returned an unknown result.",
        retryable: true,
        safeToRetryExecute: false,
      };
    }

    // STATUS_SUCCESS — interpret from last execute or delayed completion
    if (!last) {
      return {
        outcome: "STATUS_NOT_FOUND",
        processingCertainty: "NOT_PROCESSED",
        externalTransactionRef: null,
        originalOutcome: null,
        responseCode: "404",
        sanitisedMessage: "No prior mock execute recorded for this key.",
        retryable: false,
        safeToRetryExecute: true,
      };
    }

    if (last.requestHash !== request.requestHash) {
      return {
        outcome: "STATUS_TEMPORARY_FAILURE",
        processingCertainty: "UNCERTAIN",
        externalTransactionRef: null,
        originalOutcome: last.outcome,
        responseCode: "409",
        sanitisedMessage: "Request hash mismatch on status inquiry.",
        retryable: false,
        safeToRetryExecute: false,
      };
    }

    const certainty = certaintyFromExecute(last.outcome);
    return {
      outcome: "STATUS_SUCCESS",
      processingCertainty: certainty,
      externalTransactionRef: last.externalTransactionRef,
      originalOutcome: last.outcome,
      responseCode: "200",
      sanitisedMessage: `Status inquiry ok for account ${maskAccountId(request.accountId)}.`,
      retryable: false,
      safeToRetryExecute: certainty === "NOT_PROCESSED",
    };
  }
}

function certaintyFromExecute(
  outcome: WalletAdjustmentOutcomeCode
): WalletProcessingCertainty {
  switch (outcome) {
    case "SUCCESS":
    case "DUPLICATE_REQUEST":
      return "PROCESSED";
    case "TEMPORARY_FAILURE":
    case "PERMANENT_FAILURE":
    case "TIMEOUT_BEFORE_PROCESSING":
      return "NOT_PROCESSED";
    default:
      return "UNCERTAIN";
  }
}

/** Reserved for a future real provider — do not implement credentials here. */
export class RealWalletAdjustmentProvider implements WalletAdjustmentProvider {
  async executeAdjustment(): Promise<WalletAdjustmentResult> {
    throw new Error(
      "RealWalletAdjustmentProvider is not configured in this pilot phase."
    );
  }

  async getAdjustmentStatus(): Promise<WalletAdjustmentStatusResult> {
    throw new Error(
      "RealWalletAdjustmentProvider is not configured in this pilot phase."
    );
  }
}
