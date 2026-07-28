-- Seed admin user + default feature flags / templates for Phase 1
-- Depends on 20260101000009 (admin role) and existing org seed.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  org_id UUID;
  admin_id UUID := '55555555-5555-5555-5555-555555555555';
  encrypted_pw TEXT := crypt('Password123!', gen_salt('bf'));
BEGIN
  SELECT id INTO org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF org_id IS NULL THEN
    RAISE NOTICE 'No organization found; skip admin seed';
    RETURN;
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    reauthentication_token
  ) VALUES (
    admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin@example.com', encrypted_pw, NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin User","role":"admin"}'::jsonb,
    NOW(), NOW(),
    '', '', '', '', '', ''
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    admin_id, admin_id,
    jsonb_build_object('sub', admin_id::text, 'email', 'admin@example.com'),
    'email', admin_id::text, NOW(), NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, full_name, role, organization_id, is_active)
  VALUES (admin_id, 'admin@example.com', 'Admin User', 'admin', org_id, TRUE)
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    is_active = TRUE;

  INSERT INTO public.feature_flags (
    organization_id, code, name, description, is_enabled, is_active, change_reason, created_by, updated_by
  ) VALUES
    (
      org_id, 'require_execution_before_resolve',
      'Require wallet execution before resolve',
      'When enabled, cases cannot move to RESOLVED until integration execution SUCCEEDED.',
      FALSE, TRUE, 'Phase 1 seed', admin_id, admin_id
    ),
    (
      org_id, 'email_notifications_enabled',
      'Email notifications',
      'When enabled, email channel may enqueue deliveries (Phase 6).',
      FALSE, TRUE, 'Phase 1 seed', admin_id, admin_id
    )
  ON CONFLICT (organization_id, code) DO NOTHING;

  INSERT INTO public.notification_templates (
    organization_id, code, name, channel, event_type, subject_template, body_template,
    variables, is_active, change_reason, created_by, updated_by
  ) VALUES (
    org_id,
    'case_submitted_email_v1',
    'Case submitted (email)',
    'email',
    'case_submitted',
    'Case {{case_number}} submitted',
    'Your case {{case_number}} ({{title}}) has been submitted.',
    '["case_number","title"]'::jsonb,
    TRUE,
    'Phase 1 seed',
    admin_id,
    admin_id
  )
  ON CONFLICT (organization_id, code, version) DO NOTHING;

  INSERT INTO public.approval_rules (
    organization_id, code, name, sequence, min_amount, max_amount,
    required_approver_role, approval_levels, sequential_required,
    is_active, change_reason, created_by, updated_by
  ) VALUES (
    org_id,
    'default_single_approver',
    'Default single-level approval',
    100,
    NULL,
    NULL,
    'approver',
    1,
    TRUE,
    TRUE,
    'Phase 1 seed — matching engine Phase 2',
    admin_id,
    admin_id
  )
  ON CONFLICT (organization_id, code, version) DO NOTHING;
END $$;
