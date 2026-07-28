import { z } from "zod";

export const managementDashboardFilterSchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from must be before to",
        path: ["from"],
      });
    }
  });

export type ManagementDashboardFilterInput = z.infer<
  typeof managementDashboardFilterSchema
>;

export interface NamedCount {
  key: string;
  label: string;
  count: number;
}

export interface DailyTrendPoint {
  date: string;
  created: number;
  resolved: number;
}

export interface ManagementDashboardKpis {
  cases_submitted: number;
  cases_resolved: number;
  current_backlog: number;
  unassigned_cases: number;
  pending_approval: number;
  awaiting_requester: number;
  failed_integration: number;
  unknown_integration: number;
  first_response_sla_compliance_pct: number | null;
  resolution_sla_compliance_pct: number | null;
  avg_first_response_hours: number | null;
  avg_resolution_hours: number | null;
  reopen_rate_pct: number | null;
  avg_approval_turnaround_hours: number | null;
  integration_success_rate_pct: number | null;
  adjustment_amount_requested: number;
  adjustment_amount_approved: number;
  adjustment_amount_executed: number;
}

export interface ManagementDashboardSnapshot {
  organizationId: string;
  from: string;
  to: string;
  kpis: ManagementDashboardKpis;
  breakdowns: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: NamedCount[];
    bySubcategory: NamedCount[];
    byTeam: NamedCount[];
    byAgent: NamedCount[];
    byApprovalStatus: Record<string, number>;
    byExecutionStatus: Record<string, number>;
    slaBreachesByTeam: NamedCount[];
    backlogAgeing: Record<string, number>;
    dailyCreatedVsResolved: DailyTrendPoint[];
  };
}

export const AGEING_BAND_LABELS: Record<string, string> = {
  lt_1d: "Less than 1 day",
  d1_3: "1–3 days",
  d4_7: "4–7 days",
  d8_14: "8–14 days",
  gt_14d: "More than 14 days",
};
