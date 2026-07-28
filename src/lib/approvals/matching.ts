import type { ApprovalRule, CasePriority, UserRole } from "@/types";

export interface ApprovalMatchInput {
  categoryId: string | null;
  subcategoryId: string | null;
  amount: number;
  priority: CasePriority;
  requesterRole: UserRole;
  requesterTeamId?: string | null;
  assignmentGroupId?: string | null;
  riskLevel?: string | null;
  caseType?: string | null;
  now?: Date;
}

function isEffective(rule: ApprovalRule, now: Date): boolean {
  if (!rule.is_active) return false;
  const from = rule.effective_from ? new Date(rule.effective_from) : null;
  const to = rule.effective_to ? new Date(rule.effective_to) : null;
  if (from && now < from) return false;
  if (to && now > to) return false;
  return true;
}

/** First active matching rule by sequence wins. */
export function matchApprovalRule(
  rules: ApprovalRule[],
  input: ApprovalMatchInput
): ApprovalRule | null {
  const now = input.now ?? new Date();
  const ordered = [...rules]
    .filter((rule) => isEffective(rule, now))
    .sort((a, b) => a.sequence - b.sequence);

  for (const rule of ordered) {
    if (rule.case_type && rule.case_type !== (input.caseType ?? null)) continue;
    if (rule.category_id && rule.category_id !== input.categoryId) continue;
    if (rule.subcategory_id && rule.subcategory_id !== input.subcategoryId) {
      continue;
    }
    if (rule.priority && rule.priority !== input.priority) continue;
    if (rule.requester_role && rule.requester_role !== input.requesterRole) {
      continue;
    }
    if (
      rule.requester_team_id &&
      rule.requester_team_id !== (input.requesterTeamId ?? null)
    ) {
      continue;
    }
    if (
      rule.assignment_group_id &&
      rule.assignment_group_id !== (input.assignmentGroupId ?? null)
    ) {
      continue;
    }
    if (rule.risk_level && rule.risk_level !== (input.riskLevel ?? null)) {
      continue;
    }
    if (rule.min_amount != null && input.amount < Number(rule.min_amount)) {
      continue;
    }
    if (rule.max_amount != null && input.amount > Number(rule.max_amount)) {
      continue;
    }
    return rule;
  }

  return null;
}
