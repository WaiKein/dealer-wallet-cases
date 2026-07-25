import { formatDateTime } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/auth/roles";
import type { AuditEventType, CaseAuditEntry } from "@/types";

interface AuditTimelineProps {
  entries: CaseAuditEntry[];
  title?: string;
  eventFilter?: AuditEventType[];
}

function describeEntry(entry: CaseAuditEntry): string {
  if (entry.event_type === "status_change" || entry.event_type === "case_reopened") {
    if (entry.from_status && entry.to_status) {
      return `${STATUS_LABELS[entry.from_status]} → ${STATUS_LABELS[entry.to_status]}`;
    }
    if (entry.to_status) {
      return `Created as ${STATUS_LABELS[entry.to_status]}`;
    }
  }

  const labels: Partial<Record<AuditEventType, string>> = {
    assignment: "Group assignment",
    reassignment: "Agent reassignment",
    claim: "Case claimed",
    acknowledge: "Case acknowledged",
    sla_due_soon: "SLA due soon",
    sla_breach: "SLA breached",
    sla_completed: "SLA completed",
    sla_paused: "SLA paused",
    sla_resumed: "SLA resumed",
    case_reopened: "Case reopened",
  };

  return labels[entry.event_type] ?? entry.event_type;
}

export function AuditTimeline({
  entries,
  title,
  eventFilter,
}: AuditTimelineProps) {
  const filtered = eventFilter
    ? entries.filter((entry) => eventFilter.includes(entry.event_type))
    : entries;

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {title ? `No ${title.toLowerCase()} yet.` : "No audit history recorded yet."}
      </p>
    );
  }

  return (
    <ol className="relative space-y-6 border-l pl-6">
      {filtered.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{describeEntry(entry)}</p>
            {entry.comment && (
              <p className="text-sm text-muted-foreground">{entry.comment}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDateTime(entry.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
