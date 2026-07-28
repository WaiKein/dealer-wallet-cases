export type NotificationDeliveryStatus =
  | "PENDING"
  | "SENDING"
  | "DELIVERED"
  | "FAILED_RETRYABLE"
  | "FAILED_FINAL"
  | "SUPPRESSED";

export type NotificationChannelKind = "in_app" | "email";

export interface NotificationMessage {
  organizationId: string;
  recipientUserId: string;
  recipientRole: string;
  recipientEmail?: string | null;
  caseId: string;
  notificationType: string;
  /** Template / email event key, e.g. case_assigned, execution_failed */
  eventType: string;
  title: string;
  body: string;
  subject?: string;
  variables?: Record<string, string>;
  dedupeKey: string;
  suffix?: string;
  correlationId?: string | null;
  /** Internal comments must never be included for requester-facing email. */
  audience: "requester" | "operations";
}

export interface NotificationDeliveryResult {
  ok: boolean;
  status: NotificationDeliveryStatus;
  providerRef?: string | null;
  error?: string | null;
  suppressedReason?: string | null;
}

export interface NotificationChannel {
  readonly kind: NotificationChannelKind;
  send(message: NotificationMessage): Promise<NotificationDeliveryResult>;
}

/** Map in-app notification types to default email event keys. */
export function defaultEmailEventType(
  notificationType: string,
  hint?: string
): string {
  if (hint) return hint;
  switch (notificationType) {
    case "case_assignment":
    case "case_reassignment":
      return "case_assigned";
    case "approval_request":
      return "approval_requested";
    case "approval_decision":
      return "approval_decision";
    case "sla_due_soon":
      return "sla_due_soon";
    case "sla_breach":
      return "sla_breached";
    case "case_resolution":
      return "case_resolved";
    case "case_reopening":
      return "case_reopened";
    case "integration_execution":
      return "execution_unknown";
    default:
      return notificationType;
  }
}
