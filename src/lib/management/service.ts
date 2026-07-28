import { createClient } from "@/lib/supabase/server";
import { canAccessManagementDashboard } from "@/lib/auth/permissions";
import {
  managementDashboardFilterSchema,
  type ManagementDashboardFilterInput,
  type ManagementDashboardSnapshot,
} from "@/lib/management/types";
import type { Profile } from "@/types";

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function normalizeManagementDashboardSnapshot(raw: Record<string, unknown>): ManagementDashboardSnapshot {
  const kpis = (raw.kpis ?? {}) as ManagementDashboardSnapshot["kpis"];
  const breakdowns = (raw.breakdowns ??
    {}) as ManagementDashboardSnapshot["breakdowns"];
  return {
    organizationId: String(raw.organizationId ?? ""),
    from: String(raw.from ?? ""),
    to: String(raw.to ?? ""),
    kpis: {
      cases_submitted: Number(kpis.cases_submitted ?? 0),
      cases_resolved: Number(kpis.cases_resolved ?? 0),
      current_backlog: Number(kpis.current_backlog ?? 0),
      unassigned_cases: Number(kpis.unassigned_cases ?? 0),
      pending_approval: Number(kpis.pending_approval ?? 0),
      awaiting_requester: Number(kpis.awaiting_requester ?? 0),
      failed_integration: Number(kpis.failed_integration ?? 0),
      unknown_integration: Number(kpis.unknown_integration ?? 0),
      first_response_sla_compliance_pct:
        kpis.first_response_sla_compliance_pct == null
          ? null
          : Number(kpis.first_response_sla_compliance_pct),
      resolution_sla_compliance_pct:
        kpis.resolution_sla_compliance_pct == null
          ? null
          : Number(kpis.resolution_sla_compliance_pct),
      avg_first_response_hours:
        kpis.avg_first_response_hours == null
          ? null
          : Number(kpis.avg_first_response_hours),
      avg_resolution_hours:
        kpis.avg_resolution_hours == null
          ? null
          : Number(kpis.avg_resolution_hours),
      reopen_rate_pct:
        kpis.reopen_rate_pct == null ? null : Number(kpis.reopen_rate_pct),
      avg_approval_turnaround_hours:
        kpis.avg_approval_turnaround_hours == null
          ? null
          : Number(kpis.avg_approval_turnaround_hours),
      integration_success_rate_pct:
        kpis.integration_success_rate_pct == null
          ? null
          : Number(kpis.integration_success_rate_pct),
      adjustment_amount_requested: Number(kpis.adjustment_amount_requested ?? 0),
      adjustment_amount_approved: Number(kpis.adjustment_amount_approved ?? 0),
      adjustment_amount_executed: Number(kpis.adjustment_amount_executed ?? 0),
    },
    breakdowns: {
      byStatus: (breakdowns.byStatus ?? {}) as Record<string, number>,
      byPriority: (breakdowns.byPriority ?? {}) as Record<string, number>,
      byCategory: (breakdowns.byCategory ?? []) as ManagementDashboardSnapshot["breakdowns"]["byCategory"],
      bySubcategory: (breakdowns.bySubcategory ??
        []) as ManagementDashboardSnapshot["breakdowns"]["bySubcategory"],
      byTeam: (breakdowns.byTeam ?? []) as ManagementDashboardSnapshot["breakdowns"]["byTeam"],
      byAgent: (breakdowns.byAgent ?? []) as ManagementDashboardSnapshot["breakdowns"]["byAgent"],
      byApprovalStatus: (breakdowns.byApprovalStatus ?? {}) as Record<
        string,
        number
      >,
      byExecutionStatus: (breakdowns.byExecutionStatus ?? {}) as Record<
        string,
        number
      >,
      slaBreachesByTeam: (breakdowns.slaBreachesByTeam ??
        []) as ManagementDashboardSnapshot["breakdowns"]["slaBreachesByTeam"],
      backlogAgeing: (breakdowns.backlogAgeing ?? {}) as Record<string, number>,
      dailyCreatedVsResolved: (breakdowns.dailyCreatedVsResolved ??
        []) as ManagementDashboardSnapshot["breakdowns"]["dailyCreatedVsResolved"],
    },
  };
}

export async function getManagementDashboard(
  profile: Profile,
  input: ManagementDashboardFilterInput = {}
): Promise<{ data: ManagementDashboardSnapshot | null; error: string | null; code?: string }> {
  if (!canAccessManagementDashboard(profile.role)) {
    return { data: null, error: "Not allowed.", code: "FORBIDDEN" };
  }
  if (!profile.organization_id) {
    return { data: null, error: "Organization required.", code: "FORBIDDEN" };
  }

  const parsed = managementDashboardFilterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Invalid filters.",
      code: "VALIDATION_ERROR",
    };
  }

  const range = defaultRange();
  const from = parsed.data.from ?? range.from;
  const to = parsed.data.to ?? range.to;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("management_dashboard_snapshot", {
    p_organization_id: profile.organization_id,
    p_from: from,
    p_to: to,
  });

  if (error) {
    return { data: null, error: error.message, code: "VALIDATION_ERROR" };
  }

  return {
    data: normalizeManagementDashboardSnapshot((data ?? {}) as Record<string, unknown>),
    error: null,
  };
}

export { normalizeManagementDashboardSnapshot };

export async function exportManagementDashboardCsv(
  profile: Profile,
  input: ManagementDashboardFilterInput = {}
): Promise<{ csv: string | null; error: string | null; code?: string }> {
  if (!canAccessManagementDashboard(profile.role)) {
    return { csv: null, error: "Not allowed.", code: "FORBIDDEN" };
  }
  if (!profile.organization_id) {
    return { csv: null, error: "Organization required.", code: "FORBIDDEN" };
  }

  const parsed = managementDashboardFilterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      csv: null,
      error: parsed.error.issues[0]?.message ?? "Invalid filters.",
      code: "VALIDATION_ERROR",
    };
  }

  const range = defaultRange();
  const from = parsed.data.from ?? range.from;
  const to = parsed.data.to ?? range.to;

  const supabase = await createClient();
  // Hard cap rows for export safety
  const { data, error } = await supabase
    .from("v_management_case_facts")
    .select(
      "case_number,title,status,priority,category_name,subcategory_name,team_name,agent_name,adjustment_amount,currency,execution_status,first_response_sla_state,resolution_sla_state,backlog_age_band,created_at,updated_at"
    )
    .eq("organization_id", profile.organization_id)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return { csv: null, error: error.message, code: "VALIDATION_ERROR" };
  }

  const rows = data ?? [];
  const headers = [
    "case_number",
    "title",
    "status",
    "priority",
    "category",
    "subcategory",
    "team",
    "agent",
    "adjustment_amount",
    "currency",
    "execution_status",
    "first_response_sla",
    "resolution_sla",
    "backlog_age_band",
    "created_at",
    "updated_at",
  ];

  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.case_number,
        row.title,
        row.status,
        row.priority,
        row.category_name,
        row.subcategory_name,
        row.team_name,
        row.agent_name,
        row.adjustment_amount,
        row.currency,
        row.execution_status,
        row.first_response_sla_state,
        row.resolution_sla_state,
        row.backlog_age_band,
        row.created_at,
        row.updated_at,
      ]
        .map(escape)
        .join(",")
    );
  }

  return { csv: lines.join("\n"), error: null };
}
