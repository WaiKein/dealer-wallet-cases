-- Seed data: three users and five example cases
-- Password for all seed users: Password123!

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  requester_id UUID := '11111111-1111-1111-1111-111111111111';
  agent_id UUID := '22222222-2222-2222-2222-222222222222';
  approver_id UUID := '33333333-3333-3333-3333-333333333333';
  case1_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  case2_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  case3_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  case4_id UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  case5_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  encrypted_pw TEXT := crypt('Password123!', gen_salt('bf'));
BEGIN
  -- Auth users
  -- GoTrue requires several varchar columns to be '' (not NULL).
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    reauthentication_token
  ) VALUES
    (
      requester_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'requester@example.com', encrypted_pw, NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Alex Requester","role":"requester"}'::jsonb,
      NOW(), NOW(),
      '', '', '', '', '', ''
    ),
    (
      agent_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'agent@example.com', encrypted_pw, NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Sam Operations","role":"operations_agent"}'::jsonb,
      NOW(), NOW(),
      '', '', '', '', '', ''
    ),
    (
      approver_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'approver@example.com', encrypted_pw, NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Jordan Approver","role":"approver"}'::jsonb,
      NOW(), NOW(),
      '', '', '', '', '', ''
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES
    (
      requester_id, requester_id,
      jsonb_build_object('sub', requester_id::text, 'email', 'requester@example.com'),
      'email', requester_id::text, NOW(), NOW(), NOW()
    ),
    (
      agent_id, agent_id,
      jsonb_build_object('sub', agent_id::text, 'email', 'agent@example.com'),
      'email', agent_id::text, NOW(), NOW(), NOW()
    ),
    (
      approver_id, approver_id,
      jsonb_build_object('sub', approver_id::text, 'email', 'approver@example.com'),
      'email', approver_id::text, NOW(), NOW(), NOW()
    )
  ON CONFLICT (id) DO NOTHING;

  -- Profiles (trigger may have created them; ensure roles are correct)
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES
    (requester_id, 'requester@example.com', 'Alex Requester', 'requester'),
    (agent_id, 'agent@example.com', 'Sam Operations', 'operations_agent'),
    (approver_id, 'approver@example.com', 'Jordan Approver', 'approver')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  -- Example cases across workflow stages
  INSERT INTO public.cases (
    id, case_number, title, description, dealer_id, wallet_id,
    adjustment_amount, adjustment_type, currency, status,
    requester_id, assigned_agent_id, approver_id,
    rejection_reason, resolution_notes, created_at, updated_at
  ) VALUES
    (
      case1_id, 'DWC-2026-0001',
      'Duplicate deposit correction',
      'Dealer reported a duplicate wallet credit from batch DEP-8842.',
      'DLR-10042', 'WLT-88421', 1250.00, 'debit', 'USD', 'SUBMITTED',
      requester_id, NULL, NULL, NULL, NULL,
      NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
    ),
    (
      case2_id, 'DWC-2026-0002',
      'Promotional credit missing',
      'Q1 promo credit was not applied to dealer wallet after campaign enrollment.',
      'DLR-10089', 'WLT-90112', 500.00, 'credit', 'USD', 'UNDER_REVIEW',
      requester_id, agent_id, NULL, NULL, NULL,
      NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day'
    ),
    (
      case3_id, 'DWC-2026-0003',
      'Chargeback reversal',
      'Customer chargeback was reversed; dealer wallet needs credit restoration.',
      'DLR-10115', 'WLT-77331', 3200.50, 'credit', 'USD', 'PENDING_APPROVAL',
      requester_id, agent_id, NULL, NULL, NULL,
      NOW() - INTERVAL '7 days', NOW() - INTERVAL '12 hours'
    ),
    (
      case4_id, 'DWC-2026-0004',
      'Incorrect fee deduction',
      'Platform fee was deducted twice during settlement cycle SET-441.',
      'DLR-10201', 'WLT-55221', 875.25, 'credit', 'USD', 'APPROVED',
      requester_id, agent_id, approver_id, NULL, NULL,
      NOW() - INTERVAL '10 days', NOW() - INTERVAL '2 days'
    ),
    (
      case5_id, 'DWC-2026-0005',
      'Invalid adjustment request',
      'Requested debit exceeds available wallet balance; insufficient documentation.',
      'DLR-10344', 'WLT-66109', 10000.00, 'debit', 'USD', 'REJECTED',
      requester_id, agent_id, approver_id,
      'Insufficient supporting documentation and amount exceeds policy limits.',
      NULL,
      NOW() - INTERVAL '14 days', NOW() - INTERVAL '3 days'
    )
  ON CONFLICT (id) DO NOTHING;

  -- Audit history
  INSERT INTO public.case_audit_history (case_id, from_status, to_status, changed_by, comment, created_at)
  VALUES
    (case1_id, NULL, 'SUBMITTED', requester_id, 'Case submitted by requester.', NOW() - INTERVAL '2 days'),
    (case2_id, NULL, 'SUBMITTED', requester_id, 'Case submitted by requester.', NOW() - INTERVAL '5 days'),
    (case2_id, 'SUBMITTED', 'UNDER_REVIEW', agent_id, 'Assigned for operations review.', NOW() - INTERVAL '1 day'),
    (case3_id, NULL, 'SUBMITTED', requester_id, 'Case submitted by requester.', NOW() - INTERVAL '7 days'),
    (case3_id, 'SUBMITTED', 'UNDER_REVIEW', agent_id, 'Reviewing chargeback documentation.', NOW() - INTERVAL '3 days'),
    (case3_id, 'UNDER_REVIEW', 'PENDING_APPROVAL', agent_id, 'Documentation verified; sent for approval.', NOW() - INTERVAL '12 hours'),
    (case4_id, NULL, 'SUBMITTED', requester_id, 'Case submitted by requester.', NOW() - INTERVAL '10 days'),
    (case4_id, 'SUBMITTED', 'UNDER_REVIEW', agent_id, 'Review started.', NOW() - INTERVAL '8 days'),
    (case4_id, 'UNDER_REVIEW', 'PENDING_APPROVAL', agent_id, 'Ready for approver review.', NOW() - INTERVAL '5 days'),
    (case4_id, 'PENDING_APPROVAL', 'APPROVED', approver_id, 'Approved after fee reconciliation.', NOW() - INTERVAL '2 days'),
    (case5_id, NULL, 'SUBMITTED', requester_id, 'Case submitted by requester.', NOW() - INTERVAL '14 days'),
    (case5_id, 'SUBMITTED', 'UNDER_REVIEW', agent_id, 'Initial review.', NOW() - INTERVAL '10 days'),
    (case5_id, 'UNDER_REVIEW', 'PENDING_APPROVAL', agent_id, 'Escalated for approval decision.', NOW() - INTERVAL '7 days'),
    (case5_id, 'PENDING_APPROVAL', 'REJECTED', approver_id, 'Rejected due to policy limits.', NOW() - INTERVAL '3 days');

  PERFORM setval('public.case_number_seq', 5, true);
END $$;
