-- Phase 1: Administration console foundations
-- Config versioning metadata, configuration audit, feature flags,
-- notification templates, approval rules (CRUD; matching in Phase 2),
-- admin RLS write policies.
-- Depends on 20260101000009_admin_role.sql (enum value committed separately).

-- ---------------------------------------------------------------------------
-- Shared config metadata helper columns on existing tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

ALTER TABLE public.subcategories
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

ALTER TABLE public.assignment_groups
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

ALTER TABLE public.assignment_group_members
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

ALTER TABLE public.assignment_rules
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

ALTER TABLE public.sla_definitions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- ---------------------------------------------------------------------------
-- Configuration audit (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuration_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  configuration_type TEXT NOT NULL,
  configuration_id UUID NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  actor_id UUID NOT NULL REFERENCES public.profiles (id),
  change_reason TEXT,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_configuration_audit_org_type
  ON public.configuration_audit (organization_id, configuration_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_configuration_audit_record
  ON public.configuration_audit (configuration_type, configuration_id, created_at DESC);

ALTER TABLE public.configuration_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org configuration audit"
  ON public.configuration_audit FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Admins insert configuration audit"
  ON public.configuration_audit FOR INSERT
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

GRANT SELECT, INSERT ON public.configuration_audit TO authenticated;

-- ---------------------------------------------------------------------------
-- Feature flags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles (id),
  updated_by UUID REFERENCES public.profiles (id),
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_org_active
  ON public.feature_flags (organization_id, is_active, code);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org feature flags"
  ON public.feature_flags FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Admins manage feature flags"
  ON public.feature_flags FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT INSERT, UPDATE ON public.feature_flags TO authenticated;

-- ---------------------------------------------------------------------------
-- Notification templates (email/in-app content; delivery in later phase)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  event_type TEXT NOT NULL,
  subject_template TEXT,
  body_template TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles (id),
  updated_by UUID REFERENCES public.profiles (id),
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code, version)
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_org_event
  ON public.notification_templates (organization_id, event_type, is_active);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org notification templates"
  ON public.notification_templates FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Admins manage notification templates"
  ON public.notification_templates FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

GRANT SELECT ON public.notification_templates TO authenticated;
GRANT INSERT, UPDATE ON public.notification_templates TO authenticated;

-- ---------------------------------------------------------------------------
-- Approval rules (admin CRUD in Phase 1; matching engine in Phase 2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  case_type TEXT,
  category_id UUID REFERENCES public.categories (id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.subcategories (id) ON DELETE SET NULL,
  min_amount NUMERIC(14, 2),
  max_amount NUMERIC(14, 2),
  priority public.case_priority,
  requester_role public.user_role,
  requester_team_id UUID REFERENCES public.assignment_groups (id) ON DELETE SET NULL,
  assignment_group_id UUID REFERENCES public.assignment_groups (id) ON DELETE SET NULL,
  risk_level TEXT,
  required_approver_role public.user_role,
  required_approver_team_id UUID REFERENCES public.assignment_groups (id) ON DELETE SET NULL,
  approval_levels INTEGER NOT NULL DEFAULT 1 CHECK (approval_levels >= 1 AND approval_levels <= 10),
  sequential_required BOOLEAN NOT NULL DEFAULT TRUE,
  approver_limit NUMERIC(14, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles (id),
  updated_by UUID REFERENCES public.profiles (id),
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, sequence, version),
  UNIQUE (organization_id, code, version)
);

CREATE INDEX IF NOT EXISTS idx_approval_rules_org_seq
  ON public.approval_rules (organization_id, is_active, sequence);

ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org approval rules"
  ON public.approval_rules FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Admins manage approval rules"
  ON public.approval_rules FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

GRANT SELECT ON public.approval_rules TO authenticated;
GRANT INSERT, UPDATE ON public.approval_rules TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin write policies on existing config tables
-- ---------------------------------------------------------------------------
CREATE POLICY "Admins manage organizations"
  ON public.organizations FOR UPDATE
  USING (
    id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "Admins manage subcategories"
  ON public.subcategories FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "Admins manage assignment groups"
  ON public.assignment_groups FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "Admins manage assignment group members"
  ON public.assignment_group_members FOR ALL
  USING (
    public.get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.assignment_groups g
      WHERE g.id = assignment_group_members.group_id
        AND g.organization_id = public.get_my_org_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.assignment_groups g
      WHERE g.id = assignment_group_members.group_id
        AND g.organization_id = public.get_my_org_id()
    )
  );

CREATE POLICY "Admins manage assignment rules"
  ON public.assignment_rules FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "Admins manage sla definitions"
  ON public.sla_definitions FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "Admins view org profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "Admins update org profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.get_my_role() = 'admin'
    AND organization_id = public.get_my_org_id()
  )
  WITH CHECK (
    public.get_my_role() = 'admin'
    AND organization_id = public.get_my_org_id()
  );

GRANT INSERT, UPDATE ON public.categories TO authenticated;
GRANT INSERT, UPDATE ON public.subcategories TO authenticated;
GRANT INSERT, UPDATE ON public.assignment_groups TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.assignment_group_members TO authenticated;
GRANT INSERT, UPDATE ON public.assignment_rules TO authenticated;
GRANT INSERT, UPDATE ON public.sla_definitions TO authenticated;
GRANT UPDATE ON public.organizations TO authenticated;

-- ---------------------------------------------------------------------------
-- Updated-at triggers for new tables
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS feature_flags_set_updated_at ON public.feature_flags;
CREATE TRIGGER feature_flags_set_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS notification_templates_set_updated_at ON public.notification_templates;
CREATE TRIGGER notification_templates_set_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS approval_rules_set_updated_at ON public.approval_rules;
CREATE TRIGGER approval_rules_set_updated_at
  BEFORE UPDATE ON public.approval_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
