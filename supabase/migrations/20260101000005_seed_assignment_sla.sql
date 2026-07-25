-- Seed org taxonomy, assignment groups, rules, SLA defs, team lead, backfill cases

DO $$
DECLARE
  org_id UUID := '00000000-0000-0000-0000-000000000001';
  requester_id UUID := '11111111-1111-1111-1111-111111111111';
  agent_id UUID := '22222222-2222-2222-2222-222222222222';
  approver_id UUID := '33333333-3333-3333-3333-333333333333';
  lead_id UUID := '44444444-4444-4444-4444-444444444444';
  cat_wallet UUID := 'c1000000-0000-0000-0000-000000000001';
  cat_settlement UUID := 'c1000000-0000-0000-0000-000000000002';
  sub_dup UUID := 'c2000000-0000-0000-0000-000000000001';
  sub_promo UUID := 'c2000000-0000-0000-0000-000000000002';
  sub_chargeback UUID := 'c2000000-0000-0000-0000-000000000003';
  sub_fee UUID := 'c2000000-0000-0000-0000-000000000004';
  sub_other UUID := 'c2000000-0000-0000-0000-000000000005';
  group_wallet UUID := 'a1000000-0000-0000-0000-000000000001';
  group_chargeback UUID := 'a1000000-0000-0000-0000-000000000002';
  case1_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  case2_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  case3_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  case4_id UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  case5_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  encrypted_pw TEXT := crypt('Password123!', gen_salt('bf'));
BEGIN
  INSERT INTO public.organizations (id, name, lead_authorization_mode)
  VALUES (org_id, 'Default Organization', 'both')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    lead_authorization_mode = EXCLUDED.lead_authorization_mode;

  -- Team lead user
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    reauthentication_token
  ) VALUES (
    lead_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'teamlead@example.com', encrypted_pw, NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Taylor Team Lead","role":"team_lead"}'::jsonb,
    NOW(), NOW(),
    '', '', '', '', '', ''
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    lead_id, lead_id,
    jsonb_build_object('sub', lead_id::text, 'email', 'teamlead@example.com'),
    'email', lead_id::text, NOW(), NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, full_name, role, organization_id)
  VALUES
    (requester_id, 'requester@example.com', 'Alex Requester', 'requester', org_id),
    (agent_id, 'agent@example.com', 'Sam Operations', 'operations_agent', org_id),
    (approver_id, 'approver@example.com', 'Jordan Approver', 'approver', org_id),
    (lead_id, 'teamlead@example.com', 'Taylor Team Lead', 'team_lead', org_id)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    organization_id = EXCLUDED.organization_id;

  UPDATE public.profiles
  SET organization_id = org_id
  WHERE organization_id IS NULL;

  INSERT INTO public.categories (id, organization_id, code, name)
  VALUES
    (cat_wallet, org_id, 'wallet', 'Wallet adjustments'),
    (cat_settlement, org_id, 'settlement', 'Settlement & fees')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subcategories (id, organization_id, category_id, code, name)
  VALUES
    (sub_dup, org_id, cat_wallet, 'duplicate_credit', 'Duplicate credit'),
    (sub_promo, org_id, cat_wallet, 'missing_promo', 'Missing promotional credit'),
    (sub_chargeback, org_id, cat_wallet, 'chargeback', 'Chargeback reversal'),
    (sub_fee, org_id, cat_settlement, 'fee_correction', 'Fee correction'),
    (sub_other, org_id, cat_wallet, 'other', 'Other')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assignment_groups (id, organization_id, code, name, description)
  VALUES
    (
      group_wallet, org_id, 'wallet_ops', 'Wallet Operations',
      'Handles wallet credit/debit adjustments and promo issues.'
    ),
    (
      group_chargeback, org_id, 'chargeback_desk', 'Chargeback Desk',
      'Handles chargeback reversals and related disputes.'
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assignment_group_members (group_id, user_id, is_lead)
  VALUES
    (group_wallet, agent_id, FALSE),
    (group_wallet, lead_id, TRUE),
    (group_chargeback, agent_id, FALSE),
    (group_chargeback, lead_id, TRUE)
  ON CONFLICT (group_id, user_id) DO UPDATE SET is_lead = EXCLUDED.is_lead;

  INSERT INTO public.assignment_rules (
    organization_id, sequence, is_active, category_id, subcategory_id, priority, assignment_group_id
  ) VALUES
    (org_id, 10, TRUE, cat_wallet, sub_chargeback, NULL, group_chargeback),
    (org_id, 20, TRUE, cat_wallet, sub_dup, NULL, group_wallet),
    (org_id, 30, TRUE, cat_wallet, sub_promo, NULL, group_wallet),
    (org_id, 40, TRUE, cat_settlement, sub_fee, NULL, group_wallet),
    (org_id, 100, TRUE, cat_wallet, NULL, NULL, group_wallet)
  ON CONFLICT (organization_id, sequence) DO NOTHING;

  -- SLA durations (calendar minutes) by priority
  INSERT INTO public.sla_definitions (organization_id, priority, sla_type, duration_minutes)
  VALUES
    (org_id, 'low', 'first_response', 480),
    (org_id, 'low', 'resolution', 2880),
    (org_id, 'medium', 'first_response', 240),
    (org_id, 'medium', 'resolution', 1440),
    (org_id, 'high', 'first_response', 120),
    (org_id, 'high', 'resolution', 720),
    (org_id, 'critical', 'first_response', 60),
    (org_id, 'critical', 'resolution', 240)
  ON CONFLICT (organization_id, priority, sla_type) DO UPDATE
    SET duration_minutes = EXCLUDED.duration_minutes;

  -- Backfill existing sample cases
  UPDATE public.cases SET
    organization_id = org_id,
    category_id = cat_wallet,
    subcategory_id = sub_dup,
    priority = 'medium',
    assigned_group_id = group_wallet
  WHERE id = case1_id;

  UPDATE public.cases SET
    organization_id = org_id,
    category_id = cat_wallet,
    subcategory_id = sub_promo,
    priority = 'high',
    assigned_group_id = group_wallet
  WHERE id = case2_id;

  UPDATE public.cases SET
    organization_id = org_id,
    category_id = cat_wallet,
    subcategory_id = sub_chargeback,
    priority = 'critical',
    assigned_group_id = group_chargeback
  WHERE id = case3_id;

  UPDATE public.cases SET
    organization_id = org_id,
    category_id = cat_settlement,
    subcategory_id = sub_fee,
    priority = 'medium',
    assigned_group_id = group_wallet
  WHERE id = case4_id;

  UPDATE public.cases SET
    organization_id = org_id,
    category_id = cat_wallet,
    subcategory_id = sub_other,
    priority = 'low',
    assigned_group_id = group_wallet
  WHERE id = case5_id;

  -- Seed SLA rows for open cases (idempotent)
  INSERT INTO public.case_sla (case_id, sla_type, state, due_at, started_at, completed_at)
  SELECT c.id, 'first_response',
    CASE WHEN c.acknowledged_at IS NOT NULL OR c.status <> 'SUBMITTED' THEN 'COMPLETED'::public.sla_state
         ELSE 'RUNNING'::public.sla_state END,
    c.created_at + (d.duration_minutes || ' minutes')::INTERVAL,
    c.created_at,
    CASE WHEN c.acknowledged_at IS NOT NULL OR c.status <> 'SUBMITTED' THEN COALESCE(c.acknowledged_at, c.updated_at) ELSE NULL END
  FROM public.cases c
  JOIN public.sla_definitions d
    ON d.organization_id = c.organization_id
   AND d.priority = c.priority
   AND d.sla_type = 'first_response'
  WHERE c.id IN (case1_id, case2_id, case3_id, case4_id, case5_id)
  ON CONFLICT (case_id, sla_type) DO NOTHING;

  INSERT INTO public.case_sla (case_id, sla_type, state, due_at, started_at, completed_at)
  SELECT c.id, 'resolution',
    CASE WHEN c.status IN ('RESOLVED', 'REJECTED') THEN 'COMPLETED'::public.sla_state
         ELSE 'RUNNING'::public.sla_state END,
    c.created_at + (d.duration_minutes || ' minutes')::INTERVAL,
    c.created_at,
    CASE WHEN c.status IN ('RESOLVED', 'REJECTED') THEN c.updated_at ELSE NULL END
  FROM public.cases c
  JOIN public.sla_definitions d
    ON d.organization_id = c.organization_id
   AND d.priority = c.priority
   AND d.sla_type = 'resolution'
  WHERE c.id IN (case1_id, case2_id, case3_id, case4_id, case5_id)
  ON CONFLICT (case_id, sla_type) DO NOTHING;
END $$;
