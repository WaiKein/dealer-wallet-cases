-- Phase 8: Pilot management dashboard (org-scoped aggregated snapshot)

-- Fact view used by CSV export and optional ad-hoc queries (always filter by org + dates).
CREATE OR REPLACE VIEW public.v_management_case_facts AS
SELECT
  c.id AS case_id,
  c.organization_id,
  c.case_number,
  c.title,
  c.status,
  c.priority,
  c.category_id,
  cat.name AS category_name,
  cat.code AS category_code,
  c.subcategory_id,
  sub.name AS subcategory_name,
  sub.code AS subcategory_code,
  c.assigned_group_id,
  ag.name AS team_name,
  ag.code AS team_code,
  c.assigned_agent_id,
  agent.full_name AS agent_name,
  c.requester_id,
  c.adjustment_amount,
  c.adjustment_type,
  c.currency,
  c.created_at,
  c.updated_at,
  c.first_responded_at,
  c.acknowledged_at,
  CASE
    WHEN c.status IN ('RESOLVED', 'REJECTED') THEN c.updated_at
    ELSE NULL
  END AS closed_at,
  cie.status AS execution_status,
  cie.approved_amount AS execution_approved_amount,
  cie.requested_amount AS execution_requested_amount,
  CASE WHEN cie.status = 'SUCCEEDED' THEN cie.approved_amount ELSE NULL END AS executed_amount,
  fr.state AS first_response_sla_state,
  fr.due_at AS first_response_due_at,
  fr.completed_at AS first_response_completed_at,
  fr.breached_at AS first_response_breached_at,
  res.state AS resolution_sla_state,
  res.due_at AS resolution_due_at,
  res.completed_at AS resolution_completed_at,
  res.breached_at AS resolution_breached_at,
  CASE
    WHEN c.status IN ('RESOLVED', 'REJECTED') THEN NULL
    WHEN c.created_at >= NOW() - INTERVAL '1 day' THEN 'lt_1d'
    WHEN c.created_at >= NOW() - INTERVAL '3 days' THEN 'd1_3'
    WHEN c.created_at >= NOW() - INTERVAL '7 days' THEN 'd4_7'
    WHEN c.created_at >= NOW() - INTERVAL '14 days' THEN 'd8_14'
    ELSE 'gt_14d'
  END AS backlog_age_band
FROM public.cases c
LEFT JOIN public.categories cat ON cat.id = c.category_id
LEFT JOIN public.subcategories sub ON sub.id = c.subcategory_id
LEFT JOIN public.assignment_groups ag ON ag.id = c.assigned_group_id
LEFT JOIN public.profiles agent ON agent.id = c.assigned_agent_id
LEFT JOIN public.case_integration_executions cie
  ON cie.id = c.current_integration_execution_id
LEFT JOIN public.case_sla fr
  ON fr.case_id = c.id AND fr.sla_type = 'first_response'
LEFT JOIN public.case_sla res
  ON res.case_id = c.id AND res.sla_type = 'resolution';

COMMENT ON VIEW public.v_management_case_facts IS
  'Phase 8 management dashboard fact rows. Always filter by organization_id and date bounds.';

GRANT SELECT ON public.v_management_case_facts TO authenticated;
GRANT SELECT ON public.v_management_case_facts TO service_role;

-- Single round-trip org-scoped snapshot (bounded by date range; no unbounded scans from the app).
CREATE OR REPLACE FUNCTION public.management_dashboard_snapshot(
  p_organization_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_from TIMESTAMPTZ := COALESCE(p_from, NOW() - INTERVAL '30 days');
  v_to TIMESTAMPTZ := COALESCE(p_to, NOW());
  v_result JSONB;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;
  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid date range';
  END IF;
  -- Cap range to 366 days to avoid accidental huge scans.
  IF v_to - v_from > INTERVAL '366 days' THEN
    RAISE EXCEPTION 'date range may not exceed 366 days';
  END IF;

  WITH bounded AS (
    SELECT *
    FROM public.v_management_case_facts f
    WHERE f.organization_id = p_organization_id
      AND f.created_at >= v_from
      AND f.created_at <= v_to
  ),
  open_now AS (
    SELECT *
    FROM public.v_management_case_facts f
    WHERE f.organization_id = p_organization_id
      AND f.status NOT IN ('RESOLVED', 'REJECTED')
  ),
  kpis AS (
    SELECT
      (SELECT COUNT(*) FROM bounded)::int AS cases_submitted,
      (SELECT COUNT(*) FROM bounded WHERE status = 'RESOLVED')::int AS cases_resolved,
      (SELECT COUNT(*) FROM open_now)::int AS current_backlog,
      (SELECT COUNT(*) FROM open_now WHERE assigned_agent_id IS NULL)::int AS unassigned_cases,
      (SELECT COUNT(*) FROM open_now WHERE status = 'PENDING_APPROVAL')::int AS pending_approval,
      (SELECT COUNT(*) FROM open_now WHERE status = 'WAITING_FOR_REQUESTER')::int AS awaiting_requester,
      (SELECT COUNT(*) FROM open_now WHERE execution_status = 'FAILED_FINAL')::int AS failed_integration,
      (SELECT COUNT(*) FROM open_now WHERE execution_status = 'UNKNOWN')::int AS unknown_integration,
      (
        SELECT CASE
          WHEN COUNT(*) FILTER (
            WHERE first_response_sla_state IN ('COMPLETED', 'BREACHED')
          ) = 0 THEN NULL
          ELSE ROUND(
            100.0 * COUNT(*) FILTER (WHERE first_response_sla_state = 'COMPLETED')
              / NULLIF(COUNT(*) FILTER (
                WHERE first_response_sla_state IN ('COMPLETED', 'BREACHED')
              ), 0),
            1
          )
        END
        FROM bounded
      ) AS first_response_sla_compliance_pct,
      (
        SELECT CASE
          WHEN COUNT(*) FILTER (
            WHERE resolution_sla_state IN ('COMPLETED', 'BREACHED')
          ) = 0 THEN NULL
          ELSE ROUND(
            100.0 * COUNT(*) FILTER (WHERE resolution_sla_state = 'COMPLETED')
              / NULLIF(COUNT(*) FILTER (
                WHERE resolution_sla_state IN ('COMPLETED', 'BREACHED')
              ), 0),
            1
          )
        END
        FROM bounded
      ) AS resolution_sla_compliance_pct,
      (
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (first_responded_at - created_at)) / 3600.0)::numeric, 2)
        FROM bounded
        WHERE first_responded_at IS NOT NULL
      ) AS avg_first_response_hours,
      (
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600.0)::numeric, 2)
        FROM bounded
        WHERE status = 'RESOLVED' AND closed_at IS NOT NULL
      ) AS avg_resolution_hours,
      (
        SELECT CASE
          WHEN COUNT(*) FILTER (WHERE status = 'RESOLVED') = 0 THEN NULL
          ELSE ROUND(
            100.0 * (
              SELECT COUNT(*)::numeric
              FROM public.case_audit_history h
              JOIN public.cases c ON c.id = h.case_id
              WHERE c.organization_id = p_organization_id
                AND h.event_type = 'case_reopened'
                AND h.created_at >= v_from
                AND h.created_at <= v_to
            ) / NULLIF(COUNT(*) FILTER (WHERE status = 'RESOLVED'), 0),
            1
          )
        END
        FROM bounded
      ) AS reopen_rate_pct,
      (
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ar.completed_at - ar.created_at)) / 3600.0)::numeric, 2)
        FROM public.approval_requests ar
        WHERE ar.organization_id = p_organization_id
          AND ar.completed_at IS NOT NULL
          AND ar.created_at >= v_from
          AND ar.created_at <= v_to
      ) AS avg_approval_turnaround_hours,
      (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN NULL
          ELSE ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'SUCCEEDED') / COUNT(*)::numeric,
            1
          )
        END
        FROM public.case_integration_executions e
        WHERE e.organization_id = p_organization_id
          AND e.created_at >= v_from
          AND e.created_at <= v_to
          AND e.status IN ('SUCCEEDED', 'FAILED_FINAL', 'FAILED_RETRYABLE', 'UNKNOWN', 'CANCELLED')
      ) AS integration_success_rate_pct,
      (SELECT COALESCE(SUM(adjustment_amount), 0) FROM bounded)::numeric AS adjustment_amount_requested,
      (
        SELECT COALESCE(SUM(approved_amount), 0)
        FROM public.approval_requests ar
        WHERE ar.organization_id = p_organization_id
          AND ar.status = 'APPROVED'
          AND ar.completed_at >= v_from
          AND ar.completed_at <= v_to
      )::numeric AS adjustment_amount_approved,
      (
        SELECT COALESCE(SUM(approved_amount), 0)
        FROM public.case_integration_executions e
        WHERE e.organization_id = p_organization_id
          AND e.status = 'SUCCEEDED'
          AND e.completed_at >= v_from
          AND e.completed_at <= v_to
      )::numeric AS adjustment_amount_executed
  ),
  by_status AS (
    SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb) AS data
    FROM (SELECT status::text, COUNT(*)::int AS cnt FROM bounded GROUP BY status) s
  ),
  by_priority AS (
    SELECT COALESCE(jsonb_object_agg(priority, cnt), '{}'::jsonb) AS data
    FROM (SELECT priority::text, COUNT(*)::int AS cnt FROM bounded GROUP BY priority) s
  ),
  by_category AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', COALESCE(category_code, 'none'), 'label', COALESCE(category_name, 'Uncategorised'), 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb) AS data
    FROM (SELECT category_code, category_name, COUNT(*)::int AS cnt FROM bounded GROUP BY category_code, category_name) s
  ),
  by_subcategory AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', COALESCE(subcategory_code, 'none'), 'label', COALESCE(subcategory_name, 'None'), 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb) AS data
    FROM (SELECT subcategory_code, subcategory_name, COUNT(*)::int AS cnt FROM bounded GROUP BY subcategory_code, subcategory_name) s
  ),
  by_team AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', COALESCE(team_code, 'none'), 'label', COALESCE(team_name, 'Unassigned'), 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb) AS data
    FROM (SELECT team_code, team_name, COUNT(*)::int AS cnt FROM bounded GROUP BY team_code, team_name) s
  ),
  by_agent AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', COALESCE(assigned_agent_id::text, 'none'), 'label', COALESCE(agent_name, 'Unassigned'), 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb) AS data
    FROM (SELECT assigned_agent_id, agent_name, COUNT(*)::int AS cnt FROM bounded GROUP BY assigned_agent_id, agent_name) s
  ),
  by_approval AS (
    SELECT COALESCE(jsonb_object_agg(bucket, cnt), '{}'::jsonb) AS data
    FROM (
      SELECT
        CASE
          WHEN status = 'PENDING_APPROVAL' THEN 'PENDING'
          WHEN status = 'APPROVED' THEN 'APPROVED'
          WHEN status = 'REJECTED' THEN 'REJECTED'
          ELSE 'N_A'
        END AS bucket,
        COUNT(*)::int AS cnt
      FROM bounded
      GROUP BY 1
    ) s
  ),
  by_execution AS (
    SELECT COALESCE(jsonb_object_agg(COALESCE(execution_status::text, 'NONE'), cnt), '{}'::jsonb) AS data
    FROM (SELECT execution_status, COUNT(*)::int AS cnt FROM bounded GROUP BY execution_status) s
  ),
  sla_breaches_by_team AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', COALESCE(team_code, 'none'), 'label', COALESCE(team_name, 'Unassigned'), 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb) AS data
    FROM (
      SELECT team_code, team_name, COUNT(*)::int AS cnt
      FROM open_now
      WHERE first_response_sla_state = 'BREACHED' OR resolution_sla_state = 'BREACHED'
      GROUP BY team_code, team_name
    ) s
  ),
  ageing AS (
    SELECT jsonb_build_object(
      'lt_1d', COUNT(*) FILTER (WHERE backlog_age_band = 'lt_1d'),
      'd1_3', COUNT(*) FILTER (WHERE backlog_age_band = 'd1_3'),
      'd4_7', COUNT(*) FILTER (WHERE backlog_age_band = 'd4_7'),
      'd8_14', COUNT(*) FILTER (WHERE backlog_age_band = 'd8_14'),
      'gt_14d', COUNT(*) FILTER (WHERE backlog_age_band = 'gt_14d')
    ) AS data
    FROM open_now
  ),
  daily_trend AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'date', day,
      'created', created_cnt,
      'resolved', resolved_cnt
    ) ORDER BY day), '[]'::jsonb) AS data
    FROM (
      SELECT
        d::date AS day,
        (SELECT COUNT(*)::int FROM bounded b WHERE b.created_at::date = d::date) AS created_cnt,
        (
          SELECT COUNT(*)::int
          FROM public.cases c
          WHERE c.organization_id = p_organization_id
            AND c.status = 'RESOLVED'
            AND c.updated_at::date = d::date
            AND c.updated_at >= v_from
            AND c.updated_at <= v_to
        ) AS resolved_cnt
      FROM generate_series(v_from::date, v_to::date, INTERVAL '1 day') AS d
    ) s
  )
  SELECT jsonb_build_object(
    'organizationId', p_organization_id,
    'from', v_from,
    'to', v_to,
    'kpis', to_jsonb(kpis.*),
    'breakdowns', jsonb_build_object(
      'byStatus', by_status.data,
      'byPriority', by_priority.data,
      'byCategory', by_category.data,
      'bySubcategory', by_subcategory.data,
      'byTeam', by_team.data,
      'byAgent', by_agent.data,
      'byApprovalStatus', by_approval.data,
      'byExecutionStatus', by_execution.data,
      'slaBreachesByTeam', sla_breaches_by_team.data,
      'backlogAgeing', ageing.data,
      'dailyCreatedVsResolved', daily_trend.data
    )
  )
  INTO v_result
  FROM kpis, by_status, by_priority, by_category, by_subcategory, by_team, by_agent,
       by_approval, by_execution, sla_breaches_by_team, ageing, daily_trend;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.management_dashboard_snapshot(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.management_dashboard_snapshot(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role;

-- Helpful indexes for dashboard date-bounded scans
CREATE INDEX IF NOT EXISTS idx_cases_org_created_at
  ON public.cases (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_org_updated_status
  ON public.cases (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_org_completed
  ON public.approval_requests (organization_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_executions_org_completed
  ON public.case_integration_executions (organization_id, status, completed_at DESC);
