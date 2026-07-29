export type ActorRole =
  | "requester"
  | "operations_agent"
  | "approver"
  | "team_lead";

export interface ScenarioActor {
  id: string;
  email: string;
  password: string;
  role?: ActorRole;
}

export interface ScenarioAction {
  name?: string;
  actor: string;
  action: string;
  params?: Record<string, unknown>;
  expectError?: string | boolean;
  saveAs?: string;
  concurrent?: boolean;
}

export interface ScenarioAssertion {
  type: string;
  actor?: string;
  params?: Record<string, unknown>;
}

export interface ScenarioFile {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  runbookRefs: string[];
  actors: ScenarioActor[];
  setup?: Record<string, unknown>;
  actions: ScenarioAction[];
  concurrent_actions?: ScenarioAction[][];
  assertions?: ScenarioAssertion[];
  cleanup?: {
    caseTitlePrefix?: string;
    caseIdsFrom?: string[];
  };
}

export interface StepResult {
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

export interface ScenarioResult {
  id: string;
  name: string;
  tags: string[];
  runbookRefs: string[];
  ok: boolean;
  steps: StepResult[];
  startedAt: string;
  finishedAt: string;
}
