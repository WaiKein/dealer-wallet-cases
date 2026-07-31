import Link from "next/link";
import { Suspense } from "react";
import { CaseList } from "@/components/cases/case-list";
import { CasesCommandBar } from "@/components/cases/cases-command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { canCreateCase } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { listCases } from "@/lib/cases/queries";
import { listSavedCaseViews } from "@/lib/cases/saved-views";
import { caseListFilterSchema } from "@/lib/validations/case";
import type { CaseListFilterInput } from "@/lib/validations/case";

interface CasesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const profile = await requireProfile();
  const params = await searchParams;

  const rawFilters = {
    status: typeof params.status === "string" ? params.status : undefined,
    search: typeof params.search === "string" ? params.search : undefined,
    viewId: typeof params.viewId === "string" ? params.viewId : undefined,
    priority: typeof params.priority === "string" ? params.priority : undefined,
  };

  const parsedFilters = caseListFilterSchema.safeParse(rawFilters);
  const filters: CaseListFilterInput = parsedFilters.success
    ? parsedFilters.data
    : {};

  const [{ data: cases, error, view }, { data: views }] = await Promise.all([
    listCases(profile, filters),
    listSavedCaseViews(profile),
  ]);

  const openCount = cases?.length ?? 0;
  const attention =
    cases?.filter((item) =>
      item.sla_records?.some(
        (sla) => sla.state === "DUE_SOON" || sla.state === "BREACHED"
      )
    ).length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cases"
        description={
          view
            ? `${openCount} in view · Active view: ${view.name}`
            : `${openCount} matching · ${attention} need attention`
        }
        action={
          canCreateCase(profile.role) ? (
            <Button asChild>
              <Link href="/cases/new">New case</Link>
            </Button>
          ) : undefined
        }
      />

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
        <CasesCommandBar views={views} />
      </Suspense>

      {error ? (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertTitle>Unable to load cases</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <CaseList cases={cases} />
      )}
    </div>
  );
}
