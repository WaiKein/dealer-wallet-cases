import { createHash } from "node:crypto";
import type { WalletAdjustmentCommand } from "@/lib/wallet/types";

/** Fields included in the financial request hash (order-stable). */
export function buildWalletRequestHashPayload(
  command: Omit<WalletAdjustmentCommand, "requestHash" | "correlationId">
) {
  return {
    organizationId: command.organizationId,
    caseId: command.caseId,
    approvalRequestId: command.approvalRequestId,
    idempotencyKey: command.idempotencyKey,
    accountId: command.accountId,
    referenceId: command.referenceId,
    requestedAmount: command.requestedAmount,
    approvedAmount: command.approvedAmount,
    currency: command.currency,
    adjustmentType: command.adjustmentType,
  };
}

export function hashWalletRequest(
  command: Omit<WalletAdjustmentCommand, "requestHash" | "correlationId">
): string {
  return createHash("sha256")
    .update(JSON.stringify(buildWalletRequestHashPayload(command)))
    .digest("hex");
}

export function maskAccountId(accountId: string): string {
  if (accountId.length <= 4) return "****";
  return `${"*".repeat(Math.max(accountId.length - 4, 0))}${accountId.slice(-4)}`;
}

/**
 * Retry policy helpers for financial timeouts.
 * Never blindly retry an uncertain timeout.
 */
export function canScheduleExecuteRetry(params: {
  processingCertainty: "NOT_PROCESSED" | "PROCESSED" | "UNCERTAIN";
  requiresStatusInquiry: boolean;
}): boolean {
  if (params.requiresStatusInquiry) return false;
  return params.processingCertainty === "NOT_PROCESSED";
}

export function canRetryAfterStatusInquiry(params: {
  processingCertainty: "NOT_PROCESSED" | "PROCESSED" | "UNCERTAIN";
  safeToRetryExecute: boolean;
}): boolean {
  return (
    params.safeToRetryExecute && params.processingCertainty === "NOT_PROCESSED"
  );
}
