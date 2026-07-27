import { createClient } from "@/lib/supabase/server";
import { getCorrelationId } from "@/lib/observability/correlation";
import type { AuditEventType, CaseStatus } from "@/types";

export async function recordAuditEntry(params: {
  caseId: string;
  eventType: AuditEventType;
  fromStatus?: CaseStatus | null;
  toStatus?: CaseStatus | null;
  changedBy: string;
  comment?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const supabase = await createClient();
  const correlationId = getCorrelationId();
  const { error } = await supabase.from("case_audit_history").insert({
    case_id: params.caseId,
    event_type: params.eventType,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    changed_by: params.changedBy,
    comment: params.comment ?? null,
    metadata: {
      ...(params.metadata ?? {}),
      correlationId,
    },
    correlation_id: correlationId,
  });

  return error?.message ?? null;
}
