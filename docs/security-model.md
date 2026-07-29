# Security model (Phase 11)

This pilot treats **server-side identity and database policy** as the source of truth.
Client-supplied organisation IDs, roles, team membership, approval limits, and
execution status are never trusted.

## Tenant isolation

- Every business table is scoped by `organization_id`.
- Supabase RLS uses `get_my_org_id()` and role helpers (`get_my_role()`, `is_group_member()`).
- App routes resolve the actor via `withActor` (bearer or cookie session) and load the profile from the database.
- `assertCaseAccess` / `canAccessCaseRow` mirror `can_access_case` RLS for defense in depth.

Cross-organisation access is denied at both RLS and application layers. Simulator scenario `07` and saved-view scenario `36` exercise this.

## Case access (`can_access_case`)

Within an organisation, a user may read a case when they are:

| Role | Access |
| --- | --- |
| Requester | Own cases |
| Operations agent / team lead | Team queue cases (assigned group membership or unassigned group queue) |
| Approver | `PENDING_APPROVAL` cases or cases where they are recorded approver |
| Assigned agent | Cases assigned to them |

**Admin** is configuration-only for cases in this pilot (no case SELECT in RLS).

## Approval and delegation

- Maker-checker, approval limits, and sequential levels are enforced in `lib/approvals/*` using DB rules and server profile identity.
- Delegations are validated in `lib/approvals/delegation.ts` and stored with effective dates/limits.
- Simulator scenarios `27`–`31` cover self-approval, maker-checker, limits, and delegation expiry.

## Saved views

- Personal and team-shared views are filtered in `saved-views-access.ts` and RLS.
- Cross-org view access is denied (scenario `36`).

## Comments and attachments

- **Internal comments** (`is_internal = true`) are visible only to operations roles (agent, team lead, approver, admin). Requesters cannot read or post them (RLS + API validation). Scenario `41`.
- **Attachments** metadata is protected by `can_access_case` on `case_attachments`.
- **Storage** objects in `case-attachments` bucket require `can_access_case` on the path prefix `{caseId}/…` (migration `021`).

## Sensitive integration data

- Wallet/account identifiers are masked for requesters and approvers via `lib/security/masking.ts`.
- Operations roles see full identifiers for reconciliation.
- Mock provider logs and execution notifications already use `maskAccountId`.

## Notifications and email

- Recipients are filtered with `filterNotificationRecipients` to ensure profiles belong to the target organisation and are active.
- `canReceiveNotificationType` restricts notification types by role.
- Requester email bodies suppress sensitive operational detail (`email.ts`).

## Test control and simulator

Enabled only when **all** of the following hold:

- `ENABLE_TEST_CONTROL=true`
- `TEST_CONTROL_SECRET` is set
- `NODE_ENV !== "production"`

Additional guards:

- Shared `authorizeTestControl()` on every `/api/test-control/*` route
- Middleware redirects test-control/simulator paths in production when disabled
- `next.config.ts` redirects for `/api/test-control`, `/simulator`, `/api/simulator`

Service-role clients are used only in server workers, notification dispatch enrichment, and gated test-control routes — never exposed to browsers.

## Never trust from the client

| Input | Server resolution |
| --- | --- |
| Organisation ID | `profile.organization_id` from authenticated session |
| User role | `profile.role` from `profiles` table |
| Team membership | `assignment_group_members` lookup |
| Approval limit | `approval_rules` / `approval_delegations` |
| Execution status | Service-role domain services / workers only |
| Provider outcome | Mock config via test-control only; workers call provider server-side |

## Signup and roles (migration `022`)

- `handle_new_user` **always** assigns `requester`. `raw_user_meta_data.role` is ignored.
- Elevated roles (`admin`, `approver`, `operations_agent`, `team_lead`) are granted only through the authenticated admin console / admin profile updates.

## Integration executions (migration `022` / `023`)

- Authenticated clients have **SELECT-only**, **case-scoped** access (`can_access_case`).
- Raw financial columns (`account_id`, `reference_id`, hashes, idempotency keys) are withheld from authenticated grants.
- Safe view `v_case_integration_executions_safe` returns role-masked identifiers.
- INSERT/UPDATE are restricted to `service_role`.
- Manual retry and worker execute paths re-validate that the execution is linked to an **APPROVED** approval request for the same case.

## Idempotency and jobs

- HTTP idempotency keys are **claimed atomically** (insert-first) before the handler runs.
- Pending claims carry a lease (`claimed_at`); stale leases are taken over via `takeover_stale_idempotency_claim`.
- Finalization of the claim is verified; lost leases return `CONFLICT`.
- `claim_background_jobs` is **REVOKE**d from `PUBLIC` / `anon` / `authenticated` (service_role only).
- `claim_background_jobs` reclaims `running` jobs whose `locked_at` is older than the lock timeout (default 5 minutes).
- Worker completion/failure updates are fenced by `locked_by` + `attempt_count` + `status = running`, with heartbeat renewal of `locked_at`.

## CSV export

- Management and exception CSV exports neutralize formula injection by prefixing cells that begin with `=`, `+`, `-`, `@`, tab, or CR.

Apply migrations through `20260101000023_security_hardening_followup.sql`:

```bash
npx supabase db push
# or: npx supabase db reset
```

## Verification

```bash
npm run test -- tests/security.test.ts tests/security-fixes.test.ts
npm run simulate:security
```
