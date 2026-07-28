import { createServiceClient } from "@/lib/supabase/api";
import {
  renderTemplate,
  resolveEmailTemplate,
} from "@/lib/notifications/templates";
import type {
  NotificationChannel,
  NotificationDeliveryResult,
  NotificationMessage,
} from "@/lib/notifications/channels/types";

function emailTransport(): "outbox" | "console" {
  const value = (process.env.EMAIL_TRANSPORT ?? "outbox").toLowerCase();
  return value === "console" ? "console" : "outbox";
}

/**
 * Development-safe email channel.
 * Default transport captures to notification_deliveries (outbox) — no external SMTP.
 */
export class EmailNotificationChannel implements NotificationChannel {
  readonly kind = "email" as const;

  async send(message: NotificationMessage): Promise<NotificationDeliveryResult> {
    if (!message.recipientEmail) {
      return {
        ok: true,
        status: "SUPPRESSED",
        suppressedReason: "missing_recipient_email",
      };
    }

    if (message.audience === "requester") {
      const blocked = /stack|exception|sql|password|secret|token/i.test(
        `${message.title}\n${message.body}`
      );
      if (blocked) {
        return {
          ok: true,
          status: "SUPPRESSED",
          suppressedReason: "sensitive_content_filtered",
        };
      }
    }

    const service = createServiceClient();
    const template = await resolveEmailTemplate({
      organizationId: message.organizationId,
      eventType: message.eventType,
    });

    const variables: Record<string, string> = {
      case_number: message.variables?.case_number ?? "",
      title: message.variables?.title ?? message.title,
      summary: message.variables?.summary ?? message.body,
      ...message.variables,
    };

    let subject = message.subject ?? message.title;
    let body = message.body;
    let templateId: string | null = null;

    if (template) {
      subject =
        renderTemplate(template.subject_template ?? subject, variables) ||
        subject;
      body = renderTemplate(template.body_template, variables) || body;
      templateId = template.id;
    }

    const { data: existing } = await service
      .from("notification_deliveries")
      .select("id, status, attempt_count")
      .eq("organization_id", message.organizationId)
      .eq("dedupe_key", message.dedupeKey)
      .maybeSingle();

    if (
      existing &&
      (existing.status === "DELIVERED" || existing.status === "SUPPRESSED")
    ) {
      return {
        ok: true,
        status: existing.status,
        suppressedReason: "duplicate_delivery",
        providerRef: existing.id,
      };
    }

    let deliveryId = existing?.id ?? null;
    const nextAttempt = Number(existing?.attempt_count ?? 0) + 1;

    if (!deliveryId) {
      const { data: inserted, error } = await service
        .from("notification_deliveries")
        .insert({
          organization_id: message.organizationId,
          channel: "email",
          event_type: message.eventType,
          notification_type: message.notificationType,
          case_id: message.caseId,
          recipient_user_id: message.recipientUserId,
          recipient_email: message.recipientEmail,
          template_id: templateId,
          subject,
          body,
          status: "SENDING",
          attempt_count: 1,
          dedupe_key: message.dedupeKey,
          correlation_id: message.correlationId ?? null,
        })
        .select("id")
        .single();

      if (error?.code === "23505") {
        return {
          ok: true,
          status: "SUPPRESSED",
          suppressedReason: "duplicate_delivery",
        };
      }
      if (error || !inserted) {
        return {
          ok: false,
          status: "FAILED_RETRYABLE",
          error: error?.message ?? "Failed to create delivery record.",
        };
      }
      deliveryId = inserted.id;
    } else {
      await service
        .from("notification_deliveries")
        .update({
          status: "SENDING",
          subject,
          body,
          template_id: templateId,
          attempt_count: nextAttempt,
          last_error: null,
          correlation_id: message.correlationId ?? null,
        })
        .eq("id", deliveryId);
    }

    if (emailTransport() === "console") {
      console.info("[email.outbox]", {
        to: message.recipientEmail,
        subject,
        body,
        deliveryId,
      });
    }

    const { error: updateError } = await service
      .from("notification_deliveries")
      .update({
        status: "DELIVERED",
        provider_ref: `outbox:${deliveryId}`,
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", deliveryId);

    if (updateError) {
      return {
        ok: false,
        status: "FAILED_RETRYABLE",
        error: updateError.message,
        providerRef: deliveryId,
      };
    }

    return {
      ok: true,
      status: "DELIVERED",
      providerRef: deliveryId,
    };
  }
}
