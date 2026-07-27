import { createClient } from "@/lib/supabase/server";
import { canViewAllCases } from "@/lib/auth/permissions";
import { enqueueSlaRefresh } from "@/lib/jobs/domain-enqueue";
import type { CaseListFilterInput } from "@/lib/validations/case";
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
  approver:profiles!cases_approver_id_fkey(id, full_name, email)
`;

export async function listCases(
  profile: Profile,
  filters: CaseListFilterInput = {}
): Promise<{ data: CaseWithRelations[]; error: string | null }> {
  const supabase = await createClient();
  let query = supabase
    .from("cases")
    .select(CASE_SELECT)
    .order("created_at", { ascending: false });

  if (profile.organization_id) {
    query = query.eq("organization_id", profile.organization_id);
  }

  if (!canViewAllCases(profile.role)) {
    query = query.eq("requester_id", profile.id);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim();
    query = query.or(
      `case_number.ilike.%${term}%,title.ilike.%${term}%,dealer_id.ilike.%${term}%,wallet_id.ilike.%${term}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  const cases = (data ?? []) as CaseWithRelations[];
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

  return { data: cases, error: null };
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
      created_at: comment.created_at,
      author: author ?? undefined,
    };
  });

  return {
    data: {
      ...(caseData as CaseWithRelations),
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
    .select("id, status, assigned_agent_id, requester_id, organization_id");

  if (profile.organization_id) {
    query = query.eq("organization_id", profile.organization_id);
  }

  if (!canViewAllCases(profile.role)) {
    query = query.eq("requester_id", profile.id);
  }

  const { data, error } = await query;
  if (error) {
    return {
      data: { total: 0, byStatus: emptyByStatus, unassigned: 0, myOpen: 0 },
      error: error.message,
    };
  }

  const byStatus = { ...emptyByStatus };
  let unassigned = 0;
  let myOpen = 0;

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
  }

  return {
    data: {
      total: data?.length ?? 0,
      byStatus,
      unassigned,
      myOpen,
    },
    error: null,
  };
}
