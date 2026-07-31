import Link from "next/link";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { SlaStateBadge } from "@/components/cases/sla-state-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { formatCurrency, formatSlaRemaining } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { CaseSla, CaseWithRelations } from "@/types";

interface CaseListProps {
  cases: CaseWithRelations[];
}

function findSla(records: CaseSla[] | undefined, type: CaseSla["sla_type"]) {
  return records?.find((item) => item.sla_type === type);
}

function pickUrgentSla(records: CaseSla[] | undefined) {
  if (!records?.length) return undefined;
  const order = ["BREACHED", "DUE_SOON", "RUNNING", "PAUSED", "COMPLETED"] as const;
  return [...records].sort(
    (a, b) => order.indexOf(a.state) - order.indexOf(b.state)
  )[0];
}

export function CaseList({ cases }: CaseListProps) {
  if (cases.length === 0) {
    return (
      <EmptyState
        title="No cases found"
        message="Adjust filters or create a new case to populate this queue."
      />
    );
  }

  return (
    <DataTable headers={["Case / item", "Status", "SLA", "Owner"]}>
      {cases.map((caseItem) => {
        const sla =
          pickUrgentSla(caseItem.sla_records) ??
          findSla(caseItem.sla_records, "resolution") ??
          findSla(caseItem.sla_records, "first_response");
        const atRisk =
          sla?.state === "DUE_SOON" || sla?.state === "BREACHED";

        return (
          <DataTableRow
            key={caseItem.id}
            className={cn(
              atRisk && "border-l-4 border-l-amber-500 bg-amber-50/40"
            )}
          >
            <DataTableCell primary>
              <Link href={`/cases/${caseItem.id}`} className="hover:underline">
                <span className="block">
                  {caseItem.case_number}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {caseItem.title}
                  </span>
                </span>
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="sr-only">Dealer / account: </span>
                {caseItem.dealer_id} ·{" "}
                {formatCurrency(
                  Number(caseItem.adjustment_amount),
                  caseItem.currency
                )}
              </p>
            </DataTableCell>
            <DataTableCell>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-muted-foreground md:hidden">
                  Status
                </span>
                {atRisk ? (
                  <SlaStateBadge state={sla!.state} />
                ) : (
                  <CaseStatusBadge status={caseItem.status} />
                )}
              </div>
            </DataTableCell>
            <DataTableCell>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-muted-foreground md:hidden">
                  SLA
                </span>
                {sla ? (
                  <span
                    className={cn(
                      "font-medium",
                      atRisk && "text-amber-800"
                    )}
                    title={sla.state}
                  >
                    {sla.state === "COMPLETED"
                      ? "Met"
                      : formatSlaRemaining(sla.due_at)}
                  </span>
                ) : (
                  "—"
                )}
              </div>
            </DataTableCell>
            <DataTableCell>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-muted-foreground md:hidden">
                  Owner
                </span>
                {caseItem.assigned_agent?.full_name ??
                  caseItem.assigned_group?.name ??
                  "Unassigned"}
              </div>
            </DataTableCell>
          </DataTableRow>
        );
      })}
    </DataTable>
  );
}
