# Email notification adapter

Phase 6 adds a channel abstraction on top of the existing in-app notifications.

## Channels

```ts
interface NotificationChannel {
  send(message: NotificationMessage): Promise<NotificationDeliveryResult>;
}
```

- **InAppNotificationChannel** — inserts into `notifications` (unchanged behaviour)
- **EmailNotificationChannel** — org templates + delivery outbox (no real SMTP by default)

## Feature flag

`email_notifications_enabled` (seeded **off**).

When off: only in-app delivery runs (existing sims keep working).  
When on: `notification.dispatch` also writes `notification_deliveries` rows.

## Transport

| `EMAIL_TRANSPORT` | Behaviour |
| --- | --- |
| `outbox` (default) | Capture rendered email into `notification_deliveries` as `DELIVERED` |
| `console` | Same + `console.info` log |

Do **not** enable real external email in pilot without an explicit provider integration.

## Delivery states

`PENDING` → `SENDING` → `DELIVERED` | `FAILED_RETRYABLE` | `FAILED_FINAL` | `SUPPRESSED`

Dedupe key prevents duplicate email sends. Job retries cover `FAILED_RETRYABLE`.

## Templates

Org-scoped `notification_templates` (`channel = email`). Variables use `{{name}}` and are HTML-escaped. Declared variables are validated before send. Admin preview: `/admin/notification-templates`.

## Safety

- Requester content filtered for secrets/stack traces
- Internal comments are not included in email payloads
- Sensitive integration payloads stay out of templates (sanitised `summary` only)

## Ops notes

Workers read flags/templates with `service_role` — migration `017` grants those privileges.  
Simulator: `npm run simulate:email` (scenario `23-email-outbox-delivery.yaml`).
