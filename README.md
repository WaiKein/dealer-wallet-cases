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

## Scripts

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run typecheck  # TypeScript check
npm run lint       # ESLint
npm run test       # Vitest unit tests
npm run test:e2e   # Playwright e2e tests
npm run db:reset   # Reset local DB + migrations/seed
```

## Implementation notes

- Status and operational events are recorded in `case_audit_history` (`event_type`).
- SLA state is calculated and persisted server-side (calendar elapsed time).
- Resolution SLA pauses during waiting statuses.
- Notifications use unique `dedupe_key` values to prevent duplicates.
- Requesters do not receive internal operational notifications.
- Out of scope: email, AI, SAP, wallet API, workflow engines, business calendars.
