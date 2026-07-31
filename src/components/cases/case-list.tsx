import Link from "next/link";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { SlaStateBadge } from "@/components/cases/sla-state-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/ui/data-table";
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
      <EmptyState
        title="No cases found"
        message="Adjust filters or create a new case to populate this queue."
      />
    );
  }

  return (
    <DataTable
      headers={["Case / item", "Status", "SLA", "Owner", "Updated"]}
    >
      {cases.map((caseItem) => {
        const resolution = findSla(caseItem.sla_records, "resolution");
        const firstResponse = findSla(caseItem.sla_records, "first_response");
        const sla = resolution?.state === "RUNNING" || resolution?.state === "DUE_SOON" || resolution?.state === "BREACHED"
          ? resolution
          : firstResponse;

        return (
          <DataTableRow key={caseItem.id}>
            <DataTableCell primary>
              <Link href={`/cases/${caseItem.id}`} className="hover:underline">
                <span className="block">{caseItem.case_number}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {caseItem.title}
                </span>
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {caseItem.dealer_id} ·{" "}
                {formatCurrency(
                  Number(caseItem.adjustment_amount),
                  caseItem.currency
                )}
              </p>
            </DataTableCell>
            <DataTableCell>
              <CaseStatusBadge status={caseItem.status} />
            </DataTableCell>
            <DataTableCell>
              {sla ? <SlaStateBadge state={sla.state} /> : "—"}
            </DataTableCell>
            <DataTableCell>
              {caseItem.assigned_agent?.full_name ??
                caseItem.assigned_group?.name ??
                "Unassigned"}
            </DataTableCell>
            <DataTableCell>{formatCaseAge(caseItem.updated_at)}</DataTableCell>
          </DataTableRow>
        );
      })}
    </DataTable>
  );
}
