-- Fix cases SELECT policy so INSERT ... RETURNING works for requesters.
-- can_access_case(id) re-queries cases and fails visibility checks on RETURNING.

DROP POLICY IF EXISTS "Users view accessible cases" ON public.cases;

CREATE POLICY "Users view accessible cases"
  ON public.cases FOR SELECT
  USING (
    organization_id = public.get_my_org_id()
    AND (
      requester_id = auth.uid()
      OR (
        public.get_my_role() IN ('operations_agent', 'team_lead')
        AND (
          assigned_group_id IS NULL
          OR public.is_group_member(assigned_group_id)
        )
      )
      OR (
        public.get_my_role() = 'approver'
        AND (
          status = 'PENDING_APPROVAL'
          OR approver_id = auth.uid()
        )
      )
      OR assigned_agent_id = auth.uid()
    )
  );
