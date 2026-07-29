export interface SimulatorStepResult {
  scenario: string;
  step: string;
  actor: string;
  ok: boolean;
  expected?: unknown;
  actual?: unknown;
  apiResponse?: unknown;
  correlationId?: string;
  error?: string;
  durationMs: number;
}

export interface SimulatorScenarioResult {
  id?: string;
  name: string;
  tags: string[];
  runbookRefs?: string[];
  ok: boolean;
  steps: SimulatorStepResult[];
  startedAt: string;
  finishedAt: string;
}

export interface SimulatorScenarioSummary {
  file: string;
  id?: string;
  name: string;
  description?: string;
  tags: string[];
  runbookRefs?: string[];
  actionCount: number;
  assertionCount: number;
}

export interface SimulatorReport {
  results: SimulatorScenarioResult[];
  updatedAt: string | null;
}
