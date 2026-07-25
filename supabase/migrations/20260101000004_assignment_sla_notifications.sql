-- Assignment groups, categories, SLA tracking, notifications (multi-tenant ready)
-- Depends on 20260101000003_extend_enums.sql for team_lead / waiting statuses.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.case_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE public.lead_authorization_mode AS ENUM ('role', 'membership', 'both');

CREATE TYPE public.sla_type AS ENUM ('first_response', 'resolution');

CREATE TYPE public.sla_state AS ENUM (
  'RUNNING',
  'DUE_SOON',
  'BREACHED',
  'PAUSED',
  'COMPLETED'
);

CREATE TYPE public.audit_event_type AS ENUM (
  'status_change',
  'assignment',
  'reassignment',
  'claim',
  'acknowledge',
  'sla_due_soon',
  'sla_breach',
  'sla_completed',
  'sla_paused',
  'sla_resumed',
  'case_reopened'
);

CREATE TYPE public.notification_type AS ENUM (
  'case_assignment',
  'case_reassignment',
  'approval_request',
  'approval_decision',
  'sla_due_soon',
  'sla_breach',
  'case_resolution',
  'case_reopening'
);

-- ---------------------------------------------------------------------------
-- Organizations (single-tenant seed; scalable for multi-tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lead_authorization_mode public.lead_authorization_mode NOT NULL DEFAULT 'both',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN organization_id UUID REFERENCES public.organizations (id);

CREATE INDEX idx_profiles_organization_id ON public.profiles (organization_id);

-- ---------------------------------------------------------------------------
-- Categories → subcategories
-- ---------------------------------------------------------------------------
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code),
  UNIQUE (category_id, code)
);

CREATE INDEX idx_subcategories_category_id ON public.subcategories (category_id);

-- ---------------------------------------------------------------------------
-- Assignment groups module
-- ---------------------------------------------------------------------------
CREATE TABLE public.assignment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE public.assignment_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.assignment_groups (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX idx_assignment_group_members_user_id
  ON public.assignment_group_members (user_id);

-- ---------------------------------------------------------------------------
-- Assignment rules (category → subcategory → group; optional priority)
-- ---------------------------------------------------------------------------
CREATE TABLE public.assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  category_id UUID REFERENCES public.categories (id) ON DELETE CASCADE,
  subcategory_id UUID REFERENCES public.subcategories (id) ON DELETE CASCADE,
  priority public.case_priority,
  assignment_group_id UUID NOT NULL REFERENCES public.assignment_groups (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, sequence)
);

CREATE INDEX idx_assignment_rules_org_active_seq
  ON public.assignment_rules (organization_id, is_active, sequence);

-- ---------------------------------------------------------------------------
-- SLA definitions + per-case SLA tracking
-- ---------------------------------------------------------------------------
CREATE TABLE public.sla_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  priority public.case_priority NOT NULL,
  sla_type public.sla_type NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, priority, sla_type)
);

CREATE TABLE public.case_sla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  sla_type public.sla_type NOT NULL,
  state public.sla_state NOT NULL DEFAULT 'RUNNING',
  due_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  paused_elapsed_seconds INTEGER NOT NULL DEFAULT 0 CHECK (paused_elapsed_seconds >= 0),
  breached_at TIMESTAMPTZ,
  due_soon_notified_at TIMESTAMPTZ,
  breach_notified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, sla_type)
);

CREATE INDEX idx_case_sla_state ON public.case_sla (state);
CREATE INDEX idx_case_sla_due_at ON public.case_sla (due_at);

CREATE TRIGGER case_sla_set_updated_at
  BEFORE UPDATE ON public.case_sla
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Cases: taxonomy, group, acknowledge, org
-- ---------------------------------------------------------------------------
ALTER TABLE public.cases
  ADD COLUMN organization_id UUID REFERENCES public.organizations (id),
  ADD COLUMN category_id UUID REFERENCES public.categories (id),
  ADD COLUMN subcategory_id UUID REFERENCES public.subcategories (id),
  ADD COLUMN priority public.case_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN assigned_group_id UUID REFERENCES public.assignment_groups (id),
  ADD COLUMN acknowledged_at TIMESTAMPTZ,
  ADD COLUMN first_responded_at TIMESTAMPTZ;

CREATE INDEX idx_cases_organization_id ON public.cases (organization_id);
CREATE INDEX idx_cases_assigned_group_id ON public.cases (assigned_group_id);
CREATE INDEX idx_cases_priority ON public.cases (priority);

-- ---------------------------------------------------------------------------
-- Audit history: non-status events
-- ---------------------------------------------------------------------------
ALTER TABLE public.case_audit_history
  ALTER COLUMN to_status DROP NOT NULL;

ALTER TABLE public.case_audit_history
  ADD COLUMN event_type public.audit_event_type NOT NULL DEFAULT 'status_change',
  ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX idx_case_audit_history_event_type
  ON public.case_audit_history (case_id, event_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases (id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dedupe_key)
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_user_id
  ON public.notifications (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(target_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignment_group_members m
    WHERE m.group_id = target_group_id
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_lead(target_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignment_groups g
    JOIN public.organizations o ON o.id = g.organization_id
    LEFT JOIN public.assignment_group_members m
      ON m.group_id = g.id AND m.user_id = auth.uid()
    WHERE g.id = target_group_id
      AND (
        (
          o.lead_authorization_mode IN ('role', 'both')
          AND public.get_my_role() = 'team_lead'
          AND m.user_id IS NOT NULL
        )
        OR (
          o.lead_authorization_mode IN ('membership', 'both')
          AND COALESCE(m.is_lead, FALSE)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_case(target_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cases c
    WHERE c.id = target_case_id
      AND c.organization_id = public.get_my_org_id()
      AND (
        c.requester_id = auth.uid()
        OR (
          public.get_my_role() IN ('operations_agent', 'team_lead')
          AND (
            c.assigned_group_id IS NULL
            OR public.is_group_member(c.assigned_group_id)
          )
        )
        OR (
          public.get_my_role() = 'approver'
          AND (
            c.status = 'PENDING_APPROVAL'
            OR c.approver_id = auth.uid()
          )
        )
        OR c.assigned_agent_id = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(target_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    target_id = auth.uid()
    OR (
      public.get_my_org_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = target_id
          AND p.organization_id = public.get_my_org_id()
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- RLS enable
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_sla ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop and recreate case policies for tighter access
DROP POLICY IF EXISTS "Users view accessible cases" ON public.cases;
DROP POLICY IF EXISTS "Requesters create cases" ON public.cases;
DROP POLICY IF EXISTS "Authorized roles update cases" ON public.cases;
DROP POLICY IF EXISTS "View audit history for accessible cases" ON public.case_audit_history;
DROP POLICY IF EXISTS "Insert audit history for accessible cases" ON public.case_audit_history;

CREATE POLICY "Users view own organization"
  ON public.organizations FOR SELECT
  USING (id = public.get_my_org_id());

CREATE POLICY "Users view org categories"
  ON public.categories FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Users view org subcategories"
  ON public.subcategories FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Users view org assignment groups"
  ON public.assignment_groups FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Users view group members in org"
  ON public.assignment_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignment_groups g
      WHERE g.id = assignment_group_members.group_id
        AND g.organization_id = public.get_my_org_id()
    )
  );

CREATE POLICY "Users view org assignment rules"
  ON public.assignment_rules FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Users view org sla definitions"
  ON public.sla_definitions FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Users view case sla for accessible cases"
  ON public.case_sla FOR SELECT
  USING (public.can_access_case(case_id));

CREATE POLICY "Agents manage case sla for accessible cases"
  ON public.case_sla FOR INSERT
  WITH CHECK (
    public.can_access_case(case_id)
    AND public.get_my_role() IN ('requester', 'operations_agent', 'team_lead', 'approver')
  );

CREATE POLICY "Agents update case sla for accessible cases"
  ON public.case_sla FOR UPDATE
  USING (
    public.can_access_case(case_id)
    AND public.get_my_role() IN ('requester', 'operations_agent', 'team_lead', 'approver')
  );

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated insert notifications in org"
  ON public.notifications FOR INSERT
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('requester', 'operations_agent', 'team_lead', 'approver')
  );

CREATE POLICY "Users view accessible cases"
  ON public.cases FOR SELECT
  USING (public.can_access_case(id));

CREATE POLICY "Requesters create cases"
  ON public.cases FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()
    AND public.get_my_role() = 'requester'
    AND organization_id = public.get_my_org_id()
  );

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
  );

CREATE POLICY "View audit history for accessible cases"
  ON public.case_audit_history FOR SELECT
  USING (public.can_access_case(case_id));

CREATE POLICY "Insert audit history for accessible cases"
  ON public.case_audit_history FOR INSERT
  WITH CHECK (
    changed_by = auth.uid()
    AND public.get_my_role() IN ('requester', 'operations_agent', 'team_lead', 'approver')
    AND public.can_access_case(case_id)
  );

GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.categories TO authenticated;
GRANT SELECT ON public.subcategories TO authenticated;
GRANT SELECT ON public.assignment_groups TO authenticated;
GRANT SELECT ON public.assignment_group_members TO authenticated;
GRANT SELECT ON public.assignment_rules TO authenticated;
GRANT SELECT ON public.sla_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.case_sla TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_lead(UUID) TO authenticated;

-- Assign new signups to the first organization (single-tenant POC; multi-tenant later)
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
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'requester'),
    default_org
  );
  RETURN NEW;
END;
$$;
