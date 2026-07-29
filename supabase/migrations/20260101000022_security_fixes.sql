-- Security fixes: signup role trust, execution write surface, stale job reclaim,
-- and idempotency claim schema.

-- ---------------------------------------------------------------------------
-- P0: Never trust client-supplied role on signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org UUID;
BEGIN
  SELECT id INTO default_org
  FROM public.organizations
  ORDER BY created_at
  LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'requester',
    default_org
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- P0: Execution tables — authenticated users may SELECT only.
-- Writes go through service_role (app workers / validated domain services).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Agents manage org integration executions"
  ON public.case_integration_executions;
DROP POLICY IF EXISTS "Agents manage org integration attempts"
  ON public.case_integration_attempts;

REVOKE INSERT, UPDATE, DELETE ON public.case_integration_executions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.case_integration_attempts FROM authenticated;
-- SELECT privileges / case-scoped policies are owned by migration 013 + 023.
GRANT SELECT ON public.case_integration_attempts TO authenticated;

-- ---------------------------------------------------------------------------
-- P1: Idempotency — allow pending claim rows (response filled after handler)
-- ---------------------------------------------------------------------------
ALTER TABLE public.idempotency_keys
  ALTER COLUMN response_status DROP NOT NULL,
  ALTER COLUMN response_body DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- P1: Reclaim abandoned running jobs after lock timeout
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_background_jobs(INTEGER, TEXT);

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

GRANT EXECUTE ON FUNCTION public.claim_background_jobs(INTEGER, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.claim_background_jobs(INTEGER, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_background_jobs(INTEGER, TEXT, INTEGER)
  TO service_role;

DROP INDEX IF EXISTS idx_background_jobs_claim;
CREATE INDEX IF NOT EXISTS idx_background_jobs_claim
  ON public.background_jobs (status, run_at)
  WHERE status IN ('pending', 'failed', 'running');
