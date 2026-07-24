import { createClient } from "@/lib/supabase/server";
import { canViewAllCases } from "@/lib/auth/permissions";
import type { CaseListFilterInput } from "@/lib/validations/case";
import type {
  CaseAttachment,
  CaseComment,
  CaseRecord,
  CaseStatus,
  CaseWithRelations,
  Profile,
} from "@/types";

const CASE_SELECT = `
  *,
  requester:profiles!cases_requester_id_fkey(id, full_name, email),
  assigned_agent:profiles!cases_assigned_agent_id_fkey(id, full_name, email),
  approver:profiles!cases_approver_id_fkey(id, full_name, email)
`;

export async function listCases(
  profile: Profile,
  filters: CaseListFilterInput = {}
): Promise<{ data: CaseRecord[]; error: string | null }> {
  const supabase = await createClient();
  let query = supabase
    .from("cases")
    .select(CASE_SELECT)
    .order("created_at", { ascending: false });

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

  return { data: (data ?? []) as CaseRecord[], error: null };
}

export async function listOperationsAgents(): Promise<{
  data: Pick<Profile, "id" | "full_name" | "email">[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "operations_agent")
    .order("full_name", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data ?? [], error: null };
}

export async function getCaseById(
  caseId: string
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

  const [
    { data: auditHistory, error: auditError },
    { data: comments, error: commentsError },
    { data: attachments, error: attachmentsError },
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
    PENDING_APPROVAL: 0,
    APPROVED: 0,
    REJECTED: 0,
    RESOLVED: 0,
  };

  const supabase = await createClient();
  let query = supabase.from("cases").select("id, status, assigned_agent_id, requester_id");

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
    if (!item.assigned_agent_id && item.status !== "RESOLVED" && item.status !== "REJECTED") {
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
