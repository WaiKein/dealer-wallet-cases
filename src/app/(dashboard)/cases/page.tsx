import Link from "next/link";
import { Suspense } from "react";
import { CaseFilters } from "@/components/cases/case-filters";
import { CaseList } from "@/components/cases/case-list";
import { SavedViewsToolbar } from "@/components/cases/saved-views-toolbar";
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

function FiltersFallback() {
  return <Skeleton className="h-24 w-full rounded-lg" />;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cases</h1>
          <p className="text-muted-foreground">
            Track requests through the case workflow.
            {view ? (
              <>
                {" "}
                Active view: <span className="font-medium text-foreground">{view.name}</span>
              </>
            ) : null}
          </p>
        </div>
        {canCreateCase(profile.role) && (
          <Button asChild>
            <Link href="/cases/new">New case</Link>
          </Button>
        )}
      </div>

      <Suspense fallback={<FiltersFallback />}>
        <SavedViewsToolbar views={views} />
      </Suspense>

      <Suspense fallback={<FiltersFallback />}>
        <CaseFilters />
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
