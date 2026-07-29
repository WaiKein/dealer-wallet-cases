# Case Management (POC)

Proof-of-concept application for managing dealer wallet adjustment cases with
role-based workflow, assignment groups, SLA tracking, in-app notifications,
audit history, and Supabase-backed persistence.

## Stack

- Next.js App Router + TypeScript
- Supabase PostgreSQL + Authentication
- Tailwind CSS + shadcn/ui
- Zod validation
- Vitest unit tests + Playwright e2e

## Workflow

```text
SUBMITTED → UNDER_REVIEW ⇄ WAITING_FOR_REQUESTER / WAITING_FOR_EXTERNAL_PARTY
          → PENDING_APPROVAL → APPROVED or REJECTED → RESOLVED
          ↺ (reopen) UNDER_REVIEW
```

| Role | Capabilities |
| --- | --- |
| Requester | Create cases, view own cases, respond when waiting |
| Operations Agent | Claim group cases, acknowledge, review, escalate/reject, resolve |
| Team Lead | Group lead actions (configurable), reassign within group |
| Approver | Approve or reject pending cases |

## Assignment model

Cases are classified by **category → subcategory** (plus priority for SLA).
Configurable **assignment rules** (ordered by sequence) route a case to an
**assignment group**. Agents claim cases in their groups; leads reassign within
the group. Lead authorization is configurable per organization:
`role` | `membership` | `both`.

## Multi-tenant readiness

All operational data is scoped by `organization_id`. The POC seeds a single
organization; RLS helpers (`get_my_org_id`) are ready for additional tenants.

## Project structure

```text
dealer-wallet-cases/
├── src/
│   ├── app/(dashboard)/
│   │   ├── cases/                 # Case list/detail/create
│   │   ├── workspace/             # Agent queues
│   │   ├── assignment-groups/     # Simple groups page
│   │   └── dashboard/
│   ├── components/
│   ├── lib/
│   │   ├── assignment/            # Rules, claim, reassign, acknowledge
│   │   ├── sla/                   # Due dates, pause/resume, state refresh
│   │   ├── notifications/         # In-app notifications + dedupe
│   │   ├── auth/
│   │   └── cases/
│   └── types/
├── supabase/migrations/
├── tests/                         # Vitest
└── e2e/                           # Playwright
```

## Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (for local Supabase)

## Setup

1. Install dependencies:

```bash
cd dealer-wallet-cases
npm install
npx playwright install chromium
```

2. **Start Docker Desktop** and wait until it shows "Docker Desktop is running".

3. Run the local setup script (starts Supabase, applies migrations/seed, writes `.env.local`):

```powershell
.\scripts\setup-local.ps1
```

Or manually:

```bash
supabase start
supabase db reset
# Copy keys from `supabase status` into .env.local
```

4. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Seed users

All seed users share the password `Password123!`

| Email | Role |
| --- | --- |
| requester@example.com | Requester |
| agent@example.com | Operations Agent |
| teamlead@example.com | Team Lead |
| approver@example.com | Approver |
| admin@example.com | Administrator |

## Administration

Organisation admins can manage configuration at `/admin` (see [docs/admin-console.md](docs/admin-console.md)).

API-driven workflow simulator lives in `tools/case-simulator`.

```bash
# App must be running with ENABLE_TEST_CONTROL=true
npm run simulate:smoke
npm run simulate:workflow
npm run simulate:security
npm run simulate:sla
npm run simulate:reliability
npm run simulate:all
```

With test-control enabled locally, open `/simulator` (Simulator in the header)
to run scenarios and browse the latest results in the UI.

See `tools/case-simulator/README.md` for details.

## Reliability (production pilot)

- Standard API errors: `{ error: { code, message, details? }, correlationId }`
- Correlation IDs via `x-correlation-id` (middleware → APIs → audit/notifications/jobs)
- Optimistic locking: `cases.version` (HTTP 409 `VERSION_CONFLICT`); dashboard sends `expectedVersion`
- Idempotency-Key on create + approval/reject/resolve/reopen transitions
- Background jobs (`background_jobs`) for SLA refresh + notification dispatch
- Worker: `npm run jobs:worker` (optional `JOBS_POLL_INTERVAL_MS` loop) or cron → `POST /api/jobs/tick` with `x-jobs-tick-secret`
- Health: `/api/health/live`, `/api/health/ready`, `/api/health/database`
- CI: `.github/workflows/ci.yml` (lint, typecheck, unit, runbook sync, build, migrations, smoke + reliability)
- Test-control/simulator routes redirect away in production builds

**Documented system job actions** (service-role, org-scoped, no status transitions):
`sla.refresh_case`, `notification.dispatch` (see `src/lib/jobs/worker.ts`).

**Ops runbook:** [docs/pilot-ops.md](docs/pilot-ops.md) (env checklist, worker/cron, health, rollback).
**Full-feature test runbook:** [docs/system-full-feature-test-runbook.md](docs/system-full-feature-test-runbook.md) (stable `RB-*` IDs grouped into UAT journeys; sync with `npm run test:runbook-sync`).
**Admin console:** [docs/admin-console.md](docs/admin-console.md).
**Approval matrix / maker-checker:** [docs/approval-matrix.md](docs/approval-matrix.md), [docs/maker-checker.md](docs/maker-checker.md).
**Wallet provider (mock):** [docs/wallet-provider-interface.md](docs/wallet-provider-interface.md), [docs/mock-wallet-provider.md](docs/mock-wallet-provider.md).
**Saved case views:** [docs/saved-case-views.md](docs/saved-case-views.md).
**Management dashboard:** [docs/management-dashboard.md](docs/management-dashboard.md).
**Simulator expansion:** [docs/simulator-expansion.md](docs/simulator-expansion.md).
**Exception queues:** [docs/exception-queues.md](docs/exception-queues.md).
**Email notifications:** [docs/email-notifications.md](docs/email-notifications.md).

## Implementation notes

- Status and operational events are recorded in `case_audit_history` (`event_type`).
- SLA state is calculated and persisted server-side (calendar elapsed time).
- Resolution SLA pauses during waiting statuses.
- Notifications use unique `dedupe_key` values to prevent duplicates.
- Requesters do not receive internal operational notifications.
- Out of scope: email, AI, SAP, wallet API, workflow engines, business calendars.
