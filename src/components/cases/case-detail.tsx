import { ApprovalPanel } from "@/components/cases/approval-panel";
import { AuditTimeline } from "@/components/cases/audit-timeline";
import { CaseActionButtons } from "@/components/cases/case-action-buttons";
import { CaseAttachments } from "@/components/cases/case-attachments";
import { CaseComments } from "@/components/cases/case-comments";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { ExecutionPanel } from "@/components/cases/execution-panel";
import { ReassignAgentForm } from "@/components/cases/reassign-agent-form";
import { SlaStateBadge } from "@/components/cases/sla-state-badge";
import { StatusActionButtons } from "@/components/cases/status-action-buttons";
import { PageBreadcrumb, PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canAcknowledgeCase,
} from "@/lib/auth/permissions";
import { PRIORITY_LABELS } from "@/lib/auth/roles";
import { formatCaseAge, formatCurrency, formatDateTime, formatSlaRemaining } from "@/lib/utils";
import type { CaseSla, CaseWithRelations, Profile } from "@/types";

interface CaseDetailProps {
  caseData: CaseWithRelations;
  profile: Profile;
  agents: { id: string; full_name: string; email: string }[];
  canClaim: boolean;
  canReassign: boolean;
  approvalRequest?: Record<string, unknown> | null;
  approvalSteps?: Record<string, unknown>[];
  execution?: {
    id: string;
    status: string;
    provider?: string;
    attempt_count?: number;
    response_code?: string | null;
    sanitised_response_summary?: string | null;
    failure_category?: string | null;
    requires_status_inquiry?: boolean;
    external_transaction_ref?: string | null;
    version?: number;
  } | null;
  executionAttempts?: {
    id: string;
    attempt_no: number;
    kind: string;
    outcome?: string | null;
    response_code?: string | null;
    sanitised_error?: string | null;
  }[];
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
  approvalRequest = null,
  approvalSteps = [],
  execution = null,
  executionAttempts = [],
}: CaseDetailProps) {
  const firstResponse = findSla(caseData.sla_records, "first_response");
  const resolution = findSla(caseData.sla_records, "resolution");
  const canAcknowledge =
    !caseData.acknowledged_at &&
    canAcknowledgeCase(profile.role, caseData.assigned_agent_id, profile.id);

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb
          items={[
            { href: "/cases", label: "Cases" },
            { label: caseData.case_number },
          ]}
        />
        <PageHeader
          title={caseData.title}
          description={undefined}
          badges={
            <>
              <CaseStatusBadge status={caseData.status} />
              <Badge variant="outline">
                {PRIORITY_LABELS[caseData.priority]} priority
              </Badge>
              {resolution ? (
                <Badge
                  variant={
                    resolution.state === "DUE_SOON" ||
                    resolution.state === "BREACHED"
                      ? "warning"
                      : "secondary"
                  }
                >
                  SLA{" "}
                  {resolution.state === "COMPLETED"
                    ? "Met"
                    : formatSlaRemaining(resolution.due_at)}
                </Badge>
              ) : null}
            </>
          }
          action={
            <Button asChild>
              <a href="#next-action">Take action</a>
            </Button>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="ops-panel space-y-4 p-4">
            <h2 className="text-sm font-semibold">Request summary</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <DetailItem label="Dealer / account" value={caseData.dealer_id} />
              <DetailItem label="Reference" value={caseData.wallet_id} />
              <DetailItem
                label="Amount"
                value={`${caseData.adjustment_type === "credit" ? "Credit" : "Debit"} · ${formatCurrency(Number(caseData.adjustment_amount), caseData.currency)}`}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {caseData.description}
            </p>
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
              <DetailItem
                label="Category"
                value={caseData.category?.name ?? "—"}
              />
              <DetailItem
                label="Subcategory"
                value={caseData.subcategory?.name ?? "—"}
              />
              <DetailItem
                label="Requester"
                value={caseData.requester?.full_name ?? caseData.requester_id}
              />
              <DetailItem
                label="Case age"
                value={formatCaseAge(caseData.created_at)}
              />
              {caseData.rejection_reason ? (
                <DetailItem
                  label="Rejection reason"
                  value={caseData.rejection_reason}
                  className="sm:col-span-2"
                />
              ) : null}
              {caseData.resolution_notes ? (
                <DetailItem
                  label="Resolution notes"
                  value={caseData.resolution_notes}
                  className="sm:col-span-2"
                />
              ) : null}
            </div>
          </div>

          <div className="ops-panel p-4">
            <h2 className="mb-3 text-sm font-semibold">Activity</h2>
            <AuditTimeline
              entries={caseData.audit_history ?? []}
              title="Activity"
            />
          </div>

          <CaseComments
            caseId={caseData.id}
            comments={caseData.comments ?? []}
            viewerRole={profile.role}
          />

          <CaseAttachments
            caseId={caseData.id}
            attachments={caseData.attachments ?? []}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <SlaCard title="First-response SLA" record={firstResponse} />
            <SlaCard title="Resolution SLA" record={resolution} />
          </div>

          <ApprovalPanel
            request={
              approvalRequest
                ? {
                    status: String(approvalRequest.status),
                    requested_amount: Number(approvalRequest.requested_amount),
                    approved_amount:
                      approvalRequest.approved_amount == null
                        ? null
                        : Number(approvalRequest.approved_amount),
                    approval_levels: Number(
                      approvalRequest.approval_levels ?? 1
                    ),
                    approval_rule_code:
                      (approvalRequest.approval_rule_code as string | null) ??
                      null,
                    version: Number(approvalRequest.version ?? 1),
                  }
                : null
            }
            steps={approvalSteps.map((step) => ({
              id: String(step.id),
              level_no: Number(step.level_no),
              status: String(step.status),
              required_role: (step.required_role as string | null) ?? null,
              decided_by: (step.decided_by as string | null) ?? null,
              decided_as_delegate_of:
                (step.decided_as_delegate_of as string | null) ?? null,
              rejection_reason:
                (step.rejection_reason as string | null) ?? null,
            }))}
          />

          <ExecutionPanel
            caseId={caseData.id}
            canManage={
              profile.role === "operations_agent" ||
              profile.role === "team_lead" ||
              profile.role === "admin"
            }
            execution={
              execution
                ? {
                    id: execution.id,
                    status: execution.status,
                    provider: execution.provider ?? "mock_wallet",
                    attempt_count: Number(execution.attempt_count ?? 0),
                    response_code: execution.response_code ?? null,
                    sanitised_response_summary:
                      execution.sanitised_response_summary ?? null,
                    failure_category: execution.failure_category ?? null,
                    requires_status_inquiry: Boolean(
                      execution.requires_status_inquiry
                    ),
                    external_transaction_ref:
                      execution.external_transaction_ref ?? null,
                    version: Number(execution.version ?? 1),
                  }
                : null
            }
            attempts={executionAttempts.map((attempt) => ({
              id: attempt.id,
              attempt_no: Number(attempt.attempt_no),
              kind: attempt.kind,
              outcome: attempt.outcome ?? null,
              response_code: attempt.response_code ?? null,
              sanitised_error: attempt.sanitised_error ?? null,
            }))}
          />
        </div>

        <div className="space-y-6">
          <div id="next-action" className="ops-panel space-y-3 p-4">
            <h2 className="text-sm font-semibold">Next action</h2>
            <p className="text-xs text-muted-foreground">
              Only actions permitted for your role are shown.
            </p>
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
              approvalVersion={
                approvalRequest && typeof approvalRequest.version === "number"
                  ? approvalRequest.version
                  : undefined
              }
            />
          </div>

          <div className="ops-panel space-y-3 p-4">
            <h2 className="text-sm font-semibold">Ownership</h2>
            <DetailItem
              label="Assignment group"
              value={caseData.assigned_group?.name ?? "Unassigned"}
            />
            <DetailItem
              label="Assigned agent"
              value={caseData.assigned_agent?.full_name ?? "Unassigned agent"}
            />
            <DetailItem
              label="Approver"
              value={caseData.approver?.full_name ?? "Not assigned"}
            />
            {canReassign ? (
              <ReassignAgentForm
                caseId={caseData.id}
                currentAgentId={caseData.assigned_agent_id}
                agents={agents}
              />
            ) : null}
          </div>

          <div className="ops-panel p-4">
            <h2 className="mb-3 text-sm font-semibold">SLA</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">First response</span>
                {firstResponse ? (
                  <SlaStateBadge state={firstResponse.state} />
                ) : (
                  "—"
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Resolution</span>
                {resolution ? (
                  <span className="font-medium">
                    {resolution.state === "COMPLETED"
                      ? "Met"
                      : formatSlaRemaining(resolution.due_at)}
                  </span>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlaCard({ title, record }: { title: string; record?: CaseSla }) {
  return (
    <div className="ops-panel space-y-2 p-4 text-sm">
      <h3 className="font-semibold">{title}</h3>
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
