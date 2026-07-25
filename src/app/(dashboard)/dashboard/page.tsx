import Link from "next/link";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { STATUS_LABELS } from "@/lib/auth/roles";
import { requireProfile } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/cases/queries";
import type { CaseStatus } from "@/types";

const STATUS_ORDER: CaseStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "WAITING_FOR_REQUESTER",
  "WAITING_FOR_EXTERNAL_PARTY",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "RESOLVED",
];

export default async function DashboardPage() {
  const profile = await requireProfile();
  const { data, error } = await getDashboardStats(profile);

  if (error) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTitle>Unable to load dashboard</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            Snapshot of case volume and workflow status.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/cases">View all cases</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Total cases" value={data.total} />
        <SummaryCard title="My open cases" value={data.myOpen} />
        <SummaryCard title="Unassigned" value={data.unassigned} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By status</CardTitle>
          <CardDescription>Current distribution across the workflow</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STATUS_ORDER.map((status) => (
            <Link
              key={status}
              href={`/cases?status=${status}`}
              className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
            >
              <div className="space-y-2">
                <CaseStatusBadge status={status} />
                <p className="text-sm text-muted-foreground">
                  {STATUS_LABELS[status]}
                </p>
              </div>
              <p className="text-2xl font-semibold">{data.byStatus[status]}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
