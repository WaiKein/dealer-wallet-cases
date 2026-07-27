import type { BackgroundJob } from "@/lib/jobs/enqueue";
import { createNotification } from "@/lib/notifications/service";
import type { NotificationType, UserRole } from "@/types";

/** System action: notification insert only (org + recipient scoped). */
export async function handleNotificationDispatchJob(
  job: BackgroundJob
): Promise<void> {
  const recipients = (job.payload.recipients ?? []) as {
    id: string;
    role: UserRole;
  }[];
  const caseId = String(job.payload.caseId ?? "");
  const type = job.payload.type as NotificationType;
  const title = String(job.payload.title ?? "");
  const body = String(job.payload.body ?? "");
  const suffix = job.payload.suffix as string | undefined;

  if (!caseId || !type || !recipients.length) {
    throw new Error("notification.dispatch payload incomplete.");
  }

  for (const recipient of recipients) {
    const result = await createNotification({
      organizationId: job.organization_id,
      userId: recipient.id,
      userRole: recipient.role,
      caseId,
      type,
      title,
      body,
      suffix,
    });
    if (result.error) {
      throw new Error(result.error);
    }
  }
}
