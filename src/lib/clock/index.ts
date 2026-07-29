export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/**
 * Process-local test clock. Used only when test-control is enabled.
 * Production always uses SystemClock via getClock().
 */
export class TestClock implements Clock {
  private current: Date;

  constructor(initial: Date = new Date()) {
    this.current = new Date(initial.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(next: Date): void {
    this.current = new Date(next.getTime());
  }

  advance(ms: number): Date {
    this.current = new Date(this.current.getTime() + ms);
    return this.now();
  }

  toISOString(): string {
    return this.current.toISOString();
  }
}

type ClockStore = {
  systemClock: SystemClock;
  activeClock: Clock;
  testClock: TestClock | null;
};

const GLOBAL_KEY = "__dealerWalletClock__";

function store(): ClockStore {
  const global = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: ClockStore;
  };
  if (!global[GLOBAL_KEY]) {
    const systemClock = new SystemClock();
    global[GLOBAL_KEY] = {
      systemClock,
      activeClock: systemClock,
      testClock: null,
    };
  }
  return global[GLOBAL_KEY]!;
}

export function isTestControlEnabled(): boolean {
  return (
    process.env.ENABLE_TEST_CONTROL === "true" &&
    Boolean(process.env.TEST_CONTROL_SECRET) &&
    process.env.NODE_ENV !== "production"
  );
}

export function getClock(): Clock {
  return store().activeClock;
}

export function enableSystemClock(): void {
  const clocks = store();
  clocks.activeClock = clocks.systemClock;
  clocks.testClock = null;
}

export function enableTestClock(initial?: Date): TestClock {
  if (!isTestControlEnabled()) {
    throw new Error("Test clock is disabled outside test-control environments.");
  }
  const clocks = store();
  const testClock = new TestClock(initial ?? new Date());
  clocks.testClock = testClock;
  clocks.activeClock = testClock;
  return testClock;
}

/** @deprecated Prefer enableSystemClock — kept to avoid confusion with React hooks. */
export const useSystemClock = enableSystemClock;
/** @deprecated Prefer enableTestClock — kept to avoid confusion with React hooks. */
export const useTestClock = enableTestClock;

export function getTestClock(): TestClock | null {
  return store().testClock;
}
