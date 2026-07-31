import { createClient } from "@/lib/supabase/server";
import { canViewAllCases } from "@/lib/auth/permissions";
import { enqueueSlaRefresh } from "@/lib/jobs/domain-enqueue";
import {
  mergeListFilters,
  type SavedCaseView,
} from "@/lib/cases/saved-views-access";
import { getSavedCaseView } from "@/lib/cases/saved-views";
import type { SavedViewFilters, SavedViewSorting } from "@/lib/cases/saved-view-schema";
import type { CaseListFilterInput } from "@/lib/validations/case";
import { maskCaseFinancialFields } from "@/lib/security/masking";
import type {
  AssignmentGroup,
  AssignmentGroupMember,
  CaseAttachment,
  CaseComment,
  CaseSla,
  CaseStatus,
  CaseWithRelations,
  Category,
  Profile,
  Subcategory,
} from "@/types";

const CASE_SELECT = `
  *,
  requester:profiles!cases_requester_id_fkey(id, full_name, email),
  assigned_agent:profiles!cases_assigned_agent_id_fkey(id, full_name, email),
  assigned_group:assignment_groups!cases_assigned_group_id_fkey(id, name, code),
  category:categories!cases_category_id_fkey(id, name, code),
  subcategory:subcategories!cases_subcategory_id_fkey(id, name, code),
  approver:profiles!cases_approver_id_fkey(id, full_name, email),
  current_execution:case_integration_executions!cases_current_integration_execution_id_fkey(id, status)
`;

const OPEN_STATUSES: CaseStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "WAITING_FOR_REQUESTER",
  "WAITING_FOR_EXTERNAL_PARTY",
  "PENDING_APPROVAL",
  "APPROVED",
];

function sortCases(
  cases: CaseWithRelations[],
  sorting?: SavedViewSorting
): CaseWithRelations[] {
  const field = sorting?.field ?? "updated_at";
  const dir = sorting?.direction === "asc" ? 1 : -1;
  const priorityRank: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return [...cases].sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    if (field === "priority") {
      av = priorityRank[a.priority] ?? 0;
      bv = priorityRank[b.priority] ?? 0;
    } else if (field === "adjustment_amount") {
      av = Number(a.adjustment_amount);
      bv = Number(b.adjustment_amount);
    } else if (field === "case_number" || field === "title" || field === "status") {
      av = String(a[field] ?? "");
      bv = String(b[field] ?? "");
    } else {
      av = String(a[field as "created_at" | "updated_at"] ?? "");
      bv = String(b[field as "created_at" | "updated_at"] ?? "");
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

export async function listCases(
  profile: Profile,
  filters: CaseListFilterInput = {}
): Promise<{
  data: CaseWithRelations[];
  error: string | null;
  view?: SavedCaseView | null;
}> {
  let view: SavedCaseView | null = null;
  let viewFilters: SavedViewFilters = {};
  let sorting: SavedViewSorting | undefined;

  if (filters.viewId) {
    const loaded = await getSavedCaseView(profile, filters.viewId);
    if (loaded.error || !loaded.data) {
      return {
        data: [],
        error: loaded.error ?? "Saved view not found.",
        view: null,
      };
    }
    view = loaded.data;
    viewFilters = loaded.data.filters;
    sorting = loaded.data.sorting;
  }

  const applied = mergeListFilters({
    viewFilters,
    overrides: {
      status: filters.status,
      search: filters.search,
      priority: filters.priority,
      categoryId: filters.categoryId,
      subcategoryId: filters.subcategoryId,
      assignedGroupId: filters.assignedGroupId,
      assignedAgentId: filters.assignedAgentId,
      accountId: filters.accountId,
      referenceId: filters.referenceId,
    },
  });

  const supabase = await createClient();
  let query = supabase.from("cases").select(CASE_SELECT);

  if (profile.organization_id) {
    query = query.eq("organization_id", profile.organization_id);
  }

  // Always enforce requester scoping — saved views cannot bypass this.
  if (!canViewAllCases(profile.role)) {
    query = query.eq("requester_id", profile.id);
  }

  const statuses =
    applied.statuses ??
    (applied.status ? [applied.status] : undefined) ??
    (applied.openOnly ? OPEN_STATUSES : undefined) ??
    (applied.pendingMyApproval ? (["PENDING_APPROVAL"] as CaseStatus[]) : undefined);

  if (statuses?.length === 1) {
    query = query.eq("status", statuses[0]);
  } else if (statuses && statuses.length > 1) {
    query = query.in("status", statuses);
  }

  const priorities =
    applied.priorities ??
    (applied.priority ? [applied.priority] : undefined);
  if (priorities?.length === 1) {
    query = query.eq("priority", priorities[0]);
  } else if (priorities && priorities.length > 1) {
    query = query.in("priority", priorities);
  }

  if (applied.categoryId) query = query.eq("category_id", applied.categoryId);
  if (applied.subcategoryId) {
    query = query.eq("subcategory_id", applied.subcategoryId);
  }
  if (applied.assignedGroupId) {
    query = query.eq("assigned_group_id", applied.assignedGroupId);
  }
  if (applied.assignedAgentId) {
    query = query.eq("assigned_agent_id", applied.assignedAgentId);
  }
  if (applied.requesterId && canViewAllCases(profile.role)) {
    query = query.eq("requester_id", applied.requesterId);
  }
  if (applied.assignedToMe) {
    query = query.eq("assigned_agent_id", profile.id);
  }
  if (applied.accountId?.trim()) {
    query = query.ilike("dealer_id", `%${applied.accountId.trim()}%`);
  }
  if (applied.referenceId?.trim()) {
    query = query.ilike("wallet_id", `%${applied.referenceId.trim()}%`);
  }
  if (applied.amountMin != null) {
    query = query.gte("adjustment_amount", applied.amountMin);
  }
  if (applied.amountMax != null) {
    query = query.lte("adjustment_amount", applied.amountMax);
  }
  if (applied.createdFrom) query = query.gte("created_at", applied.createdFrom);
  if (applied.createdTo) query = query.lte("created_at", applied.createdTo);
  if (applied.updatedFrom) query = query.gte("updated_at", applied.updatedFrom);
  if (applied.updatedTo) query = query.lte("updated_at", applied.updatedTo);
  if (applied.updatedWithinHours) {
    const since = new Date(
      Date.now() - applied.updatedWithinHours * 3600 * 1000
    ).toISOString();
    query = query.gte("updated_at", since);
  }

  if (applied.search?.trim()) {
    const term = applied.search.trim();
    query = query.or(
      `case_number.ilike.%${term}%,title.ilike.%${term}%,dealer_id.ilike.%${term}%,wallet_id.ilike.%${term}%`
    );
  }

  const pageSize = view?.page_size ?? 100;
  query = query.limit(Math.min(pageSize, 200));

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message, view };
  }

  let cases = (data ?? []) as (CaseWithRelations & {
    current_execution?: { id: string; status: string } | null;
  })[];

  const ids = cases.map((item) => item.id);

  if (ids.length > 0) {
    const { data: slaRows } = await supabase
      .from("case_sla")
      .select("*")
      .in("case_id", ids);

    const byCase = new Map<string, CaseSla[]>();
    for (const row of (slaRows ?? []) as CaseSla[]) {
      const list = byCase.get(row.case_id) ?? [];
      list.push(row);
      byCase.set(row.case_id, list);
    }

    for (const item of cases) {
      item.sla_records = byCase.get(item.id) ?? [];
    }
  }

  if (applied.unassignedInMyTeams) {
    const groupIds = await getMyGroupIds(profile.id);
    cases = cases.filter(
      (item) =>
        Boolean(item.assigned_group_id) &&
        groupIds.includes(item.assigned_group_id!) &&
        !item.assigned_agent_id &&
        item.status !== "RESOLVED" &&
        item.status !== "REJECTED"
    );
  }

  if (applied.slaStatuses?.length) {
    cases = cases.filter((item) =>
      (item.sla_records ?? []).some((sla) =>
        applied.slaStatuses!.includes(sla.state as never)
      )
    );
  }

  if (applied.executionStatuses?.length) {
    cases = cases.filter((item) => {
      const status = item.current_execution?.status;
      return status && applied.executionStatuses!.includes(status as never);
    });
  }

  if (applied.approvalStatuses?.length) {
    const map: Record<string, string> = {
      PENDING_APPROVAL: "PENDING",
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
    };
    cases = cases.filter((item) => {
      const mapped = map[item.status];
      return mapped && applied.approvalStatuses!.includes(mapped as never);
    });
  }

  if (applied.exceptionStatuses?.length && ids.length > 0) {
    const { data: exceptions } = await supabase
      .from("operational_exceptions")
      .select("case_id, status")
      .in("case_id", ids)
      .in("status", applied.exceptionStatuses);
    const matched = new Set(
      (exceptions ?? []).map((row) => row.case_id as string)
    );
    cases = cases.filter((item) => matched.has(item.id));
  }

  cases = sortCases(cases, sorting);

  return { data: cases, error: null, view };
}

export async function listCategories(organizationId: string): Promise<{
  data: Category[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name");

  return { data: (data as Category[]) ?? [], error: error?.message ?? null };
}

export async function listSubcategories(organizationId: string): Promise<{
  data: Subcategory[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subcategories")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name");

  return { data: (data as Subcategory[]) ?? [], error: error?.message ?? null };
}

export async function listAssignmentGroups(organizationId: string): Promise<{
  data: (AssignmentGroup & { members: AssignmentGroupMember[] })[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: groups, error } = await supabase
    .from("assignment_groups")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");

  if (error) {
    return { data: [], error: error.message };
  }

  const groupIds = (groups ?? []).map((group) => group.id);
  const { data: members } = await supabase
    .from("assignment_group_members")
    .select(
      "id, group_id, user_id, is_lead, created_at, profile:profiles!assignment_group_members_user_id_fkey(id, full_name, email, role)"
    )
    .in("group_id", groupIds.length ? groupIds : ["00000000-0000-0000-0000-000000000000"]);

  const byGroup = new Map<string, AssignmentGroupMember[]>();
  for (const row of members ?? []) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const member: AssignmentGroupMember = {
      id: row.id,
      group_id: row.group_id,
      user_id: row.user_id,
      is_lead: row.is_lead,
      created_at: row.created_at,
      profile: profile ?? undefined,
    };
    const list = byGroup.get(row.group_id) ?? [];
    list.push(member);
    byGroup.set(row.group_id, list);
  }

  return {
    data: ((groups ?? []) as AssignmentGroup[]).map((group) => ({
      ...group,
      members: byGroup.get(group.id) ?? [],
    })),
    error: null,
  };
}

export async function listGroupAgents(groupId: string): Promise<{
  data: Pick<Profile, "id" | "full_name" | "email">[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignment_group_members")
    .select(
      "profile:profiles!assignment_group_members_user_id_fkey(id, full_name, email, role)"
    )
    .eq("group_id", groupId);

  if (error) {
    return { data: [], error: error.message };
  }

  const agents: Pick<Profile, "id" | "full_name" | "email">[] = [];
  for (const row of data ?? []) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    if (
      profile &&
      (profile.role === "operations_agent" || profile.role === "team_lead")
    ) {
      agents.push({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
      });
    }
  }

  return { data: agents, error: null };
}

export async function getCaseById(
  caseId: string,
  profile: Profile
): Promise<{ data: CaseWithRelations | null; error: string | null }> {
  const supabase = await createClient();

  const { data: caseData, error: caseError } = await supabase
    .from("cases")
    .select(CASE_SELECT)
    .eq("id", caseId)
    .single();

  if (caseError) {
    return { data: null, error: caseError.message };
  }

  if (
    caseData.organization_id &&
    profile.organization_id &&
    caseData.organization_id === profile.organization_id
  ) {
    try {
      await enqueueSlaRefresh({
        caseId,
        organizationId: caseData.organization_id,
        priority: caseData.priority,
        assignedGroupId: caseData.assigned_group_id,
        actorId: profile.id,
      });
    } catch {
      // Non-blocking: detail views must still load if the job bus is unavailable.
    }
  }

  const [
    { data: auditHistory, error: auditError },
    { data: comments, error: commentsError },
    { data: attachments, error: attachmentsError },
    { data: slaRecords, error: slaError },
  ] = await Promise.all([
    supabase
      .from("case_audit_history")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    supabase
      .from("case_comments")
      .select(
        "id, case_id, author_id, body, created_at, author:profiles!case_comments_author_id_fkey(id, full_name, email, role)"
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    supabase
      .from("case_attachments")
      .select(
        "id, case_id, uploaded_by, file_name, file_path, file_size, mime_type, created_at, uploader:profiles!case_attachments_uploaded_by_fkey(id, full_name, email)"
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabase.from("case_sla").select("*").eq("case_id", caseId),
  ]);

  if (auditError) {
    return { data: null, error: auditError.message };
  }
  if (commentsError) {
    return { data: null, error: commentsError.message };
  }
  if (attachmentsError) {
    return { data: null, error: attachmentsError.message };
  }
  if (slaError) {
    return { data: null, error: slaError.message };
  }

  const attachmentsWithUrls: CaseAttachment[] = await Promise.all(
    (attachments ?? []).map(async (attachment) => {
      const { data: signed } = await supabase.storage
        .from("case-attachments")
        .createSignedUrl(attachment.file_path, 60 * 60);

      const uploader = Array.isArray(attachment.uploader)
        ? attachment.uploader[0]
        : attachment.uploader;

      return {
        id: attachment.id,
        case_id: attachment.case_id,
        uploaded_by: attachment.uploaded_by,
        file_name: attachment.file_name,
        file_path: attachment.file_path,
        file_size: attachment.file_size,
        mime_type: attachment.mime_type,
        created_at: attachment.created_at,
        uploader: uploader ?? undefined,
        signed_url: signed?.signedUrl ?? null,
      };
    })
  );

  const normalizedComments: CaseComment[] = (comments ?? []).map((comment) => {
    const author = Array.isArray(comment.author)
      ? comment.author[0]
      : comment.author;

    return {
      id: comment.id,
      case_id: comment.case_id,
      author_id: comment.author_id,
      body: comment.body,
      is_internal: Boolean(
        (comment as { is_internal?: boolean }).is_internal
      ),
      created_at: comment.created_at,
      author: author ?? undefined,
    };
  });

  const maskedCase = maskCaseFinancialFields(
    caseData as CaseWithRelations,
    profile
  );

  return {
    data: {
      ...maskedCase,
      audit_history: auditHistory ?? [],
      comments: normalizedComments,
      attachments: attachmentsWithUrls,
      sla_records: (slaRecords as CaseSla[]) ?? [],
    },
    error: null,
  };
}

export async function getMyGroupIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignment_group_members")
    .select("group_id")
    .eq("user_id", userId);

  return (data ?? []).map((row) => row.group_id);
}

export async function getWorkspaceQueues(profile: Profile): Promise<{
  data: {
    myAssigned: CaseWithRelations[];
    unassignedForTeam: CaseWithRelations[];
    dueSoon: CaseWithRelations[];
    breached: CaseWithRelations[];
    pendingApprovals: CaseWithRelations[];
  };
  error: string | null;
}> {
  const empty = {
    myAssigned: [],
    unassignedForTeam: [],
    dueSoon: [],
    breached: [],
    pendingApprovals: [],
  };

  if (!profile.organization_id) {
    return { data: empty, error: null };
  }

  const { data: cases, error } = await listCases(profile, {});
  if (error) {
    return { data: empty, error };
  }

  for (const item of cases) {
    if (item.organization_id) {
      await enqueueSlaRefresh({
        caseId: item.id,
        organizationId: item.organization_id,
        priority: item.priority,
        assignedGroupId: item.assigned_group_id,
        actorId: profile.id,
      });
    }
  }

  // Best-effort process pending SLA jobs so workspace queues stay current.
  try {
    const { processClaimedJobs } = await import("@/lib/jobs/worker");
    await processClaimedJobs(`workspace-${profile.id}`, 25);
  } catch {
    // Worker may be unavailable without service role in some contexts.
  }

  // Re-read SLA rows after refresh so queue membership is current.
  const { data: refreshed, error: refreshError } = await listCases(profile, {});
  if (refreshError) {
    return { data: empty, error: refreshError };
  }
  const currentCases = refreshed;

  const groupIds = await getMyGroupIds(profile.id);
  const myAssigned = currentCases.filter(
    (item) =>
      item.assigned_agent_id === profile.id &&
      item.status !== "RESOLVED" &&
      item.status !== "REJECTED"
  );
  const unassignedForTeam = currentCases.filter(
    (item) =>
      item.assigned_group_id &&
      groupIds.includes(item.assigned_group_id) &&
      !item.assigned_agent_id &&
      item.status !== "RESOLVED" &&
      item.status !== "REJECTED"
  );

  const dueSoon: CaseWithRelations[] = [];
  const breached: CaseWithRelations[] = [];
  for (const item of currentCases) {
    const states = item.sla_records ?? [];
    if (states.some((sla) => sla.state === "DUE_SOON")) {
      dueSoon.push(item);
    }
    if (states.some((sla) => sla.state === "BREACHED")) {
      breached.push(item);
    }
  }

  const pendingApprovals = currentCases.filter(
    (item) => item.status === "PENDING_APPROVAL"
  );

  return {
    data: {
      myAssigned,
      unassignedForTeam,
      dueSoon,
      breached,
      pendingApprovals,
    },
    error: null,
  };
}

export async function getDashboardStats(profile: Profile): Promise<{
  data: {
    total: number;
    byStatus: Record<CaseStatus, number>;
    unassigned: number;
    myOpen: number;
    resolvedToday: number;
  };
  error: string | null;
}> {
  const emptyByStatus: Record<CaseStatus, number> = {
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    WAITING_FOR_REQUESTER: 0,
    WAITING_FOR_EXTERNAL_PARTY: 0,
    PENDING_APPROVAL: 0,
    APPROVED: 0,
    REJECTED: 0,
    RESOLVED: 0,
  };

  const supabase = await createClient();
  let query = supabase
    .from("cases")
    .select(
      "id, status, assigned_agent_id, requester_id, organization_id, updated_at"
    );

  if (profile.organization_id) {
    query = query.eq("organization_id", profile.organization_id);
  }

  if (!canViewAllCases(profile.role)) {
    query = query.eq("requester_id", profile.id);
  }

  const { data, error } = await query;
  if (error) {
    return {
      data: {
        total: 0,
        byStatus: emptyByStatus,
        unassigned: 0,
        myOpen: 0,
        resolvedToday: 0,
      },
      error: error.message,
    };
  }

  const byStatus = { ...emptyByStatus };
  let unassigned = 0;
  let myOpen = 0;
  let resolvedToday = 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  for (const item of data ?? []) {
    byStatus[item.status as CaseStatus] += 1;
    if (
      !item.assigned_agent_id &&
      item.status !== "RESOLVED" &&
      item.status !== "REJECTED"
    ) {
      unassigned += 1;
    }
    const isMine =
      item.requester_id === profile.id || item.assigned_agent_id === profile.id;
    if (
      isMine &&
      item.status !== "RESOLVED" &&
      item.status !== "REJECTED"
    ) {
      myOpen += 1;
    }
    if (item.status === "RESOLVED") {
      if (item.updated_at && new Date(item.updated_at) >= startOfDay) {
        resolvedToday += 1;
      }
    }
  }

  return {
    data: {
      total: data?.length ?? 0,
      byStatus,
      unassigned,
      myOpen,
      resolvedToday,
    },
    error: null,
  };
}
