# Saved case views

Phase 7 lets users save reusable case-list filters as **views**.

## Scopes

| Scope | Who can see | Who can create |
| --- | --- | --- |
| `personal` | Owner | Any authenticated user |
| `team` | Team members | Owner who belongs to the team |
| `organization` | Org members | Admin / team lead |
| `system` | Org members | Seeded only (admin can deactivate) |

## Safety

Loading a view never bypasses tenant, role, or case ACL. Requesters still only see their own cases even if a shared view filter is broader. Actor-scoped flags (`assignedToMe`, `unassignedInMyTeams`, `pendingMyApproval`) resolve against the current user.

## Table

`saved_case_views` — filters / sorting / columns / page size / default flag.

## System views (seeded)

My open cases · Unassigned team cases · High-priority · Waiting for requester · Due soon · Breached · Pending my approval · Failed integration · Unknown integration · Recently updated

## API

- `GET/POST /api/v1/saved-views`
- `GET/PATCH/DELETE /api/v1/saved-views/:id` (delete = deactivate)
- `GET /api/v1/cases?viewId=` applies a view’s filters

## UI

`/cases` — saved view picker + “Save personal view” from current status/search.

## Simulator

`npm run simulate:views` — scenario `24-saved-case-views.yaml`
