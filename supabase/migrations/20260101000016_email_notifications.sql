-- Phase 6: Email notification deliveries (outbox) + template seeds

DO $$ BEGIN
  CREATE TYPE public.notification_delivery_status AS ENUM (
    'PENDING',
    'SENDING',
    'DELIVERED',
    'FAILED_RETRYABLE',
    'FAILED_FINAL',
    'SUPPRESSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  event_type TEXT NOT NULL,
  notification_type TEXT,
  case_id UUID REFERENCES public.cases (id) ON DELETE SET NULL,
  recipient_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  template_id UUID REFERENCES public.notification_templates (id) ON DELETE SET NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status public.notification_delivery_status NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  dedupe_key TEXT NOT NULL,
  last_error TEXT,
  provider_ref TEXT,
  correlation_id UUID,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_org_status
  ON public.notification_deliveries (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient
  ON public.notification_deliveries (recipient_user_id, created_at DESC);

DROP TRIGGER IF EXISTS notification_deliveries_set_updated_at
  ON public.notification_deliveries;
CREATE TRIGGER notification_deliveries_set_updated_at
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notification deliveries"
  ON public.notification_deliveries FOR SELECT
  USING (
    organization_id = public.get_my_org_id()
    AND (
      recipient_user_id = auth.uid()
      OR public.get_my_role() = 'admin'
    )
  );

CREATE POLICY "Admins manage notification deliveries"
  ON public.notification_deliveries FOR ALL
  USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
  );

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;

-- Seed email templates for common events (org-scoped)
DO $$
DECLARE
  org_id UUID;
  admin_id UUID := '55555555-5555-5555-5555-555555555555';
BEGIN
  SELECT id INTO org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF org_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notification_templates (
    organization_id, code, name, channel, event_type, subject_template, body_template,
    variables, is_active, change_reason, created_by, updated_by
  ) VALUES
    (org_id, 'email_case_submitted', 'Case submitted', 'email', 'case_submitted',
     'Case {{case_number}} submitted',
     'Your case {{case_number}} ({{title}}) has been submitted.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_case_assigned', 'Case assigned', 'email', 'case_assigned',
     'Case {{case_number}} assigned',
     'Case {{case_number}} ({{title}}) has been assigned.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_info_requested', 'More information requested', 'email', 'information_requested',
     'More information needed for {{case_number}}',
     'Please provide more information for case {{case_number}} ({{title}}).',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_info_received', 'Requester information received', 'email', 'information_received',
     'Information received for {{case_number}}',
     'Additional information was received for case {{case_number}}.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_approval_requested', 'Approval requested', 'email', 'approval_requested',
     'Approval requested: {{case_number}}',
     'Case {{case_number}} ({{title}}) is awaiting approval.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_approval_approved', 'Approval approved', 'email', 'approval_approved',
     'Case {{case_number}} approved',
     'Case {{case_number}} has been approved.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_approval_rejected', 'Approval rejected', 'email', 'approval_rejected',
     'Case {{case_number}} rejected',
     'Case {{case_number}} has been rejected.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_approval_expired', 'Approval expired', 'email', 'approval_expired',
     'Approval expired for {{case_number}}',
     'The approval request for case {{case_number}} has expired.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_execution_succeeded', 'Execution succeeded', 'email', 'execution_succeeded',
     'Wallet execution succeeded for {{case_number}}',
     'Wallet adjustment for case {{case_number}} completed successfully.',
     '["case_number","title","summary"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_execution_failed', 'Execution failed', 'email', 'execution_failed',
     'Wallet execution failed for {{case_number}}',
     'Wallet adjustment for case {{case_number}} failed. {{summary}}',
     '["case_number","title","summary"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_execution_unknown', 'Execution unknown', 'email', 'execution_unknown',
     'Wallet execution needs attention: {{case_number}}',
     'Wallet adjustment for case {{case_number}} has an unknown result. Status inquiry is required.',
     '["case_number","title","summary"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_case_resolved', 'Case resolved', 'email', 'case_resolved',
     'Case {{case_number}} resolved',
     'Case {{case_number}} ({{title}}) has been resolved.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_case_reopened', 'Case reopened', 'email', 'case_reopened',
     'Case {{case_number}} reopened',
     'Case {{case_number}} ({{title}}) has been reopened.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_sla_due_soon', 'SLA due soon', 'email', 'sla_due_soon',
     'SLA due soon: {{case_number}}',
     'An SLA for case {{case_number}} is approaching its deadline.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id),
    (org_id, 'email_sla_breached', 'SLA breached', 'email', 'sla_breached',
     'SLA breached: {{case_number}}',
     'An SLA for case {{case_number}} has been breached.',
     '["case_number","title"]'::jsonb, TRUE, 'Phase 6 seed', admin_id, admin_id)
  ON CONFLICT (organization_id, code, version) DO NOTHING;
END $$;
