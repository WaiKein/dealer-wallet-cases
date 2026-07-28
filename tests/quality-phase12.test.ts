import { describe, expect, it } from "vitest";
import { buildApprovalStepDrafts } from "@/lib/approvals/steps";
import { resolveApprovalRuleVersioning } from "@/lib/admin/approval-rule-versioning";
import { planExceptionProjection } from "@/lib/exceptions/projection";
import { normalizeManagementDashboardSnapshot } from "@/lib/management/service";
import { buildNotificationDedupeKey } from "@/lib/notifications/dedupe";
import { hashWalletRequest } from "@/lib/wallet/hash";
import { buildWalletAdjustmentCommand } from "@/lib/wallet/command";

describe("approval level generation", () => {
  it("creates a single pending level for one-level rules", () => {
    expect(
      buildApprovalStepDrafts({
        levels: 1,
        sequentialRequired: true,
        requiredRole: "approver",
      })
    ).toEqual([
      {
        level_no: 1,
        status: "PENDING",
        required_role: "approver",
        required_team_id: null,
      },
    ]);
  });

  it("keeps only level 1 pending when sequential approval is required", () => {
    const steps = buildApprovalStepDrafts({
      levels: 3,
      sequentialRequired: true,
      requiredRole: "team_lead",
      requiredTeamId: "team-1",
    });
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.status)).toEqual([
      "PENDING",
      "SKIPPED",
      "SKIPPED",
    ]);
  });

  it("marks every level pending when sequential approval is disabled", () => {
    const steps = buildApprovalStepDrafts({
      levels: 2,
      sequentialRequired: false,
      requiredRole: "approver",
    });
    expect(steps.every((step) => step.status === "PENDING")).toBe(true);
  });
});

describe("configuration version selection", () => {
  it("reuses the latest row id and bumps version monotonically", () => {
    const result = resolveApprovalRuleVersioning({
      code: "HIGH_VALUE",
      rows: [
        { id: "old", version: 1 },
        { id: "latest", version: 3 },
      ],
    });
    expect(result.resolvedId).toBe("latest");
    expect(result.nextVersion).toBe(4);
    expect(result.staleIds).toEqual(["old"]);
  });

  it("honours an explicit id when provided", () => {
    const result = resolveApprovalRuleVersioning({
      id: "explicit",
      code: "HIGH_VALUE",
      rows: [
        { id: "explicit", version: 2 },
        { id: "other", version: 5 },
      ],
    });
    expect(result.resolvedId).toBe("explicit");
    expect(result.nextVersion).toBe(6);
    expect(result.staleIds).toEqual(["other"]);
  });
});

describe("notification deduplication", () => {
  it("builds stable dedupe keys per user and case", () => {
    const key = buildNotificationDedupeKey({
      type: "approval_request",
      caseId: "case-1",
      userId: "user-1",
      suffix: "v1",
    });
    expect(key).toBe("approval_request:case-1:user-1:v1");
    expect(
      buildNotificationDedupeKey({
        type: "approval_request",
        caseId: "case-1",
        userId: "user-2",
        suffix: "v1",
      })
    ).not.toBe(key);
  });
});

describe("execution idempotency", () => {
  it("hashes identical wallet commands to the same value", () => {
    const command = buildWalletAdjustmentCommand({
      idempotencyKey: "idem-42",
      correlationId: "corr-42",
      caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      approvalRequestId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      organizationId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      requestedAmount: 250,
      approvedAmount: 250,
      accountId: "ACCT-12345678",
      referenceId: "REF-9",
      currency: "USD",
      adjustmentType: "credit",
    });
    expect(hashWalletRequest(command)).toBe(hashWalletRequest(command));
  });
});

describe("exception queue projection", () => {
  it("opens retry queue for retryable failures", () => {
    const actions = planExceptionProjection({
      executionId: "exec-1",
      executionStatus: "FAILED_RETRYABLE",
    });
    expect(actions.some((action) => action.kind === "upsert")).toBe(true);
    const upsert = actions.find((action) => action.kind === "upsert");
    expect(upsert && upsert.kind === "upsert" ? upsert.queueType : null).toBe(
      "integration_retry_pending"
    );
  });

  it("routes unknown executions to the unknown queue", () => {
    const actions = planExceptionProjection({
      executionId: "exec-2",
      executionStatus: "UNKNOWN",
    });
    const upsert = actions.find((action) => action.kind === "upsert");
    expect(upsert && upsert.kind === "upsert" ? upsert.queueType : null).toBe(
      "integration_unknown"
    );
  });
});

describe("dashboard aggregation normalization", () => {
  it("coerces rpc payload numbers and preserves breakdown arrays", () => {
    const snapshot = normalizeManagementDashboardSnapshot({
      organizationId: "org-1",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.000Z",
      kpis: {
        cases_submitted: "12",
        pending_approval: 3,
        integration_success_rate_pct: "88.5",
      },
      breakdowns: {
        byStatus: { SUBMITTED: 2 },
        byCategory: [{ key: "wallet", label: "Wallet", count: 5 }],
      },
    });
    expect(snapshot.kpis.cases_submitted).toBe(12);
    expect(snapshot.kpis.pending_approval).toBe(3);
    expect(snapshot.kpis.integration_success_rate_pct).toBe(88.5);
    expect(snapshot.breakdowns.byCategory[0]?.label).toBe("Wallet");
  });
});
