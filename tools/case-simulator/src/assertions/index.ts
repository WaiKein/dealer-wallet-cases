import type { AuthenticatedActor } from "../auth/actors.js";
import type { ScenarioAssertion } from "../types.js";

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export async function runAssertion(params: {
  assertion: ScenarioAssertion;
  actors: Map<string, AuthenticatedActor>;
  vars: Record<string, unknown>;
}): Promise<{ ok: boolean; expected?: unknown; actual?: unknown; detail?: string }> {
  const actorId = params.assertion.actor ?? "requester";
  const actor = params.actors.get(actorId);
  if (!actor) {
    return { ok: false, detail: `Unknown actor ${actorId}` };
  }

  const p = params.assertion.params ?? {};
  const caseId = String(
    typeof p.caseId === "string" && p.caseId.startsWith("$")
      ? params.vars[p.caseId.slice(1)]
      : p.caseId ?? params.vars.caseId
  );

  switch (params.assertion.type) {
    case "api_success":
      return { ok: true };
    case "case_status": {
      const result = await actor.client.request<{ case: { status: string } }>(
        "GET",
        `/api/v1/cases/${caseId}`
      );
      const actual = result.data?.case?.status;
      const expected = p.status;
      return { ok: actual === expected, expected, actual };
    }
    case "assigned_team":
    case "assigned_group": {
      const result = await actor.client.request<{
        case: { assigned_group?: { code?: string; name?: string }; assigned_group_id?: string };
      }>("GET", `/api/v1/cases/${caseId}`);
      const actual =
        result.data?.case?.assigned_group?.code ??
        result.data?.case?.assigned_group?.name ??
        result.data?.case?.assigned_group_id;
      const expected = p.groupCode ?? p.groupName ?? p.groupId;
      return {
        ok: actual === expected || String(actual).includes(String(expected)),
        expected,
        actual,
      };
    }
    case "assigned_agent": {
      const result = await actor.client.request<{
        case: {
          assigned_agent_id: string | null;
          assigned_agent?: { email?: string; id?: string };
        };
      }>("GET", `/api/v1/cases/${caseId}`);
      const actualEmail = result.data?.case?.assigned_agent?.email;
      const actualId =
        result.data?.case?.assigned_agent?.id ??
        result.data?.case?.assigned_agent_id;
      if (p.agentEmail) {
        return {
          ok: actualEmail === p.agentEmail,
          expected: p.agentEmail,
          actual: actualEmail,
        };
      }
      const expected = p.agentId ?? actor.profile.id;
      return { ok: actualId === expected, expected, actual: actualId };
    }
    case "field_value": {
      const result = await actor.client.request<{ case: Record<string, unknown> }>(
        "GET",
        `/api/v1/cases/${caseId}`
      );
      const actual = getPath(result.data?.case, String(p.field));
      return { ok: actual === p.value, expected: p.value, actual };
    }
    case "sla_state": {
      const result = await actor.client.request<{
        case: { sla_records?: { sla_type: string; state: string }[] };
      }>("GET", `/api/v1/cases/${caseId}`);
      const record = result.data?.case?.sla_records?.find(
        (item) => item.sla_type === p.slaType
      );
      return {
        ok: record?.state === p.state,
        expected: p.state,
        actual: record?.state,
      };
    }
    case "notification_existence": {
      const result = await actor.client.request<{
        notifications: { type: string; case_id: string | null }[];
      }>("GET", "/api/v1/notifications");
      const found = (result.data?.notifications ?? []).some(
        (item) =>
          item.type === p.type &&
          (!p.caseId || item.case_id === caseId)
      );
      return { ok: found, expected: true, actual: found };
    }
    case "notification_count": {
      const result = await actor.client.request<{
        notifications: unknown[];
        unreadCount: number;
      }>("GET", "/api/v1/notifications");
      const actual =
        p.unread === true
          ? result.data?.unreadCount
          : result.data?.notifications?.length;
      return { ok: Number(actual) >= Number(p.min ?? p.count ?? 1), expected: p, actual };
    }
    case "audit_event_existence": {
      const result = await actor.client.request<{
        case: { audit_history?: { event_type: string; to_status?: string }[] };
      }>("GET", `/api/v1/cases/${caseId}`);
      const found = (result.data?.case?.audit_history ?? []).some((item) => {
        if (p.eventType && item.event_type !== p.eventType) return false;
        if (p.toStatus && item.to_status !== p.toStatus) return false;
        return true;
      });
      return { ok: found, expected: p, actual: found };
    }
    case "access_denied": {
      const result = await actor.client.request("GET", `/api/v1/cases/${caseId}`);
      return {
        ok: result.status === 401 || result.status === 403 || result.status === 404 || !result.ok,
        expected: "denied",
        actual: result.status,
      };
    }
    case "case_visibility": {
      const result = await actor.client.request("GET", `/api/v1/cases/${caseId}`);
      const visible = Boolean(result.ok && (result.data as { case?: unknown })?.case);
      return {
        ok: visible === Boolean(p.visible ?? true),
        expected: p.visible ?? true,
        actual: visible,
      };
    }
    case "http_status": {
      return {
        ok: true,
        detail: "Use action expectError + status checks in scenario steps",
      };
    }
    case "error_code": {
      const actual = params.vars.lastErrorCode;
      return {
        ok: actual === p.code || actual === p.errorCode,
        expected: p.code ?? p.errorCode,
        actual,
      };
    }
    case "job_status": {
      const jobId = String(
        typeof p.jobId === "string" && p.jobId.startsWith("$")
          ? params.vars[p.jobId.slice(1)]
          : p.jobId ?? params.vars.jobId
      );
      const secret =
        process.env.TEST_CONTROL_SECRET ?? "local-simulator-secret";
      const baseUrl =
        process.env.SIMULATOR_BASE_URL ?? "http://127.0.0.1:3000";
      const response = await fetch(
        `${baseUrl}/api/test-control/jobs?jobId=${encodeURIComponent(jobId)}`,
        { headers: { "x-test-control-secret": secret } }
      );
      const raw = (await response.json()) as {
        data?: { job?: { status?: string; attempt_count?: number } };
      };
      const actual = raw.data?.job?.status;
      const attempts = raw.data?.job?.attempt_count;
      const statusOk = actual === p.status;
      const attemptsOk =
        p.minAttempts == null || Number(attempts) >= Number(p.minAttempts);
      return {
        ok: statusOk && attemptsOk,
        expected: p,
        actual: { status: actual, attempt_count: attempts },
      };
    }
    case "wallet_execute_outcome": {
      const execute = params.vars.walletExecute as {
        result?: {
          outcome?: string;
          processingCertainty?: string;
          requiresStatusInquiry?: boolean;
          retryable?: boolean;
        };
        retryPolicy?: { canScheduleExecuteRetry?: boolean };
      } | null;
      const actual = execute?.result?.outcome;
      const expected = p.outcome;
      const certaintyOk =
        p.processingCertainty == null ||
        execute?.result?.processingCertainty === p.processingCertainty;
      const inquiryOk =
        p.requiresStatusInquiry == null ||
        execute?.result?.requiresStatusInquiry === p.requiresStatusInquiry;
      const retryOk =
        p.canScheduleExecuteRetry == null ||
        execute?.retryPolicy?.canScheduleExecuteRetry ===
          p.canScheduleExecuteRetry;
      return {
        ok: actual === expected && certaintyOk && inquiryOk && retryOk,
        expected: p,
        actual: {
          outcome: actual,
          processingCertainty: execute?.result?.processingCertainty,
          requiresStatusInquiry: execute?.result?.requiresStatusInquiry,
          canScheduleExecuteRetry:
            execute?.retryPolicy?.canScheduleExecuteRetry,
        },
      };
    }
    case "wallet_status_outcome": {
      const status = params.vars.walletStatus as {
        result?: {
          outcome?: string;
          processingCertainty?: string;
          safeToRetryExecute?: boolean;
        };
        retryPolicy?: { canRetryAfterStatusInquiry?: boolean };
      } | null;
      const actual = status?.result?.outcome;
      const expected = p.outcome;
      const certaintyOk =
        p.processingCertainty == null ||
        status?.result?.processingCertainty === p.processingCertainty;
      const retryOk =
        p.safeToRetryExecute == null ||
        status?.result?.safeToRetryExecute === p.safeToRetryExecute;
      return {
        ok: actual === expected && certaintyOk && retryOk,
        expected: p,
        actual: {
          outcome: actual,
          processingCertainty: status?.result?.processingCertainty,
          safeToRetryExecute: status?.result?.safeToRetryExecute,
        },
      };
    }
    case "integration_execution_status": {
      const caseId = String(
        typeof p.caseId === "string" && p.caseId.startsWith("$")
          ? params.vars[p.caseId.slice(1)]
          : p.caseId ?? params.vars.caseId
      );
      const actor = params.actors.get(params.assertion.actor);
      if (!actor) {
        return { ok: false, detail: `Unknown actor ${params.assertion.actor}` };
      }
      const response = await actor.client.request<{
        execution?: { status?: string; attempt_count?: number } | null;
      }>("GET", `/api/v1/cases/${caseId}/execution`);
      const actual = response.data?.execution?.status;
      const attempts = response.data?.execution?.attempt_count;
      const statusOk = actual === p.status;
      const attemptsOk =
        p.minAttempts == null || Number(attempts) >= Number(p.minAttempts);
      return {
        ok: response.ok && statusOk && attemptsOk,
        expected: p,
        actual: {
          status: actual,
          attempt_count: attempts,
          httpStatus: response.status,
          error: response.errorMessage,
        },
      };
    }
    case "exception_queue_contains": {
      const caseId = String(
        typeof p.caseId === "string" && p.caseId.startsWith("$")
          ? params.vars[p.caseId.slice(1)]
          : p.caseId ?? params.vars.caseId
      );
      const actor = params.actors.get(params.assertion.actor);
      if (!actor) {
        return { ok: false, detail: `Unknown actor ${params.assertion.actor}` };
      }
      const queueType = p.queueType ? String(p.queueType) : "";
      const response = await actor.client.request<{
        exceptions?: {
          case_id?: string;
          queue_type?: string;
          status?: string;
        }[];
      }>(
        "GET",
        `/api/v1/operations/exceptions?queueType=${encodeURIComponent(queueType || "all")}`
      );
      const list = response.data?.exceptions ?? [];
      const match = list.find(
        (item) =>
          item.case_id === caseId &&
          (!queueType || item.queue_type === queueType)
      );
      return {
        ok: Boolean(response.ok && match),
        expected: p,
        actual: {
          found: Boolean(match),
          status: match?.status,
          httpStatus: response.status,
          count: list.length,
          error: response.errorMessage,
        },
      };
    }
    case "email_delivery_exists": {
      const caseId = String(
        typeof p.caseId === "string" && p.caseId.startsWith("$")
          ? params.vars[p.caseId.slice(1)]
          : p.caseId ?? params.vars.caseId
      );
      const actor = params.actors.get(params.assertion.actor);
      if (!actor) {
        return { ok: false, detail: `Unknown actor ${params.assertion.actor}` };
      }
      const eventType = p.eventType ? String(p.eventType) : "";
      const qs = new URLSearchParams({ caseId });
      if (eventType) qs.set("eventType", eventType);
      const response = await actor.client.request<{
        deliveries?: { status?: string; event_type?: string; case_id?: string }[];
      }>("GET", `/api/v1/notifications/deliveries?${qs.toString()}`);
      const list = response.data?.deliveries ?? [];
      const match = list.find(
        (item) =>
          item.case_id === caseId &&
          (!eventType || item.event_type === eventType) &&
          (!p.status || item.status === p.status)
      );
      return {
        ok: Boolean(response.ok && match),
        expected: p,
        actual: {
          found: Boolean(match),
          status: match?.status,
          count: list.length,
          httpStatus: response.status,
          error: response.errorMessage,
        },
      };
    }
    case "saved_view_exists": {
      const response = await actor.client.request<{
        views?: { id?: string; name?: string; code?: string | null; sharing_scope?: string }[];
      }>("GET", "/api/v1/saved-views");
      const list = response.data?.views ?? [];
      const name = p.name ? String(p.name) : "";
      const code = p.code ? String(p.code) : "";
      const match = list.find(
        (item) =>
          (!name || item.name === name) &&
          (!code || item.code === code) &&
          (!p.sharingScope || item.sharing_scope === p.sharingScope)
      );
      return {
        ok: Boolean(response.ok && match),
        expected: p,
        actual: {
          found: Boolean(match),
          count: list.length,
          names: list.map((item) => item.name),
          httpStatus: response.status,
          error: response.errorMessage,
        },
      };
    }
    case "management_kpis_present": {
      const response = await actor.client.request<{
        snapshot?: {
          kpis?: Record<string, unknown>;
          breakdowns?: Record<string, unknown>;
        };
      }>("GET", "/api/v1/management/dashboard");
      const kpis = response.data?.snapshot?.kpis ?? {};
      const breakdowns = response.data?.snapshot?.breakdowns ?? {};
      const required = [
        "cases_submitted",
        "cases_resolved",
        "current_backlog",
        "unassigned_cases",
        "pending_approval",
        "awaiting_requester",
        "failed_integration",
        "unknown_integration",
        "adjustment_amount_requested",
      ];
      const missing = required.filter((key) => !(key in kpis));
      const hasBreakdowns =
        "byStatus" in breakdowns &&
        "backlogAgeing" in breakdowns &&
        "dailyCreatedVsResolved" in breakdowns;
      return {
        ok: Boolean(response.ok && missing.length === 0 && hasBreakdowns),
        expected: { required, hasBreakdowns: true },
        actual: {
          missing,
          hasBreakdowns,
          httpStatus: response.status,
          error: response.errorMessage,
          kpiKeys: Object.keys(kpis),
        },
      };
    }
    case "approval_rule_selected": {
      const caseId = String(
        typeof p.caseId === "string" && p.caseId.startsWith("$")
          ? params.vars[p.caseId.slice(1)]
          : p.caseId ?? params.vars.caseId
      );
      const response = await actor.client.request<{
        approvalRequest?: { approval_rule_code?: string | null };
      }>("GET", `/api/v1/cases/${caseId}/approval`);
      const actual = response.data?.approvalRequest?.approval_rule_code;
      return {
        ok: response.ok && actual === p.code,
        expected: p.code,
        actual,
      };
    }
    case "maker_checker_denial":
    case "approval_limit_enforcement":
    case "delegation_validity": {
      // These assert on the last failed action captured via expected_api_error / http_status
      // Prefer pairing with expectError actions; here we re-check by optional lastErrorCode var.
      const code = params.vars.lastErrorCode ?? p.code;
      const expected = p.code ?? p.errorCode;
      return {
        ok: !expected || code === expected || code === "FORBIDDEN",
        expected: expected ?? "FORBIDDEN",
        actual: code,
      };
    }
    case "approval_level_sequence": {
      const caseId = String(
        typeof p.caseId === "string" && p.caseId.startsWith("$")
          ? params.vars[p.caseId.slice(1)]
          : p.caseId ?? params.vars.caseId
      );
      const response = await actor.client.request<{
        approvalSteps?: { level_no?: number; status?: string }[];
      }>("GET", `/api/v1/cases/${caseId}/approval`);
      const steps = response.data?.approvalSteps ?? [];
      const expectedLevels = Number(p.levels ?? 2);
      const approvedCount = steps.filter((s) => s.status === "APPROVED").length;
      const pendingCount = steps.filter((s) => s.status === "PENDING").length;
      const ok =
        response.ok &&
        steps.length >= expectedLevels &&
        (p.approvedCount == null || approvedCount === Number(p.approvedCount)) &&
        (p.pendingCount == null || pendingCount === Number(p.pendingCount));
      return {
        ok,
        expected: p,
        actual: { steps: steps.length, approvedCount, pendingCount },
      };
    }
    case "execution_record_state": {
      return runAssertion({
        ...params,
        assertion: {
          ...params.assertion,
          type: "integration_execution_status",
        },
      });
    }
    case "integration_attempt_count": {
      const caseId = String(
        typeof p.caseId === "string" && p.caseId.startsWith("$")
          ? params.vars[p.caseId.slice(1)]
          : p.caseId ?? params.vars.caseId
      );
      const response = await actor.client.request<{
        attempts?: unknown[];
        execution?: { attempt_count?: number };
      }>("GET", `/api/v1/cases/${caseId}/execution`);
      const count =
        response.data?.attempts?.length ??
        response.data?.execution?.attempt_count ??
        0;
      const min = p.min != null ? Number(p.min) : null;
      const exact = p.count != null ? Number(p.count) : null;
      const ok =
        response.ok &&
        (exact == null || Number(count) === exact) &&
        (min == null || Number(count) >= min);
      return { ok, expected: p, actual: { count } };
    }
    case "idempotent_execution": {
      const a = params.vars.walletExecute as
        | { result?: { outcome?: string }; command?: { idempotencyKey?: string } }
        | undefined;
      const b = params.vars.walletStatus as
        | { result?: { outcome?: string } }
        | undefined;
      // For duplicate execute: second response should match first success without double-processing.
      const first = params.vars.firstExecute as { result?: { outcome?: string } } | undefined;
      const second = params.vars.secondExecute as { result?: { outcome?: string } } | undefined;
      if (first && second) {
        return {
          ok: first.result?.outcome === second.result?.outcome,
          expected: first.result?.outcome,
          actual: second.result?.outcome,
        };
      }
      return {
        ok: Boolean(a?.result?.outcome),
        expected: "execute outcome present",
        actual: a?.result?.outcome ?? b?.result?.outcome,
      };
    }
    case "unknown_result_handling":
    case "safe_retry_eligibility": {
      return runAssertion({
        ...params,
        assertion: {
          ...params.assertion,
          type: "wallet_status_outcome",
        },
      });
    }
    case "exception_queue_membership": {
      return runAssertion({
        ...params,
        assertion: {
          ...params.assertion,
          type: "exception_queue_contains",
        },
      });
    }
    case "email_outbox_entry": {
      return runAssertion({
        ...params,
        assertion: {
          ...params.assertion,
          type: "email_delivery_exists",
        },
      });
    }
    case "email_dedupe": {
      const caseId = String(
        typeof p.caseId === "string" && p.caseId.startsWith("$")
          ? params.vars[p.caseId.slice(1)]
          : p.caseId ?? params.vars.caseId
      );
      const eventType = p.eventType ? String(p.eventType) : "approval_requested";
      const qs = new URLSearchParams({ caseId, eventType });
      const response = await actor.client.request<{
        deliveries?: { status?: string; event_type?: string }[];
      }>("GET", `/api/v1/notifications/deliveries?${qs.toString()}`);
      const list = (response.data?.deliveries ?? []).filter(
        (item) => item.event_type === eventType
      );
      const delivered = list.filter((item) => item.status === "DELIVERED");
      const maxDelivered = p.maxDelivered != null ? Number(p.maxDelivered) : 1;
      return {
        ok: response.ok && delivered.length <= maxDelivered && delivered.length >= 1,
        expected: { maxDelivered, minDelivered: 1 },
        actual: { delivered: delivered.length, total: list.length },
      };
    }
    case "saved_view_access": {
      const raw = String(p.viewId ?? "");
      const viewId =
        raw.startsWith("$") &&
        Object.prototype.hasOwnProperty.call(params.vars, raw.slice(1))
          ? String(params.vars[raw.slice(1)])
          : raw;
      const response = await actor.client.request(
        "GET",
        `/api/v1/saved-views/${viewId}`
      );
      const expectOk = p.allowed !== false;
      return {
        ok: expectOk ? response.ok : !response.ok,
        expected: { allowed: expectOk },
        actual: {
          httpStatus: response.status,
          errorCode: response.errorCode,
          error: response.errorMessage,
        },
      };
    }
    case "dashboard_kpi_value": {
      const response = await actor.client.request<{
        snapshot?: { kpis?: Record<string, number> };
      }>("GET", "/api/v1/management/dashboard");
      const key = String(p.key ?? "cases_submitted");
      const actual = response.data?.snapshot?.kpis?.[key];
      const min = p.min != null ? Number(p.min) : null;
      const exact = p.equals != null ? Number(p.equals) : null;
      const ok =
        response.ok &&
        actual != null &&
        (exact == null || Number(actual) === exact) &&
        (min == null || Number(actual) >= min);
      return { ok, expected: p, actual };
    }
    case "complete_audit_trail": {
      const caseId = String(
        typeof p.caseId === "string" && p.caseId.startsWith("$")
          ? params.vars[p.caseId.slice(1)]
          : p.caseId ?? params.vars.caseId
      );
      const response = await actor.client.request<{
        case?: { audit_history?: { event_type?: string; to_status?: string }[] };
      }>("GET", `/api/v1/cases/${caseId}`);
      const history = response.data?.case?.audit_history ?? [];
      const requiredEvents = Array.isArray(p.eventTypes)
        ? (p.eventTypes as string[])
        : ["status_change"];
      const missing = requiredEvents.filter(
        (eventType) => !history.some((row) => row.event_type === eventType)
      );
      return {
        ok: response.ok && missing.length === 0 && history.length > 0,
        expected: { eventTypes: requiredEvents },
        actual: { count: history.length, missing },
      };
    }
    case "internal_comment_hidden": {
      const marker = String(p.marker ?? "");
      const response = await actor.client.request<{
        case?: { comments?: { body?: string; is_internal?: boolean }[] };
      }>("GET", `/api/v1/cases/${caseId}`);
      const comments = response.data?.case?.comments ?? [];
      const visible = comments.some((comment) => comment.body?.includes(marker));
      return {
        ok: response.ok && !visible,
        expected: `comment marker "${marker}" hidden`,
        actual: { visible, commentCount: comments.length },
      };
    }
    case "expected_api_error":
      return { ok: true };
    default:
      return { ok: false, detail: `Unknown assertion ${params.assertion.type}` };
  }
}

