# Pilot management dashboard

Phase 8 adds an organisation-scoped management dashboard at `/dashboard/management`.

## Access

Roles: `operations_agent`, `team_lead`, `approver`, `admin` (`canAccessManagementDashboard`).

## Aggregation

All KPIs and breakdowns come from a single Postgres RPC:

`management_dashboard_snapshot(organization_id, from, to)`

- Always scoped to the caller’s organisation
- Date range required (defaults to last 30 days; max 366 days)
- Uses fact view `v_management_case_facts` (not unbounded app-side scans)

## KPIs

Submitted / resolved / backlog / unassigned / pending approval / awaiting requester / failed & unknown integration / SLA compliance & averages / reopen rate / approval turnaround / integration success / adjustment amounts (requested, approved, executed).

## Breakdowns

Status, priority, category, subcategory, team, agent, approval status, execution status, SLA breaches by team, backlog ageing bands, daily created-vs-resolved trend.

Ageing bands: &lt;1d · 1–3d · 4–7d · 8–14d · &gt;14d.

## API

- `GET /api/v1/management/dashboard?from=&to=`
- `GET /api/v1/management/dashboard/export?from=&to=` — CSV for authorised users (max 5,000 rows)

## Simulator

`npm run simulate:management` — scenario `25-management-dashboard.yaml`
