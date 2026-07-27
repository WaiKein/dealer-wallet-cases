import Link from "next/link";
import { AuditTimeline } from "@/components/cases/audit-timeline";
import { CaseActionButtons } from "@/components/cases/case-action-buttons";
import { CaseAttachments } from "@/components/cases/case-attachments";
import { CaseComments } from "@/components/cases/case-comments";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { ReassignAgentForm } from "@/components/cases/reassign-agent-form";
import { SlaStateBadge } from "@/components/cases/sla-state-badge";
import { StatusActionButtons } from "@/components/cases/status-action-buttons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  canAcknowledgeCase,
} from "@/lib/auth/permissions";
import { PRIORITY_LABELS } from "@/lib/auth/roles";
import { formatCaseAge, formatCurrency, formatDateTime } from "@/lib/utils";
import type { CaseSla, CaseWithRelations, Profile } from "@/types";

interface CaseDetailProps {
  caseData: CaseWithRelations;
  profile: Profile;
  agents: { id: string; full_name: string; email: string }[];
  canClaim: boolean;
  canReassign: boolean;
}

function findSla(records: CaseSla[] | undefined, type: CaseSla["sla_type"]) {
  return records?.find((item) => item.sla_type === type);
}

export function CaseDetail({
  caseData,
  profile,
  agents,
  canClaim,
  canReassign,
}: CaseDetailProps) {
  const firstResponse = findSla(caseData.sla_records, "first_response");
  const resolution = findSla(caseData.sla_records, "resolution");
  const canAcknowledge =
    !caseData.acknowledged_at &&
    canAcknowledgeCase(profile.role, caseData.assigned_agent_id, profile.id);

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
              <DetailItem label="Account ID (system)" value={caseData.dealer_id} />
              <DetailItem label="Reference ID" value={caseData.wallet_id} />
              <DetailItem
                label="Adjustment"
                value={`${caseData.adjustment_type === "credit" ? "Credit" : "Debit"} · ${formatCurrency(Number(caseData.adjustment_amount), caseData.currency)}`}
              />
              <DetailItem
                label="Priority"
                value={PRIORITY_LABELS[caseData.priority]}
              />
              <DetailItem
                label="Category"
                value={caseData.category?.name ?? "—"}
              />
              <DetailItem
                label="Subcategory"
                value={caseData.subcategory?.name ?? "—"}
              />
              <DetailItem
                label="Assignment group"
                value={caseData.assigned_group?.name ?? "Unassigned"}
              />
              <DetailItem
                label="Assigned agent"
                value={caseData.assigned_agent?.full_name ?? "Unassigned"}
              />
              <DetailItem
                label="Requester"
                value={caseData.requester?.full_name ?? caseData.requester_id}
              />
              <DetailItem
                label="Approver"
                value={caseData.approver?.full_name ?? "Not assigned"}
              />
              <DetailItem
                label="Case age"
                value={formatCaseAge(caseData.created_at)}
              />
              <DetailItem
                label="Created"
                value={formatDateTime(caseData.created_at)}
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

          <div className="grid gap-6 md:grid-cols-2">
            <SlaCard title="First-response SLA" record={firstResponse} />
            <SlaCard title="Resolution SLA" record={resolution} />
          </div>

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
          <CaseActionButtons
            caseId={caseData.id}
            canClaim={canClaim}
            canAcknowledge={canAcknowledge}
          />

          <StatusActionButtons
            caseId={caseData.id}
            currentStatus={caseData.status}
            role={profile.role}
            version={caseData.version ?? 1}
          />

          {canReassign && (
            <ReassignAgentForm
              caseId={caseData.id}
              currentAgentId={caseData.assigned_agent_id}
              agents={agents}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Assignment history</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTimeline
                entries={caseData.audit_history ?? []}
                title="Assignment history"
                eventFilter={["assignment", "reassignment", "claim"]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SLA activity</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTimeline
                entries={caseData.audit_history ?? []}
                title="SLA activity"
                eventFilter={[
                  "sla_due_soon",
                  "sla_breach",
                  "sla_completed",
                  "sla_paused",
                  "sla_resumed",
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
              <CardDescription>All recorded status changes</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTimeline
                entries={caseData.audit_history ?? []}
                eventFilter={["status_change", "acknowledge", "case_reopened"]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SlaCard({ title, record }: { title: string; record?: CaseSla }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {record ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">State</span>
              <SlaStateBadge state={record.state} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Due</span>
              <span>{formatDateTime(record.due_at)}</span>
            </div>
            {record.completed_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span>{formatDateTime(record.completed_at)}</span>
              </div>
            )}
            {record.paused_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paused at</span>
                <span>{formatDateTime(record.paused_at)}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">No SLA record.</p>
        )}
      </CardContent>
    </Card>
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
