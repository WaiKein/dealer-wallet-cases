import { EmailNotificationChannel } from "@/lib/notifications/channels/email";
import { InAppNotificationChannel } from "@/lib/notifications/channels/in-app";
import type { NotificationChannel } from "@/lib/notifications/channels/types";

export function getInAppNotificationChannel(): NotificationChannel {
  return new InAppNotificationChannel();
}

export function getEmailNotificationChannel(): NotificationChannel {
  return new EmailNotificationChannel();
}
