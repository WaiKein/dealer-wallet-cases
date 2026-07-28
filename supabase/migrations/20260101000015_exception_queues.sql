-- Phase 5: Operational exception queues

DO $$ BEGIN
  CREATE TYPE public.exception_queue_type AS ENUM (
    'integration_failed_final',
    'integration_retry_pending',
    'integration_unknown',
    'approval_expired',
    'approval_rejected',
    'sla_breached',
    'unassigned_case',
    'duplicate_transaction_suspected',
    'manual_reconciliation_required',
    'dead_letter_job'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.exception_item_status AS ENUM (
    'OPEN',
    'ASSIGNED',
    'IN_PROGRESS',
    'ESCALATED',
    'RESOLVED',
    'DISMISSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'exception_action';

CREATE TABLE IF NOT EXISTS public.operational_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  queue_type public.exception_queue_type NOT NULL,
  status public.exception_item_status NOT NULL DEFAULT 'OPEN',
  case_id UUID REFERENCES public.cases (id) ON DELETE CASCADE,
  execution_id UUID REFERENCES public.case_integration_executions (id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.background_jobs (id) ON DELETE SET NULL,
  source_ref TEXT NOT NULL,
  title TEXT,
  failure_category TEXT,
  assigned_owner_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  reconciliation_required BOOLEAN NOT NULL DEFAULT FALSE,
  last_internal_note TEXT,
  resolution_note TEXT,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, source_ref)
);

CREATE INDEX IF NOT EXISTS idx_operational_exceptions_org_queue_status
  ON public.operational_exceptions (organization_id, queue_type, status);

CREATE INDEX IF NOT EXISTS idx_operational_exceptions_case
  ON public.operational_exceptions (case_id, created_at DESC)
  WHERE case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_exceptions_owner
  ON public.operational_exceptions (assigned_owner_id, status)
  WHERE assigned_owner_id IS NOT NULL;

DROP TRIGGER IF EXISTS operational_exceptions_set_updated_at
  ON public.operational_exceptions;
CREATE TRIGGER operational_exceptions_set_updated_at
  BEFORE UPDATE ON public.operational_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.operational_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org operational exceptions"
  ON public.operational_exceptions FOR SELECT
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN (
      'operations_agent', 'team_lead', 'admin', 'approver'
    )
  );

CREATE POLICY "Agents manage org operational exceptions"
  ON public.operational_exceptions FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('operations_agent', 'team_lead', 'admin')
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('operations_agent', 'team_lead', 'admin')
  );

GRANT SELECT, INSERT, UPDATE ON public.operational_exceptions TO authenticated;
GRANT ALL ON public.operational_exceptions TO service_role;
