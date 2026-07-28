import { isFeatureFlagEnabled } from "@/lib/executions/feature-flags";
import {
  getEmailNotificationChannel,
  getInAppNotificationChannel,
} from "@/lib/notifications/channels";
import {
  buildNotificationDedupeKey,
  canReceiveNotificationType,
} from "@/lib/notifications/dedupe";
import {
  defaultEmailEventType,
  type NotificationMessage,
} from "@/lib/notifications/channels/types";
import { filterNotificationRecipients } from "@/lib/security/recipients";
import { getCorrelationId } from "@/lib/observability/correlation";
import { createServiceClient } from "@/lib/supabase/api";
import type { NotificationType, UserRole } from "@/types";

export async function dispatchNotificationChannels(params: {
  organizationId: string;
  recipients: { id: string; role: UserRole; email?: string | null }[];
  caseId: string;
  type: NotificationType;
  title: string;
  body: string;
  suffix?: string;
  emailEventType?: string;
  variables?: Record<string, string>;
}): Promise<void> {
  const inApp = getInAppNotificationChannel();
  const emailEnabled = await isFeatureFlagEnabled({
    organizationId: params.organizationId,
    code: "email_notifications_enabled",
  });
  const email = emailEnabled ? getEmailNotificationChannel() : null;

  // Enrich emails if missing
  let emailByUser = new Map<string, string | null>();
  if (email) {
    const missing = params.recipients.filter((r) => !r.email).map((r) => r.id);
    if (missing.length) {
      const service = createServiceClient();
      const { data } = await service
        .from("profiles")
        .select("id, email")
        .in("id", missing);
      emailByUser = new Map(
        (data ?? []).map((row) => [row.id as string, (row.email as string) ?? null])
      );
    }
  }

  // Case context for templates
  let caseNumber = params.variables?.case_number ?? "";
  let caseTitle = params.variables?.title ?? "";
  if ((!caseNumber || !caseTitle) && params.caseId) {
    const service = createServiceClient();
    const { data: caseRow } = await service
      .from("cases")
      .select("case_number, title")
      .eq("id", params.caseId)
      .maybeSingle();
    caseNumber = caseNumber || String(caseRow?.case_number ?? "");
    caseTitle = caseTitle || String(caseRow?.title ?? "");
  }

  const correlationId = getCorrelationId();
  const eventType = defaultEmailEventType(params.type, params.emailEventType);

  const authorizedRecipients = await filterNotificationRecipients({
    organizationId: params.organizationId,
    recipients: params.recipients,
  });

  for (const recipient of authorizedRecipients) {
    if (!canReceiveNotificationType(recipient.role, params.type)) {
      continue;
    }

    const dedupeKey = buildNotificationDedupeKey({
      type: params.type,
      caseId: params.caseId,
      userId: recipient.id,
      suffix: params.suffix,
    });

    const audience =
      recipient.role === "requester" ? "requester" : "operations";

    const message: NotificationMessage = {
      organizationId: params.organizationId,
      recipientUserId: recipient.id,
      recipientRole: recipient.role,
      recipientEmail:
        recipient.email ?? emailByUser.get(recipient.id) ?? null,
      caseId: params.caseId,
      notificationType: params.type,
      eventType,
      title: params.title,
      body: params.body,
      variables: {
        case_number: caseNumber,
        title: caseTitle,
        summary: params.body,
        ...params.variables,
      },
      dedupeKey,
      suffix: params.suffix,
      correlationId,
      audience,
    };

    const inAppResult = await inApp.send(message);
    if (!inAppResult.ok && inAppResult.status === "FAILED_RETRYABLE") {
      throw new Error(inAppResult.error ?? "In-app notification failed.");
    }

    if (email) {
      const emailDedupe = `email:${dedupeKey}:${eventType}`;
      const emailResult = await email.send({
        ...message,
        dedupeKey: emailDedupe,
      });
      // Email failures are recorded on delivery rows; don't fail the whole job
      // unless we want retry — mark retryable by throwing for FAILED_RETRYABLE.
      if (!emailResult.ok && emailResult.status === "FAILED_RETRYABLE") {
        throw new Error(emailResult.error ?? "Email delivery failed.");
      }
    }
  }
}
