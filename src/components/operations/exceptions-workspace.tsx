"use client";

import { useMemo, useState, useTransition } from "react";
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
import {
  EXCEPTION_QUEUE_LABELS,
  type ExceptionQueueRow,
  type ExceptionQueueType,
} from "@/lib/exceptions/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ageLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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

  const filtered =
    activeQueue === "all"
      ? rows
      : rows.filter((row) => row.queue_type === activeQueue);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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
          .map(csvEscape)
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

  const queueTypes = Object.keys(EXCEPTION_QUEUE_LABELS) as ExceptionQueueType[];

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={selected.size === 0}
          onClick={exportSelected}
        >
          Export selected ({selected.size})
        </Button>
      </div>

      {error ? (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {filtered.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No open exceptions</CardTitle>
            <CardDescription>
              This queue is clear for the current filter.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-4">
          {filtered.map((row) => {
            const canRetry =
              canManage &&
              Boolean(row.case_id) &&
              (row.execution_status === "FAILED_RETRYABLE" ||
                row.queue_type === "integration_retry_pending");
            // Never blind-retry UNKNOWN financial results — inquiry first.
            const canInquire =
              canManage &&
              Boolean(row.case_id) &&
              (row.queue_type === "integration_unknown" ||
                row.execution_status === "UNKNOWN");

            return (
              <li key={row.id}>
                <Card>
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={`Select ${row.case_number ?? row.id}`}
                        />
                        <div>
                          <CardTitle className="text-base">
                            {row.case_number ? (
                              <Link
                                href={`/cases/${row.case_id}`}
                                className="hover:underline"
                              >
                                {row.case_number}
                              </Link>
                            ) : (
                              "No case"
                            )}{" "}
                            · {row.case_title ?? row.title ?? "Exception"}
                          </CardTitle>
                          <CardDescription>
                            {EXCEPTION_QUEUE_LABELS[row.queue_type]} ·{" "}
                            {row.status}
                            {row.reconciliation_required
                              ? " · reconciliation required"
                              : ""}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{row.status}</Badge>
                        {row.execution_status ? (
                          <Badge variant="outline">{row.execution_status}</Badge>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                      <Meta
                        label="Failure category"
                        value={row.failure_category}
                      />
                      <Meta label="Last attempt" value={row.last_attempt_at} />
                      <Meta label="Next retry" value={row.next_retry_at} />
                      <Meta
                        label="External ref"
                        value={row.external_transaction_ref}
                      />
                      <Meta
                        label="Correlation"
                        value={row.execution_correlation_id}
                      />
                      <Meta
                        label="Case age"
                        value={ageLabel(row.case_created_at)}
                      />
                      <Meta
                        label="Exception age"
                        value={ageLabel(row.created_at)}
                      />
                    </div>

                    {row.last_internal_note ? (
                      <p className="text-muted-foreground">
                        Note: {row.last_internal_note}
                      </p>
                    ) : null}

                    {canManage ? (
                      <div className="space-y-3 border-t pt-3">
                        <div className="flex flex-wrap gap-2">
                          {row.case_id ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/cases/${row.case_id}`}>
                                Open case
                              </Link>
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
                                run(() =>
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
                                run(() =>
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
                              run(() =>
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
                              run(() =>
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
                              onChange={(e) =>
                                setOwnerById((prev) => ({
                                  ...prev,
                                  [row.id]: e.target.value,
                                }))
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
                                run(() =>
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
                              onChange={(e) =>
                                setNoteById((prev) => ({
                                  ...prev,
                                  [row.id]: e.target.value,
                                }))
                              }
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={pending || !noteById[row.id]?.trim()}
                              onClick={() =>
                                run(() =>
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
                            onChange={(e) =>
                              setNoteById((prev) => ({
                                ...prev,
                                [`${row.id}:resolve`]: e.target.value,
                              }))
                            }
                          />
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={
                                pending ||
                                !noteById[`${row.id}:resolve`]?.trim()
                              }
                              onClick={() =>
                                run(() =>
                                  resolveExceptionAction({
                                    exceptionId: row.id,
                                    resolutionNote:
                                      noteById[`${row.id}:resolve`],
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
                                pending ||
                                !noteById[`${row.id}:resolve`]?.trim()
                              }
                              onClick={() =>
                                run(() =>
                                  resolveExceptionAction({
                                    exceptionId: row.id,
                                    resolutionNote:
                                      noteById[`${row.id}:resolve`],
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
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
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
      className={`rounded-full border px-3 py-1 text-xs ${
        active
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      }`}
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
