-- Rollback notes for 20260101000016_email_notifications.sql
DROP TABLE IF EXISTS public.notification_deliveries;
DROP TYPE IF EXISTS public.notification_delivery_status;
-- Seeded templates are left in place (safe to keep).
