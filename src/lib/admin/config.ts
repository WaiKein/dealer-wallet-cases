import { recordConfigurationAudit } from "@/lib/admin/audit";
import { resolveApprovalRuleVersioning } from "@/lib/admin/approval-rule-versioning";
import { assertAdmin, requireOrgId } from "@/lib/admin/guard";
import { createServiceClient } from "@/lib/supabase/api";
import { createClient } from "@/lib/supabase/server";
import {
  approvalRuleUpsertSchema,
  assignmentRuleUpsertSchema,
  categoryUpsertSchema,
  featureFlagUpsertSchema,
  notificationTemplateUpsertSchema,
  organizationUpdateSchema,
  paginationSchema,
  profileUpdateSchema,
  slaDefinitionUpsertSchema,
  subcategoryUpsertSchema,
  teamMembershipUpsertSchema,
  teamUpsertSchema,
  type PaginationInput,
} from "@/lib/validations/admin";
import type {
  ActionResult,
  ApprovalRule,
  AssignmentGroup,
  AssignmentGroupMember,
  AssignmentRule,
  Category,
  ConfigurationAuditEntry,
  FeatureFlag,
  NotificationTemplate,
  Organization,
  Profile,
  SlaDefinition,
  Subcategory,
} from "@/types";

type ListResult<T> = ActionResult<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}>;

function parsePagination(input?: Partial<PaginationInput>) {
  return paginationSchema.parse(input ?? {});
}

function applyActiveFilter<T extends { eq: (c: string, v: boolean) => T }>(
  query: T,
  active: PaginationInput["active"]
) {
  if (active === "active") return query.eq("is_active", true);
  if (active === "inactive") return query.eq("is_active", false);
  return query;
}

export async function listConfigurationHistory(
  profile: Profile,
  configurationType: string,
  configurationId: string
): Promise<ActionResult<{ items: ConfigurationAuditEntry[] }>> {
  const denied = assertAdmin(profile);
  if (denied) return denied;
  const orgId = requireOrgId(profile);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuration_audit")
    .select("*")
    .eq("organization_id", orgId)
    .eq("configuration_type", configurationType)
    .eq("configuration_id", configurationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { success: false, error: error.message, code: "VALIDATION_ERROR" };
  }
  return { success: true, data: { items: (data ?? []) as ConfigurationAuditEntry[] } };
}

export async function getAdminOrganization(
  profile: Profile
): Promise<ActionResult<{ organization: Organization }>> {
  const denied = assertAdmin(profile);
  if (denied) return denied;
  const orgId = requireOrgId(profile);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Organization not found.", code: "NOT_FOUND" };
  }
  return { success: true, data: { organization: data as Organization } };
}

export async function updateAdminOrganization(
  profile: Profile,
  input: unknown
): Promise<ActionResult<{ organization: Organization }>> {
  const denied = assertAdmin(profile);
  if (denied) return denied;
  const orgId = requireOrgId(profile);
  const parsed = organizationUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid organization.",
      code: "VALIDATION_ERROR",
    };
  }

  const current = await getAdminOrganization(profile);
  if (!current.success || !current.data) return current;

  const supabase = await createClient();
  const nextVersion = Number(current.data.organization.version ?? 1) + 1;
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      lead_authorization_mode: parsed.data.lead_authorization_mode,
      is_active: parsed.data.is_active ?? current.data.organization.is_active ?? true,
      version: nextVersion,
      updated_by: profile.id,
      change_reason: parsed.data.change_reason,
    })
    .eq("id", orgId)
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Update failed.", code: "VALIDATION_ERROR" };
  }

  await recordConfigurationAudit({
    organizationId: orgId,
    configurationType: "organization",
    configurationId: orgId,
    previousValue: current.data.organization as unknown as Record<string, unknown>,
    newValue: data as unknown as Record<string, unknown>,
    actor: profile,
    changeReason: parsed.data.change_reason,
  });

  return { success: true, data: { organization: data as Organization } };
}

export async function listAdminProfiles(
  profile: Profile,
  input?: Partial<PaginationInput>
): Promise<ListResult<Profile>> {
  const denied = assertAdmin(profile);
  if (denied) return denied;
  const orgId = requireOrgId(profile);
  const paging = parsePagination(input);
  const supabase = await createClient();
  const from = (paging.page - 1) * paging.pageSize;
  const to = from + paging.pageSize - 1;

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .order("full_name", { ascending: true })
    .range(from, to);

  query = applyActiveFilter(query, paging.active);
  if (paging.q) {
    query = query.or(
      `full_name.ilike.%${paging.q}%,email.ilike.%${paging.q}%`
    );
  }

  const { data, error, count } = await query;
  if (error) {
    return { success: false, error: error.message, code: "VALIDATION_ERROR" };
  }
  return {
    success: true,
    data: {
      items: (data ?? []) as Profile[],
      total: count ?? 0,
      page: paging.page,
      pageSize: paging.pageSize,
    },
  };
}

export async function updateAdminProfile(
  profile: Profile,
  input: unknown
): Promise<ActionResult<{ profile: Profile }>> {
  const denied = assertAdmin(profile);
  if (denied) return denied;
  const orgId = requireOrgId(profile);
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid profile.",
      code: "VALIDATION_ERROR",
    };
  }

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Profile not found in your organization.", code: "NOT_FOUND" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      is_active: parsed.data.is_active,
      updated_by: profile.id,
      change_reason: parsed.data.change_reason,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId)
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Update failed.", code: "VALIDATION_ERROR" };
  }

  await recordConfigurationAudit({
    organizationId: orgId,
    configurationType: "profile",
    configurationId: parsed.data.id,
    previousValue: existing as unknown as Record<string, unknown>,
    newValue: data as unknown as Record<string, unknown>,
    actor: profile,
    changeReason: parsed.data.change_reason,
  });

  return { success: true, data: { profile: data as Profile } };
}

async function listOrgTable<T>(
  profile: Profile,
  table: string,
  input?: Partial<PaginationInput>,
  searchColumns: string[] = ["name", "code"]
): Promise<ListResult<T>> {
  const denied = assertAdmin(profile);
  if (denied) return denied;
  const orgId = requireOrgId(profile);
  const paging = parsePagination(input);
  const supabase = await createClient();
  const from = (paging.page - 1) * paging.pageSize;
  const to = from + paging.pageSize - 1;

  let query = supabase
    .from(table)
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(from, to);

  query = applyActiveFilter(query, paging.active);
  if (paging.q && searchColumns.length) {
    query = query.or(
      searchColumns.map((col) => `${col}.ilike.%${paging.q}%`).join(",")
    );
  }

  const { data, error, count } = await query;
  if (error) {
    return { success: false, error: error.message, code: "VALIDATION_ERROR" };
  }
  return {
    success: true,
    data: {
      items: (data ?? []) as T[],
      total: count ?? 0,
      page: paging.page,
      pageSize: paging.pageSize,
    },
  };
}

export function listAdminCategories(profile: Profile, input?: Partial<PaginationInput>) {
  return listOrgTable<Category>(profile, "categories", input);
}

export function listAdminSubcategories(profile: Profile, input?: Partial<PaginationInput>) {
  return listOrgTable<Subcategory>(profile, "subcategories", input);
}

export function listAdminTeams(profile: Profile, input?: Partial<PaginationInput>) {
  return listOrgTable<AssignmentGroup>(profile, "assignment_groups", input);
}

export function listAdminAssignmentRules(profile: Profile, input?: Partial<PaginationInput>) {
  return listOrgTable<AssignmentRule>(profile, "assignment_rules", input, []);
}

export function listAdminSlaDefinitions(profile: Profile, input?: Partial<PaginationInput>) {
  return listOrgTable<SlaDefinition>(profile, "sla_definitions", input, []);
}

export function listAdminApprovalRules(profile: Profile, input?: Partial<PaginationInput>) {
  return listOrgTable<ApprovalRule>(profile, "approval_rules", input);
}

export function listAdminNotificationTemplates(
  profile: Profile,
  input?: Partial<PaginationInput>
) {
  return listOrgTable<NotificationTemplate>(profile, "notification_templates", input);
}

export function listAdminFeatureFlags(profile: Profile, input?: Partial<PaginationInput>) {
  return listOrgTable<FeatureFlag>(profile, "feature_flags", input);
}

export async function listAdminTeamMemberships(
  profile: Profile,
  input?: Partial<PaginationInput> & { groupId?: string }
): Promise<ListResult<AssignmentGroupMember>> {
  const denied = assertAdmin(profile);
  if (denied) return denied;
  const orgId = requireOrgId(profile);
  const paging = parsePagination(input);
  const supabase = await createClient();
  const from = (paging.page - 1) * paging.pageSize;
  const to = from + paging.pageSize - 1;

  let query = supabase
    .from("assignment_group_members")
    .select(
      "*, profile:profiles!assignment_group_members_user_id_fkey(id, full_name, email, role), group:assignment_groups!inner(id, organization_id, name, code)",
      { count: "exact" }
    )
    .eq("group.organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input?.groupId) {
    query = query.eq("group_id", input.groupId);
  }
  query = applyActiveFilter(query, paging.active);

  const { data, error, count } = await query;
  if (error) {
    return { success: false, error: error.message, code: "VALIDATION_ERROR" };
  }
  return {
    success: true,
    data: {
      items: (data ?? []) as AssignmentGroupMember[],
      total: count ?? 0,
      page: paging.page,
      pageSize: paging.pageSize,
    },
  };
}

async function upsertConfigRecord<T extends { id: string; version?: number }>(params: {
  profile: Profile;
  table: string;
  configurationType: string;
  id?: string;
  payload: Record<string, unknown>;
  changeReason: string;
  /** Override auto-increment when callers already know the next version. */
  nextVersion?: number;
}): Promise<ActionResult<{ record: T }>> {
  const denied = assertAdmin(params.profile);
  if (denied) return denied;
  const orgId = requireOrgId(params.profile);
  const supabase = await createClient();

  if (params.id) {
    const { data: existing, error: fetchError } = await supabase
      .from(params.table)
      .select("*")
      .eq("id", params.id)
      .eq("organization_id", orgId)
      .single();
    if (fetchError || !existing) {
      return { success: false, error: "Record not found.", code: "NOT_FOUND" };
    }

    const version =
      params.nextVersion ?? Number(existing.version ?? 1) + 1;

    const { data, error } = await supabase
      .from(params.table)
      .update({
        ...params.payload,
        version,
        updated_by: params.profile.id,
        change_reason: params.changeReason,
      })
      .eq("id", params.id)
      .eq("organization_id", orgId)
      .select("*")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Update failed.", code: "VALIDATION_ERROR" };
    }

    await recordConfigurationAudit({
      organizationId: orgId,
      configurationType: params.configurationType,
      configurationId: params.id,
      previousValue: existing as Record<string, unknown>,
      newValue: data as Record<string, unknown>,
      actor: params.profile,
      changeReason: params.changeReason,
    });

    return { success: true, data: { record: data as T } };
  }

  const { data, error } = await supabase
    .from(params.table)
    .insert({
      ...params.payload,
      organization_id: orgId,
      version: 1,
      created_by: params.profile.id,
      updated_by: params.profile.id,
      change_reason: params.changeReason,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Create failed.", code: "VALIDATION_ERROR" };
  }

  await recordConfigurationAudit({
    organizationId: orgId,
    configurationType: params.configurationType,
    configurationId: data.id,
    previousValue: null,
    newValue: data as Record<string, unknown>,
    actor: params.profile,
    changeReason: params.changeReason,
  });

  return { success: true, data: { record: data as T } };
}

export async function upsertAdminCategory(profile: Profile, input: unknown) {
  const parsed = categoryUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid category.",
      code: "VALIDATION_ERROR",
    };
  }
  const { id, change_reason, ...payload } = parsed.data;
  return upsertConfigRecord<Category>({
    profile,
    table: "categories",
    configurationType: "category",
    id,
    payload,
    changeReason: change_reason,
  });
}

export async function upsertAdminSubcategory(profile: Profile, input: unknown) {
  const parsed = subcategoryUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid subcategory.",
      code: "VALIDATION_ERROR",
    };
  }
  const { id, change_reason, ...payload } = parsed.data;
  return upsertConfigRecord<Subcategory>({
    profile,
    table: "subcategories",
    configurationType: "subcategory",
    id,
    payload,
    changeReason: change_reason,
  });
}

export async function upsertAdminTeam(profile: Profile, input: unknown) {
  const parsed = teamUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid team.",
      code: "VALIDATION_ERROR",
    };
  }
  const { id, change_reason, ...payload } = parsed.data;
  return upsertConfigRecord<AssignmentGroup>({
    profile,
    table: "assignment_groups",
    configurationType: "team",
    id,
    payload: { ...payload, description: payload.description ?? null },
    changeReason: change_reason,
  });
}

export async function upsertAdminAssignmentRule(profile: Profile, input: unknown) {
  const parsed = assignmentRuleUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid assignment rule.",
      code: "VALIDATION_ERROR",
    };
  }
  const { id, change_reason, ...payload } = parsed.data;
  return upsertConfigRecord<AssignmentRule>({
    profile,
    table: "assignment_rules",
    configurationType: "assignment_rule",
    id,
    payload: {
      ...payload,
      category_id: payload.category_id ?? null,
      subcategory_id: payload.subcategory_id ?? null,
      priority: payload.priority ?? null,
    },
    changeReason: change_reason,
  });
}

export async function upsertAdminSlaDefinition(profile: Profile, input: unknown) {
  const parsed = slaDefinitionUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid SLA definition.",
      code: "VALIDATION_ERROR",
    };
  }
  const { id, change_reason, ...payload } = parsed.data;
  return upsertConfigRecord<SlaDefinition>({
    profile,
    table: "sla_definitions",
    configurationType: "sla_definition",
    id,
    payload,
    changeReason: change_reason,
  });
}

export async function upsertAdminApprovalRule(profile: Profile, input: unknown) {
  const parsed = approvalRuleUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid approval rule.",
      code: "VALIDATION_ERROR",
    };
  }
  const { id, change_reason, ...payload } = parsed.data;
  const orgId = requireOrgId(profile);
  // Prefer service client so idempotent simulator/admin upserts always see
  // prior versions even if the user-scoped select is unexpectedly empty.
  const lookupClient = createServiceClient();
  const { data: sameCodeRows } = await lookupClient
    .from("approval_rules")
    .select("id, version")
    .eq("organization_id", orgId)
    .eq("code", payload.code)
    .order("version", { ascending: false });

  const versioning = resolveApprovalRuleVersioning({
    id,
    code: payload.code,
    rows: (sameCodeRows ?? []) as { id: string; version: number }[],
  });
  const resolvedId = versioning.resolvedId;
  const maxVersion = Math.max(
    0,
    ...(sameCodeRows ?? []).map((row) => Number(row.version ?? 0))
  );

  // Keep a single live row per code: update the latest and retire older clones.
  if (versioning.staleIds.length) {
      await lookupClient
        .from("approval_rules")
        .update({ is_active: false, change_reason: "Superseded duplicate code row" })
        .in("id", versioning.staleIds);
  }

  return upsertConfigRecord<ApprovalRule>({
    profile,
    table: "approval_rules",
    configurationType: "approval_rule",
    id: resolvedId,
    // Force next version above any existing code/version pairs.
    nextVersion: resolvedId ? maxVersion + 1 : undefined,
    payload: {
      ...payload,
      case_type: payload.case_type ?? null,
      category_id: payload.category_id ?? null,
      subcategory_id: payload.subcategory_id ?? null,
      min_amount: payload.min_amount ?? null,
      max_amount: payload.max_amount ?? null,
      priority: payload.priority ?? null,
      requester_role: payload.requester_role ?? null,
      requester_team_id: payload.requester_team_id ?? null,
      assignment_group_id: payload.assignment_group_id ?? null,
      risk_level: payload.risk_level ?? null,
      required_approver_role: payload.required_approver_role ?? null,
      required_approver_team_id: payload.required_approver_team_id ?? null,
      approver_limit: payload.approver_limit ?? null,
    },
    changeReason: change_reason,
  });
}

export async function upsertAdminNotificationTemplate(profile: Profile, input: unknown) {
  const parsed = notificationTemplateUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid template.",
      code: "VALIDATION_ERROR",
    };
  }
  const { id, change_reason, ...payload } = parsed.data;
  return upsertConfigRecord<NotificationTemplate>({
    profile,
    table: "notification_templates",
    configurationType: "notification_template",
    id,
    payload: {
      ...payload,
      subject_template: payload.subject_template ?? null,
      variables: payload.variables,
    },
    changeReason: change_reason,
  });
}

export async function upsertAdminFeatureFlag(profile: Profile, input: unknown) {
  const parsed = featureFlagUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid feature flag.",
      code: "VALIDATION_ERROR",
    };
  }
  const { id, change_reason, ...payload } = parsed.data;
  return upsertConfigRecord<FeatureFlag>({
    profile,
    table: "feature_flags",
    configurationType: "feature_flag",
    id,
    payload: {
      ...payload,
      description: payload.description ?? null,
    },
    changeReason: change_reason,
  });
}

export async function upsertAdminTeamMembership(profile: Profile, input: unknown) {
  const denied = assertAdmin(profile);
  if (denied) return denied;
  const orgId = requireOrgId(profile);
  const parsed = teamMembershipUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid membership.",
      code: "VALIDATION_ERROR",
    };
  }

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("assignment_groups")
    .select("id")
    .eq("id", parsed.data.group_id)
    .eq("organization_id", orgId)
    .single();
  if (!group) {
    return { success: false as const, error: "Team not found.", code: "NOT_FOUND" };
  }

  const { data: memberProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.user_id)
    .eq("organization_id", orgId)
    .single();
  if (!memberProfile) {
    return {
      success: false as const,
      error: "User must belong to your organization.",
      code: "FORBIDDEN",
    };
  }

  if (parsed.data.id) {
    const { data: existing, error: fetchError } = await supabase
      .from("assignment_group_members")
      .select("*")
      .eq("id", parsed.data.id)
      .single();
    if (fetchError || !existing) {
      return { success: false as const, error: "Membership not found.", code: "NOT_FOUND" };
    }
    const { data, error } = await supabase
      .from("assignment_group_members")
      .update({
        is_lead: parsed.data.is_lead,
        is_active: parsed.data.is_active,
        version: Number(existing.version ?? 1) + 1,
        updated_by: profile.id,
        change_reason: parsed.data.change_reason,
      })
      .eq("id", parsed.data.id)
      .select("*")
      .single();
    if (error || !data) {
      return {
        success: false as const,
        error: error?.message ?? "Update failed.",
        code: "VALIDATION_ERROR",
      };
    }
    await recordConfigurationAudit({
      organizationId: orgId,
      configurationType: "team_membership",
      configurationId: parsed.data.id,
      previousValue: existing as Record<string, unknown>,
      newValue: data as Record<string, unknown>,
      actor: profile,
      changeReason: parsed.data.change_reason,
    });
    return { success: true as const, data: { record: data as AssignmentGroupMember } };
  }

  const { data, error } = await supabase
    .from("assignment_group_members")
    .insert({
      group_id: parsed.data.group_id,
      user_id: parsed.data.user_id,
      is_lead: parsed.data.is_lead,
      is_active: parsed.data.is_active,
      version: 1,
      created_by: profile.id,
      updated_by: profile.id,
      change_reason: parsed.data.change_reason,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false as const,
      error: error?.message ?? "Create failed.",
      code: "VALIDATION_ERROR",
    };
  }

  await recordConfigurationAudit({
    organizationId: orgId,
    configurationType: "team_membership",
    configurationId: data.id,
    previousValue: null,
    newValue: data as Record<string, unknown>,
    actor: profile,
    changeReason: parsed.data.change_reason,
  });

  return { success: true as const, data: { record: data as AssignmentGroupMember } };
}

export const APPLICATION_ROLES = [
  {
    role: "admin",
    label: "Administrator",
    description: "Manages organisation configuration in the admin console.",
  },
  {
    role: "requester",
    label: "Requester",
    description: "Creates and tracks wallet-adjustment cases.",
  },
  {
    role: "operations_agent",
    label: "Operations Agent",
    description: "Claims and works cases within assigned teams.",
  },
  {
    role: "team_lead",
    label: "Team Lead",
    description: "Leads teams, reassigns work, and oversees queues.",
  },
  {
    role: "approver",
    label: "Approver",
    description: "Approves or rejects cases pending approval.",
  },
] as const;
