-- Production-pilot reliability: versioning, correlation, idempotency, jobs

-- ---------------------------------------------------------------------------
-- Cases optimistic locking
-- ---------------------------------------------------------------------------
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- Correlation on audit + notifications
-- ---------------------------------------------------------------------------
ALTER TABLE public.case_audit_history
  ADD COLUMN IF NOT EXISTS correlation_id UUID;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS correlation_id UUID;

CREATE INDEX IF NOT EXISTS idx_case_audit_correlation
  ON public.case_audit_history (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_correlation
  ON public.notifications (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Idempotency keys (HTTP mutating APIs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  route TEXT NOT NULL,
  method TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  -- Nullable until the request completes (atomic claim: insert first, then fill).
  response_status INTEGER,
  response_body JSONB,
  case_id UUID REFERENCES public.cases (id) ON DELETE SET NULL,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  UNIQUE (organization_id, idempotency_key, route, method)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
  ON public.idempotency_keys (expires_at);

-- ---------------------------------------------------------------------------
-- Background jobs
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM (
    'pending',
    'running',
    'succeeded',
    'failed',
    'dead_letter',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.job_status NOT NULL DEFAULT 'pending',
  idempotency_key TEXT UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_claim
  ON public.background_jobs (status, run_at)
  WHERE status IN ('pending', 'failed', 'running');

CREATE INDEX IF NOT EXISTS idx_background_jobs_org
  ON public.background_jobs (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.background_job_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.background_jobs (id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status public.job_status NOT NULL,
  error TEXT,
  correlation_id UUID,
  UNIQUE (job_id, attempt_no)
);

CREATE OR REPLACE FUNCTION public.set_background_jobs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS background_jobs_set_updated_at ON public.background_jobs;
CREATE TRIGGER background_jobs_set_updated_at
  BEFORE UPDATE ON public.background_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_background_jobs_updated_at();

-- Safe concurrent claim: SKIP LOCKED; also reclaim stale running jobs.
CREATE OR REPLACE FUNCTION public.claim_background_jobs(
  p_limit INTEGER,
  p_worker_id TEXT,
  p_lock_timeout_seconds INTEGER DEFAULT 300
)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lock_timeout INTERVAL := make_interval(secs => GREATEST(COALESCE(p_lock_timeout_seconds, 300), 30));
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.background_jobs j
    WHERE (
        j.status IN ('pending', 'failed')
        OR (
          j.status = 'running'
          AND j.locked_at IS NOT NULL
          AND j.locked_at < NOW() - lock_timeout
        )
      )
      AND j.run_at <= NOW()
      AND j.attempt_count < j.max_attempts
    ORDER BY j.run_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 1)
  ),
  updated AS (
    UPDATE public.background_jobs j
    SET
      status = 'running',
      locked_at = NOW(),
      locked_by = p_worker_id,
      attempt_count = j.attempt_count + 1,
      last_error = CASE
        WHEN j.status = 'running' THEN COALESCE(j.last_error, 'Reclaimed after lock timeout')
        ELSE j.last_error
      END
    FROM candidates c
    WHERE j.id = c.id
    RETURNING j.*
  )
  SELECT * FROM updated;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.idempotency_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.background_jobs TO authenticated;
GRANT SELECT, INSERT ON public.background_job_attempts TO authenticated;
GRANT ALL ON public.idempotency_keys TO service_role;
GRANT ALL ON public.background_jobs TO service_role;
GRANT ALL ON public.background_job_attempts TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_background_jobs(INTEGER, TEXT, INTEGER) TO service_role;

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_job_attempts ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS; authenticated users may only read own-org metadata
CREATE POLICY "Users view org jobs"
  ON public.background_jobs FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Users view org idempotency"
  ON public.idempotency_keys FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Users view org job attempts"
  ON public.background_job_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.background_jobs j
      WHERE j.id = job_id
        AND j.organization_id = public.get_my_org_id()
    )
  );
