import { createNotification } from "@/lib/notifications/service";
import type {
  NotificationChannel,
  NotificationDeliveryResult,
  NotificationMessage,
} from "@/lib/notifications/channels/types";
import type { NotificationType, UserRole } from "@/types";

export class InAppNotificationChannel implements NotificationChannel {
  readonly kind = "in_app" as const;

  async send(message: NotificationMessage): Promise<NotificationDeliveryResult> {
    const result = await createNotification({
      organizationId: message.organizationId,
      userId: message.recipientUserId,
      userRole: message.recipientRole as UserRole,
      caseId: message.caseId,
      type: message.notificationType as NotificationType,
      title: message.title,
      body: message.body,
      suffix: message.suffix,
    });

    if (result.error) {
      return {
        ok: false,
        status: "FAILED_RETRYABLE",
        error: result.error,
      };
    }

    return {
      ok: true,
      status: result.created ? "DELIVERED" : "SUPPRESSED",
      suppressedReason: result.created ? null : "duplicate_in_app",
    };
  }
}
