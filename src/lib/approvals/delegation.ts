import { getClock } from "@/lib/clock";
import type { Profile } from "@/types";

export interface ApprovalDelegationRecord {
  id: string;
  organization_id: string;
  delegator_id: string;
  delegate_id: string;
  approval_limit: number | null;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
}

export function isDelegationActive(
  delegation: ApprovalDelegationRecord,
  now = getClock().now()
): boolean {
  if (!delegation.is_active) return false;
  const from = new Date(delegation.effective_from);
  const to = delegation.effective_to ? new Date(delegation.effective_to) : null;
  if (now < from) return false;
  if (to && now > to) return false;
  return true;
}

/** Pick the best active delegation for actor as delegate of a required role holder. */
export function selectDelegation(params: {
  delegations: ApprovalDelegationRecord[];
  actorId: string;
  allowedDelegatorIds: string[];
  requestedAmount: number;
  now?: Date;
}): ApprovalDelegationRecord | null {
  const now = params.now ?? getClock().now();
  const candidates = params.delegations
    .filter(
      (item) =>
        item.delegate_id === params.actorId &&
        params.allowedDelegatorIds.includes(item.delegator_id) &&
        isDelegationActive(item, now)
    )
    .filter((item) => {
      if (item.approval_limit == null) return true;
      return params.requestedAmount <= Number(item.approval_limit);
    })
    .sort((a, b) => {
      const aLimit = a.approval_limit == null ? Number.POSITIVE_INFINITY : Number(a.approval_limit);
      const bLimit = b.approval_limit == null ? Number.POSITIVE_INFINITY : Number(b.approval_limit);
      return aLimit - bLimit;
    });

  return candidates[0] ?? null;
}

export function validateDelegationAuthority(params: {
  delegator: Profile;
  delegate: Profile;
  approvalLimit: number | null;
  delegatorLimit: number | null;
}): { ok: true } | { ok: false; message: string } {
  if (params.delegator.organization_id !== params.delegate.organization_id) {
    return { ok: false, message: "Delegation must stay within the same organisation." };
  }
  if (params.delegator.id === params.delegate.id) {
    return { ok: false, message: "You cannot delegate to yourself." };
  }
  if (params.delegator.role !== "approver" && params.delegator.role !== "admin") {
    return { ok: false, message: "Only approvers can create delegations." };
  }
  if (
    params.approvalLimit != null &&
    params.delegatorLimit != null &&
    params.approvalLimit > params.delegatorLimit
  ) {
    return {
      ok: false,
      message: "Delegation limit cannot exceed your own approval authority.",
    };
  }
  return { ok: true };
}
