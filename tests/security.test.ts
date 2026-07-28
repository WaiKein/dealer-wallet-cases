import { describe, expect, it } from "vitest";
import { canAccessCaseRow } from "@/lib/cases/access";
import {
  canPostInternalComment,
  canAccessAdminConsole,
} from "@/lib/auth/permissions";
import {
  maskCaseFinancialFields,
  maskExecutionPayloadForRole,
  shouldMaskFinancialIdentifiers,
} from "@/lib/security/masking";
import { maskAccountId } from "@/lib/wallet/hash";
import type { Profile } from "@/types";

function profile(overrides: Partial<Profile>): Profile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    email: "user@example.com",
    full_name: "User",
    role: "requester",
    organization_id: "00000000-0000-0000-0000-000000000001",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Profile;
}

describe("case access boundaries", () => {
  it("denies cross-organisation case access", async () => {
    const allowed = await canAccessCaseRow(
      profile({ role: "operations_agent" }),
      {
        id: "case-1",
        organization_id: "other-org",
        requester_id: "other-user",
        assigned_agent_id: null,
        assigned_group_id: null,
        status: "SUBMITTED",
        approver_id: null,
      }
    );
    expect(allowed).toBe(false);
  });

  it("allows requester access to own case", async () => {
    const user = profile({ role: "requester" });
    const allowed = await canAccessCaseRow(user, {
      id: "case-1",
      organization_id: user.organization_id,
      requester_id: user.id,
      assigned_agent_id: null,
      assigned_group_id: null,
      status: "SUBMITTED",
      approver_id: null,
    });
    expect(allowed).toBe(true);
  });
});

describe("internal comment permissions", () => {
  it("blocks requesters from posting internal comments", () => {
    expect(canPostInternalComment("requester")).toBe(false);
    expect(canPostInternalComment("operations_agent")).toBe(true);
  });
});

describe("financial identifier masking", () => {
  it("masks account identifiers for requesters and approvers", () => {
    expect(shouldMaskFinancialIdentifiers("requester")).toBe(true);
    expect(shouldMaskFinancialIdentifiers("approver")).toBe(true);
    expect(shouldMaskFinancialIdentifiers("operations_agent")).toBe(false);
  });

  it("masks case dealer and wallet ids for requesters", () => {
    const masked = maskCaseFinancialFields(
      { dealer_id: "ACC123456", wallet_id: "REF987654" },
      profile({ role: "requester" })
    );
    expect(masked.dealer_id).toBe(maskAccountId("ACC123456"));
    expect(masked.wallet_id).toBe(maskAccountId("REF987654"));
  });

  it("masks execution account ids in API payloads", () => {
    const masked = maskExecutionPayloadForRole({
      execution: {
        id: "exec-1",
        account_id: "ACC123456",
        reference_id: "REF987654",
      } as never,
      attempts: [],
      role: "approver",
    });
    expect(masked.execution?.account_id).toBe(maskAccountId("ACC123456"));
    expect(masked.execution?.reference_id).toBe(maskAccountId("REF987654"));
  });
});

describe("admin boundaries", () => {
  it("restricts admin console to admin role only", () => {
    expect(canAccessAdminConsole("admin")).toBe(true);
    expect(canAccessAdminConsole("team_lead")).toBe(false);
    expect(canAccessAdminConsole("operations_agent")).toBe(false);
  });
});
