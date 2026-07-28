-- Rollback notes for 20260101000013_integration_execution.sql
-- Run only on non-production / with care: drops Phase 4 execution tables.

ALTER TABLE public.cases
  DROP COLUMN IF EXISTS current_integration_execution_id;

DROP TABLE IF EXISTS public.case_integration_attempts;
DROP TABLE IF EXISTS public.case_integration_executions;

DROP TYPE IF EXISTS public.integration_attempt_kind;
DROP TYPE IF EXISTS public.integration_execution_status;

-- notification_type value 'integration_execution' cannot be easily removed in Postgres.
