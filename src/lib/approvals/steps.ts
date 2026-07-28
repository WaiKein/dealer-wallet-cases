import type { UserRole } from "@/types";

export type ApprovalStepDraft = {
  level_no: number;
  status: "PENDING" | "SKIPPED";
  required_role: UserRole;
  required_team_id: string | null;
};

/**
 * Pure approval-step planner used when creating approval requests.
 * Level 1 is pending when sequential approval is required; later levels start skipped.
 */
export function buildApprovalStepDrafts(params: {
  levels: number;
  sequentialRequired: boolean;
  requiredRole: UserRole;
  requiredTeamId?: string | null;
}): ApprovalStepDraft[] {
  const levels = Math.max(1, params.levels);
  return Array.from({ length: levels }, (_, index) => {
    const levelNo = index + 1;
    const status =
      !params.sequentialRequired || levelNo === 1 ? "PENDING" : "SKIPPED";
    return {
      level_no: levelNo,
      status,
      required_role: params.requiredRole,
      required_team_id: params.requiredTeamId ?? null,
    };
  });
}
