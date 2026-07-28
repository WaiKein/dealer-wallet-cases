# Administration console

Organisation-scoped configuration UI and APIs for the business pilot.

## Access

- Route: `/admin`
- Role: `admin` only (`canAccessAdminConsole`)
- Enforced in: layout (`requireAdmin`), server actions, `/api/v1/admin/config`, domain `assertAdmin`, and Postgres RLS write policies

Seed user: `admin@example.com` / `Password123!`

## Modules

| Screen | Data |
| --- | --- |
| Organisation | `organizations` |
| Users | `profiles` (org-scoped) |
| Roles | Read-only enum catalogue |
| Teams | `assignment_groups` |
| Memberships | `assignment_group_members` |
| Categories / Subcategories | taxonomy tables |
| Assignment rules | `assignment_rules` |
| SLA definitions | `sla_definitions` |
| Approval rules | `approval_rules` (matching in Phase 2) |
| Notification templates | `notification_templates` |
| Feature flags | `feature_flags` |

## Configuration rules

- Prefer deactivate / version bump over hard delete
- Every mutation requires `change_reason` (≥ 3 chars)
- Append-only `configuration_audit` stores previous/new JSON, actor, org, correlation ID
- Metadata columns: `version`, `effective_from`/`effective_to`, `created_by`/`updated_by`, `change_reason`

## API

`GET/POST /api/v1/admin/config` with bearer auth.

- GET `?resource=categories|teams|approval-rules|...`
- POST body `{ "resource": "categories", "payload": { ... } }`

## Migrations

- Migrations: `009` admin role, `010` admin console schema, `011` seed
- Rollback notes: `supabase/rollbacks/20260101000009_admin_console_down.sql`
