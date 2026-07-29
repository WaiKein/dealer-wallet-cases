# System full-feature test runbook

> **Authoritative copy.** Version-controlled under `docs/`. Any `outputs/` export is a delivered snapshot only.

- **Version:** 2026-07-29
- **Baseline commit:** 0e16e7e
- **Machine registry:** `quality/runbook-requirements.yaml`

Each testable behavior has a stable `RB-*` ID. Automation ownership is recorded in the registry (`expectedLayers`, `status`).

## Status legend

| Status | Meaning |
| --- | --- |
| `active` | In scope for automation or already covered |
| `blocked_ui` | Requirement blocked by known UI gap (Plan 2+) |
| `manual_only` | Human / visual check |
| `retired` | Do not reuse |

## 1. Authentication

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-AUTH-LOGIN-VALID` | 1.1 | Valid user can sign in | critical | `active` |

## 2. Case workflow

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-CASE-CREATE-VALID` | 2.1 | Requester creates a valid adjustment case | critical | `active` |
| `RB-CASE-CLAIM` | 2.2 | Agent claims an unassigned group case | critical | `active` |
| `RB-CASE-ACKNOWLEDGE` | 2.3 | Assigned agent acknowledges a case | critical | `active` |
| `RB-CASE-WAIT-REQUESTER` | 2.4 | Case can wait for requester information | high | `active` |
| `RB-CASE-RESOLVE` | 2.5 | Approved case can be resolved after successful execution | critical | `active` |
| `RB-CASE-REOPEN` | 2.6 | Resolved case can be reopened | high | `active` |
| `RB-CASE-CONCURRENT-CLAIM` | 2.7 | Concurrent claims result in a single assignee | critical | `active` |
| `RB-CASE-CONCURRENT-UPDATE` | 2.8 | Concurrent case updates are conflict-safe | high | `active` |
| `RB-CASE-STALE-VERSION` | 2.9 | Stale case version is rejected | high | `active` |
| `RB-CASE-TIMELINE-VISIBLE` | 2.10 | Status history timeline is visible on the case | high | `active` |
| `RB-CASE-AUTO-ASSIGN-GROUP` | 2.11 | Submitted case is auto-assigned to a matching group | critical | `active` |
| `RB-CASE-PENDING-APPROVAL-NOTIFY` | 2.12 | Approver is notified when a case reaches pending approval | high | `active` |

## 3. Approvals

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-APPROVAL-HAPPY` | 3.1 | Approver completes a happy-path approval | critical | `active` |
| `RB-APPROVAL-REJECT` | 3.2 | Approver can reject a pending case | critical | `active` |
| `RB-APPROVAL-DUPLICATE-SUBMIT` | 3.3 | Duplicate approval submission is rejected or idempotent | high | `active` |
| `RB-APPROVAL-DUPLICATE-REQUEST` | 3.4 | Duplicate approval request is blocked | high | `active` |
| `RB-APPROVAL-SEQUENTIAL-TWO-LEVEL` | 3.5 | High-value cases require sequential two-level approval | critical | `active` |
| `RB-APPROVAL-MAKER-CHECKER-REQUESTER` | 3.6 | Requester cannot approve their own case | critical | `active` |
| `RB-APPROVAL-MAKER-CHECKER-AGENT` | 3.7 | Assigned agent cannot approve the case they processed | critical | `active` |
| `RB-APPROVAL-LIMIT-EXCEEDED` | 3.8 | Approval is denied when amount exceeds approver limit | high | `active` |
| `RB-APPROVAL-DELEGATION-VALID` | 3.9 | Valid delegated approval is accepted | high | `active` |
| `RB-APPROVAL-DELEGATION-EXPIRED` | 3.10 | Expired delegation cannot approve | high | `active` |

## 3/15. Administration

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-ADMIN-CATEGORY-CREATE` | 15.21 | Admin creates a category | critical | `blocked_ui` |
| `RB-ADMIN-CATEGORY-EDIT` | 15.21 | Admin edits an existing category | high | `blocked_ui` |
| `RB-UI-SUBCATEGORY-EDIT` | 15.22 | Admin edits an existing subcategory | high | `blocked_ui` |
| `RB-ADMIN-APPROVAL-RULE-CREATE` | 3.11 | Administrator configures an approval rule | critical | `active` |
| `RB-ADMIN-CONFIG-VERSION-RETAINED` | 3.12 | Case retains approval rule version selected at request time | high | `active` |

## 4. SLA

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-SLA-FIRST-RESPONSE-BREACH` | 4.1 | First-response SLA breach is detected | high | `active` |
| `RB-SLA-RESOLUTION-PAUSE-RESUME` | 4.2 | Resolution SLA pauses while waiting for requester | high | `active` |
| `RB-SLA-BREACHED-QUEUE` | 4.3 | Breached cases appear in the agent workspace queue | high | `active` |

## 5. Security boundaries

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-NAV-ADMIN-DENIED` | 1.2 | Non-admin is redirected away from administration | critical | `active` |
| `RB-SEC-CROSS-TEAM-DENY` | 5.1 | Unauthorized cross-team case access is denied | critical | `active` |
| `RB-SEC-CROSS-ORG-DENY` | 5.2 | Unauthorized cross-organisation access is denied | critical | `active` |
| `RB-SEC-INTERNAL-COMMENT-HIDDEN` | 5.3 | Internal comments are hidden from requesters | high | `active` |

## 6. Reliability and jobs

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-JOB-RETRY` | 6.1 | Failed background job is retried | high | `active` |
| `RB-JOB-DEAD-LETTER` | 6.2 | Exhausted job moves to dead-letter | high | `active` |
| `RB-API-IDEMPOTENCY-KEY` | 6.3 | Duplicate Idempotency-Key returns consistent result | critical | `active` |

## 7. Wallet and integration

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-WALLET-SUCCESS` | 7.1 | Mock wallet execute succeeds | critical | `active` |
| `RB-WALLET-TEMP-FAILURE` | 7.2 | Temporary wallet failure is retryable | high | `active` |
| `RB-WALLET-RETRY-SUCCESS` | 7.3 | Wallet retries then succeeds for the same key | high | `active` |
| `RB-WALLET-UNKNOWN-INQUIRY` | 7.4 | Uncertain timeout requires status inquiry | critical | `active` |
| `RB-WALLET-EXEC-AFTER-APPROVAL` | 7.5 | Approval queues wallet execution to SUCCEEDED | critical | `active` |
| `RB-WALLET-EXEC-IDEMPOTENT` | 7.6 | Duplicate wallet execution is idempotent | critical | `active` |
| `RB-WALLET-CONCURRENT-WORKERS` | 7.7 | Concurrent integration workers leave a single success | high | `active` |
| `RB-WALLET-TIMEOUT-SAFE-RETRY` | 7.8 | Confirmed non-processing timeout allows safe retry | high | `active` |

## 8. Exceptions

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-EXCEPTION-PERMANENT-FAILURE` | 8.1 | Permanent wallet failure creates an operations exception | critical | `active` |
| `RB-EXCEPTION-RESOLVE` | 8.2 | Operations can resolve an operational exception | critical | `active` |
| `RB-EXCEPTION-RETRY-UI` | 8.3 | Team lead can retry a retryable failure from exceptions UI | high | `active` |

## 9. Email and notifications

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-EMAIL-OUTBOX-DELIVER` | 9.1 | Email outbox row is created when flag enabled | high | `active` |
| `RB-EMAIL-DEDUPE` | 9.2 | Duplicate email notifications are suppressed | high | `active` |

## 10. Saved views

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-VIEW-LIST-CREATE-PERSONAL` | 10.1 | User can list system views and create a personal view | high | `active` |
| `RB-VIEW-TEAM-SHARED` | 10.2 | Team member can create and load a team-scoped view | high | `active` |
| `RB-VIEW-CROSS-ORG-DENY` | 10.3 | Cross-organisation saved view access is denied | critical | `active` |

## 11. Management dashboard

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-DASHBOARD-KPI-LOAD` | 11.1 | Authorised user can load management dashboard KPIs | high | `active` |
| `RB-DASHBOARD-KPI-VALUE` | 11.2 | Dashboard KPI values reflect submitted cases | high | `active` |
| `RB-DASHBOARD-CSV-EXPORT` | 11.3 | Management dashboard CSV export downloads safely | medium | `blocked_ui` |

## 12. Manual UI checks

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-UI-LAYOUT-RESPONSIVE` | 12.1 | Primary pages remain usable on desktop and mobile widths | medium | `manual_only` |

## 15. Admin navigation (UI remediation)

| ID | Section | Title | Priority | Status |
| --- | --- | --- | --- | --- |
| `RB-NAV-ADMIN-CATEGORIES` | 15.1 | Admin locates Categories from overview or navigation | critical | `blocked_ui` |

## Traceability

- Simulator scenarios: `tools/case-simulator/scenarios/*.yaml` (`id: SIM-NNN`, `runbookRefs`)
- Playwright: `e2e/**/*.spec.ts` titles include `[RB-…]`
- Sync gate: `npm run test:runbook-sync`
- Coverage: `npm run generate:runbook-coverage` → `tools/case-simulator/reports/runbook-coverage.*`
