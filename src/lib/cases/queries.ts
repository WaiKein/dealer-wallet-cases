import { createClient } from "@/lib/supabase/server";
import { canViewAllCases } from "@/lib/auth/permissions";
import type { CaseListFilterInput } from "@/lib/validations/case";
import type { CaseRecord, CaseWithRelations, Profile } from "@/types";

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

  const { data: auditHistory, error: auditError } = await supabase
    .from("case_audit_history")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (auditError) {
    return { data: null, error: auditError.message };
  }

  return {
    data: {
      ...(caseData as CaseWithRelations),
      audit_history: auditHistory ?? [],
    },
    error: null,
  };
}
