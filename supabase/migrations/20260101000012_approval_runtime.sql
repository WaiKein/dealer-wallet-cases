-- Phase 2: Approval matrix runtime — requests, steps, delegations

DO $$ BEGIN
  CREATE TYPE public.approval_request_status AS ENUM (
    'NOT_REQUIRED',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_step_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'SKIPPED',
    'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  approval_rule_id UUID REFERENCES public.approval_rules (id) ON DELETE SET NULL,
  approval_rule_version INTEGER,
  approval_rule_code TEXT,
  status public.approval_request_status NOT NULL DEFAULT 'PENDING',
  requested_amount NUMERIC(14, 2) NOT NULL,
  approved_amount NUMERIC(14, 2),
  approval_levels INTEGER NOT NULL DEFAULT 1,
  sequential_required BOOLEAN NOT NULL DEFAULT TRUE,
  required_approver_role public.user_role,
  required_approver_team_id UUID REFERENCES public.assignment_groups (id) ON DELETE SET NULL,
  approver_limit NUMERIC(14, 2),
  requested_by UUID NOT NULL REFERENCES public.profiles (id),
  decided_by UUID REFERENCES public.profiles (id),
  rejection_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_case
  ON public.approval_requests (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_org_status
  ON public.approval_requests (organization_id, status);

CREATE TABLE IF NOT EXISTS public.approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  approval_request_id UUID NOT NULL REFERENCES public.approval_requests (id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  level_no INTEGER NOT NULL CHECK (level_no >= 1),
  status public.approval_step_status NOT NULL DEFAULT 'PENDING',
  required_role public.user_role,
  required_team_id UUID REFERENCES public.assignment_groups (id) ON DELETE SET NULL,
  decided_by UUID REFERENCES public.profiles (id),
  decided_as_delegate_of UUID REFERENCES public.profiles (id),
  decision_comment TEXT,
  rejection_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  UNIQUE (approval_request_id, level_no)
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_request
  ON public.approval_steps (approval_request_id, level_no);

CREATE TABLE IF NOT EXISTS public.approval_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  delegator_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  delegate_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  approval_limit NUMERIC(14, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles (id),
  updated_by UUID REFERENCES public.profiles (id),
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (delegator_id <> delegate_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_delegations_org_active
  ON public.approval_delegations (organization_id, is_active, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_approval_delegations_delegate
  ON public.approval_delegations (delegate_id, is_active);

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS approval_rule_id UUID REFERENCES public.approval_rules (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_rule_version INTEGER,
  ADD COLUMN IF NOT EXISTS current_approval_request_id UUID REFERENCES public.approval_requests (id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS approval_requests_set_updated_at ON public.approval_requests;
CREATE TRIGGER approval_requests_set_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS approval_steps_set_updated_at ON public.approval_steps;
CREATE TRIGGER approval_steps_set_updated_at
  BEFORE UPDATE ON public.approval_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS approval_delegations_set_updated_at ON public.approval_delegations;
CREATE TRIGGER approval_delegations_set_updated_at
  BEFORE UPDATE ON public.approval_delegations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_delegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org approval requests"
  ON public.approval_requests FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Authorized roles manage approval requests"
  ON public.approval_requests FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('operations_agent', 'team_lead', 'approver', 'admin')
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('operations_agent', 'team_lead', 'approver', 'admin')
  );

CREATE POLICY "Users view org approval steps"
  ON public.approval_steps FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "Authorized roles manage approval steps"
  ON public.approval_steps FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('operations_agent', 'team_lead', 'approver', 'admin')
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('operations_agent', 'team_lead', 'approver', 'admin')
  );

CREATE POLICY "Users view org approval delegations"
  ON public.approval_delegations FOR SELECT
  USING (
    organization_id = public.get_my_org_id()
    AND (
      public.get_my_role() IN ('admin', 'approver', 'team_lead')
      OR delegator_id = auth.uid()
      OR delegate_id = auth.uid()
    )
  );

CREATE POLICY "Approvers manage own delegations"
  ON public.approval_delegations FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND (
      public.get_my_role() = 'admin'
      OR (public.get_my_role() = 'approver' AND delegator_id = auth.uid())
    )
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND (
      public.get_my_role() = 'admin'
      OR (public.get_my_role() = 'approver' AND delegator_id = auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.approval_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.approval_delegations TO authenticated;
