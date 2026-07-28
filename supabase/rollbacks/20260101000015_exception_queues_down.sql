-- Rollback notes for 20260101000015_exception_queues.sql

DROP TABLE IF EXISTS public.operational_exceptions;
DROP TYPE IF EXISTS public.exception_item_status;
DROP TYPE IF EXISTS public.exception_queue_type;
-- audit_event_type value 'exception_action' cannot be easily removed in Postgres.
