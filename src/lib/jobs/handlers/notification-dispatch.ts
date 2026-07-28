import type { BackgroundJob } from "@/lib/jobs/enqueue";
import { dispatchNotificationChannels } from "@/lib/notifications/dispatch";
import type { NotificationType, UserRole } from "@/types";

/** System action: in-app insert + optional email outbox (flag-gated). */
export async function handleNotificationDispatchJob(
  job: BackgroundJob
): Promise<void> {
  const recipients = (job.payload.recipients ?? []) as {
    id: string;
    role: UserRole;
    email?: string | null;
  }[];
  const caseId = String(job.payload.caseId ?? "");
  const type = job.payload.type as NotificationType;
  const title = String(job.payload.title ?? "");
  const body = String(job.payload.body ?? "");
  const suffix = job.payload.suffix as string | undefined;
  const emailEventType = job.payload.emailEventType as string | undefined;
  const variables = (job.payload.variables ?? undefined) as
    | Record<string, string>
    | undefined;

  if (!caseId || !type || !recipients.length) {
    throw new Error("notification.dispatch payload incomplete.");
  }

  await dispatchNotificationChannels({
    organizationId: job.organization_id,
    recipients,
    caseId,
    type,
    title,
    body,
    suffix,
    emailEventType,
    variables,
  });
}
