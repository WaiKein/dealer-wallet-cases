import { describe, expect, it } from "vitest";
import { canAccessManagementDashboard } from "@/lib/auth/permissions";
import { managementDashboardFilterSchema } from "@/lib/management/types";

describe("management dashboard access", () => {
  it("allows ops leadership roles and blocks requesters", () => {
    expect(canAccessManagementDashboard("operations_agent")).toBe(true);
    expect(canAccessManagementDashboard("team_lead")).toBe(true);
    expect(canAccessManagementDashboard("approver")).toBe(true);
    expect(canAccessManagementDashboard("admin")).toBe(true);
    expect(canAccessManagementDashboard("requester")).toBe(false);
  });
});

describe("management dashboard filters", () => {
  it("accepts a valid ISO range", () => {
    const result = managementDashboardFilterSchema.safeParse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects inverted ranges", () => {
    const result = managementDashboardFilterSchema.safeParse({
      from: "2026-02-01T00:00:00.000Z",
      to: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
