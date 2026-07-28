import { apiError, jsonOk } from "@/lib/api/response";
import { authorizeTestControl } from "@/lib/test-control/authorize";
import { buildWalletAdjustmentCommand } from "@/lib/wallet/command";
import { canScheduleExecuteRetry } from "@/lib/wallet/hash";
import { getWalletAdjustmentProvider } from "@/lib/wallet/provider";

/**
 * Invoke the mock wallet provider directly for simulator/API tests.
 * Not a business case-execution API (that lands in Phase 4).
 */
export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    idempotencyKey?: string;
    correlationId?: string;
    caseId?: string;
    approvalRequestId?: string;
    organizationId?: string;
    requestedAmount?: number;
    approvedAmount?: number;
    accountId?: string;
    referenceId?: string;
    currency?: string;
    adjustmentType?: "credit" | "debit";
  };

  const required = [
    "idempotencyKey",
    "caseId",
    "approvalRequestId",
    "organizationId",
    "accountId",
    "referenceId",
  ] as const;
  for (const key of required) {
    if (!body[key]) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: `${key} is required.`,
      });
    }
  }

  const command = buildWalletAdjustmentCommand({
    idempotencyKey: String(body.idempotencyKey),
    correlationId: String(body.correlationId ?? crypto.randomUUID()),
    caseId: String(body.caseId),
    approvalRequestId: String(body.approvalRequestId),
    organizationId: String(body.organizationId),
    requestedAmount: Number(body.requestedAmount ?? 100),
    approvedAmount: Number(
      body.approvedAmount ?? body.requestedAmount ?? 100
    ),
    accountId: String(body.accountId),
    referenceId: String(body.referenceId),
    currency: String(body.currency ?? "USD"),
    adjustmentType: body.adjustmentType === "debit" ? "debit" : "credit",
  });

  const provider = getWalletAdjustmentProvider();
  const result = await provider.executeAdjustment(command);

  return jsonOk({
    command: {
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      correlationId: command.correlationId,
      caseId: command.caseId,
      approvedAmount: command.approvedAmount,
    },
    result,
    retryPolicy: {
      canScheduleExecuteRetry: canScheduleExecuteRetry({
        processingCertainty: result.processingCertainty,
        requiresStatusInquiry: result.requiresStatusInquiry,
      }),
    },
  });
}
