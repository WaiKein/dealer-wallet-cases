-- Repair: seed cases left in PENDING_APPROVAL without approval_requests/steps.
-- Early seed (00001) set status before approval runtime tables existed (00012).

DO $$
DECLARE
  orphan RECORD;
  request_id UUID;
  rule_id UUID;
  rule_version INTEGER;
  rule_code TEXT;
  rule_levels INTEGER;
  rule_sequential BOOLEAN;
  rule_role public.user_role;
  rule_team UUID;
  rule_limit NUMERIC(14, 2);
  requester UUID;
BEGIN
  FOR orphan IN
    SELECT
      c.id,
      c.organization_id,
      c.adjustment_amount,
      c.requester_id,
      c.assigned_agent_id,
      c.category_id,
      c.subcategory_id,
      c.priority,
      c.assigned_group_id
    FROM public.cases c
    WHERE c.status = 'PENDING_APPROVAL'
      AND c.organization_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.approval_requests ar
        WHERE ar.case_id = c.id
          AND ar.status = 'PENDING'
      )
  LOOP
    SELECT
      r.id,
      r.version,
      r.code,
      r.approval_levels,
      r.sequential_required,
      r.required_approver_role,
      r.required_approver_team_id,
      r.approver_limit
    INTO
      rule_id,
      rule_version,
      rule_code,
      rule_levels,
      rule_sequential,
      rule_role,
      rule_team,
      rule_limit
    FROM public.approval_rules r
    WHERE r.organization_id = orphan.organization_id
      AND r.is_active = TRUE
    ORDER BY r.sequence ASC, r.version DESC
    LIMIT 1;

    requester := COALESCE(orphan.assigned_agent_id, orphan.requester_id);
    request_id := gen_random_uuid();

    INSERT INTO public.approval_requests (
      id,
      organization_id,
      case_id,
      approval_rule_id,
      approval_rule_version,
      approval_rule_code,
      status,
      requested_amount,
      approval_levels,
      sequential_required,
      required_approver_role,
      required_approver_team_id,
      approver_limit,
      requested_by,
      version,
      created_at,
      updated_at
    ) VALUES (
      request_id,
      orphan.organization_id,
      orphan.id,
      rule_id,
      rule_version,
      rule_code,
      'PENDING',
      orphan.adjustment_amount,
      COALESCE(rule_levels, 1),
      COALESCE(rule_sequential, TRUE),
      COALESCE(rule_role, 'approver'),
      rule_team,
      rule_limit,
      requester,
      1,
      NOW() - INTERVAL '12 hours',
      NOW() - INTERVAL '12 hours'
    );

    INSERT INTO public.approval_steps (
      organization_id,
      approval_request_id,
      case_id,
      level_no,
      status,
      required_role,
      required_team_id,
      version,
      created_at,
      updated_at
    ) VALUES (
      orphan.organization_id,
      request_id,
      orphan.id,
      1,
      'PENDING',
      COALESCE(rule_role, 'approver'),
      rule_team,
      1,
      NOW() - INTERVAL '12 hours',
      NOW() - INTERVAL '12 hours'
    );

    UPDATE public.cases
    SET
      current_approval_request_id = request_id,
      approval_rule_id = COALESCE(cases.approval_rule_id, rule_id),
      approval_rule_version = COALESCE(cases.approval_rule_version, rule_version)
    WHERE id = orphan.id;
  END LOOP;
END $$;
