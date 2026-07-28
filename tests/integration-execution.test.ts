import { describe, expect, it } from "vitest";
import { mapExecuteOutcomeToExecution } from "@/lib/executions/types";
import {
  canRetryAfterStatusInquiry,
  canScheduleExecuteRetry,
} from "@/lib/wallet/hash";

describe("mapExecuteOutcomeToExecution", () => {
  it("maps success and duplicate to SUCCEEDED", () => {
    expect(
      mapExecuteOutcomeToExecution({
        outcome: "SUCCESS",
        requiresStatusInquiry: false,
      }).status
    ).toBe("SUCCEEDED");
    expect(
      mapExecuteOutcomeToExecution({
        outcome: "DUPLICATE_REQUEST",
        requiresStatusInquiry: false,
      }).status
    ).toBe("SUCCEEDED");
  });

  it("maps temporary and confirmed timeout to FAILED_RETRYABLE with execute retry", () => {
    const temp = mapExecuteOutcomeToExecution({
      outcome: "TEMPORARY_FAILURE",
      requiresStatusInquiry: false,
    });
    expect(temp.status).toBe("FAILED_RETRYABLE");
    expect(temp.scheduleExecuteRetry).toBe(true);
    expect(
      canScheduleExecuteRetry({
        processingCertainty: "NOT_PROCESSED",
        requiresStatusInquiry: false,
      })
    ).toBe(true);

    const timeout = mapExecuteOutcomeToExecution({
      outcome: "TIMEOUT_BEFORE_PROCESSING",
      requiresStatusInquiry: false,
    });
    expect(timeout.status).toBe("FAILED_RETRYABLE");
    expect(timeout.scheduleExecuteRetry).toBe(true);
  });

  it("maps permanent failure to FAILED_FINAL", () => {
    const mapped = mapExecuteOutcomeToExecution({
      outcome: "PERMANENT_FAILURE",
      requiresStatusInquiry: false,
    });
    expect(mapped.status).toBe("FAILED_FINAL");
    expect(mapped.scheduleExecuteRetry).toBe(false);
  });

  it("maps uncertain outcomes to UNKNOWN and status inquiry only", () => {
    for (const outcome of [
      "TIMEOUT_AFTER_POSSIBLE_PROCESSING",
      "DELAYED_COMPLETION",
      "UNKNOWN_RESULT",
      "MALFORMED_RESPONSE",
    ] as const) {
      const mapped = mapExecuteOutcomeToExecution({
        outcome,
        requiresStatusInquiry: true,
      });
      expect(mapped.status).toBe("UNKNOWN");
      expect(mapped.requiresStatusInquiry).toBe(true);
      expect(mapped.scheduleExecuteRetry).toBe(false);
      expect(mapped.scheduleStatusInquiry).toBe(true);
      expect(
        canScheduleExecuteRetry({
          processingCertainty: "UNCERTAIN",
          requiresStatusInquiry: true,
        })
      ).toBe(false);
    }
  });

  it("allows execute retry only after safe status inquiry", () => {
    expect(
      canRetryAfterStatusInquiry({
        processingCertainty: "NOT_PROCESSED",
        safeToRetryExecute: true,
      })
    ).toBe(true);
    expect(
      canRetryAfterStatusInquiry({
        processingCertainty: "UNCERTAIN",
        safeToRetryExecute: false,
      })
    ).toBe(false);
  });
});
