import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ManagementDashboardView } from "@/components/management/management-dashboard-view";
import { ManagementFilters } from "@/components/management/management-filters";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canAccessManagementDashboard } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { getManagementDashboard } from "@/lib/management/service";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ManagementDashboardPage({
  searchParams,
}: PageProps) {
  const profile = await requireProfile();
  if (!canAccessManagementDashboard(profile.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : undefined;
  const to = typeof params.to === "string" ? params.to : undefined;

  const { data, error } = await getManagementDashboard(profile, { from, to });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Management dashboard</h1>
          <p className="text-muted-foreground">
            Organisation-scoped pilot KPIs and breakdowns (server-side
            aggregation).
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Personal dashboard</Link>
        </Button>
      </div>

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
        <ManagementFilters />
      </Suspense>

      {error || !data ? (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertTitle>Unable to load management dashboard</AlertTitle>
          <AlertDescription>{error ?? "No data returned."}</AlertDescription>
        </Alert>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Range {new Date(data.from).toLocaleString()} →{" "}
            {new Date(data.to).toLocaleString()}
          </p>
          <ManagementDashboardView snapshot={data} />
        </>
      )}
    </div>
  );
}
