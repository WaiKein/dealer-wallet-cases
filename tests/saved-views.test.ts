import { describe, expect, it } from "vitest";
import {
  canAccessSavedView,
  canMutateSavedView,
  mergeListFilters,
} from "@/lib/cases/saved-views-access";
import {
  createSavedViewSchema,
  savedViewFiltersSchema,
} from "@/lib/cases/saved-view-schema";
import type { Profile } from "@/types";

const agent: Profile = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "agent@example.com",
  full_name: "Agent",
  role: "operations_agent",
  organization_id: "00000000-0000-0000-0000-000000000001",
  created_at: new Date().toISOString(),
};

describe("saved view access", () => {
  it("allows system views to org members", () => {
    expect(
      canAccessSavedView(
        agent,
        {
          organization_id: agent.organization_id!,
          sharing_scope: "system",
          owner_id: null,
          team_id: null,
          is_active: true,
        },
        []
      )
    ).toBe(true);
  });

  it("blocks personal views for non-owners", () => {
    expect(
      canAccessSavedView(
        agent,
        {
          organization_id: agent.organization_id!,
          sharing_scope: "personal",
          owner_id: "11111111-1111-1111-1111-111111111111",
          team_id: null,
          is_active: true,
        },
        []
      )
    ).toBe(false);
  });

  it("requires team membership for team views", () => {
    const view = {
      organization_id: agent.organization_id!,
      sharing_scope: "team" as const,
      owner_id: agent.id,
      team_id: "g1111111-1111-1111-1111-111111111111",
      is_active: true,
    };
    expect(canAccessSavedView(agent, view, [])).toBe(false);
    expect(
      canAccessSavedView(agent, view, ["g1111111-1111-1111-1111-111111111111"])
    ).toBe(true);
  });

  it("blocks mutating system views for non-admins", () => {
    expect(
      canMutateSavedView(agent, {
        organization_id: agent.organization_id!,
        owner_id: null,
        is_system: true,
      })
    ).toBe(false);
  });
});

describe("saved view filters schema", () => {
  it("accepts system-style filters", () => {
    const result = savedViewFiltersSchema.safeParse({
      assignedToMe: true,
      openOnly: true,
      priorities: ["high", "critical"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown filter keys", () => {
    const result = savedViewFiltersSchema.safeParse({
      sneakyOrgId: "00000000-0000-0000-0000-000000000002",
    });
    expect(result.success).toBe(false);
  });

  it("requires teamId for team scope", () => {
    const result = createSavedViewSchema.safeParse({
      name: "Team queue",
      sharingScope: "team",
      filters: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("mergeListFilters", () => {
  it("keeps view actor flags while applying URL overrides", () => {
    const merged = mergeListFilters({
      viewFilters: { assignedToMe: true, openOnly: true },
      overrides: { status: "UNDER_REVIEW", search: "ABC" },
    });
    expect(merged.assignedToMe).toBe(true);
    expect(merged.openOnly).toBe(true);
    expect(merged.statuses).toEqual(["UNDER_REVIEW"]);
    expect(merged.search).toBe("ABC");
  });
});
