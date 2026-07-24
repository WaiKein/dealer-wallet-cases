# Case Management (POC)

Proof-of-concept application for managing cases with role-based workflow, audit history, and Supabase-backed persistence.

## Stack

- Next.js App Router + TypeScript
- Supabase PostgreSQL + Authentication
- Tailwind CSS + shadcn/ui
- Zod validation
- Vitest unit tests

## Workflow

```text
SUBMITTED → UNDER_REVIEW → PENDING_APPROVAL → APPROVED or REJECTED → RESOLVED
```

| Role | Capabilities |
| --- | --- |
| Requester | Create cases, view own cases |
| Operations Agent | Review submitted cases, escalate/reject, resolve approved cases |
| Approver | Approve or reject pending cases |

## Project structure

```text
dealer-wallet-cases/
├── src/
│   ├── app/
│   │   ├── (dashboard)/cases/     # Protected case pages
│   │   ├── auth/callback/         # Supabase auth callback
│   │   └── login/                 # Public login page
│   ├── components/
│   │   ├── auth/                  # Login form
│   │   ├── cases/                 # Case UI components
│   │   ├── layout/                # App shell
│   │   └── ui/                    # shadcn/ui primitives
│   ├── lib/
│   │   ├── auth/                  # Session, roles, permissions, actions
│   │   ├── cases/                 # Queries and server actions
│   │   ├── supabase/              # Browser/server/middleware clients
│   │   └── validations/           # Zod schemas
│   └── types/                     # Shared TypeScript types
├── supabase/migrations/           # Schema + seed SQL
└── tests/                         # Vitest unit tests
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
| approver@example.com | Approver |

Five sample cases are seeded across all major workflow statuses.

## Scripts

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run typecheck  # TypeScript check
npm run test       # Vitest unit tests
npm run lint       # ESLint
```

## Implementation notes

- Status changes are validated in application code (`src/lib/auth/permissions.ts`) and recorded in `case_audit_history`.
- Row Level Security restricts requesters to their own cases; agents and approvers can access all cases.
- Out of scope for this POC: external integrations, email notifications, SLA rules, and AI features.

## Implementation plan (completed modules)

1. **Project structure** — Next.js App Router, Tailwind, shadcn/ui, Zod, Vitest
2. **Database** — profiles, cases, case_audit_history, RLS, triggers, seed data
3. **Authentication & RBAC** — Supabase auth, middleware, role helpers
4. **Case management** — create/list/detail pages with server actions
5. **Audit history** — append-only audit entries on every status change
6. **Quality** — Zod validation, loading/error UI, unit tests
