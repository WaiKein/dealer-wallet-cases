-- Phase 4: Integration execution tracking (wallet adjustment)

DO $$ BEGIN
  CREATE TYPE public.integration_execution_status AS ENUM (
    'NOT_STARTED',
    'QUEUED',
    'IN_PROGRESS',
    'SUCCEEDED',
    'FAILED_RETRYABLE',
    'FAILED_FINAL',
    'UNKNOWN',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_attempt_kind AS ENUM (
    'execute',
    'status_inquiry'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'integration_execution';

CREATE TABLE IF NOT EXISTS public.case_integration_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  approval_request_id UUID NOT NULL REFERENCES public.approval_requests (id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'mock_wallet',
  operation TEXT NOT NULL DEFAULT 'wallet_adjustment',
  status public.integration_execution_status NOT NULL DEFAULT 'NOT_STARTED',
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  correlation_id UUID,
  internal_request_ref TEXT,
  external_transaction_ref TEXT,
  requested_amount NUMERIC(14, 2) NOT NULL,
  approved_amount NUMERIC(14, 2) NOT NULL,
  account_id TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('credit', 'debit')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  response_code TEXT,
  sanitised_response_summary TEXT,
  failure_category TEXT,
  failure_message TEXT,
  unknown_result_reason TEXT,
  requires_status_inquiry BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (idempotency_key),
  UNIQUE (case_id, approval_request_id)
);

CREATE INDEX IF NOT EXISTS idx_case_integration_executions_org_status
  ON public.case_integration_executions (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_case_integration_executions_case
  ON public.case_integration_executions (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_integration_executions_retry
  ON public.case_integration_executions (status, next_retry_at)
  WHERE status IN ('FAILED_RETRYABLE', 'UNKNOWN', 'QUEUED');

CREATE TABLE IF NOT EXISTS public.case_integration_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES public.case_integration_executions (id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL CHECK (attempt_no >= 1),
  kind public.integration_attempt_kind NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  outcome TEXT,
  processing_certainty TEXT,
  response_code TEXT,
  sanitised_error TEXT,
  correlation_id UUID,
  worker_job_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (execution_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_case_integration_attempts_execution
  ON public.case_integration_attempts (execution_id, attempt_no);

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS current_integration_execution_id UUID
    REFERENCES public.case_integration_executions (id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS case_integration_executions_set_updated_at
  ON public.case_integration_executions;
CREATE TRIGGER case_integration_executions_set_updated_at
  BEFORE UPDATE ON public.case_integration_executions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_integration_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_integration_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org integration executions"
  ON public.case_integration_executions FOR SELECT
  USING (organization_id = public.get_my_org_id());

-- Writes are restricted to service_role (workers / domain services).
-- Authenticated clients may only read org-scoped execution history.

CREATE POLICY "Users view org integration attempts"
  ON public.case_integration_attempts FOR SELECT
  USING (organization_id = public.get_my_org_id());

GRANT SELECT ON public.case_integration_executions TO authenticated;
GRANT SELECT ON public.case_integration_attempts TO authenticated;
GRANT ALL ON public.case_integration_executions TO service_role;
GRANT ALL ON public.case_integration_attempts TO service_role;
