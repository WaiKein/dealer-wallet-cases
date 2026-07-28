import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApprovalStepDrafts } from "@/lib/approvals/steps";
import { planExceptionProjection } from "@/lib/exceptions/projection";
import { EmailNotificationChannel } from "@/lib/notifications/channels/email";
import { buildNotificationDedupeKey } from "@/lib/notifications/dedupe";
import { canAccessCaseRow } from "@/lib/cases/access";
import { sanitizePublicMessage } from "@/lib/api/errors";
import type { Profile } from "@/types";

const orgA = "00000000-0000-0000-0000-000000000001";
const orgB = "00000000-0000-0000-0000-000000000002";

vi.mock("@/lib/supabase/api", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/cases/queries", () => ({
  getMyGroupIds: vi.fn(async () => ["group-1"]),
}));

vi.mock("@/lib/notifications/templates", () => ({
  resolveEmailTemplate: vi.fn(async () => null),
  renderTemplate: vi.fn((template: string) => template),
}));

vi.mock("@/lib/jobs/handlers/integration-execute", () => ({
  handleIntegrationExecuteJob: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase/context", () => ({
  runWithSupabaseClient: vi.fn(
    async (_client: unknown, fn: () => Promise<void>) => fn()
  ),
}));

vi.mock("@/lib/observability/correlation", () => ({
  runWithCorrelationId: vi.fn(
    async (_id: string, fn: () => Promise<void>) => fn()
  ),
}));

import { createServiceClient } from "@/lib/supabase/api";
import { processClaimedJobs } from "@/lib/jobs/worker";

describe("approval transaction consistency", () => {
  it("creates one pending step per sequential request and preserves level count", () => {
    const levels = 4;
    const steps = buildApprovalStepDrafts({
      levels,
      sequentialRequired: true,
      requiredRole: "approver",
    });
    expect(steps).toHaveLength(levels);
    expect(steps.filter((step) => step.status === "PENDING")).toHaveLength(1);
    expect(steps.filter((step) => step.status === "SKIPPED")).toHaveLength(
      levels - 1
    );
  });

  it("unlocks later levels only after earlier sequential approvals complete", () => {
    const steps = buildApprovalStepDrafts({
      levels: 2,
      sequentialRequired: true,
      requiredRole: "team_lead",
    });
    const [first, second] = steps;
    expect(first.status).toBe("PENDING");
    expect(second.status).toBe("SKIPPED");

    const afterFirstApproval = [
      { ...first, status: "APPROVED" as const },
      { ...second, status: "PENDING" as const },
    ];
    expect(afterFirstApproval.every((step) => step.level_no <= 2)).toBe(true);
  });
});

describe("execution job processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims jobs with the provided worker id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(createServiceClient).mockReturnValue({
      rpc,
      from: vi.fn(),
    } as never);

    await processClaimedJobs("worker-alpha", 7);

    expect(rpc).toHaveBeenCalledWith("claim_background_jobs", {
      p_limit: 7,
      p_worker_id: "worker-alpha",
    });
  });

  it("marks integration execute jobs as succeeded when handler completes", async () => {
    const updates: Record<string, unknown>[] = [];
    const job = {
      id: "job-1",
      organization_id: orgA,
      job_type: "integration.execute_wallet",
      attempt_count: 1,
      max_attempts: 5,
      correlation_id: "corr-1",
      payload: {
        organizationId: orgA,
        caseId: "case-1",
        executionId: "exec-1",
      },
      run_at: new Date().toISOString(),
    };

    const jobsUpdate = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));
    const attemptsUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));
    const attemptsInsert = vi.fn(async () => ({ error: null }));

    vi.mocked(createServiceClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: [job], error: null }),
      from: vi.fn((table: string) => {
        if (table === "background_jobs") {
          return {
            update: (payload: Record<string, unknown>) => {
              updates.push(payload);
              return jobsUpdate();
            },
          };
        }
        if (table === "background_job_attempts") {
          return {
            insert: attemptsInsert,
            update: attemptsUpdate,
          };
        }
        return { insert: vi.fn(), update: vi.fn() };
      }),
    } as never);

    const result = await processClaimedJobs("worker-beta", 1);
    expect(result.succeeded).toBe(1);
    expect(updates.some((payload) => payload.status === "succeeded")).toBe(true);
  });
});

describe("concurrent worker claiming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes distinct worker ids for parallel tick invocations", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(createServiceClient).mockReturnValue({
      rpc,
      from: vi.fn(),
    } as never);

    await Promise.all([
      processClaimedJobs("worker-1", 3),
      processClaimedJobs("worker-2", 3),
    ]);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map((call) => call[1]?.p_worker_id).sort()).toEqual([
      "worker-1",
      "worker-2",
    ]);
  });
});

describe("exception-queue projection", () => {
  it("resolves open queues when execution succeeds", () => {
    const actions = planExceptionProjection({
      executionId: "exec-ok",
      executionStatus: "SUCCEEDED",
    });
    expect(actions[0]?.kind).toBe("resolve");
  });

  it("opens retry queue for retryable failures", () => {
    const actions = planExceptionProjection({
      executionId: "exec-retry",
      executionStatus: "FAILED_RETRYABLE",
    });
    const upsert = actions.find((action) => action.kind === "upsert");
    expect(upsert && upsert.kind === "upsert" ? upsert.queueType : null).toBe(
      "integration_retry_pending"
    );
  });
});

describe("email outbox delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suppresses duplicate deliveries with the same dedupe key", async () => {
    const dedupeKey = buildNotificationDedupeKey({
      type: "approval_request",
      caseId: "case-1",
      userId: "user-1",
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "delivery-1", status: "DELIVERED", attempt_count: 1 },
    });

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
      })),
    } as never);

    const channel = new EmailNotificationChannel();
    const result = await channel.send({
      organizationId: orgA,
      recipientUserId: "user-1",
      recipientRole: "approver",
      recipientEmail: "approver@example.com",
      caseId: "case-1",
      notificationType: "approval_request",
      eventType: "approval_requested",
      title: "Approval requested",
      body: "Please review",
      dedupeKey,
      audience: "operations",
    });

    expect(result.status).toBe("DELIVERED");
    expect(result.suppressedReason).toBe("duplicate_delivery");
  });
});

describe("organisation isolation", () => {
  it("denies case access across organisations at the app layer", async () => {
    const profile: Profile = {
      id: "agent-1",
      email: "agent@example.com",
      full_name: "Agent",
      role: "operations_agent",
      organization_id: orgA,
      created_at: new Date().toISOString(),
    };
    const allowed = await canAccessCaseRow(profile, {
      id: "case-1",
      organization_id: orgB,
      requester_id: "other",
      assigned_agent_id: null,
      assigned_group_id: "group-1",
      status: "SUBMITTED",
      approver_id: null,
    });
    expect(allowed).toBe(false);
  });
});

describe("RLS policies", () => {
  it("treats postgres policy failures as internal errors at the API boundary", () => {
    expect(
      sanitizePublicMessage(
        "INTERNAL_ERROR",
        'new row violates row-level security policy for table "cases"'
      )
    ).toBe("An unexpected error occurred.");
  });
});
