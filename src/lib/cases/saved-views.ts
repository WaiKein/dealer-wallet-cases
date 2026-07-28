import { createClient } from "@/lib/supabase/server";
import {
  canAccessSavedView,
  canMutateSavedView,
  type SavedCaseView,
} from "@/lib/cases/saved-views-access";
import {
  createSavedViewSchema,
  savedViewFiltersSchema,
  savedViewSortingSchema,
  updateSavedViewSchema,
  type CreateSavedViewInput,
  type SavedViewFilters,
  type SavedViewSorting,
  type UpdateSavedViewInput,
} from "@/lib/cases/saved-view-schema";
import type { ActionResult, Profile } from "@/types";

async function myGroupIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignment_group_members")
    .select("group_id")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.group_id as string);
}

function parseViewRow(row: Record<string, unknown>): SavedCaseView {
  const filtersParsed = savedViewFiltersSchema.safeParse(row.filters ?? {});
  const sortingParsed = savedViewSortingSchema.safeParse(row.sorting ?? {});
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    code: (row.code as string | null) ?? null,
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    owner_id: (row.owner_id as string | null) ?? null,
    team_id: (row.team_id as string | null) ?? null,
    sharing_scope: row.sharing_scope as SavedCaseView["sharing_scope"],
    filters: filtersParsed.success ? filtersParsed.data : {},
    sorting: sortingParsed.success
      ? sortingParsed.data
      : { field: "updated_at", direction: "desc" },
    visible_columns: Array.isArray(row.visible_columns)
      ? (row.visible_columns as string[])
      : [],
    column_order: Array.isArray(row.column_order)
      ? (row.column_order as string[])
      : [],
    page_size: Number(row.page_size ?? 25),
    is_default: Boolean(row.is_default),
    is_system: Boolean(row.is_system),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listSavedCaseViews(
  profile: Profile
): Promise<{ data: SavedCaseView[]; error: string | null }> {
  if (!profile.organization_id) {
    return { data: [], error: null };
  }

  const supabase = await createClient();
  const myTeams = await myGroupIds(profile.id);
  const { data, error } = await supabase
    .from("saved_case_views")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .eq("is_active", true)
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  const views = (data ?? [])
    .map((row) => parseViewRow(row as Record<string, unknown>))
    .filter((view) => canAccessSavedView(profile, view, myTeams));

  return { data: views, error: null };
}

export async function getSavedCaseView(
  profile: Profile,
  viewId: string
): Promise<{ data: SavedCaseView | null; error: string | null; code?: string }> {
  if (!profile.organization_id) {
    return { data: null, error: "Organization required.", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const myTeams = await myGroupIds(profile.id);
  const { data, error } = await supabase
    .from("saved_case_views")
    .select("*")
    .eq("id", viewId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message, code: "VALIDATION_ERROR" };
  }
  if (!data) {
    return { data: null, error: "View not found.", code: "NOT_FOUND" };
  }

  const view = parseViewRow(data as Record<string, unknown>);
  if (!canAccessSavedView(profile, view, myTeams)) {
    return { data: null, error: "View not found.", code: "NOT_FOUND" };
  }

  return { data: view, error: null };
}

export async function createSavedCaseView(
  profile: Profile,
  input: CreateSavedViewInput
): Promise<ActionResult<SavedCaseView>> {
  const parsed = createSavedViewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid view.",
      code: "VALIDATION_ERROR",
    };
  }
  if (!profile.organization_id) {
    return {
      success: false,
      error: "Organization required.",
      code: "FORBIDDEN",
    };
  }

  const body = parsed.data;
  if (body.sharingScope === "organization" && profile.role !== "admin" && profile.role !== "team_lead") {
    return {
      success: false,
      error: "Only team leads and admins can create organisation views.",
      code: "FORBIDDEN",
    };
  }

  if (body.sharingScope === "team" && body.teamId) {
    const myTeams = await myGroupIds(profile.id);
    if (!myTeams.includes(body.teamId) && profile.role !== "admin") {
      return {
        success: false,
        error: "You are not a member of that team.",
        code: "FORBIDDEN",
      };
    }
  }

  const supabase = await createClient();

  if (body.isDefault) {
    await supabase
      .from("saved_case_views")
      .update({ is_default: false })
      .eq("organization_id", profile.organization_id)
      .eq("owner_id", profile.id)
      .eq("sharing_scope", "personal");
  }

  const { data, error } = await supabase
    .from("saved_case_views")
    .insert({
      organization_id: profile.organization_id,
      name: body.name,
      description: body.description ?? null,
      owner_id: profile.id,
      team_id: body.sharingScope === "team" ? body.teamId : null,
      sharing_scope: body.sharingScope,
      filters: body.filters,
      sorting: body.sorting,
      visible_columns: body.visibleColumns ?? [
        "case_number",
        "title",
        "group",
        "agent",
        "status",
        "amount",
      ],
      column_order: body.columnOrder ?? [
        "case_number",
        "title",
        "group",
        "agent",
        "fr_sla",
        "res_sla",
        "age",
        "status",
        "amount",
      ],
      page_size: body.pageSize ?? 25,
      is_default: Boolean(body.isDefault),
      is_system: false,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to create view.",
      code: "VALIDATION_ERROR",
    };
  }

  return { success: true, data: parseViewRow(data as Record<string, unknown>) };
}

export async function updateSavedCaseView(
  profile: Profile,
  viewId: string,
  input: UpdateSavedViewInput
): Promise<ActionResult<SavedCaseView>> {
  const parsed = updateSavedViewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid view.",
      code: "VALIDATION_ERROR",
    };
  }

  const existing = await getSavedCaseView(profile, viewId);
  if (!existing.data) {
    return {
      success: false,
      error: existing.error ?? "View not found.",
      code: existing.code ?? "NOT_FOUND",
    };
  }
  if (!canMutateSavedView(profile, existing.data)) {
    return {
      success: false,
      error: "You cannot modify this view.",
      code: "FORBIDDEN",
    };
  }

  const body = parsed.data;
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (body.filters !== undefined) patch.filters = body.filters;
  if (body.sorting !== undefined) patch.sorting = body.sorting;
  if (body.visibleColumns !== undefined) patch.visible_columns = body.visibleColumns;
  if (body.columnOrder !== undefined) patch.column_order = body.columnOrder;
  if (body.pageSize !== undefined) patch.page_size = body.pageSize;
  if (body.isActive !== undefined) patch.is_active = body.isActive;
  if (body.isDefault !== undefined) patch.is_default = body.isDefault;
  if (body.sharingScope !== undefined) {
    patch.sharing_scope = body.sharingScope;
    patch.team_id =
      body.sharingScope === "team" ? body.teamId ?? existing.data.team_id : null;
  } else if (body.teamId !== undefined) {
    patch.team_id = body.teamId;
  }

  if (body.isDefault && profile.organization_id) {
    await supabase
      .from("saved_case_views")
      .update({ is_default: false })
      .eq("organization_id", profile.organization_id)
      .eq("owner_id", profile.id)
      .neq("id", viewId);
  }

  const { data, error } = await supabase
    .from("saved_case_views")
    .update(patch)
    .eq("id", viewId)
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to update view.",
      code: "VALIDATION_ERROR",
    };
  }

  return { success: true, data: parseViewRow(data as Record<string, unknown>) };
}

export async function deactivateSavedCaseView(
  profile: Profile,
  viewId: string
): Promise<ActionResult> {
  const result = await updateSavedCaseView(profile, viewId, { isActive: false });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      code: result.code,
    };
  }
  return { success: true };
}

export type { SavedViewFilters, SavedViewSorting, SavedCaseView };
