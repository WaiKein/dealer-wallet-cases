-- Phase 7: Saved case views (personal / team / org / system)

DO $$ BEGIN
  CREATE TYPE public.saved_view_sharing_scope AS ENUM (
    'personal',
    'team',
    'organization',
    'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.saved_case_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.assignment_groups (id) ON DELETE SET NULL,
  sharing_scope public.saved_view_sharing_scope NOT NULL DEFAULT 'personal',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  sorting JSONB NOT NULL DEFAULT '{"field":"updated_at","direction":"desc"}'::jsonb,
  visible_columns JSONB NOT NULL DEFAULT '["case_number","title","group","agent","status","amount"]'::jsonb,
  column_order JSONB NOT NULL DEFAULT '["case_number","title","group","agent","fr_sla","res_sla","age","status","amount"]'::jsonb,
  page_size INTEGER NOT NULL DEFAULT 25 CHECK (page_size BETWEEN 5 AND 200),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saved_case_views_team_scope_chk CHECK (
    (sharing_scope <> 'team' AND team_id IS NULL)
    OR (sharing_scope = 'team' AND team_id IS NOT NULL)
  ),
  CONSTRAINT saved_case_views_system_chk CHECK (
    (is_system = FALSE)
    OR (sharing_scope = 'system' AND code IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_case_views_org_code
  ON public.saved_case_views (organization_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_case_views_org_scope
  ON public.saved_case_views (organization_id, sharing_scope, is_active);

CREATE INDEX IF NOT EXISTS idx_saved_case_views_owner
  ON public.saved_case_views (owner_id, is_active)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_case_views_team
  ON public.saved_case_views (team_id, is_active)
  WHERE team_id IS NOT NULL;

DROP TRIGGER IF EXISTS saved_case_views_set_updated_at ON public.saved_case_views;
CREATE TRIGGER saved_case_views_set_updated_at
  BEFORE UPDATE ON public.saved_case_views
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.saved_case_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view accessible saved case views"
  ON public.saved_case_views FOR SELECT
  USING (
    organization_id = public.get_my_org_id()
    AND is_active = TRUE
    AND (
      sharing_scope IN ('organization', 'system')
      OR (sharing_scope = 'personal' AND owner_id = auth.uid())
      OR (
        sharing_scope = 'team'
        AND team_id IN (
          SELECT group_id FROM public.assignment_group_members
          WHERE user_id = auth.uid()
        )
      )
      OR public.get_my_role() = 'admin'
    )
  );

CREATE POLICY "Users insert own personal or team views"
  ON public.saved_case_views FOR INSERT
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND is_system = FALSE
    AND sharing_scope IN ('personal', 'team', 'organization')
    AND (
      (sharing_scope = 'personal' AND owner_id = auth.uid())
      OR (
        sharing_scope = 'team'
        AND owner_id = auth.uid()
        AND team_id IN (
          SELECT group_id FROM public.assignment_group_members
          WHERE user_id = auth.uid()
        )
      )
      OR (
        sharing_scope = 'organization'
        AND owner_id = auth.uid()
        AND public.get_my_role() IN ('admin', 'team_lead')
      )
    )
  );

CREATE POLICY "Owners and admins update saved case views"
  ON public.saved_case_views FOR UPDATE
  USING (
    organization_id = public.get_my_org_id()
    AND (
      owner_id = auth.uid()
      OR public.get_my_role() = 'admin'
    )
    AND (is_system = FALSE OR public.get_my_role() = 'admin')
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND (
      owner_id = auth.uid()
      OR public.get_my_role() = 'admin'
    )
  );

CREATE POLICY "Owners and admins delete saved case views"
  ON public.saved_case_views FOR DELETE
  USING (
    organization_id = public.get_my_org_id()
    AND is_system = FALSE
    AND (owner_id = auth.uid() OR public.get_my_role() = 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_case_views TO authenticated;
GRANT ALL ON public.saved_case_views TO service_role;

-- Seed standard system views for the default organization
INSERT INTO public.saved_case_views (
  id, organization_id, code, name, description, sharing_scope,
  filters, sorting, is_system, is_default, owner_id
) VALUES
  (
    'a7000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'my_open',
    'My open cases',
    'Cases assigned to me that are not resolved or rejected',
    'system',
    '{"assignedToMe":true,"openOnly":true}'::jsonb,
    '{"field":"updated_at","direction":"desc"}'::jsonb,
    TRUE, FALSE, NULL
  ),
  (
    'a7000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'unassigned_team',
    'Unassigned team cases',
    'Open cases in my teams with no assigned agent',
    'system',
    '{"unassignedInMyTeams":true}'::jsonb,
    '{"field":"created_at","direction":"asc"}'::jsonb,
    TRUE, FALSE, NULL
  ),
  (
    'a7000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'high_priority',
    'High-priority cases',
    'Open high and critical priority cases',
    'system',
    '{"priorities":["high","critical"],"openOnly":true}'::jsonb,
    '{"field":"priority","direction":"desc"}'::jsonb,
    TRUE, FALSE, NULL
  ),
  (
    'a7000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'waiting_requester',
    'Waiting for requester',
    'Cases waiting on requester information',
    'system',
    '{"statuses":["WAITING_FOR_REQUESTER"]}'::jsonb,
    '{"field":"updated_at","direction":"desc"}'::jsonb,
    TRUE, FALSE, NULL
  ),
  (
    'a7000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'due_soon',
    'Due soon',
    'Cases with SLA state DUE_SOON',
    'system',
    '{"slaStatuses":["DUE_SOON"],"openOnly":true}'::jsonb,
    '{"field":"updated_at","direction":"asc"}'::jsonb,
    TRUE, FALSE, NULL
  ),
  (
    'a7000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'breached',
    'Breached',
    'Cases with SLA state BREACHED',
    'system',
    '{"slaStatuses":["BREACHED"],"openOnly":true}'::jsonb,
    '{"field":"updated_at","direction":"asc"}'::jsonb,
    TRUE, FALSE, NULL
  ),
  (
    'a7000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'pending_my_approval',
    'Pending my approval',
    'Cases awaiting approval',
    'system',
    '{"pendingMyApproval":true}'::jsonb,
    '{"field":"updated_at","direction":"asc"}'::jsonb,
    TRUE, FALSE, NULL
  ),
  (
    'a7000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    'failed_integration',
    'Failed integration',
    'Cases whose current wallet execution failed permanently',
    'system',
    '{"executionStatuses":["FAILED_FINAL"]}'::jsonb,
    '{"field":"updated_at","direction":"desc"}'::jsonb,
    TRUE, FALSE, NULL
  ),
  (
    'a7000000-0000-0000-0000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    'unknown_integration',
    'Unknown integration result',
    'Cases whose current wallet execution result is unknown',
    'system',
    '{"executionStatuses":["UNKNOWN"]}'::jsonb,
    '{"field":"updated_at","direction":"desc"}'::jsonb,
    TRUE, FALSE, NULL
  ),
  (
    'a7000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'recently_updated',
    'Recently updated',
    'Cases updated in the last 48 hours',
    'system',
    '{"updatedWithinHours":48}'::jsonb,
    '{"field":"updated_at","direction":"desc"}'::jsonb,
    TRUE, TRUE, NULL
  )
ON CONFLICT DO NOTHING;
