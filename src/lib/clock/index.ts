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

const systemClock = new SystemClock();
let activeClock: Clock = systemClock;
let testClock: TestClock | null = null;

export function isTestControlEnabled(): boolean {
  return (
    process.env.ENABLE_TEST_CONTROL === "true" &&
    Boolean(process.env.TEST_CONTROL_SECRET) &&
    process.env.NODE_ENV !== "production"
  );
}

export function getClock(): Clock {
  return activeClock;
}

export function useSystemClock(): void {
  activeClock = systemClock;
  testClock = null;
}

export function useTestClock(initial?: Date): TestClock {
  if (!isTestControlEnabled()) {
    throw new Error("Test clock is disabled outside test-control environments.");
  }
  testClock = new TestClock(initial ?? new Date());
  activeClock = testClock;
  return testClock;
}

export function getTestClock(): TestClock | null {
  return testClock;
}
