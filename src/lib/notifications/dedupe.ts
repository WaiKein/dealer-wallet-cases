import type { NotificationType, UserRole } from "@/types";

/** Operational notification types hidden from requesters. */
export const OPERATIONAL_NOTIFICATION_TYPES: NotificationType[] = [
  "case_assignment",
  "case_reassignment",
  "approval_request",
  "approval_decision",
  "sla_due_soon",
  "sla_breach",
  "integration_execution",
];

export const REQUESTER_VISIBLE_NOTIFICATION_TYPES: NotificationType[] = [
  "approval_decision",
  "case_resolution",
  "case_reopening",
];

export function canReceiveNotificationType(
  role: UserRole,
  type: NotificationType
): boolean {
  if (role === "requester") {
    return REQUESTER_VISIBLE_NOTIFICATION_TYPES.includes(type);
  }
  return true;
}

export function buildNotificationDedupeKey(parts: {
  type: NotificationType;
  caseId: string;
  userId: string;
  /** Extra discriminator (e.g. sla type, status transition id). */
  suffix?: string;
}): string {
  return [parts.type, parts.caseId, parts.userId, parts.suffix ?? ""]
    .filter(Boolean)
    .join(":");
}
