import { beforeEach, describe, expect, it } from "vitest";
import { buildWalletAdjustmentCommand } from "@/lib/wallet/command";
import {
  canRetryAfterStatusInquiry,
  canScheduleExecuteRetry,
  hashWalletRequest,
  maskAccountId,
} from "@/lib/wallet/hash";
import {
  resetMockWalletConfig,
  setDefaultMockWalletScenario,
  setMockWalletScenarioForIdempotencyKey,
  clearMockExecuteMemory,
} from "@/lib/wallet/mock-config";
import { MockWalletAdjustmentProvider } from "@/lib/wallet/mock-provider";
import {
  getWalletAdjustmentProvider,
  resetWalletAdjustmentProviderCache,
} from "@/lib/wallet/provider";

function sampleCommand(overrides: Record<string, unknown> = {}) {
  return buildWalletAdjustmentCommand({
    idempotencyKey: "idem-1",
    correlationId: "corr-1",
    caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    approvalRequestId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    organizationId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    requestedAmount: 100,
    approvedAmount: 100,
    accountId: "ACCT-12345678",
    referenceId: "REF-9",
    currency: "USD",
    adjustmentType: "credit",
    ...overrides,
  });
}

describe("wallet hash helpers", () => {
  it("masks account ids", () => {
    expect(maskAccountId("ACCT-12345678")).toBe("*********5678");
  });

  it("produces stable request hashes", () => {
    const a = hashWalletRequest(sampleCommand());
    const b = hashWalletRequest(sampleCommand());
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("never schedules retry for uncertain timeouts", () => {
    expect(
      canScheduleExecuteRetry({
        processingCertainty: "UNCERTAIN",
        requiresStatusInquiry: true,
      })
    ).toBe(false);
    expect(
      canScheduleExecuteRetry({
        processingCertainty: "NOT_PROCESSED",
        requiresStatusInquiry: false,
      })
    ).toBe(true);
    expect(
      canRetryAfterStatusInquiry({
        processingCertainty: "NOT_PROCESSED",
        safeToRetryExecute: true,
      })
    ).toBe(true);
  });
});

describe("MockWalletAdjustmentProvider", () => {
  beforeEach(() => {
    resetMockWalletConfig();
    clearMockExecuteMemory();
    resetWalletAdjustmentProviderCache();
  });

  it("returns success by default", async () => {
    const provider = new MockWalletAdjustmentProvider();
    const result = await provider.executeAdjustment(sampleCommand());
    expect(result.outcome).toBe("SUCCESS");
    expect(result.processingCertainty).toBe("PROCESSED");
    expect(result.completed).toBe(true);
    expect(result.externalTransactionRef).toBeTruthy();
  });

  it("supports temporary failure then success", async () => {
    setMockWalletScenarioForIdempotencyKey("idem-retry", {
      executeOutcome: "TEMPORARY_FAILURE",
      afterAttempts: 2,
      thenExecuteOutcome: "SUCCESS",
    });
    const provider = new MockWalletAdjustmentProvider();
    const cmd = sampleCommand({ idempotencyKey: "idem-retry" });
    const first = await provider.executeAdjustment(cmd);
    expect(first.outcome).toBe("TEMPORARY_FAILURE");
    expect(first.retryable).toBe(true);
    expect(
      canScheduleExecuteRetry({
        processingCertainty: first.processingCertainty,
        requiresStatusInquiry: first.requiresStatusInquiry,
      })
    ).toBe(true);

    const second = await provider.executeAdjustment(cmd);
    expect(second.outcome).toBe("SUCCESS");
  });

  it("marks uncertain timeout as requiring status inquiry", async () => {
    setDefaultMockWalletScenario({
      executeOutcome: "TIMEOUT_AFTER_POSSIBLE_PROCESSING",
      statusOutcome: "STATUS_NOT_FOUND",
    });
    const provider = new MockWalletAdjustmentProvider();
    const cmd = sampleCommand({ idempotencyKey: "idem-timeout" });
    const result = await provider.executeAdjustment(cmd);
    expect(result.requiresStatusInquiry).toBe(true);
    expect(result.retryable).toBe(false);
    expect(
      canScheduleExecuteRetry({
        processingCertainty: result.processingCertainty,
        requiresStatusInquiry: result.requiresStatusInquiry,
      })
    ).toBe(false);

    const status = await provider.getAdjustmentStatus({
      organizationId: cmd.organizationId,
      caseId: cmd.caseId,
      approvalRequestId: cmd.approvalRequestId,
      idempotencyKey: cmd.idempotencyKey,
      requestHash: cmd.requestHash,
      correlationId: cmd.correlationId,
      accountId: cmd.accountId,
      referenceId: cmd.referenceId,
    });
    expect(status.outcome).toBe("STATUS_NOT_FOUND");
    expect(status.safeToRetryExecute).toBe(true);
  });

  it("rejects approved amount above requested", async () => {
    const provider = new MockWalletAdjustmentProvider();
    const result = await provider.executeAdjustment(
      sampleCommand({ approvedAmount: 200, requestedAmount: 100 })
    );
    expect(result.outcome).toBe("PERMANENT_FAILURE");
  });

  it("factory returns mock provider", () => {
    const provider = getWalletAdjustmentProvider();
    expect(provider).toBeInstanceOf(MockWalletAdjustmentProvider);
  });
});
