import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEASE_HEARTBEAT_MS,
  startClaimHeartbeat,
} from "@/lib/api/idempotency";
import { startJobHeartbeat } from "@/lib/jobs/worker";

/**
 * Lazy Supabase-style builder: the update is only sent when the chain is
 * awaited or .then()'d (terminal consumption of the PromiseLike).
 */
function createLazyUpdateBuilder(onTerminal: () => void) {
  const chain: {
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    then: (
      onFulfilled?: (value: { error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise<unknown>;
  } = {
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    then(onFulfilled, onRejected) {
      onTerminal();
      return Promise.resolve({ error: null }).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

describe("idempotency claim heartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("awaits the Supabase update when the timer fires", async () => {
    vi.useFakeTimers();
    let terminalCount = 0;

    const service = {
      from: vi.fn(() => ({
        update: vi.fn(() => createLazyUpdateBuilder(() => {
          terminalCount += 1;
        })),
      })),
    };

    const stop = startClaimHeartbeat(
      service as never,
      { id: "claim-1", token: "token-aaa" },
      1_000
    );

    expect(terminalCount).toBe(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(terminalCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(terminalCount).toBe(2);

    stop();
    expect(LEASE_HEARTBEAT_MS).toBe(20_000);
  });
});

describe("job worker heartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("awaits the Supabase update when the timer fires", async () => {
    vi.useFakeTimers();
    let terminalCount = 0;

    const service = {
      from: vi.fn(() => ({
        update: vi.fn(() => createLazyUpdateBuilder(() => {
          terminalCount += 1;
        })),
      })),
    };

    const stop = startJobHeartbeat(
      service as never,
      { jobId: "job-1", lockedBy: "worker-a", attemptCount: 2 },
      1_000
    );

    expect(terminalCount).toBe(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(terminalCount).toBe(1);

    stop();
  });
});
