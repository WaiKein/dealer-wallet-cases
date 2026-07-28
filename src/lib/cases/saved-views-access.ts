import type { SavedViewFilters, SavedViewSorting } from "@/lib/cases/saved-view-schema";
import type { Profile } from "@/types";

export type SavedViewSharingScope =
  | "personal"
  | "team"
  | "organization"
  | "system";

export interface SavedCaseView {
  id: string;
  organization_id: string;
  code: string | null;
  name: string;
  description: string | null;
  owner_id: string | null;
  team_id: string | null;
  sharing_scope: SavedViewSharingScope;
  filters: SavedViewFilters;
  sorting: SavedViewSorting;
  visible_columns: string[];
  column_order: string[];
  page_size: number;
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Can the actor load this view row (tenant + sharing). Case ACL still applies on list. */
export function canAccessSavedView(
  profile: Profile,
  view: Pick<
    SavedCaseView,
    "organization_id" | "sharing_scope" | "owner_id" | "team_id" | "is_active"
  >,
  myTeamIds: string[]
): boolean {
  if (!view.is_active) return false;
  if (
    !profile.organization_id ||
    view.organization_id !== profile.organization_id
  ) {
    return false;
  }
  if (profile.role === "admin") return true;
  if (view.sharing_scope === "organization" || view.sharing_scope === "system") {
    return true;
  }
  if (view.sharing_scope === "personal") {
    return view.owner_id === profile.id;
  }
  if (view.sharing_scope === "team") {
    return Boolean(view.team_id && myTeamIds.includes(view.team_id));
  }
  return false;
}

export function canMutateSavedView(
  profile: Profile,
  view: Pick<SavedCaseView, "owner_id" | "is_system" | "organization_id">
): boolean {
  if (
    !profile.organization_id ||
    view.organization_id !== profile.organization_id
  ) {
    return false;
  }
  if (profile.role === "admin") return true;
  if (view.is_system) return false;
  return view.owner_id === profile.id;
}

/**
 * Merge URL overrides onto a saved view's filters.
 * Actor-scoped flags from the saved view are kept; clients cannot inject
 * assignedToMe/unassignedInMyTeams/pendingMyApproval via URL alone without view.
 */
export function mergeListFilters(params: {
  viewFilters: SavedViewFilters;
  overrides?: Partial<SavedViewFilters> & {
    status?: string;
    search?: string;
    priority?: string;
    categoryId?: string;
    subcategoryId?: string;
    assignedGroupId?: string;
    assignedAgentId?: string;
    accountId?: string;
    referenceId?: string;
  };
}): SavedViewFilters {
  const o = params.overrides ?? {};
  const base = { ...params.viewFilters };

  if (o.status) {
    base.statuses = [o.status as NonNullable<SavedViewFilters["statuses"]>[number]];
    delete base.status;
  }
  if (o.search !== undefined) base.search = o.search;
  if (o.priority) {
    base.priorities = [
      o.priority as NonNullable<SavedViewFilters["priorities"]>[number],
    ];
  }
  if (o.categoryId) base.categoryId = o.categoryId;
  if (o.subcategoryId) base.subcategoryId = o.subcategoryId;
  if (o.assignedGroupId) base.assignedGroupId = o.assignedGroupId;
  if (o.assignedAgentId) base.assignedAgentId = o.assignedAgentId;
  if (o.accountId) base.accountId = o.accountId;
  if (o.referenceId) base.referenceId = o.referenceId;

  return base;
}
