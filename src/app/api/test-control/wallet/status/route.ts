import { apiError, jsonOk } from "@/lib/api/response";
import { authorizeTestControl } from "@/lib/test-control/authorize";
import { canRetryAfterStatusInquiry } from "@/lib/wallet/hash";
import { getWalletAdjustmentProvider } from "@/lib/wallet/provider";

/** Status inquiry against the mock wallet provider (simulator / test-control). */
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
    requestHash?: string;
    externalTransactionRef?: string | null;
    accountId?: string;
    referenceId?: string;
  };

  const required = [
    "idempotencyKey",
    "caseId",
    "approvalRequestId",
    "organizationId",
    "requestHash",
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

  const provider = getWalletAdjustmentProvider();
  const result = await provider.getAdjustmentStatus({
    idempotencyKey: String(body.idempotencyKey),
    correlationId: String(body.correlationId ?? crypto.randomUUID()),
    caseId: String(body.caseId),
    approvalRequestId: String(body.approvalRequestId),
    organizationId: String(body.organizationId),
    requestHash: String(body.requestHash),
    externalTransactionRef: body.externalTransactionRef ?? null,
    accountId: String(body.accountId),
    referenceId: String(body.referenceId),
  });

  return jsonOk({
    result,
    retryPolicy: {
      canRetryAfterStatusInquiry: canRetryAfterStatusInquiry({
        processingCertainty: result.processingCertainty,
        safeToRetryExecute: result.safeToRetryExecute,
      }),
    },
  });
}
