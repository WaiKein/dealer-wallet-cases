import { formatDateTime } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/auth/roles";
import type { CaseAuditEntry } from "@/types";

interface AuditTimelineProps {
  entries: CaseAuditEntry[];
}

export function AuditTimeline({ entries }: AuditTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No audit history recorded yet.</p>
    );
  }

  return (
    <ol className="relative space-y-6 border-l pl-6">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {entry.from_status
                ? `${STATUS_LABELS[entry.from_status]} → ${STATUS_LABELS[entry.to_status]}`
                : `Created as ${STATUS_LABELS[entry.to_status]}`}
            </p>
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
