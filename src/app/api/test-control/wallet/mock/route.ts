import { apiError, jsonOk } from "@/lib/api/response";
import { authorizeTestControl } from "@/lib/test-control/authorize";
import {
  clearMockExecuteMemory,
  resetMockWalletConfig,
  setDefaultMockWalletScenario,
  setMockWalletScenarioForCaseId,
  setMockWalletScenarioForIdempotencyKey,
  type MockWalletScenario,
} from "@/lib/wallet/mock-config";
import type {
  WalletAdjustmentOutcomeCode,
  WalletStatusInquiryOutcomeCode,
} from "@/lib/wallet/types";

const EXECUTE_OUTCOMES = new Set<WalletAdjustmentOutcomeCode>([
  "SUCCESS",
  "TEMPORARY_FAILURE",
  "PERMANENT_FAILURE",
  "TIMEOUT_BEFORE_PROCESSING",
  "TIMEOUT_AFTER_POSSIBLE_PROCESSING",
  "DUPLICATE_REQUEST",
  "DELAYED_COMPLETION",
  "UNKNOWN_RESULT",
  "MALFORMED_RESPONSE",
]);

const STATUS_OUTCOMES = new Set<WalletStatusInquiryOutcomeCode>([
  "STATUS_SUCCESS",
  "STATUS_NOT_FOUND",
  "STATUS_TEMPORARY_FAILURE",
  "STATUS_UNKNOWN",
]);

/**
 * Configure mock wallet outcomes for simulators.
 * Ordinary users cannot call this — requires test-control secret.
 */
export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "reset" | "set";
    scope?: "default" | "idempotencyKey" | "caseId";
    idempotencyKey?: string;
    caseId?: string;
    executeOutcome?: string;
    statusOutcome?: string;
    afterAttempts?: number;
    thenExecuteOutcome?: string;
  };

  if (body.action === "reset") {
    resetMockWalletConfig();
    clearMockExecuteMemory();
    return jsonOk({ reset: true });
  }

  if (body.action !== "set") {
    return apiError({
      code: "VALIDATION_ERROR",
      message: "Unsupported action. Use reset|set.",
    });
  }

  if (
    !body.executeOutcome ||
    !EXECUTE_OUTCOMES.has(body.executeOutcome as WalletAdjustmentOutcomeCode)
  ) {
    return apiError({
      code: "VALIDATION_ERROR",
      message: "Invalid or missing executeOutcome.",
    });
  }

  if (
    body.statusOutcome &&
    !STATUS_OUTCOMES.has(body.statusOutcome as WalletStatusInquiryOutcomeCode)
  ) {
    return apiError({
      code: "VALIDATION_ERROR",
      message: "Invalid statusOutcome.",
    });
  }

  if (
    body.thenExecuteOutcome &&
    !EXECUTE_OUTCOMES.has(
      body.thenExecuteOutcome as WalletAdjustmentOutcomeCode
    )
  ) {
    return apiError({
      code: "VALIDATION_ERROR",
      message: "Invalid thenExecuteOutcome.",
    });
  }

  const scenario: MockWalletScenario = {
    executeOutcome: body.executeOutcome as WalletAdjustmentOutcomeCode,
    statusOutcome: body.statusOutcome as
      | WalletStatusInquiryOutcomeCode
      | undefined,
    afterAttempts: body.afterAttempts,
    thenExecuteOutcome: body.thenExecuteOutcome as
      | WalletAdjustmentOutcomeCode
      | undefined,
  };

  const scope = body.scope ?? "default";
  if (scope === "default") {
    setDefaultMockWalletScenario(scenario);
  } else if (scope === "idempotencyKey") {
    if (!body.idempotencyKey) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: "idempotencyKey is required for this scope.",
      });
    }
    setMockWalletScenarioForIdempotencyKey(body.idempotencyKey, scenario);
  } else if (scope === "caseId") {
    if (!body.caseId) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: "caseId is required for this scope.",
      });
    }
    setMockWalletScenarioForCaseId(body.caseId, scenario);
  } else {
    return apiError({
      code: "VALIDATION_ERROR",
      message: "Unsupported scope.",
    });
  }

  console.info("[test-control] wallet.mock", { scope, scenario });
  return jsonOk({ configured: true, scope, scenario });
}
