"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addExceptionNoteAction,
  assignExceptionOwnerAction,
  escalateExceptionAction,
  inquireExceptionExecutionAction,
  markExceptionReconciliationAction,
  resolveExceptionAction,
  retryExceptionExecutionAction,
} from "@/lib/exceptions/actions";
import { escapeCsvCell } from "@/lib/csv";
import {
  EXCEPTION_QUEUE_LABELS,
  type ExceptionQueueRow,
  type ExceptionQueueType,
} from "@/lib/exceptions/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommandToolbar } from "@/components/ui/command-toolbar";
import {
  DataTable,
  DataTableCell,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function ageLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function KpiCard({
  title,
  value,
  href,
}: {
  title: string;
  value: number;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="ops-panel block p-4 transition-colors hover:bg-muted/30"
      >
        {content}
      </Link>
    );
  }

  return <div className="ops-panel p-4">{content}</div>;
}

export function ExceptionsWorkspace({
  rows,
  agents,
  canManage,
  activeQueue,
}: {
  rows: ExceptionQueueRow[];
  agents: { id: string; full_name: string }[];
  canManage: boolean;
  activeQueue: ExceptionQueueType | "all";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [ownerById, setOwnerById] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: rows.length };
    for (const row of rows) {
      map[row.queue_type] = (map[row.queue_type] ?? 0) + 1;
    }
    return map;
  }, [rows]);

  const kpis = useMemo(
    () => ({
      critical: rows.filter(
        (row) =>
          row.queue_type === "integration_failed_final" ||
          row.queue_type === "dead_letter_job"
      ).length,
      slaBreached: counts.sla_breached ?? 0,
      integrationUnknown: counts.integration_unknown ?? 0,
      unassigned: counts.unassigned_case ?? 0,
    }),
    [rows, counts]
  );

  const queueFiltered =
    activeQueue === "all"
      ? rows
      : rows.filter((row) => row.queue_type === activeQueue);

  const searchTerm = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!searchTerm) return queueFiltered;
    return queueFiltered.filter((row) => {
      const haystack = [
        row.case_number,
        row.case_title,
        row.title,
        row.execution_correlation_id,
        row.correlation_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [queueFiltered, searchTerm]);

  const queueTypes = Object.keys(
    EXCEPTION_QUEUE_LABELS
  ) as ExceptionQueueType[];

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function navigateQueue(queue: ExceptionQueueType | "all") {
    startTransition(() => {
      router.push(
        queue === "all"
          ? "/operations/exceptions"
          : `/operations/exceptions?queue=${queue}`
      );
    });
  }

  function exportSelected() {
    const chosen = filtered.filter((row) => selected.has(row.id));
    const header = [
      "queue_type",
      "status",
      "case_number",
      "case_title",
      "account_id",
      "requested_amount",
      "approved_amount",
      "case_status",
      "execution_status",
      "failure_category",
      "assigned_team",
      "assigned_agent",
      "last_attempt",
      "next_retry",
      "external_ref",
      "correlation_id",
      "case_age",
      "exception_age",
    ];
    const lines = [
      header.join(","),
      ...chosen.map((row) =>
        [
          row.queue_type,
          row.status,
          row.case_number,
          row.case_title,
          row.account_id,
          row.requested_amount,
          row.approved_amount,
          row.case_status,
          row.execution_status,
          row.failure_category,
          row.assigned_group_name,
          row.assigned_agent_name,
          row.last_attempt_at,
          row.next_retry_at,
          row.external_transaction_ref,
          row.execution_correlation_id,
          ageLabel(row.case_created_at),
          ageLabel(row.created_at),
        ]
          .map(escapeCsvCell)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exceptions-${activeQueue}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function run(action: () => Promise<{ error?: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Critical"
          value={kpis.critical}
          href="/operations/exceptions?queue=integration_failed_final"
        />
        <KpiCard
          title="SLA breached"
          value={kpis.slaBreached}
          href="/operations/exceptions?queue=sla_breached"
        />
        <KpiCard
          title="Integration unknown"
          value={kpis.integrationUnknown}
          href="/operations/exceptions?queue=integration_unknown"
        />
        <KpiCard
          title="Unassigned"
          value={kpis.unassigned}
          href="/operations/exceptions?queue=unassigned_case"
        />
      </div>

      <CommandToolbar>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search case number, title, correlation ID…"
          className="h-9 flex-1 min-w-[200px]"
          disabled={pending}
        />
        <Select
          value={activeQueue}
          onValueChange={(value) =>
            navigateQueue(value as ExceptionQueueType | "all")
          }
          disabled={pending}
        >
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="All queues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All queues ({counts.all ?? 0})</SelectItem>
            {queueTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {EXCEPTION_QUEUE_LABELS[type]} ({counts[type] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={selected.size === 0}
          onClick={exportSelected}
        >
          Export selected ({selected.size})
        </Button>
      </CommandToolbar>

      <div className="flex flex-wrap gap-2">
        <QueueChip
          href="/operations/exceptions"
          label={`All (${counts.all ?? 0})`}
          active={activeQueue === "all"}
        />
        {queueTypes.map((type) => (
          <QueueChip
            key={type}
            href={`/operations/exceptions?queue=${type}`}
            label={`${EXCEPTION_QUEUE_LABELS[type]} (${counts[type] ?? 0})`}
            active={activeQueue === type}
          />
        ))}
      </div>

      {error ? (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title="No open exceptions"
          message="This queue is clear for the current filter."
        />
      ) : (
        <>
          <DataTable
            headers={[
              "Exception / case",
              "Category",
              "Age",
              "Owner",
              "Status",
            ]}
          >
            {filtered.map((row) => {
              const atRisk = row.queue_type === "sla_breached";
              const expanded = expandedId === row.id;
              const canRetry =
                canManage &&
                Boolean(row.case_id) &&
                (row.execution_status === "FAILED_RETRYABLE" ||
                  row.queue_type === "integration_retry_pending");
              const canInquire =
                canManage &&
                Boolean(row.case_id) &&
                (row.queue_type === "integration_unknown" ||
                  row.execution_status === "UNKNOWN");
              const ownerLabel =
                row.assigned_agent_name ??
                row.assigned_group_name ??
                "Unassigned";

              return (
                <Fragment key={row.id}>
                  <tr
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted/40",
                      atRisk && "border-l-4 border-l-amber-500 bg-amber-50/40",
                      expanded && "bg-muted/30"
                    )}
                    onClick={() =>
                      setExpandedId((prev) =>
                        prev === row.id ? null : row.id
                      )
                    }
                  >
                    <DataTableCell primary>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(row.id)}
                          onChange={() => toggleSelected(row.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${row.case_number ?? row.id}`}
                        />
                        <div>
                          <span className="block">
                            {row.case_number ? (
                              <Link
                                href={`/cases/${row.case_id}`}
                                className="hover:underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {row.case_number}
                              </Link>
                            ) : (
                              "No case"
                            )}
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {row.case_title ?? row.title ?? "Exception"}
                            </span>
                          </span>
                          {row.reconciliation_required ? (
                            <p className="mt-1 text-xs text-amber-800">
                              Reconciliation required
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      {EXCEPTION_QUEUE_LABELS[row.queue_type]}
                    </DataTableCell>
                    <DataTableCell>{ageLabel(row.created_at)}</DataTableCell>
                    <DataTableCell>{ownerLabel}</DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-1">
                        {atRisk ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 text-amber-800"
                          >
                            At risk
                          </Badge>
                        ) : null}
                        <Badge variant="outline">{row.status}</Badge>
                        {row.execution_status ? (
                          <Badge variant="outline">
                            {row.execution_status}
                          </Badge>
                        ) : null}
                      </div>
                    </DataTableCell>
                  </tr>

                  {expanded ? (
                    <tr className="bg-muted/20">
                      <td colSpan={5} className="px-4 py-4">
                        <ExceptionEvidencePanel
                          row={row}
                          canManage={canManage}
                          canRetry={canRetry}
                          canInquire={canInquire}
                          pending={pending}
                          noteById={noteById}
                          ownerById={ownerById}
                          agents={agents}
                          onNoteChange={(id, value) =>
                            setNoteById((prev) => ({ ...prev, [id]: value }))
                          }
                          onOwnerChange={(id, value) =>
                            setOwnerById((prev) => ({ ...prev, [id]: value }))
                          }
                          onRun={run}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </DataTable>

          <Alert className="border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
            <AlertDescription>
              Selecting a row opens evidence, retry history and resolution
              actions.
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}

function ExceptionEvidencePanel({
  row,
  canManage,
  canRetry,
  canInquire,
  pending,
  noteById,
  ownerById,
  agents,
  onNoteChange,
  onOwnerChange,
  onRun,
}: {
  row: ExceptionQueueRow;
  canManage: boolean;
  canRetry: boolean;
  canInquire: boolean;
  pending: boolean;
  noteById: Record<string, string>;
  ownerById: Record<string, string>;
  agents: { id: string; full_name: string }[];
  onNoteChange: (id: string, value: string) => void;
  onOwnerChange: (id: string, value: string) => void;
  onRun: (action: () => Promise<{ error?: string | null }>) => void;
}) {
  return (
    <div className="ops-panel space-y-4 p-4 text-sm">
      <div>
        <h4 className="text-sm font-semibold">Evidence & retry history</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {EXCEPTION_QUEUE_LABELS[row.queue_type]} · {row.status}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Meta
          label="Correlation ID"
          value={row.execution_correlation_id ?? row.correlation_id}
        />
        <Meta label="Last attempt" value={row.last_attempt_at} />
        <Meta label="Next retry" value={row.next_retry_at} />
        <Meta label="Failure category" value={row.failure_category} />
        <Meta
          label="External ref"
          value={row.external_transaction_ref}
        />
        <Meta label="Account" value={row.account_id} />
        <Meta
          label="Requested"
          value={
            row.requested_amount != null
              ? Number(row.requested_amount).toFixed(2)
              : null
          }
        />
        <Meta
          label="Approved"
          value={
            row.approved_amount != null
              ? Number(row.approved_amount).toFixed(2)
              : null
          }
        />
        <Meta label="Case status" value={row.case_status} />
        <Meta label="Team" value={row.assigned_group_name} />
        <Meta label="Agent" value={row.assigned_agent_name} />
        <Meta label="Case age" value={ageLabel(row.case_created_at)} />
        <Meta label="Exception age" value={ageLabel(row.created_at)} />
      </div>

      {row.last_internal_note ? (
        <p className="rounded-md border bg-background px-3 py-2 text-muted-foreground">
          Last note: {row.last_internal_note}
        </p>
      ) : null}

      {canManage ? (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            {row.case_id ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/cases/${row.case_id}`}>Open case</Link>
              </Button>
            ) : null}
            {row.case_id ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/cases/${row.case_id}#execution`}>
                  View attempts
                </Link>
              </Button>
            ) : null}
            {canInquire ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  onRun(() =>
                    inquireExceptionExecutionAction({
                      caseId: row.case_id!,
                    })
                  )
                }
              >
                Status inquiry
              </Button>
            ) : null}
            {canRetry ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  onRun(() =>
                    retryExceptionExecutionAction({
                      caseId: row.case_id!,
                    })
                  )
                }
              >
                Retry execution
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                onRun(() =>
                  markExceptionReconciliationAction({
                    exceptionId: row.id,
                  })
                )
              }
            >
              Mark reconciliation
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                onRun(() =>
                  escalateExceptionAction({
                    exceptionId: row.id,
                    note: noteById[row.id],
                  })
                )
              }
            >
              Escalate
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex gap-2">
              <select
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={ownerById[row.id] ?? ""}
                onChange={(event) =>
                  onOwnerChange(row.id, event.target.value)
                }
              >
                <option value="">Assign owner…</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                disabled={pending || !ownerById[row.id]}
                onClick={() =>
                  onRun(() =>
                    assignExceptionOwnerAction({
                      exceptionId: row.id,
                      ownerId: ownerById[row.id],
                      expectedVersion: row.version,
                    })
                  )
                }
              >
                Assign
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Internal note"
                value={noteById[row.id] ?? ""}
                onChange={(event) =>
                  onNoteChange(row.id, event.target.value)
                }
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !noteById[row.id]?.trim()}
                onClick={() =>
                  onRun(() =>
                    addExceptionNoteAction({
                      exceptionId: row.id,
                      note: noteById[row.id],
                      expectedVersion: row.version,
                    })
                  )
                }
              >
                Add note
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Resolution note (required to close)"
              value={noteById[`${row.id}:resolve`] ?? ""}
              onChange={(event) =>
                onNoteChange(`${row.id}:resolve`, event.target.value)
              }
            />
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                disabled={
                  pending || !noteById[`${row.id}:resolve`]?.trim()
                }
                onClick={() =>
                  onRun(() =>
                    resolveExceptionAction({
                      exceptionId: row.id,
                      resolutionNote: noteById[`${row.id}:resolve`],
                    })
                  )
                }
              >
                Resolve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  pending || !noteById[`${row.id}:resolve`]?.trim()
                }
                onClick={() =>
                  onRun(() =>
                    resolveExceptionAction({
                      exceptionId: row.id,
                      resolutionNote: noteById[`${row.id}:resolve`],
                      dismiss: true,
                    })
                  )
                }
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QueueChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-accent text-accent-foreground"
          : "border-transparent text-muted-foreground hover:border-muted hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium break-all">{value || "—"}</p>
    </div>
  );
}
