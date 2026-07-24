import Link from "next/link";
import { AuditTimeline } from "@/components/cases/audit-timeline";
import { AssignAgentForm } from "@/components/cases/assign-agent-form";
import { CaseAttachments } from "@/components/cases/case-attachments";
import { CaseComments } from "@/components/cases/case-comments";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { StatusActionButtons } from "@/components/cases/status-action-buttons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canAssignAgent } from "@/lib/auth/permissions";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { CaseWithRelations, Profile } from "@/types";

interface CaseDetailProps {
  caseData: CaseWithRelations;
  profile: Profile;
  agents: { id: string; full_name: string; email: string }[];
}

export function CaseDetail({ caseData, profile, agents }: CaseDetailProps) {
  const showAssign = canAssignAgent(profile.role, caseData.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{caseData.case_number}</h1>
            <CaseStatusBadge status={caseData.status} />
          </div>
          <p className="text-lg font-medium">{caseData.title}</p>
          <p className="mt-2 text-muted-foreground">{caseData.description}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/cases">Back to cases</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Case details</CardTitle>
              <CardDescription>Adjustment request information</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Account ID" value={caseData.dealer_id} />
              <DetailItem label="Reference ID" value={caseData.wallet_id} />
              <DetailItem
                label="Adjustment"
                value={`${caseData.adjustment_type === "credit" ? "Credit" : "Debit"} · ${formatCurrency(Number(caseData.adjustment_amount), caseData.currency)}`}
              />
              <DetailItem label="Currency" value={caseData.currency} />
              <DetailItem
                label="Requester"
                value={caseData.requester?.full_name ?? caseData.requester_id}
              />
              <DetailItem
                label="Assigned agent"
                value={caseData.assigned_agent?.full_name ?? "Unassigned"}
              />
              <DetailItem
                label="Approver"
                value={caseData.approver?.full_name ?? "Not assigned"}
              />
              <DetailItem
                label="Created"
                value={formatDateTime(caseData.created_at)}
              />
              <DetailItem
                label="Last updated"
                value={formatDateTime(caseData.updated_at)}
              />
              {caseData.rejection_reason && (
                <DetailItem
                  label="Rejection reason"
                  value={caseData.rejection_reason}
                  className="sm:col-span-2"
                />
              )}
              {caseData.resolution_notes && (
                <DetailItem
                  label="Resolution notes"
                  value={caseData.resolution_notes}
                  className="sm:col-span-2"
                />
              )}
            </CardContent>
          </Card>

          <CaseComments
            caseId={caseData.id}
            comments={caseData.comments ?? []}
          />

          <CaseAttachments
            caseId={caseData.id}
            attachments={caseData.attachments ?? []}
          />
        </div>

        <div className="space-y-6">
          <StatusActionButtons
            caseId={caseData.id}
            currentStatus={caseData.status}
            role={profile.role}
          />

          {showAssign && (
            <AssignAgentForm
              caseId={caseData.id}
              currentAgentId={caseData.assigned_agent_id}
              agents={agents}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
              <CardDescription>All recorded status changes</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTimeline entries={caseData.audit_history ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
