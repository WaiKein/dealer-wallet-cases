import { apiError, jsonOk } from "@/lib/api/response";
import {
  enableSystemClock,
  enableTestClock,
  getClock,
  getTestClock,
  isTestControlEnabled,
} from "@/lib/clock";
import { createServiceClient } from "@/lib/supabase/api";

function authorizeTestControl(request: Request): string | null {
  if (!isTestControlEnabled()) {
    return "Test control is disabled.";
  }
  const secret = request.headers.get("x-test-control-secret");
  if (!secret || secret !== process.env.TEST_CONTROL_SECRET) {
    return "Invalid test-control secret.";
  }
  return null;
}

async function auditTestControl(action: string, metadata: Record<string, unknown>) {
  try {
    const service = createServiceClient();
    await service.from("case_audit_history").insert({
      case_id: null,
      event_type: "status_change",
      from_status: null,
      to_status: null,
      changed_by: "00000000-0000-0000-0000-000000000000",
      comment: `[test-control] ${action}`,
      metadata: { test_control: true, action, ...metadata },
    });
  } catch {
    // Audit table requires case_id FK — fall back to console for POC.
    console.info("[test-control]", action, metadata);
  }
}

export async function GET(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return apiError({ code: "FORBIDDEN", message: denied });
  }
  return jsonOk({
    now: getClock().now().toISOString(),
    usingTestClock: Boolean(getTestClock()),
  });
}

export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return apiError({ code: "FORBIDDEN", message: denied });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "reset" | "set" | "advance";
    iso?: string;
    ms?: number;
  };

  if (body.action === "reset") {
    enableSystemClock();
    await auditTestControl("clock.reset", {});
    return jsonOk({ now: getClock().now().toISOString(), usingTestClock: false });
  }

  const clock = getTestClock() ?? enableTestClock();

  if (body.action === "set" && body.iso) {
    clock.set(new Date(body.iso));
    await auditTestControl("clock.set", { iso: body.iso });
    return jsonOk({ now: clock.toISOString(), usingTestClock: true });
  }

  if (body.action === "advance") {
    const ms = Number(body.ms ?? 0);
    clock.advance(ms);
    await auditTestControl("clock.advance", { ms });
    return jsonOk({ now: clock.toISOString(), usingTestClock: true });
  }

  return apiError({
    code: "VALIDATION_ERROR",
    message: "Unsupported clock action. Use reset|set|advance.",
  });
}
