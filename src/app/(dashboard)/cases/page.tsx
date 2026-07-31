import Link from "next/link";
import { Suspense } from "react";
import { CaseFilters } from "@/components/cases/case-filters";
import { CaseList } from "@/components/cases/case-list";
import { SavedViewsToolbar } from "@/components/cases/saved-views-toolbar";
import { PageHeader } from "@/components/layout/page-header";
import { CommandToolbar } from "@/components/ui/command-toolbar";
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

  const openCount = cases?.length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cases"
        description={
          view
            ? `${openCount} in view · Active view: ${view.name}`
            : `${openCount} matching · Track requests through the workflow.`
        }
        action={
          canCreateCase(profile.role) ? (
            <Button asChild>
              <Link href="/cases/new">New case</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        <QuickView href="/cases" label="All" />
        <QuickView href="/cases?status=PENDING_APPROVAL" label="Pending approval" />
        <QuickView href="/workspace?queue=breached" label="SLA at risk" />
      </div>

      <CommandToolbar>
        <div className="min-w-0 flex-1 space-y-3">
          <Suspense fallback={<FiltersFallback />}>
            <SavedViewsToolbar views={views} />
          </Suspense>
          <Suspense fallback={<FiltersFallback />}>
            <CaseFilters />
          </Suspense>
        </div>
      </CommandToolbar>

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

function QuickView({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {label}
    </Link>
  );
}
