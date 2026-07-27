import type { AuthenticatedActor } from "../auth/actors.js";
import type { ApiClient } from "../api/client.js";

function transitionBody(
  p: Record<string, unknown>,
  nextStatus: string,
  extra: Record<string, unknown> = {}
) {
  const body: Record<string, unknown> = {
    nextStatus,
    ...extra,
  };
  if (p.expectedVersion != null) {
    body.expectedVersion = p.expectedVersion;
  } else if (p.caseVersion != null) {
    body.expectedVersion = p.caseVersion;
  }
  return body;
}

function idempotencyHeaders(p: Record<string, unknown>) {
  if (!p.idempotencyKey) return undefined;
  return { "Idempotency-Key": String(p.idempotencyKey) };
}

function resolve(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    if (value.startsWith("$") && !value.includes("-") && !value.slice(1).includes("$")) {
      const key = value.slice(1);
      if (Object.prototype.hasOwnProperty.call(vars, key)) {
        return vars[key];
      }
    }
    if (value.includes("$")) {
      return value.replace(/\$([A-Za-z0-9_]+)/g, (_, name: string) => {
        const found = vars[name];
        return found == null ? `$${name}` : String(found);
      });
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolve(item, vars));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = resolve(item, vars);
    }
    return out;
  }
  return value;
}

export async function runAction(params: {
  action: string;
  actor: AuthenticatedActor;
  rawParams?: Record<string, unknown>;
  vars: Record<string, unknown>;
  testControlSecret: string;
  baseClient: ApiClient;
}): Promise<{
  ok: boolean;
  status: number;
  data: unknown;
  raw: unknown;
  correlationId?: string;
  saved?: unknown;
}> {
  const p = {
    ...((resolve(params.rawParams ?? {}, params.vars) ?? {}) as Record<
      string,
      unknown
    >),
  };
  if (p.expectedVersion == null && params.vars.caseVersion != null) {
    p.expectedVersion = params.vars.caseVersion;
  }
  const client = params.actor.client;
  const controlHeaders = {
    "x-test-control-secret": params.testControlSecret,
  };

  switch (params.action) {
    case "authenticate":
      return {
        ok: true,
        status: 200,
        data: { actorId: params.actor.id },
        raw: {},
      };
    case "create_case": {
      const taxonomy = await client.request<{
        categories: { id: string; code: string }[];
        subcategories: { id: string; code: string; category_id: string }[];
      }>("GET", "/api/v1/taxonomy");
      const categoryCode = String(p.categoryCode ?? "wallet");
      const subcategoryCode = String(p.subcategoryCode ?? "duplicate_credit");
      const category = taxonomy.data.categories.find((c) => c.code === categoryCode);
      const subcategory = taxonomy.data.subcategories.find(
        (s) => s.code === subcategoryCode
      );
      const result = await client.request<{ id: string; case_number: string }>(
        "POST",
        "/api/v1/cases",
        {
          title: p.title ?? `Simulator case ${Date.now()}`,
          description:
            p.description ??
            "Simulator-generated wallet adjustment case for workflow validation.",
          adjustment_amount: p.adjustment_amount ?? 100,
          adjustment_type: p.adjustment_type ?? "credit",
          currency: p.currency ?? "USD",
          priority: p.priority ?? "medium",
          category_id: p.category_id ?? category?.id,
          subcategory_id: p.subcategory_id ?? subcategory?.id,
          wallet_id: p.wallet_id,
        },
        idempotencyHeaders(p)
      );
      return { ...result, saved: result.data };
    }
    case "get_case": {
      const result = await client.request(
        "GET",
        `/api/v1/cases/${String(p.caseId)}`
      );
      return { ...result, saved: (result.data as { case?: unknown })?.case };
    }
    case "list_cases": {
      const qs = new URLSearchParams();
      if (p.status) qs.set("status", String(p.status));
      if (p.search) qs.set("search", String(p.search));
      const suffix = qs.toString() ? `?${qs}` : "";
      return client.request("GET", `/api/v1/cases${suffix}`);
    }
    case "claim_case":
      return client.request("POST", `/api/v1/cases/${String(p.caseId)}/claim`);
    case "acknowledge_case":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/acknowledge`
      );
    case "add_comment":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/comments`,
        { body: p.body ?? "Simulator comment" }
      );
    case "request_information":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/transition`,
        transitionBody(p, "WAITING_FOR_REQUESTER", {
          comment: p.comment ?? "Need more information",
        }),
        idempotencyHeaders(p)
      );
    case "submit_information":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/transition`,
        transitionBody(p, "UNDER_REVIEW", {
          comment: p.comment ?? "Information provided",
        }),
        idempotencyHeaders(p)
      );
    case "request_approval":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/transition`,
        transitionBody(p, "PENDING_APPROVAL", {
          comment: p.comment ?? "Ready for approval",
        }),
        idempotencyHeaders(p)
      );
    case "approve_case":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/transition`,
        transitionBody(p, "APPROVED", {
          comment: p.comment ?? "Approved",
        }),
        idempotencyHeaders(p)
      );
    case "reject_case":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/transition`,
        transitionBody(p, "REJECTED", {
          rejection_reason: p.rejection_reason ?? "Rejected by simulator",
          comment:
            p.comment ?? p.rejection_reason ?? "Rejected by simulator",
        }),
        idempotencyHeaders(p)
      );
    case "resolve_case":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/transition`,
        transitionBody(p, "RESOLVED", {
          resolution_notes: p.resolution_notes ?? "Resolved by simulator",
          comment: p.comment,
        }),
        idempotencyHeaders(p)
      );
    case "reopen_case":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/transition`,
        transitionBody(p, "UNDER_REVIEW", {
          comment: p.comment ?? "Reopened by simulator",
        }),
        idempotencyHeaders(p)
      );
    case "start_review":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/transition`,
        transitionBody(p, "UNDER_REVIEW", { comment: p.comment }),
        idempotencyHeaders(p)
      );
    case "advance_time": {
      const result = await params.baseClient.request(
        "POST",
        "/api/test-control/clock",
        { action: "advance", ms: p.ms ?? 0 },
        controlHeaders
      );
      return result;
    }
    case "set_clock": {
      return params.baseClient.request(
        "POST",
        "/api/test-control/clock",
        { action: "set", iso: p.iso },
        controlHeaders
      );
    }
    case "reset_clock": {
      return params.baseClient.request(
        "POST",
        "/api/test-control/clock",
        { action: "reset" },
        controlHeaders
      );
    }
    case "run_sla_processor": {
      return params.baseClient.request(
        "POST",
        "/api/test-control/sla/refresh",
        { caseId: p.caseId },
        controlHeaders
      );
    }
    case "drain_jobs": {
      return params.baseClient.request(
        "POST",
        "/api/jobs/tick",
        { limit: p.limit ?? 50, workerId: `sim-drain-${Date.now()}` },
        { "x-jobs-tick-secret": params.testControlSecret }
      );
    }
    case "enqueue_test_job": {
      return params.baseClient.request(
        "POST",
        "/api/test-control/jobs/enqueue",
        {
          jobType: p.jobType ?? "jobs.fail_once",
          organizationId: p.organizationId,
          payload: p.payload ?? {},
          maxAttempts: p.maxAttempts ?? 3,
          idempotencyKey: p.idempotencyKey,
        },
        controlHeaders
      );
    }
    default:
      throw new Error(`Unknown action: ${params.action}`);
  }
}
