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
  errorMessage?: string;
  errorCode?: string;
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
      if (p.viewId) {
        const raw = String(p.viewId);
        const viewId =
          raw.startsWith("$") && Object.prototype.hasOwnProperty.call(params.vars, raw.slice(1))
            ? String(params.vars[raw.slice(1)])
            : raw;
        qs.set("viewId", viewId);
      }
      if (p.priority) qs.set("priority", String(p.priority));
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
        {
          body: p.body ?? "Simulator comment",
          is_internal: Boolean(p.is_internal),
        }
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
    case "configure_wallet_mock": {
      return params.baseClient.request(
        "POST",
        "/api/test-control/wallet/mock",
        {
          action: "set",
          scope: p.scope ?? "default",
          idempotencyKey: p.idempotencyKey,
          caseId: p.caseId,
          executeOutcome: p.executeOutcome,
          statusOutcome: p.statusOutcome,
          afterAttempts: p.afterAttempts,
          thenExecuteOutcome: p.thenExecuteOutcome,
        },
        controlHeaders
      );
    }
    case "reset_wallet_mock": {
      return params.baseClient.request(
        "POST",
        "/api/test-control/wallet/mock",
        { action: "reset" },
        controlHeaders
      );
    }
    case "execute_wallet_adjustment": {
      const result = await params.baseClient.request(
        "POST",
        "/api/test-control/wallet/execute",
        {
          idempotencyKey: p.idempotencyKey ?? `sim-wallet-${Date.now()}`,
          correlationId: p.correlationId,
          caseId: p.caseId ?? params.vars.caseId,
          approvalRequestId:
            p.approvalRequestId ??
            params.vars.approvalRequestId ??
            "00000000-0000-4000-8000-000000000001",
          organizationId:
            p.organizationId ??
            params.vars.organizationId ??
            params.actor.profile.organization_id,
          requestedAmount: p.requestedAmount ?? 100,
          approvedAmount: p.approvedAmount ?? p.requestedAmount ?? 100,
          accountId: p.accountId ?? "ACCT-SIM-001",
          referenceId: p.referenceId ?? "REF-SIM-001",
          currency: p.currency ?? "USD",
          adjustmentType: p.adjustmentType ?? "credit",
        },
        controlHeaders
      );
      return {
        ...result,
        saved: result.data,
      };
    }
    case "inquire_wallet_status": {
      const prior =
        (params.vars.walletExecute as {
          command?: { requestHash?: string; idempotencyKey?: string };
          result?: { externalTransactionRef?: string | null };
        }) ?? {};
      const result = await params.baseClient.request(
        "POST",
        "/api/test-control/wallet/status",
        {
          idempotencyKey:
            p.idempotencyKey ??
            prior.command?.idempotencyKey ??
            params.vars.walletIdempotencyKey,
          correlationId: p.correlationId,
          caseId: p.caseId ?? params.vars.caseId,
          approvalRequestId:
            p.approvalRequestId ??
            params.vars.approvalRequestId ??
            "00000000-0000-4000-8000-000000000001",
          organizationId:
            p.organizationId ??
            params.vars.organizationId ??
            params.actor.profile.organization_id,
          requestHash: p.requestHash ?? prior.command?.requestHash,
          externalTransactionRef:
            p.externalTransactionRef ??
            prior.result?.externalTransactionRef ??
            null,
          accountId: p.accountId ?? "ACCT-SIM-001",
          referenceId: p.referenceId ?? "REF-SIM-001",
        },
        controlHeaders
      );
      return { ...result, saved: result.data };
    }
    case "set_feature_flag": {
      return params.baseClient.request(
        "POST",
        "/api/test-control/feature-flags",
        {
          code: p.code,
          isEnabled: Boolean(p.isEnabled),
          organizationId:
            p.organizationId ?? params.actor.profile.organization_id,
        },
        controlHeaders
      );
    }
    case "list_saved_views": {
      return client.request("GET", "/api/v1/saved-views");
    }
    case "get_management_dashboard": {
      const qs = new URLSearchParams();
      if (p.from) qs.set("from", String(p.from));
      if (p.to) qs.set("to", String(p.to));
      const suffix = qs.toString() ? `?${qs}` : "";
      return client.request("GET", `/api/v1/management/dashboard${suffix}`);
    }
    case "create_saved_view": {
      const result = await client.request(
        "POST",
        "/api/v1/saved-views",
        {
          name: p.name ?? `Sim view ${Date.now()}`,
          description: p.description ?? null,
          sharingScope: p.sharingScope ?? "personal",
          teamId: p.teamId,
          filters: p.filters ?? {},
          sorting: p.sorting ?? { field: "updated_at", direction: "desc" },
          isDefault: Boolean(p.isDefault),
        }
      );
      return {
        ...result,
        saved: (result.data as { view?: unknown })?.view,
      };
    }
    case "load_saved_view": {
      const raw = String(p.viewId ?? "");
      const viewId =
        raw.startsWith("$") &&
        Object.prototype.hasOwnProperty.call(params.vars, raw.slice(1))
          ? String(params.vars[raw.slice(1)])
          : raw;
      return client.request("GET", `/api/v1/saved-views/${viewId}`);
    }
    case "create_approval_rule":
    case "update_approval_rule": {
      let ruleId = p.id ? String(p.id) : undefined;
      const code = String(p.code ?? `sim_rule_${Date.now()}`);
      if (!ruleId && params.action === "create_approval_rule") {
        const existing = await client.request(
          "GET",
          `/api/v1/admin/config?resource=approval-rules&q=${encodeURIComponent(code)}&active=all&pageSize=100`
        );
        const root = existing.data as Record<string, unknown> | null;
        const nested = root?.data as Record<string, unknown> | undefined;
        const deep = nested?.data as Record<string, unknown> | undefined;
        const items = (root?.items ??
          nested?.items ??
          deep?.items ??
          []) as { id?: string; code?: string; version?: number }[];
        const matches = items.filter((item) => item.code === code);
        matches.sort(
          (a, b) => Number(b.version ?? 0) - Number(a.version ?? 0)
        );
        const match = matches[0];
        if (match?.id) ruleId = match.id;
      }
      // Prefer stable sequence from params once we have an id (update path).
      const sequence = Number(p.sequence ?? 10);
      const result = await client.request("POST", "/api/v1/admin/config", {
        resource: "approval-rules",
        payload: {
          id: ruleId,
          code,
          name: p.name ?? "Simulator approval rule",
          sequence,
          min_amount: p.min_amount ?? null,
          max_amount: p.max_amount ?? null,
          approval_levels: p.approval_levels ?? 1,
          sequential_required: p.sequential_required ?? true,
          required_approver_role: p.required_approver_role ?? "approver",
          approver_limit: p.approver_limit ?? null,
          is_active: p.is_active ?? true,
          change_reason: p.change_reason ?? "Simulator approval rule upsert",
        },
      });
      return {
        ...result,
        saved:
          (result.data as { record?: unknown })?.record ?? result.data,
      };
    }
    case "approve_level":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/transition`,
        transitionBody(p, "APPROVED", {
          comment: p.comment ?? "Level approved",
          approved_amount: p.approved_amount,
        }),
        idempotencyHeaders(p)
      );
    case "reject_level":
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/transition`,
        transitionBody(p, "REJECTED", {
          rejection_reason: p.rejection_reason ?? "Level rejected",
          comment: p.comment ?? p.rejection_reason ?? "Level rejected",
        }),
        idempotencyHeaders(p)
      );
    case "get_approval": {
      const result = await client.request(
        "GET",
        `/api/v1/cases/${String(p.caseId)}/approval`
      );
      return {
        ...result,
        saved: (result.data as { approvalRequest?: unknown })?.approvalRequest,
      };
    }
    case "create_delegation": {
      const result = await client.request("POST", "/api/v1/delegations", {
        id: p.id,
        delegate_id: p.delegate_id ?? p.delegateId,
        approval_limit: p.approval_limit ?? p.approvalLimit ?? null,
        effective_from: p.effective_from ?? p.effectiveFrom,
        effective_to: p.effective_to ?? p.effectiveTo ?? null,
        is_active: p.is_active ?? true,
        change_reason: p.change_reason ?? "Simulator delegation",
      });
      return {
        ...result,
        saved: (result.data as { delegation?: unknown })?.delegation,
      };
    }
    case "deactivate_my_delegations": {
      const listed = await client.request<{
        delegations?: { id?: string; is_active?: boolean; delegate_id?: string }[];
      }>("GET", "/api/v1/delegations");
      const active = (listed.data?.delegations ?? []).filter(
        (row) => row.is_active && row.id
      );
      let last: Awaited<ReturnType<typeof client.request>> | null = null;
      for (const row of active) {
        last = await client.request("POST", "/api/v1/delegations", {
          id: row.id,
          delegate_id: row.delegate_id,
          is_active: false,
          change_reason: "Simulator deactivate prior delegations",
        });
      }
      return (
        last ?? {
          ok: true,
          status: 200,
          data: { deactivated: 0 },
          raw: { deactivated: active.length },
        }
      );
    }
    case "run_integration_worker":
    case "run_notification_worker":
    case "generate_email_notification": {
      return params.baseClient.request(
        "POST",
        "/api/jobs/tick",
        { limit: p.limit ?? 50, workerId: `sim-worker-${Date.now()}` },
        { "x-jobs-tick-secret": params.testControlSecret }
      );
    }
    case "run_status_inquiry": {
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/execution/inquire`,
        { expectedVersion: p.expectedVersion }
      );
    }
    case "retry_safe_execution": {
      return client.request(
        "POST",
        `/api/v1/cases/${String(p.caseId)}/execution/retry`,
        { expectedVersion: p.expectedVersion }
      );
    }
    case "get_execution": {
      const result = await client.request(
        "GET",
        `/api/v1/cases/${String(p.caseId)}/execution`
      );
      return {
        ...result,
        saved: (result.data as { execution?: unknown })?.execution,
      };
    }
    case "resolve_operational_exception": {
      const raw = String(p.exceptionId ?? "");
      const exceptionId =
        raw.startsWith("$") &&
        Object.prototype.hasOwnProperty.call(params.vars, raw.slice(1))
          ? String(params.vars[raw.slice(1)])
          : raw;
      return client.request(
        "POST",
        `/api/v1/operations/exceptions/${exceptionId}/resolve`,
        {
          resolutionNote: p.resolutionNote ?? "Resolved via simulator",
          dismiss: Boolean(p.dismiss),
        }
      );
    }
    case "list_exceptions": {
      const qs = new URLSearchParams();
      if (p.queueType) qs.set("queueType", String(p.queueType));
      if (p.includeResolved) qs.set("includeResolved", "true");
      const suffix = qs.toString() ? `?${qs}` : "";
      const result = await client.request(
        "GET",
        `/api/v1/operations/exceptions${suffix}`
      );
      const list =
        (result.data as { exceptions?: { id?: string; case_id?: string }[] })
          ?.exceptions ?? [];
      const caseId = p.caseId
        ? String(
            String(p.caseId).startsWith("$")
              ? params.vars[String(p.caseId).slice(1)]
              : p.caseId
          )
        : null;
      const match = caseId
        ? list.find((item) => item.case_id === caseId)
        : list[0];
      return { ...result, saved: match };
    }
    case "advance_mock_provider_state": {
      return params.baseClient.request(
        "POST",
        "/api/test-control/wallet/mock",
        {
          action: "set",
          scope: p.scope ?? "default",
          idempotencyKey: p.idempotencyKey,
          caseId: p.caseId,
          executeOutcome: p.executeOutcome,
          statusOutcome: p.statusOutcome,
          afterAttempts: p.afterAttempts,
          thenExecuteOutcome: p.thenExecuteOutcome,
        },
        controlHeaders
      );
    }
    case "create_fixture_organization": {
      const result = await params.baseClient.request(
        "POST",
        "/api/test-control/fixtures/organization",
        { name: p.name ?? `Sim Org ${Date.now()}` },
        controlHeaders
      );
      return {
        ...result,
        saved: {
          id: (result.data as { organizationId?: string })?.organizationId,
        },
      };
    }
    case "create_fixture_saved_view": {
      const orgRaw = String(p.organizationId ?? "");
      const organizationId =
        orgRaw.startsWith("$") &&
        Object.prototype.hasOwnProperty.call(params.vars, orgRaw.slice(1))
          ? String(params.vars[orgRaw.slice(1)])
          : orgRaw;
      const result = await params.baseClient.request(
        "POST",
        "/api/test-control/fixtures/saved-view",
        {
          organizationId,
          name: p.name ?? "Foreign org view",
          sharingScope: p.sharingScope ?? "organization",
        },
        controlHeaders
      );
      return {
        ...result,
        saved: (result.data as { view?: unknown })?.view,
      };
    }
    case "list_admin_resource": {
      const qs = new URLSearchParams({
        resource: String(p.resource ?? "approval-rules"),
      });
      if (p.q) qs.set("q", String(p.q));
      return client.request("GET", `/api/v1/admin/config?${qs.toString()}`);
    }
    default:
      throw new Error(`Unknown action: ${params.action}`);
  }
}
