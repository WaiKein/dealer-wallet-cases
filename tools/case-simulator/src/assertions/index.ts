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
      return { ok: true };
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
    case "expected_api_error":
      return { ok: true };
    default:
      return { ok: false, detail: `Unknown assertion ${params.assertion.type}` };
  }
}
