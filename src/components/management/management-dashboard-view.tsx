import {
  type ManagementDashboardSnapshot,
  type NamedCount,
} from "@/lib/management/types";
import { formatCurrency } from "@/lib/utils";

function fmtPct(value: number | null): string {
  return value == null ? "—" : `${value}%`;
}

function fmtHours(value: number | null): string {
  return value == null ? "—" : `${value}h`;
}

function Kpi({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="ops-panel p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ObjectBreakdown({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="ops-panel p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          entries.map(([key, count]) => (
            <div
              key={key}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{key}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NamedBreakdown({ title, rows }: { title: string; rows: NamedCount[] }) {
  return (
    <div className="ops-panel p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          rows.slice(0, 12).map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between text-sm"
            >
              <span className="truncate text-muted-foreground">{row.label}</span>
              <span className="font-medium">{row.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ManagementDashboardView({
  snapshot,
}: {
  snapshot: ManagementDashboardSnapshot;
}) {
  const { kpis, breakdowns } = snapshot;
  const maxTrend = Math.max(
    1,
    ...breakdowns.dailyCreatedVsResolved.map((d) =>
      Math.max(d.created, d.resolved)
    )
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Backlog" value={kpis.current_backlog} />
        <Kpi
          title="Resolution SLA"
          value={fmtPct(kpis.resolution_sla_compliance_pct)}
        />
        <Kpi
          title="Median resolution"
          value={fmtHours(kpis.avg_resolution_hours)}
        />
        <Kpi title="Reopen rate" value={fmtPct(kpis.reopen_rate_pct)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ops-panel p-4">
          <h3 className="text-sm font-semibold">Submitted vs resolved</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Daily trend for the selected range.
          </p>
          <div className="mt-4 space-y-3">
            {breakdowns.dailyCreatedVsResolved.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trend data</p>
            ) : (
              breakdowns.dailyCreatedVsResolved.slice(-14).map((point) => (
                <div key={point.date} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{point.date}</span>
                    <span>
                      +{point.created} / ✓{point.resolved}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-2 rounded bg-muted">
                      <div
                        className="h-2 rounded bg-primary/80"
                        style={{
                          width: `${(point.created / maxTrend) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="h-2 rounded bg-muted">
                      <div
                        className="h-2 rounded bg-emerald-600/80"
                        style={{
                          width: `${(point.resolved / maxTrend) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="ops-panel space-y-3 p-4">
          <h3 className="text-sm font-semibold">Service health</h3>
          <div className="flex items-center justify-between text-sm">
            <span>First response {fmtPct(kpis.first_response_sla_compliance_pct)}</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              {(kpis.first_response_sla_compliance_pct ?? 0) >= 95
                ? "Healthy"
                : "Watch"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Resolution {fmtPct(kpis.resolution_sla_compliance_pct)}</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {(kpis.resolution_sla_compliance_pct ?? 0) >= 95
                ? "Healthy"
                : "Watch"}
            </span>
          </div>
          <div className="border-t pt-3 text-sm text-muted-foreground">
            Failed integration {kpis.failed_integration} · Unknown{" "}
            {kpis.unknown_integration} · Unassigned {kpis.unassigned_cases}
          </div>
        </div>
      </div>

      <NamedBreakdown title="Team performance" rows={breakdowns.byTeam} />

      <details className="ops-panel p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          More metrics
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi title="Cases submitted" value={kpis.cases_submitted} />
          <Kpi title="Cases resolved" value={kpis.cases_resolved} />
          <Kpi title="Pending approval" value={kpis.pending_approval} />
          <Kpi title="Awaiting requester" value={kpis.awaiting_requester} />
          <Kpi
            title="Avg first response"
            value={fmtHours(kpis.avg_first_response_hours)}
          />
          <Kpi
            title="Approval turnaround"
            value={fmtHours(kpis.avg_approval_turnaround_hours)}
          />
          <Kpi
            title="Integration success"
            value={fmtPct(kpis.integration_success_rate_pct)}
          />
          <Kpi
            title="Amount executed"
            value={formatCurrency(Number(kpis.adjustment_amount_executed))}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ObjectBreakdown title="Cases by status" data={breakdowns.byStatus} />
          <ObjectBreakdown title="Cases by priority" data={breakdowns.byPriority} />
          <NamedBreakdown title="Cases by category" rows={breakdowns.byCategory} />
          <NamedBreakdown title="Cases by agent" rows={breakdowns.byAgent} />
        </div>
      </details>
    </div>
  );
}
