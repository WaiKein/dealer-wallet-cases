-- Follow-up security: revoke public job claim, case-scoped execution reads,
-- financial column lockdown, idempotency leases, job lock fencing support.

-- ---------------------------------------------------------------------------
-- P0: claim_background_jobs must not be executable by PUBLIC/anon/authenticated
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.claim_background_jobs(INTEGER, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_background_jobs(INTEGER, TEXT, INTEGER)
  TO service_role;

-- ---------------------------------------------------------------------------
-- P1: Case-level execution access + withhold raw financial identifiers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view org integration executions"
  ON public.case_integration_executions;
DROP POLICY IF EXISTS "Users view accessible case executions"
  ON public.case_integration_executions;

CREATE POLICY "Users view accessible case executions"
  ON public.case_integration_executions FOR SELECT
  USING (public.can_access_case(case_id));

DROP POLICY IF EXISTS "Users view org integration attempts"
  ON public.case_integration_attempts;
DROP POLICY IF EXISTS "Users view accessible case attempts"
  ON public.case_integration_attempts;

CREATE POLICY "Users view accessible case attempts"
  ON public.case_integration_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_integration_executions e
      WHERE e.id = execution_id
        AND public.can_access_case(e.case_id)
    )
  );

-- Authenticated may not read raw financial / hash columns via REST.
REVOKE SELECT ON TABLE public.case_integration_executions FROM authenticated;
GRANT SELECT (
  id,
  organization_id,
  case_id,
  approval_request_id,
  provider,
  operation,
  status,
  correlation_id,
  external_transaction_ref,
  requested_amount,
  approved_amount,
  currency,
  adjustment_type,
  attempt_count,
  last_attempt_at,
  next_retry_at,
  response_code,
  sanitised_response_summary,
  failure_category,
  failure_message,
  unknown_result_reason,
  requires_status_inquiry,
  version,
  created_at,
  updated_at,
  completed_at
) ON TABLE public.case_integration_executions TO authenticated;

CREATE OR REPLACE FUNCTION public.mask_financial_id_for_viewer(raw TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN public.get_my_role() IN ('requester', 'approver') THEN
      CASE
        WHEN length(raw) <= 4 THEN '****'
        ELSE repeat('*', GREATEST(length(raw) - 4, 0)) || right(raw, 4)
      END
    ELSE raw
  END;
$$;

-- Masked financial fields for authenticated callers.
-- View owner may read base columns; can_access_case / get_my_role use auth.uid().
CREATE OR REPLACE VIEW public.v_case_integration_executions_safe
WITH (security_barrier = true) AS
SELECT
  e.id,
  e.organization_id,
  e.case_id,
  e.approval_request_id,
  e.provider,
  e.operation,
  e.status,
  e.correlation_id,
  e.external_transaction_ref,
  e.requested_amount,
  e.approved_amount,
  e.currency,
  e.adjustment_type,
  e.attempt_count,
  e.last_attempt_at,
  e.next_retry_at,
  e.response_code,
  e.sanitised_response_summary,
  e.failure_category,
  e.failure_message,
  e.unknown_result_reason,
  e.requires_status_inquiry,
  e.version,
  e.created_at,
  e.updated_at,
  e.completed_at,
  public.mask_financial_id_for_viewer(e.account_id) AS account_id,
  public.mask_financial_id_for_viewer(e.reference_id) AS reference_id
FROM public.case_integration_executions e
WHERE public.can_access_case(e.case_id);

GRANT SELECT ON public.v_case_integration_executions_safe TO authenticated;
GRANT SELECT ON public.v_case_integration_executions_safe TO service_role;
GRANT EXECUTE ON FUNCTION public.mask_financial_id_for_viewer(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- P1: Idempotency lease column for stale pending takeover
-- ---------------------------------------------------------------------------
ALTER TABLE public.idempotency_keys
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_pending_lease
  ON public.idempotency_keys (claimed_at)
  WHERE response_status IS NULL;

-- Atomically take over a stale pending claim (same org/key/route/method/hash).
CREATE OR REPLACE FUNCTION public.takeover_stale_idempotency_claim(
  p_organization_id UUID,
  p_idempotency_key TEXT,
  p_route TEXT,
  p_method TEXT,
  p_request_hash TEXT,
  p_correlation_id UUID,
  p_lease_seconds INTEGER DEFAULT 60
)
RETURNS public.idempotency_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lease INTERVAL := make_interval(secs => GREATEST(COALESCE(p_lease_seconds, 60), 5));
  row public.idempotency_keys;
BEGIN
  UPDATE public.idempotency_keys k
  SET
    claimed_at = NOW(),
    correlation_id = p_correlation_id,
    request_hash = p_request_hash
  WHERE k.organization_id = p_organization_id
    AND k.idempotency_key = p_idempotency_key
    AND k.route = p_route
    AND k.method = p_method
    AND k.response_status IS NULL
    AND k.claimed_at < NOW() - lease
    AND k.request_hash = p_request_hash
  RETURNING k.* INTO row;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.takeover_stale_idempotency_claim(UUID, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.takeover_stale_idempotency_claim(UUID, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER)
  TO service_role;
