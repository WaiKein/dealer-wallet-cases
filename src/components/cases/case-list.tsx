import Link from "next/link";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { SlaStateBadge } from "@/components/cases/sla-state-badge";
import { formatCaseAge, formatCurrency } from "@/lib/utils";
import type { CaseSla, CaseWithRelations } from "@/types";

interface CaseListProps {
  cases: CaseWithRelations[];
}

function findSla(records: CaseSla[] | undefined, type: CaseSla["sla_type"]) {
  return records?.find((item) => item.sla_type === type);
}

export function CaseList({ cases }: CaseListProps) {
  if (cases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        No cases found. Adjust filters or create a new case.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="hidden grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-medium md:grid">
        <div className="col-span-2">Case #</div>
        <div className="col-span-2">Title</div>
        <div className="col-span-1">Group</div>
        <div className="col-span-1">Agent</div>
        <div className="col-span-1">FR SLA</div>
        <div className="col-span-1">Res SLA</div>
        <div className="col-span-1">Age</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1">Amount</div>
      </div>
      <ul className="divide-y">
        {cases.map((caseItem) => {
          const firstResponse = findSla(caseItem.sla_records, "first_response");
          const resolution = findSla(caseItem.sla_records, "resolution");

          return (
            <li key={caseItem.id}>
              <Link
                href={`/cases/${caseItem.id}`}
                className="grid grid-cols-1 gap-2 px-4 py-4 transition-colors hover:bg-muted/30 md:grid-cols-12 md:items-center md:gap-3"
              >
                <div className="font-medium md:col-span-2">{caseItem.case_number}</div>
                <div className="md:col-span-2">
                  <p className="font-medium line-clamp-1">{caseItem.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {caseItem.category?.name ?? "—"} / {caseItem.subcategory?.name ?? "—"}
                  </p>
                </div>
                <div className="text-sm md:col-span-1">
                  {caseItem.assigned_group?.name ?? "Unassigned"}
                </div>
                <div className="text-sm md:col-span-1">
                  {caseItem.assigned_agent?.full_name ?? "—"}
                </div>
                <div className="md:col-span-1">
                  {firstResponse ? (
                    <SlaStateBadge state={firstResponse.state} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="md:col-span-1">
                  {resolution ? (
                    <SlaStateBadge state={resolution.state} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground md:col-span-1">
                  {formatCaseAge(caseItem.created_at)}
                </div>
                <div className="md:col-span-2">
                  <CaseStatusBadge status={caseItem.status} />
                </div>
                <div className="text-sm md:col-span-1">
                  {caseItem.adjustment_type === "credit" ? "+" : "-"}
                  {formatCurrency(Number(caseItem.adjustment_amount), caseItem.currency)}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
