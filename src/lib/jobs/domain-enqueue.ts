import { enqueueJob } from "@/lib/jobs/enqueue";
import type { CasePriority, NotificationType, UserRole } from "@/types";

export async function enqueueSlaRefresh(params: {
  organizationId: string;
  caseId: string;
  priority: CasePriority;
  assignedGroupId?: string | null;
  actorId?: string;
}) {
  return enqueueJob({
    organizationId: params.organizationId,
    jobType: "sla.refresh_case",
    payload: {
      caseId: params.caseId,
      priority: params.priority,
      assignedGroupId: params.assignedGroupId ?? null,
      actorId: params.actorId,
    },
    idempotencyKey: `sla.refresh:${params.caseId}:${crypto.randomUUID()}`,
  });
}

export async function enqueueNotificationDispatch(params: {
  organizationId: string;
  recipients: { id: string; role: UserRole }[];
  caseId: string;
  type: NotificationType;
  title: string;
  body: string;
  suffix?: string;
}) {
  if (!params.recipients.length) {
    return { id: null, error: null };
  }

  return enqueueJob({
    organizationId: params.organizationId,
    jobType: "notification.dispatch",
    payload: {
      recipients: params.recipients,
      caseId: params.caseId,
      type: params.type,
      title: params.title,
      body: params.body,
      suffix: params.suffix,
    },
    idempotencyKey: `notify:${params.type}:${params.caseId}:${params.suffix ?? "default"}:${params.recipients
      .map((r) => r.id)
      .sort()
      .join(",")}`,
  });
}
