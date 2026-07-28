import { getMyGroupIds } from "@/lib/cases/queries";
import type { ActionResult, CaseStatus, Profile } from "@/types";

type CaseAccessRow = {
  id: string;
  organization_id: string | null;
  requester_id: string;
  assigned_agent_id: string | null;
  assigned_group_id: string | null;
  status: CaseStatus;
  approver_id: string | null;
};

/**
 * App-layer mirror of `can_access_case` RLS (defense in depth).
 * Never trust client-supplied organisation or role hints.
 */
export async function canAccessCaseRow(
  profile: Profile,
  caseRow: CaseAccessRow
): Promise<boolean> {
  if (!profile.organization_id || !caseRow.organization_id) {
    return false;
  }
  if (caseRow.organization_id !== profile.organization_id) {
    return false;
  }

  if (caseRow.requester_id === profile.id) {
    return true;
  }
  if (caseRow.assigned_agent_id === profile.id) {
    return true;
  }

  if (
    profile.role === "operations_agent" ||
    profile.role === "team_lead"
  ) {
    if (!caseRow.assigned_group_id) {
      return true;
    }
    const groupIds = await getMyGroupIds(profile.id);
    return groupIds.includes(caseRow.assigned_group_id);
  }

  if (profile.role === "approver") {
    return (
      caseRow.status === "PENDING_APPROVAL" ||
      caseRow.approver_id === profile.id
    );
  }

  return false;
}

export async function assertCaseAccess(
  profile: Profile,
  caseRow: CaseAccessRow | null
): Promise<ActionResult<{ caseId: string }>> {
  if (!caseRow) {
    return { success: false, error: "Case not found.", code: "NOT_FOUND" };
  }

  const allowed = await canAccessCaseRow(profile, caseRow);
  if (!allowed) {
    return { success: false, error: "Case not found.", code: "NOT_FOUND" };
  }

  return { success: true, data: { caseId: caseRow.id } };
}
