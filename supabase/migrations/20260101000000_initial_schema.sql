-- Case Management - Initial Schema

-- Enums
CREATE TYPE public.user_role AS ENUM (
  'requester',
  'operations_agent',
  'approver'
);

CREATE TYPE public.case_status AS ENUM (
  'SUBMITTED',
  'UNDER_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'RESOLVED'
);

CREATE TYPE public.adjustment_type AS ENUM ('credit', 'debit');

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'requester',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cases
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL DEFAULT '' UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  dealer_id TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  adjustment_amount NUMERIC(14, 2) NOT NULL CHECK (adjustment_amount > 0),
  adjustment_type public.adjustment_type NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.case_status NOT NULL DEFAULT 'SUBMITTED',
  requester_id UUID NOT NULL REFERENCES public.profiles (id),
  assigned_agent_id UUID REFERENCES public.profiles (id),
  approver_id UUID REFERENCES public.profiles (id),
  rejection_reason TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cases_status ON public.cases (status);
CREATE INDEX idx_cases_requester_id ON public.cases (requester_id);
CREATE INDEX idx_cases_created_at ON public.cases (created_at DESC);

-- Audit history for all status changes
CREATE TABLE public.case_audit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  from_status public.case_status,
  to_status public.case_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles (id),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_audit_history_case_id ON public.case_audit_history (case_id, created_at DESC);

-- Auto-update updated_at on cases
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER cases_set_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Case number sequence
CREATE SEQUENCE public.case_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
    NEW.case_number := 'DWC-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
      LPAD(NEXTVAL('public.case_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cases_generate_case_number
  BEFORE INSERT ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_case_number();

-- Create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always assign requester. Elevated roles are granted only by admins.
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'requester'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_audit_history ENABLE ROW LEVEL SECURITY;

-- Role helper avoids recursive RLS between profiles <-> cases policies.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
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
    OR public.get_my_role() IN ('operations_agent', 'approver')
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.requester_id = target_id
         OR c.assigned_agent_id = target_id
         OR c.approver_id = target_id
    );
$$;

-- Profiles policies
CREATE POLICY "Users can view profiles"
  ON public.profiles FOR SELECT
  USING (public.can_view_profile(id));

-- Cases policies
CREATE POLICY "Users view accessible cases"
  ON public.cases FOR SELECT
  USING (
    requester_id = auth.uid()
    OR public.get_my_role() IN ('operations_agent', 'approver')
  );

CREATE POLICY "Requesters create cases"
  ON public.cases FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()
    AND public.get_my_role() = 'requester'
  );

CREATE POLICY "Authorized roles update cases"
  ON public.cases FOR UPDATE
  USING (
    public.get_my_role() IN ('operations_agent', 'approver')
    OR (
      requester_id = auth.uid()
      AND status = 'SUBMITTED'
    )
  );

-- Audit history policies
CREATE POLICY "View audit history for accessible cases"
  ON public.case_audit_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_audit_history.case_id
        AND (
          c.requester_id = auth.uid()
          OR public.get_my_role() IN ('operations_agent', 'approver')
        )
    )
  );

CREATE POLICY "Insert audit history for accessible cases"
  ON public.case_audit_history FOR INSERT
  WITH CHECK (
    changed_by = auth.uid()
    AND public.get_my_role() IN ('requester', 'operations_agent', 'approver')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_audit_history.case_id
    )
  );

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cases TO authenticated;
GRANT SELECT, INSERT ON public.case_audit_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_profile(UUID) TO authenticated;
