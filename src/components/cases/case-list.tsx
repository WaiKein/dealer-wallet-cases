import Link from "next/link";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { CaseRecord } from "@/types";

interface CaseListProps {
  cases: CaseRecord[];
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
      <div className="hidden grid-cols-12 gap-4 border-b bg-muted/40 px-4 py-3 text-sm font-medium md:grid">
        <div className="col-span-2">Case #</div>
        <div className="col-span-3">Title</div>
        <div className="col-span-2">Dealer</div>
        <div className="col-span-2">Amount</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1">Updated</div>
      </div>
      <ul className="divide-y">
        {cases.map((caseItem) => (
          <li key={caseItem.id}>
            <Link
              href={`/cases/${caseItem.id}`}
              className="grid grid-cols-1 gap-2 px-4 py-4 transition-colors hover:bg-muted/30 md:grid-cols-12 md:items-center md:gap-4"
            >
              <div className="font-medium md:col-span-2">{caseItem.case_number}</div>
              <div className="md:col-span-3">
                <p className="font-medium">{caseItem.title}</p>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {caseItem.description}
                </p>
              </div>
              <div className="text-sm md:col-span-2">{caseItem.dealer_id}</div>
              <div className="text-sm md:col-span-2">
                {caseItem.adjustment_type === "credit" ? "+" : "-"}
                {formatCurrency(Number(caseItem.adjustment_amount), caseItem.currency)}
              </div>
              <div className="md:col-span-2">
                <CaseStatusBadge status={caseItem.status} />
              </div>
              <div className="text-sm text-muted-foreground md:col-span-1">
                {formatDateTime(caseItem.updated_at)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
