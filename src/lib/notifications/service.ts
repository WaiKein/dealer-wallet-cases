import {
  buildNotificationDedupeKey,
  canReceiveNotificationType,
} from "@/lib/notifications/dedupe";
import { getCorrelationId } from "@/lib/observability/correlation";
import { createClient } from "@/lib/supabase/server";
import type { NotificationType, UserRole } from "@/types";

export async function createNotification(params: {
  organizationId: string;
  userId: string;
  userRole: UserRole;
  caseId: string;
  type: NotificationType;
  title: string;
  body: string;
  suffix?: string;
}): Promise<{ created: boolean; error: string | null }> {
  if (!canReceiveNotificationType(params.userRole, params.type)) {
    return { created: false, error: null };
  }

  const dedupeKey = buildNotificationDedupeKey({
    type: params.type,
    caseId: params.caseId,
    userId: params.userId,
    suffix: params.suffix,
  });

  const supabase = await createClient();
  const correlationId = getCorrelationId();
  const { error } = await supabase.from("notifications").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    case_id: params.caseId,
    type: params.type,
    title: params.title,
    body: params.body,
    dedupe_key: dedupeKey,
    correlation_id: correlationId,
  });

  if (error) {
    // Unique violation = duplicate event; treat as success (idempotent).
    if (error.code === "23505") {
      return { created: false, error: null };
    }
    return { created: false, error: error.message };
  }

  return { created: true, error: null };
}

export async function notifyUsers(params: {
  organizationId: string;
  recipients: { id: string; role: UserRole }[];
  caseId: string;
  type: NotificationType;
  title: string;
  body: string;
  suffix?: string;
  /** When true, insert inline (job worker). Default enqueues a background job. */
  inline?: boolean;
}): Promise<void> {
  if (params.inline) {
    for (const recipient of params.recipients) {
      await createNotification({
        organizationId: params.organizationId,
        userId: recipient.id,
        userRole: recipient.role,
        caseId: params.caseId,
        type: params.type,
        title: params.title,
        body: params.body,
        suffix: params.suffix,
      });
    }
    return;
  }

  const { enqueueNotificationDispatch } = await import(
    "@/lib/jobs/domain-enqueue"
  );
  await enqueueNotificationDispatch(params);
}

export async function listNotificationsForUser(userId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data: data ?? [], error: error?.message ?? null };
}

export async function countUnreadNotifications(userId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  return { count: count ?? 0, error: error?.message ?? null };
}

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null);

  return error?.message ?? null;
}

export async function markAllNotificationsRead(
  userId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  return error?.message ?? null;
}
