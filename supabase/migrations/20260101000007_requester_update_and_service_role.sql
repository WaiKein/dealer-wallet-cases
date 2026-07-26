-- Requesters may leave WAITING_FOR_REQUESTER → UNDER_REVIEW.
-- Postgres RLS WITH CHECK defaults to USING; the old USING only allowed
-- SUBMITTED/WAITING_FOR_REQUESTER on the *new* row, which blocked that transition.
DROP POLICY IF EXISTS "Authorized roles update cases" ON public.cases;

CREATE POLICY "Authorized roles update cases"
  ON public.cases FOR UPDATE
  USING (
    public.can_access_case(id)
    AND (
      public.get_my_role() IN ('operations_agent', 'team_lead', 'approver')
      OR (
        requester_id = auth.uid()
        AND status IN ('SUBMITTED', 'WAITING_FOR_REQUESTER')
      )
    )
  )
  WITH CHECK (
    public.can_access_case(id)
    AND (
      public.get_my_role() IN ('operations_agent', 'team_lead', 'approver')
      OR (
        requester_id = auth.uid()
        AND status IN ('SUBMITTED', 'WAITING_FOR_REQUESTER', 'UNDER_REVIEW')
      )
    )
  );

-- Test-control uses the service_role key; custom tables were only granted to authenticated.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
