import { describe, expect, it } from "vitest";
import {
  calculateSlaDueAt,
  calculateSlaState,
  canActAsGroupLead,
  canClaimCase,
  matchAssignmentRule,
  pauseResolutionSla,
  resumeResolutionSla,
} from "@/lib/assignment/rules";
import {
  buildNotificationDedupeKey,
  canReceiveNotificationType,
} from "@/lib/notifications/dedupe";
import {
  canAcknowledgeCase,
  canCreateCase,
  canTransition,
  getAvailableTransitions,
} from "@/lib/auth/permissions";
import type { AssignmentRule } from "@/types";

function rule(
  partial: Partial<AssignmentRule> & Pick<AssignmentRule, "sequence" | "assignment_group_id">
): AssignmentRule {
  return {
    id: partial.id ?? `rule-${partial.sequence}`,
    organization_id: "org",
    is_active: partial.is_active ?? true,
    category_id: partial.category_id ?? null,
    subcategory_id: partial.subcategory_id ?? null,
    priority: partial.priority ?? null,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe("assignment-rule matching", () => {
  const rules = [
    rule({
      sequence: 10,
      category_id: "cat-wallet",
      subcategory_id: "sub-chargeback",
      assignment_group_id: "group-chargeback",
    }),
    rule({
      sequence: 20,
      category_id: "cat-wallet",
      subcategory_id: "sub-dup",
      assignment_group_id: "group-wallet",
    }),
    rule({
      sequence: 100,
      category_id: "cat-wallet",
      assignment_group_id: "group-wallet",
    }),
    rule({
      sequence: 5,
      is_active: false,
      category_id: "cat-wallet",
      subcategory_id: "sub-chargeback",
      assignment_group_id: "group-inactive",
    }),
  ];

  it("returns the first active matching rule by sequence", () => {
    const matched = matchAssignmentRule(rules, {
      categoryId: "cat-wallet",
      subcategoryId: "sub-chargeback",
      priority: "high",
    });
    expect(matched?.assignment_group_id).toBe("group-chargeback");
  });

  it("supports wildcard subcategory fallback", () => {
    const matched = matchAssignmentRule(rules, {
      categoryId: "cat-wallet",
      subcategoryId: "sub-other",
      priority: "medium",
    });
    expect(matched?.sequence).toBe(100);
  });

  it("returns null when no rule matches", () => {
    const matched = matchAssignmentRule(rules, {
      categoryId: "cat-unknown",
      subcategoryId: "sub-dup",
      priority: "low",
    });
    expect(matched).toBeNull();
  });
});

describe("SLA calculations", () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");

  it("calculates due dates from duration and paused elapsed time", () => {
    const due = calculateSlaDueAt(startedAt, 60, 120);
    expect(due.toISOString()).toBe("2026-01-01T01:02:00.000Z");
  });

  it("marks due soon at 80 percent elapsed", () => {
    const dueAt = calculateSlaDueAt(startedAt, 100);
    const state = calculateSlaState({
      now: new Date("2026-01-01T01:20:00.000Z"),
      startedAt,
      dueAt,
      durationMinutes: 100,
      state: "RUNNING",
      pausedAt: null,
      pausedElapsedSeconds: 0,
      completedAt: null,
    });
    expect(state).toBe("DUE_SOON");
  });

  it("marks breached when past due", () => {
    const dueAt = calculateSlaDueAt(startedAt, 60);
    const state = calculateSlaState({
      now: new Date("2026-01-01T02:00:00.000Z"),
      startedAt,
      dueAt,
      durationMinutes: 60,
      state: "RUNNING",
      pausedAt: null,
      pausedElapsedSeconds: 0,
      completedAt: null,
    });
    expect(state).toBe("BREACHED");
  });

  it("pauses and resumes resolution SLA idempotently", () => {
    const paused = pauseResolutionSla({
      now: new Date("2026-01-01T00:30:00.000Z"),
      state: "RUNNING",
      pausedAt: null,
      pausedElapsedSeconds: 0,
    });
    expect(paused?.state).toBe("PAUSED");

    const secondPause = pauseResolutionSla({
      now: new Date("2026-01-01T00:40:00.000Z"),
      state: "PAUSED",
      pausedAt: paused!.pausedAt,
      pausedElapsedSeconds: 0,
    });
    expect(secondPause).toBeNull();

    const resumed = resumeResolutionSla({
      now: new Date("2026-01-01T01:00:00.000Z"),
      state: "PAUSED",
      pausedAt: paused!.pausedAt,
      pausedElapsedSeconds: 0,
      startedAt,
      durationMinutes: 120,
    });

    expect(resumed?.pausedElapsedSeconds).toBe(1800);
    expect(resumed?.dueAt).toBe("2026-01-01T02:30:00.000Z");
  });
});

describe("notification dedupe and visibility", () => {
  it("builds stable dedupe keys", () => {
    expect(
      buildNotificationDedupeKey({
        type: "sla_breach",
        caseId: "case-1",
        userId: "user-1",
        suffix: "resolution",
      })
    ).toBe("sla_breach:case-1:user-1:resolution");
  });

  it("hides operational notifications from requesters", () => {
    expect(canReceiveNotificationType("requester", "case_assignment")).toBe(
      false
    );
    expect(canReceiveNotificationType("requester", "case_resolution")).toBe(
      true
    );
    expect(canReceiveNotificationType("approver", "approval_request")).toBe(
      true
    );
  });
});

describe("authorization rules", () => {
  it("allows only requesters to create cases", () => {
    expect(canCreateCase("requester")).toBe(true);
    expect(canCreateCase("operations_agent")).toBe(false);
    expect(canCreateCase("team_lead")).toBe(false);
  });

  it("supports configurable group lead modes", () => {
    expect(
      canActAsGroupLead({
        role: "team_lead",
        isGroupMember: true,
        isMembershipLead: false,
        mode: "role",
      })
    ).toBe(true);

    expect(
      canActAsGroupLead({
        role: "operations_agent",
        isGroupMember: true,
        isMembershipLead: true,
        mode: "membership",
      })
    ).toBe(true);

    expect(
      canActAsGroupLead({
        role: "operations_agent",
        isGroupMember: true,
        isMembershipLead: false,
        mode: "both",
      })
    ).toBe(false);
  });

  it("allows agents to claim unassigned group cases", () => {
    expect(
      canClaimCase({
        role: "operations_agent",
        isGroupMember: true,
        assignedAgentId: null,
      })
    ).toBe(true);
    expect(
      canClaimCase({
        role: "team_lead",
        isGroupMember: true,
        assignedAgentId: null,
      })
    ).toBe(false);
  });

  it("allows acknowledge for assigned agent or unassigned agent/lead", () => {
    expect(canAcknowledgeCase("operations_agent", null, "a1")).toBe(true);
    expect(canAcknowledgeCase("operations_agent", "a1", "a1")).toBe(true);
    expect(canAcknowledgeCase("operations_agent", "a2", "a1")).toBe(false);
  });

  it("includes waiting and reopen transitions", () => {
    const waiting = getAvailableTransitions("UNDER_REVIEW", "operations_agent");
    expect(waiting.map((item) => item.to)).toContain("WAITING_FOR_REQUESTER");
    expect(canTransition("RESOLVED", "UNDER_REVIEW", "team_lead")?.to).toBe(
      "UNDER_REVIEW"
    );
  });
});
