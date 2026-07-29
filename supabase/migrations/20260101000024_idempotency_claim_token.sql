-- Fence idempotency claims with a per-owner token so stale takeovers
-- invalidate the previous owner's finalize/delete updates.

ALTER TABLE public.idempotency_keys
  ADD COLUMN IF NOT EXISTS claim_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION public.takeover_stale_idempotency_claim(
  p_organization_id UUID,
  p_idempotency_key TEXT,
  p_route TEXT,
  p_method TEXT,
  p_request_hash TEXT,
  p_correlation_id UUID,
  p_lease_seconds INTEGER DEFAULT 60,
  p_claim_token UUID DEFAULT NULL
)
RETURNS public.idempotency_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lease INTERVAL := make_interval(secs => GREATEST(COALESCE(p_lease_seconds, 60), 5));
  next_token UUID := COALESCE(p_claim_token, gen_random_uuid());
  row public.idempotency_keys;
BEGIN
  UPDATE public.idempotency_keys k
  SET
    claimed_at = NOW(),
    correlation_id = p_correlation_id,
    request_hash = p_request_hash,
    claim_token = next_token
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

-- Drop previous 7-arg overload if present; callers use the 8-arg form.
DROP FUNCTION IF EXISTS public.takeover_stale_idempotency_claim(UUID, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER);

REVOKE ALL ON FUNCTION public.takeover_stale_idempotency_claim(UUID, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.takeover_stale_idempotency_claim(UUID, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER, UUID)
  TO service_role;
