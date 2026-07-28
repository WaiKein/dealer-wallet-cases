import { describe, expect, it } from "vitest";
import {
  canAccessAdminConsole,
  canManageConfiguration,
} from "@/lib/auth/permissions";
import { isUserRole } from "@/lib/auth/roles";
import {
  categoryUpsertSchema,
  changeReasonSchema,
  featureFlagUpsertSchema,
} from "@/lib/validations/admin";

describe("admin permissions", () => {
  it("allows only admin role into the console", () => {
    expect(canAccessAdminConsole("admin")).toBe(true);
    expect(canAccessAdminConsole("team_lead")).toBe(false);
    expect(canAccessAdminConsole("approver")).toBe(false);
    expect(canManageConfiguration("admin")).toBe(true);
  });

  it("recognizes admin as a user role", () => {
    expect(isUserRole("admin")).toBe(true);
  });
});

describe("admin validations", () => {
  it("requires a change reason", () => {
    expect(changeReasonSchema.safeParse("ab").success).toBe(false);
    expect(changeReasonSchema.safeParse("Updated SLA window").success).toBe(true);
  });

  it("validates category upsert payloads", () => {
    const parsed = categoryUpsertSchema.safeParse({
      code: "ADJ",
      name: "Adjustment",
      is_active: true,
      change_reason: "Seed taxonomy",
    });
    expect(parsed.success).toBe(true);
  });

  it("validates feature flag codes", () => {
    expect(
      featureFlagUpsertSchema.safeParse({
        code: "Bad-Code",
        name: "Bad",
        change_reason: "test reason here",
      }).success
    ).toBe(false);
    expect(
      featureFlagUpsertSchema.safeParse({
        code: "require_execution_before_resolve",
        name: "Require execution",
        is_enabled: false,
        change_reason: "pilot default",
      }).success
    ).toBe(true);
  });
});
