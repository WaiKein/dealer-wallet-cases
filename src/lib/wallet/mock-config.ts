import type {
  WalletAdjustmentOutcomeCode,
  WalletStatusInquiryOutcomeCode,
} from "@/lib/wallet/types";

export type MockWalletScenario = {
  executeOutcome: WalletAdjustmentOutcomeCode;
  statusOutcome?: WalletStatusInquiryOutcomeCode;
  /** After N execute calls for the same idempotency key, switch to this outcome. */
  afterAttempts?: number;
  thenExecuteOutcome?: WalletAdjustmentOutcomeCode;
};

type MockWalletStore = {
  byIdempotencyKey: Map<string, MockWalletScenario>;
  byCaseId: Map<string, MockWalletScenario>;
  defaultScenario: MockWalletScenario;
  attemptCounts: Map<string, number>;
  lastExecuteByKey: Map<
    string,
    {
      outcome: WalletAdjustmentOutcomeCode;
      externalTransactionRef: string | null;
      requestHash: string;
    }
  >;
};

const GLOBAL_KEY = "__dealerWalletMockConfig__";

function store(): MockWalletStore {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: MockWalletStore;
  };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      byIdempotencyKey: new Map(),
      byCaseId: new Map(),
      defaultScenario: {
        executeOutcome: "SUCCESS",
        statusOutcome: "STATUS_SUCCESS",
      },
      attemptCounts: new Map(),
      lastExecuteByKey: new Map(),
    };
  }
  return g[GLOBAL_KEY]!;
}

/**
 * Process-local mock wallet configuration (globalThis singleton so Next.js
 * route/worker bundles share the same in-memory state).
 * Writable only via test-control when ENABLE_TEST_CONTROL=true.
 */
export function resetMockWalletConfig() {
  const s = store();
  s.byIdempotencyKey.clear();
  s.byCaseId.clear();
  s.attemptCounts.clear();
  s.lastExecuteByKey.clear();
  s.defaultScenario = {
    executeOutcome: "SUCCESS",
    statusOutcome: "STATUS_SUCCESS",
  };
}

export function setDefaultMockWalletScenario(scenario: MockWalletScenario) {
  store().defaultScenario = scenario;
}

export function setMockWalletScenarioForIdempotencyKey(
  idempotencyKey: string,
  scenario: MockWalletScenario
) {
  store().byIdempotencyKey.set(idempotencyKey, scenario);
}

export function setMockWalletScenarioForCaseId(
  caseId: string,
  scenario: MockWalletScenario
) {
  store().byCaseId.set(caseId, scenario);
}

export function resolveMockWalletScenario(params: {
  idempotencyKey: string;
  caseId: string;
}): MockWalletScenario {
  const s = store();
  return (
    s.byIdempotencyKey.get(params.idempotencyKey) ??
    s.byCaseId.get(params.caseId) ??
    s.defaultScenario
  );
}

export function nextMockExecuteAttempt(idempotencyKey: string): number {
  const s = store();
  const next = (s.attemptCounts.get(idempotencyKey) ?? 0) + 1;
  s.attemptCounts.set(idempotencyKey, next);
  return next;
}

export function getMockExecuteAttempt(idempotencyKey: string): number {
  return store().attemptCounts.get(idempotencyKey) ?? 0;
}

export function rememberMockExecute(params: {
  idempotencyKey: string;
  outcome: WalletAdjustmentOutcomeCode;
  externalTransactionRef: string | null;
  requestHash: string;
}) {
  store().lastExecuteByKey.set(params.idempotencyKey, {
    outcome: params.outcome,
    externalTransactionRef: params.externalTransactionRef,
    requestHash: params.requestHash,
  });
}

export function getLastMockExecute(idempotencyKey: string) {
  return store().lastExecuteByKey.get(idempotencyKey) ?? null;
}

export function clearMockExecuteMemory() {
  store().lastExecuteByKey.clear();
}
