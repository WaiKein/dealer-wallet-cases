import { describe, expect, it } from "vitest";
import {
  canAssignAgent,
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

  it("allows agents and approvers to view all cases", () => {
    expect(canViewAllCases("requester")).toBe(false);
    expect(canViewAllCases("operations_agent")).toBe(true);
    expect(canViewAllCases("approver")).toBe(true);
  });

  it("allows agents to assign during early workflow statuses", () => {
    expect(canAssignAgent("operations_agent", "SUBMITTED")).toBe(true);
    expect(canAssignAgent("operations_agent", "UNDER_REVIEW")).toBe(true);
    expect(canAssignAgent("operations_agent", "PENDING_APPROVAL")).toBe(false);
    expect(canAssignAgent("approver", "SUBMITTED")).toBe(false);
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

  it("blocks requester from changing status", () => {
    expect(canTransition("SUBMITTED", "UNDER_REVIEW", "requester")).toBeNull();
  });

  it("allows agent to resolve approved cases", () => {
    const transition = canTransition("APPROVED", "RESOLVED", "operations_agent");
    expect(transition?.to).toBe("RESOLVED");
  });
});
