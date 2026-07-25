import { describe, expect, it } from "vitest";
import {
  canCreateCase,
  canTransition,
  canViewAllCases,
  getAvailableTransitions,
} from "@/lib/auth/permissions";

describe("role permissions", () => {
  it("allows only requesters to create cases", () => {
    expect(canCreateCase("requester")).toBe(true);
    expect(canCreateCase("operations_agent")).toBe(false);
    expect(canCreateCase("approver")).toBe(false);
  });

  it("allows agents, leads, and approvers to view org case queues", () => {
    expect(canViewAllCases("requester")).toBe(false);
    expect(canViewAllCases("operations_agent")).toBe(true);
    expect(canViewAllCases("team_lead")).toBe(true);
    expect(canViewAllCases("approver")).toBe(true);
  });
});

describe("status transitions", () => {
  it("returns agent transitions from SUBMITTED", () => {
    const transitions = getAvailableTransitions("SUBMITTED", "operations_agent");
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.to).toBe("UNDER_REVIEW");
  });

  it("returns approver transitions from PENDING_APPROVAL", () => {
    const transitions = getAvailableTransitions(
      "PENDING_APPROVAL",
      "approver"
    );
    expect(transitions.map((item) => item.to)).toEqual(["APPROVED", "REJECTED"]);
  });

  it("blocks requester from changing status except leaving wait", () => {
    expect(canTransition("SUBMITTED", "UNDER_REVIEW", "requester")).toBeNull();
    expect(
      canTransition("WAITING_FOR_REQUESTER", "UNDER_REVIEW", "requester")?.to
    ).toBe("UNDER_REVIEW");
  });

  it("allows agent to resolve approved cases", () => {
    const transition = canTransition("APPROVED", "RESOLVED", "operations_agent");
    expect(transition?.to).toBe("RESOLVED");
  });
});
