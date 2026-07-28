import { authenticateActor, type AuthenticatedActor } from "./auth/actors.js";
import { runAction } from "./actions/index.js";
import { runAssertion } from "./assertions/index.js";
import { ApiClient } from "./api/client.js";
import type {
  ScenarioAction,
  ScenarioFile,
  ScenarioResult,
  StepResult,
} from "./types.js";

export async function runScenario(params: {
  scenario: ScenarioFile;
  baseUrl: string;
  testControlSecret: string;
}): Promise<ScenarioResult> {
  const startedAt = new Date().toISOString();
  const steps: StepResult[] = [];
  const vars: Record<string, unknown> = {
    runId: `sim-${Date.now()}`,
  };
  const actors = new Map<string, AuthenticatedActor>();
  const baseClient = new ApiClient(params.baseUrl);
  const createdCaseIds: string[] = [];

  try {
    for (const actor of params.scenario.actors) {
      const authed = await authenticateActor(params.baseUrl, actor);
      actors.set(actor.id, authed);
    }

    for (const [index, action] of params.scenario.actions.entries()) {
      const step = await executeActionStep({
        scenarioName: params.scenario.name,
        index,
        action,
        actors,
        vars,
        baseClient,
        testControlSecret: params.testControlSecret,
      });
      steps.push(step);
      if (step.ok && action.saveAs && step.actual) {
        const saved = step.actual as {
          id?: string;
          version?: number;
          jobId?: string;
          command?: { idempotencyKey?: string; requestHash?: string };
        };
        vars[action.saveAs] = saved.id ?? saved.jobId ?? step.actual;
        if (saved.id && action.action === "create_case") {
          createdCaseIds.push(saved.id);
          vars.caseId = saved.id;
        } else if (saved.id && action.saveAs === "caseId") {
          createdCaseIds.push(saved.id);
          vars.caseId = saved.id;
        }
        if (saved.jobId) {
          vars.jobId = saved.jobId;
        }
        if (typeof saved.version === "number") {
          vars.caseVersion = saved.version;
        }
      }
      if (step.ok && step.actual) {
        const saved = step.actual as {
          command?: { idempotencyKey?: string; requestHash?: string };
        };
        if (action.action === "execute_wallet_adjustment") {
          vars.walletExecute = step.actual;
          if (saved.command?.idempotencyKey) {
            vars.walletIdempotencyKey = saved.command.idempotencyKey;
          }
          if (saved.command?.requestHash) {
            vars.walletRequestHash = saved.command.requestHash;
          }
        }
        if (action.action === "inquire_wallet_status") {
          vars.walletStatus = step.actual;
        }
      }
      if (
        step.ok &&
        typeof step.actual === "object" &&
        step.actual &&
        "version" in (step.actual as object)
      ) {
        const version = (step.actual as { version?: number }).version;
        if (typeof version === "number") {
          vars.caseVersion = version;
        }
      }
      if (!step.ok) {
        break;
      }
    }

    // Drain background jobs so notification/SLA assertions see side effects.
    await baseClient.request(
      "POST",
      "/api/jobs/tick",
      { limit: 50, workerId: `sim-${vars.runId}` },
      { "x-jobs-tick-secret": params.testControlSecret }
    );

    for (const [index, assertion] of (params.scenario.assertions ?? []).entries()) {
      const started = Date.now();
      const actorId = assertion.actor ?? params.scenario.actors[0]?.id ?? "actor";
      try {
        const result = await runAssertion({ assertion, actors, vars });
        steps.push({
          scenario: params.scenario.name,
          step: `assert:${assertion.type}#${index + 1}`,
          actor: actorId,
          ok: result.ok,
          expected: result.expected,
          actual: result.actual,
          error: result.detail,
          durationMs: Date.now() - started,
        });
        if (!result.ok) {
          break;
        }
      } catch (error) {
        steps.push({
          scenario: params.scenario.name,
          step: `assert:${assertion.type}#${index + 1}`,
          actor: actorId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - started,
        });
        break;
      }
    }
  } finally {
    const prefix =
      params.scenario.cleanup?.caseTitlePrefix ??
      (typeof params.scenario.setup?.titlePrefix === "string"
        ? params.scenario.setup.titlePrefix
        : undefined);

    if (prefix || createdCaseIds.length) {
      await baseClient.request(
        "POST",
        "/api/test-control/cleanup",
        {
          caseIds: createdCaseIds,
          prefix,
        },
        { "x-test-control-secret": params.testControlSecret }
      );
    }
  }

  const finishedAt = new Date().toISOString();
  return {
    name: params.scenario.name,
    tags: params.scenario.tags ?? [],
    ok: steps.every((step) => step.ok),
    steps,
    startedAt,
    finishedAt,
  };
}

async function executeActionStep(params: {
  scenarioName: string;
  index: number;
  action: ScenarioAction;
  actors: Map<string, AuthenticatedActor>;
  vars: Record<string, unknown>;
  baseClient: ApiClient;
  testControlSecret: string;
}): Promise<StepResult> {
  const started = Date.now();
  const actor = params.actors.get(params.action.actor);
  const stepName =
    params.action.name ?? `${params.action.action}#${params.index + 1}`;

  if (!actor) {
    return {
      scenario: params.scenarioName,
      step: stepName,
      actor: params.action.actor,
      ok: false,
      error: `Unknown actor ${params.action.actor}`,
      durationMs: Date.now() - started,
    };
  }

  try {
    const result = await runAction({
      action: params.action.action,
      actor,
      rawParams: params.action.params,
      vars: params.vars,
      testControlSecret: params.testControlSecret,
      baseClient: params.baseClient,
    });

    const ok = params.action.expectError ? !result.ok : result.ok;
    if (!result.ok && result.errorCode) {
      params.vars.lastErrorCode = result.errorCode;
    }
    return {
      scenario: params.scenarioName,
      step: stepName,
      actor: params.action.actor,
      ok,
      expected: params.action.expectError ? "error" : "success",
      actual: result.saved ?? result.data,
      apiResponse: result.raw,
      correlationId: result.correlationId,
      error: ok
        ? undefined
        : result.errorMessage ??
          (typeof result.raw === "object" && result.raw && "error" in result.raw
            ? JSON.stringify((result.raw as { error: unknown }).error)
            : `HTTP ${result.status}`),
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      scenario: params.scenarioName,
      step: stepName,
      actor: params.action.actor,
      ok: Boolean(params.action.expectError),
      expected: params.action.expectError ? "error" : "success",
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    };
  }
}
