import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { canAccessManagementDashboard, canCreateCase } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { getDashboardStats, listCases } from "@/lib/cases/queries";
import { formatCaseAge } from "@/lib/utils";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const [{ data, error }, recent] = await Promise.all([
    getDashboardStats(profile),
    listCases(profile, {}),
  ]);

  if (error || !data) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTitle>Unable to load dashboard</AlertTitle>
        <AlertDescription>{error ?? "Unknown error"}</AlertDescription>
      </Alert>
    );
  }

  const pendingApproval = data.byStatus.PENDING_APPROVAL ?? 0;
  const atRisk =
    (data.byStatus.WAITING_FOR_REQUESTER ?? 0) +
    (data.byStatus.WAITING_FOR_EXTERNAL_PARTY ?? 0);
  const resolvedToday = data.resolvedToday ?? 0;
  const recentRows = (recent.data ?? []).slice(0, 6);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${profile.full_name.split(" ")[0] ?? "there"}`}
        description={`${new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })} · Your operational picture.`}
        action={
          <div className="flex flex-wrap gap-2">
            {canAccessManagementDashboard(profile.role) ? (
              <Button asChild variant="outline">
                <Link href="/dashboard/management">Analytics</Link>
              </Button>
            ) : null}
            {canCreateCase(profile.role) ? (
              <Button asChild>
                <Link href="/cases/new">Create case</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/cases">View cases</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="My queue" value={data.myOpen} href="/cases" />
        <Metric label="At risk" value={atRisk} href="/workspace" tone="warning" />
        <Metric
          label="Awaiting approval"
          value={pendingApproval}
          href="/cases?status=PENDING_APPROVAL"
        />
        <Metric label="Resolved today" value={resolvedToday} href="/cases?status=RESOLVED" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ops-panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Queue trend · 7 days</h2>
          <p className="text-sm text-muted-foreground">
            Trend charting lands with management time-series. Use Analytics for
            submitted-versus-resolved history in the selected range.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/dashboard/management">Open analytics</Link>
          </Button>
        </section>

        <section className="ops-panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Needs attention</h2>
          {data.myOpen === 0 && atRisk === 0 && pendingApproval === 0 ? (
            <EmptyState
              className="border-0 shadow-none"
              title="You're clear"
              message="No open items need attention right now. New work will appear here."
            />
          ) : (
            <ul className="space-y-3 text-sm">
              {atRisk > 0 ? (
                <AttentionRow
                  count={atRisk}
                  label="Waiting / at risk"
                  href="/workspace"
                  tone="warning"
                />
              ) : null}
              {pendingApproval > 0 ? (
                <AttentionRow
                  count={pendingApproval}
                  label="Approval waiting"
                  href="/cases?status=PENDING_APPROVAL"
                />
              ) : null}
              {data.myOpen > 0 ? (
                <AttentionRow
                  count={data.myOpen}
                  label="Open in my queue"
                  href="/cases"
                />
              ) : null}
            </ul>
          )}
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent work</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/cases">Open cases</Link>
          </Button>
        </div>
        {recentRows.length === 0 ? (
          <EmptyState message="No recent cases yet. Create or claim a case to get started." />
        ) : (
          <DataTable headers={["Case / item", "Status", "Age", "Owner"]}>
            {recentRows.map((item) => (
              <DataTableRow key={item.id}>
                <DataTableCell primary>
                  <Link href={`/cases/${item.id}`} className="hover:underline">
                    <span className="block">{item.case_number}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {item.title}
                    </span>
                  </Link>
                </DataTableCell>
                <DataTableCell>
                  <CaseStatusBadge status={item.status} />
                </DataTableCell>
                <DataTableCell>{formatCaseAge(item.created_at)}</DataTableCell>
                <DataTableCell>
                  {item.assigned_agent?.full_name ?? "Unassigned"}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone?: "warning";
}) {
  return (
    <Link
      href={href}
      className="ops-panel block p-4 transition-colors hover:bg-muted/30"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold ${
          tone === "warning" ? "text-amber-700" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </Link>
  );
}

function AttentionRow({
  count,
  label,
  href,
  tone,
}: {
  count: number;
  label: string;
  href: string;
  tone?: "warning";
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
            tone === "warning"
              ? "bg-amber-100 text-amber-800"
              : "bg-muted text-foreground"
          }`}
        >
          {count}
        </span>
        <span>{label}</span>
      </div>
      <Link href={href} className="text-sm font-medium text-primary hover:underline">
        View
      </Link>
    </li>
  );
}
