# System full-feature test runbook

> **Authoritative copy.** Version-controlled under `docs/`. Any `outputs/` export is a delivered snapshot only.

- **Version:** 2026-07-29
- **Structure:** Shared catalogues + UAT journeys (step 2 scaffold)
- **Machine registry:** `quality/runbook-requirements.yaml`

Requirements keep stable `RB-*` anchors inside shared **UAT journeys**. Procedure levels: `index_only` → `draft` → `detailed`. Most requirements are now `detailed` with field-level steps; regenerate via `npm run generate:uat-journeys`.

## Procedure levels

| Level | Meaning |
| --- | --- |
| `index_only` | ID, title and anchor only |
| `draft` | Journey subsection present; not yet fully executable without tester invention |
| `detailed` | Complete actor, route, data, step/expected pairs, final state and cleanup |

## Status legend

| Status | Meaning |
| --- | --- |
| `active` | In scope for automation or already covered |
| `blocked_ui` | Requirement blocked by known UI gap (Plan 2+) |
| `manual_only` | Human / visual check |
| `retired` | Do not reuse |

## Catalogues

### Actor catalogue

| Actor ID | Login | Role | Password |
| --- | --- | --- | --- |
| `ACTOR-ADMIN` | `admin@example.com` | Admin | `Password123!` |
| `ACTOR-REQUESTER` | `requester@example.com` | Requester | `Password123!` |
| `ACTOR-AGENT` | `agent@example.com` | Operations agent | `Password123!` |
| `ACTOR-APPROVER` | `approver@example.com` | Approver | `Password123!` |
| `ACTOR-TEAMLEAD` | `teamlead@example.com` | Team lead | `Password123!` |

### Test-data catalogue

#### `TD-SEED-USERS`

- Use seeded accounts from the actor catalogue.
- Do not create ad-hoc users during UAT unless the journey says so.

#### `TD-CATEGORY-01`

| Field | Initial value | Edited value |
| --- | --- | --- |
| Code | `UAT-CAT-01` | Unchanged |
| Name | `UAT Category 01` | `UAT Category 01 Edited` |
| Active | Checked | Unchecked during cleanup |
| Change reason | `UAT create category` | `UAT edit category` |

#### `TD-CASE-HAPPY-01`

| Field | Value |
| --- | --- |
| Title | `UAT Happy Path Case` |
| Category | Wallet adjustments |
| Subcategory | Duplicate credit |
| Adjustment type | Credit |
| Amount | `210.00` |

#### `TD-CASE-EXCEPTION-01`

| Field | Value |
| --- | --- |
| Title prefix | `UAT Exception Path` |
| Amount | `125.50` |

#### `TD-APPROVAL-CONTROLS-01`

| Field | Value |
| --- | --- |
| Rule code | `UAT_RULE_01` |
| High-value amount | Per sequential-approval scenario |

#### `TD-SLA-JOBS-01`

| Field | Value |
| --- | --- |
| Clock control | test-control clock advance |
| Job drain | `/api/jobs/tick` via simulator/test-control |

#### `TD-WALLET-01`

| Field | Value |
| --- | --- |
| Provider | mock wallet |
| Success outcome | `SUCCESS` |
| Temp failure | `TEMPORARY_FAILURE` then retry |

#### `TD-VIEW-01` / `TD-DASHBOARD-01`

| Field | Value |
| --- | --- |
| Personal view name | `UAT Personal View` |
| Dashboard route | `/dashboard/management` |

#### `TD-SECURITY-01`

- Use cross-team / cross-org fixtures from simulator scenarios.
- Internal comments must remain hidden from requesters.

### Common-result catalogue

| Result ID | Meaning |
| --- | --- |
| `ER-SAVE-01` | Success notification appears |
| `ER-AUDIT-01` | Actor, timestamp, reason, old/new values recorded where applicable |
| `ER-DEACTIVATE-01` | Record remains stored but is excluded from active selection |
| `ER-DENY-01` | Action is rejected; no forbidden side effects persist |

## Journey index

| Journey | Title | Actor | Start page | Requirements |
| --- | --- | --- | --- | ---: |
| [`UAT-AUTH-ACCESS-01`](#uat-auth-access-01) | Authentication and access | `ACTOR-ADMIN` | `/login` | 2 |
| [`UAT-ADMIN-CATEGORIES-01`](#uat-admin-categories-01) | Category maintenance | `ACTOR-ADMIN` | `/admin/categories` | 4 |
| [`UAT-CASE-HAPPY-01`](#uat-case-happy-01) | Case happy path | `ACTOR-REQUESTER` | `/cases/new` | 8 |
| [`UAT-CASE-EXCEPTION-01`](#uat-case-exception-01) | Case exception and concurrency path | `ACTOR-AGENT` | `/cases` | 5 |
| [`UAT-APPROVAL-CONTROLS-01`](#uat-approval-controls-01) | Approval controls | `ACTOR-APPROVER` | `/cases` | 11 |
| [`UAT-SLA-JOBS-01`](#uat-sla-jobs-01) | SLA and background jobs | `ACTOR-AGENT` | `/workspace` | 8 |
| [`UAT-WALLET-EXCEPTIONS-01`](#uat-wallet-exceptions-01) | Wallet execution and exceptions | `ACTOR-AGENT` | `/operations/exceptions` | 11 |
| [`UAT-VIEWS-DASHBOARD-01`](#uat-views-dashboard-01) | Views and management dashboard | `ACTOR-AGENT` | `/cases` | 6 |
| [`UAT-SECURITY-01`](#uat-security-01) | Security boundaries | `ACTOR-AGENT` | `/cases` | 4 |

## Requirement index

| ID | Journey | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-AUTH-LOGIN-VALID`](#rb-auth-login-valid) | `UAT-AUTH-ACCESS-01` | Valid user can sign in | critical | `active` | `detailed` |
| [`RB-NAV-ADMIN-DENIED`](#rb-nav-admin-denied) | `UAT-AUTH-ACCESS-01` | Non-admin is redirected away from administration | critical | `active` | `detailed` |
| [`RB-NAV-ADMIN-CATEGORIES`](#rb-nav-admin-categories) | `UAT-ADMIN-CATEGORIES-01` | Admin locates Categories from overview or navigation | critical | `blocked_ui` | `detailed` |
| [`RB-ADMIN-CATEGORY-CREATE`](#rb-admin-category-create) | `UAT-ADMIN-CATEGORIES-01` | Admin creates a category | critical | `blocked_ui` | `detailed` |
| [`RB-ADMIN-CATEGORY-EDIT`](#rb-admin-category-edit) | `UAT-ADMIN-CATEGORIES-01` | Admin edits an existing category | high | `blocked_ui` | `detailed` |
| [`RB-UI-SUBCATEGORY-EDIT`](#rb-ui-subcategory-edit) | `UAT-ADMIN-CATEGORIES-01` | Admin edits an existing subcategory | high | `blocked_ui` | `detailed` |
| [`RB-CASE-CREATE-VALID`](#rb-case-create-valid) | `UAT-CASE-HAPPY-01` | Requester creates a valid adjustment case | critical | `active` | `detailed` |
| [`RB-CASE-CLAIM`](#rb-case-claim) | `UAT-CASE-HAPPY-01` | Agent claims an unassigned group case | critical | `active` | `detailed` |
| [`RB-CASE-ACKNOWLEDGE`](#rb-case-acknowledge) | `UAT-CASE-HAPPY-01` | Assigned agent acknowledges a case | critical | `active` | `detailed` |
| [`RB-CASE-WAIT-REQUESTER`](#rb-case-wait-requester) | `UAT-CASE-EXCEPTION-01` | Case can wait for requester information | high | `active` | `detailed` |
| [`RB-CASE-RESOLVE`](#rb-case-resolve) | `UAT-CASE-HAPPY-01` | Approved case can be resolved after successful execution | critical | `active` | `detailed` |
| [`RB-CASE-REOPEN`](#rb-case-reopen) | `UAT-CASE-EXCEPTION-01` | Resolved case can be reopened | high | `active` | `detailed` |
| [`RB-CASE-CONCURRENT-CLAIM`](#rb-case-concurrent-claim) | `UAT-CASE-EXCEPTION-01` | Concurrent claims result in a single assignee | critical | `active` | `detailed` |
| [`RB-CASE-CONCURRENT-UPDATE`](#rb-case-concurrent-update) | `UAT-CASE-EXCEPTION-01` | Concurrent case updates are conflict-safe | high | `active` | `detailed` |
| [`RB-CASE-STALE-VERSION`](#rb-case-stale-version) | `UAT-CASE-EXCEPTION-01` | Stale case version is rejected | high | `active` | `detailed` |
| [`RB-CASE-TIMELINE-VISIBLE`](#rb-case-timeline-visible) | `UAT-CASE-HAPPY-01` | Status history timeline is visible on the case | high | `active` | `detailed` |
| [`RB-CASE-AUTO-ASSIGN-GROUP`](#rb-case-auto-assign-group) | `UAT-CASE-HAPPY-01` | Submitted case is auto-assigned to a matching group | critical | `active` | `detailed` |
| [`RB-CASE-PENDING-APPROVAL-NOTIFY`](#rb-case-pending-approval-notify) | `UAT-CASE-HAPPY-01` | Approver is notified when a case reaches pending approval | high | `active` | `detailed` |
| [`RB-APPROVAL-HAPPY`](#rb-approval-happy) | `UAT-CASE-HAPPY-01` | Approver completes a happy-path approval | critical | `active` | `detailed` |
| [`RB-APPROVAL-REJECT`](#rb-approval-reject) | `UAT-APPROVAL-CONTROLS-01` | Approver can reject a pending case | critical | `active` | `detailed` |
| [`RB-APPROVAL-DUPLICATE-SUBMIT`](#rb-approval-duplicate-submit) | `UAT-APPROVAL-CONTROLS-01` | Duplicate approval submission is rejected or idempotent | high | `active` | `detailed` |
| [`RB-APPROVAL-DUPLICATE-REQUEST`](#rb-approval-duplicate-request) | `UAT-APPROVAL-CONTROLS-01` | Duplicate approval request is blocked | high | `active` | `detailed` |
| [`RB-APPROVAL-SEQUENTIAL-TWO-LEVEL`](#rb-approval-sequential-two-level) | `UAT-APPROVAL-CONTROLS-01` | High-value cases require sequential two-level approval | critical | `active` | `detailed` |
| [`RB-APPROVAL-MAKER-CHECKER-REQUESTER`](#rb-approval-maker-checker-requester) | `UAT-APPROVAL-CONTROLS-01` | Requester cannot approve their own case | critical | `active` | `detailed` |
| [`RB-APPROVAL-MAKER-CHECKER-AGENT`](#rb-approval-maker-checker-agent) | `UAT-APPROVAL-CONTROLS-01` | Assigned agent cannot approve the case they processed | critical | `active` | `detailed` |
| [`RB-APPROVAL-LIMIT-EXCEEDED`](#rb-approval-limit-exceeded) | `UAT-APPROVAL-CONTROLS-01` | Approval is denied when amount exceeds approver limit | high | `active` | `detailed` |
| [`RB-APPROVAL-DELEGATION-VALID`](#rb-approval-delegation-valid) | `UAT-APPROVAL-CONTROLS-01` | Valid delegated approval is accepted | high | `active` | `detailed` |
| [`RB-APPROVAL-DELEGATION-EXPIRED`](#rb-approval-delegation-expired) | `UAT-APPROVAL-CONTROLS-01` | Expired delegation cannot approve | high | `active` | `detailed` |
| [`RB-ADMIN-APPROVAL-RULE-CREATE`](#rb-admin-approval-rule-create) | `UAT-APPROVAL-CONTROLS-01` | Administrator configures an approval rule | critical | `active` | `detailed` |
| [`RB-ADMIN-CONFIG-VERSION-RETAINED`](#rb-admin-config-version-retained) | `UAT-APPROVAL-CONTROLS-01` | Case retains approval rule version selected at request time | high | `active` | `detailed` |
| [`RB-SLA-FIRST-RESPONSE-BREACH`](#rb-sla-first-response-breach) | `UAT-SLA-JOBS-01` | First-response SLA breach is detected | high | `active` | `detailed` |
| [`RB-SLA-RESOLUTION-PAUSE-RESUME`](#rb-sla-resolution-pause-resume) | `UAT-SLA-JOBS-01` | Resolution SLA pauses while waiting for requester | high | `active` | `detailed` |
| [`RB-SLA-BREACHED-QUEUE`](#rb-sla-breached-queue) | `UAT-SLA-JOBS-01` | Breached cases appear in the agent workspace queue | high | `active` | `detailed` |
| [`RB-SEC-CROSS-TEAM-DENY`](#rb-sec-cross-team-deny) | `UAT-SECURITY-01` | Unauthorized cross-team case access is denied | critical | `active` | `detailed` |
| [`RB-SEC-CROSS-ORG-DENY`](#rb-sec-cross-org-deny) | `UAT-SECURITY-01` | Unauthorized cross-organisation access is denied | critical | `active` | `detailed` |
| [`RB-SEC-INTERNAL-COMMENT-HIDDEN`](#rb-sec-internal-comment-hidden) | `UAT-SECURITY-01` | Internal comments are hidden from requesters | high | `active` | `detailed` |
| [`RB-JOB-RETRY`](#rb-job-retry) | `UAT-SLA-JOBS-01` | Failed background job is retried | high | `active` | `detailed` |
| [`RB-JOB-DEAD-LETTER`](#rb-job-dead-letter) | `UAT-SLA-JOBS-01` | Exhausted job moves to dead-letter | high | `active` | `detailed` |
| [`RB-API-IDEMPOTENCY-KEY`](#rb-api-idempotency-key) | `UAT-SLA-JOBS-01` | Duplicate Idempotency-Key returns consistent result | critical | `active` | `detailed` |
| [`RB-WALLET-SUCCESS`](#rb-wallet-success) | `UAT-WALLET-EXCEPTIONS-01` | Mock wallet execute succeeds | critical | `active` | `detailed` |
| [`RB-WALLET-TEMP-FAILURE`](#rb-wallet-temp-failure) | `UAT-WALLET-EXCEPTIONS-01` | Temporary wallet failure is retryable | high | `active` | `detailed` |
| [`RB-WALLET-RETRY-SUCCESS`](#rb-wallet-retry-success) | `UAT-WALLET-EXCEPTIONS-01` | Wallet retries then succeeds for the same key | high | `active` | `detailed` |
| [`RB-WALLET-UNKNOWN-INQUIRY`](#rb-wallet-unknown-inquiry) | `UAT-WALLET-EXCEPTIONS-01` | Uncertain timeout requires status inquiry | critical | `active` | `detailed` |
| [`RB-WALLET-EXEC-AFTER-APPROVAL`](#rb-wallet-exec-after-approval) | `UAT-WALLET-EXCEPTIONS-01` | Approval queues wallet execution to SUCCEEDED | critical | `active` | `detailed` |
| [`RB-WALLET-EXEC-IDEMPOTENT`](#rb-wallet-exec-idempotent) | `UAT-WALLET-EXCEPTIONS-01` | Duplicate wallet execution is idempotent | critical | `active` | `detailed` |
| [`RB-WALLET-CONCURRENT-WORKERS`](#rb-wallet-concurrent-workers) | `UAT-WALLET-EXCEPTIONS-01` | Concurrent integration workers leave a single success | high | `active` | `detailed` |
| [`RB-WALLET-TIMEOUT-SAFE-RETRY`](#rb-wallet-timeout-safe-retry) | `UAT-WALLET-EXCEPTIONS-01` | Confirmed non-processing timeout allows safe retry | high | `active` | `detailed` |
| [`RB-EXCEPTION-PERMANENT-FAILURE`](#rb-exception-permanent-failure) | `UAT-WALLET-EXCEPTIONS-01` | Permanent wallet failure creates an operations exception | critical | `active` | `detailed` |
| [`RB-EXCEPTION-RESOLVE`](#rb-exception-resolve) | `UAT-WALLET-EXCEPTIONS-01` | Operations can resolve an operational exception | critical | `active` | `detailed` |
| [`RB-EXCEPTION-RETRY-UI`](#rb-exception-retry-ui) | `UAT-WALLET-EXCEPTIONS-01` | Team lead can retry a retryable failure from exceptions UI | high | `active` | `detailed` |
| [`RB-EMAIL-OUTBOX-DELIVER`](#rb-email-outbox-deliver) | `UAT-SLA-JOBS-01` | Email outbox row is created when flag enabled | high | `active` | `detailed` |
| [`RB-EMAIL-DEDUPE`](#rb-email-dedupe) | `UAT-SLA-JOBS-01` | Duplicate email notifications are suppressed | high | `active` | `detailed` |
| [`RB-VIEW-LIST-CREATE-PERSONAL`](#rb-view-list-create-personal) | `UAT-VIEWS-DASHBOARD-01` | User can list system views and create a personal view | high | `active` | `detailed` |
| [`RB-VIEW-TEAM-SHARED`](#rb-view-team-shared) | `UAT-VIEWS-DASHBOARD-01` | Team member can create and load a team-scoped view | high | `active` | `detailed` |
| [`RB-VIEW-CROSS-ORG-DENY`](#rb-view-cross-org-deny) | `UAT-VIEWS-DASHBOARD-01` | Cross-organisation saved view access is denied | critical | `active` | `detailed` |
| [`RB-DASHBOARD-KPI-LOAD`](#rb-dashboard-kpi-load) | `UAT-VIEWS-DASHBOARD-01` | Authorised user can load management dashboard KPIs | high | `active` | `detailed` |
| [`RB-DASHBOARD-KPI-VALUE`](#rb-dashboard-kpi-value) | `UAT-VIEWS-DASHBOARD-01` | Dashboard KPI values reflect submitted cases | high | `active` | `detailed` |
| [`RB-DASHBOARD-CSV-EXPORT`](#rb-dashboard-csv-export) | `UAT-VIEWS-DASHBOARD-01` | Management dashboard CSV export downloads safely | medium | `blocked_ui` | `detailed` |
| [`RB-UI-LAYOUT-RESPONSIVE`](#rb-ui-layout-responsive) | `UAT-SECURITY-01` | Primary pages remain usable on desktop and mobile widths | medium | `manual_only` | `detailed` |

## UAT journeys

<a id="uat-auth-access-01"></a>

## UAT-AUTH-ACCESS-01 — Authentication and access

**Actor:** `ACTOR-ADMIN`  
**Starting page:** `/login`  
**Shared data:** `TD-SEED-USERS`

### Shared preconditions

- Sign in as `ACTOR-ADMIN` from the actor catalogue.
- Open `/login`.
- Local Supabase + app are running with seed data.
- Confirm shared test-data codes from this journey are free or cleaned from prior runs.

### Shared cleanup

- Deactivate or delete journey-created rows where the product supports it.
- Prefer `ER-DEACTIVATE-01` for master data that must remain auditable.
- Leave seeded baseline users and org config unchanged.

<a id="rb-auth-login-valid"></a>

### RB-AUTH-LOGIN-VALID — Valid user can sign in

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-AUTH-ACCESS-01`

**Role:** Any seeded user (e.g. ACTOR-ADMIN / admin@example.com)  
**Page:** `/login`

#### Preconditions

- Local Supabase and app are running with seed data (TD-SEED-USERS).
- Browser session is signed out.

#### Test data

| Field | Value |
| --- | --- |
| Email | admin@example.com |
| Password | Password123! |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Open /login. Enter Email admin@example.com and Password Password123!. Click Sign in. | Redirect to /dashboard (or /cases / /workspace / /admin for the role). Header shows the user's name and role. No error banner. |
| 2 | Repeat sign-in for requester@example.com and agent@example.com. | Each valid seeded account reaches an authenticated landing page without credential errors (ER-SAVE-01 not applicable; ER-DENY-01 must not occur). |

#### Expected final state

- Tester is signed in with a valid session.

#### Cleanup

1. Sign out via header Sign out button; confirm redirect to /login.

<a id="rb-nav-admin-denied"></a>

### RB-NAV-ADMIN-DENIED — Non-admin is redirected away from administration

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-AUTH-ACCESS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/admin`

#### Preconditions

- TD-SEED-USERS: agent@example.com exists and is not an admin.
- Signed out before starting.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Sign in as agent@example.com / Password123!. Confirm header nav does not offer Admin (or it is absent for non-admins). | Agent workspace loads; no Administration console access in normal nav. |
| 2 | Manually navigate to /admin. | Browser redirects away from administration (typically to /dashboard). ER-DENY-01: no admin configuration UI is rendered. |

#### Expected final state

- Non-admin cannot reach /admin content.

#### Cleanup

1. Sign out.

<a id="uat-admin-categories-01"></a>

## UAT-ADMIN-CATEGORIES-01 — Category maintenance

**Actor:** `ACTOR-ADMIN`  
**Starting page:** `/admin/categories`  
**Shared data:** `TD-CATEGORY-01`

### Shared preconditions

- Sign in as `ACTOR-ADMIN` from the actor catalogue.
- Open `/admin/categories`.
- Local Supabase + app are running with seed data.
- Confirm shared test-data codes from this journey are free or cleaned from prior runs.

### Shared cleanup

- Deactivate or delete journey-created rows where the product supports it.
- Prefer `ER-DEACTIVATE-01` for master data that must remain auditable.
- Leave seeded baseline users and org config unchanged.

<a id="rb-nav-admin-categories"></a>

### RB-NAV-ADMIN-CATEGORIES — Admin locates Categories from overview or navigation

**Priority:** critical  
**Status:** `blocked_ui`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-ADMIN-CATEGORIES-01`

> **Blocked UI:** procedure documents the intended path. Do not mark the requirement complete until the UI gap is closed.

**Role:** ACTOR-ADMIN (admin@example.com)  
**Page:** `/admin`

#### Preconditions

- Signed in as admin@example.com.
- TD-CATEGORY-01 codes are free or from a prior cleanup run.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | In header nav, click Admin. Confirm URL is /admin and page title "Administration". | Overview grid shows card link "Categories" with body "Case taxonomy categories." |
| 2 | Click the Categories card (or admin sidebar link Categories). | URL is /admin/categories. Page shows Search and Status filter with Apply, plus Create category form. |
| 3 | Use admin sidebar Subcategories link, then return via Categories. | Both routes load under Administration layout without error. |

#### Expected final state

- Admin can reach /admin/categories from overview and sidebar.

#### Cleanup

1. Sign out.

<a id="rb-admin-category-create"></a>

### RB-ADMIN-CATEGORY-CREATE — Admin creates a category

**Priority:** critical  
**Status:** `blocked_ui`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-ADMIN-CATEGORIES-01`

> **Blocked UI:** procedure documents the intended path. Do not mark the requirement complete until the UI gap is closed.

**Role:** ACTOR-ADMIN (admin@example.com)  
**Page:** `/admin/categories`

#### Preconditions

- Signed in as admin@example.com.
- Code UAT-CAT-01 from TD-CATEGORY-01 is not already an active duplicate.

#### Test data

| Field | Value |
| --- | --- |
| Code | UAT-CAT-01 |
| Name | UAT Category 01 |
| Active | checked |
| Change reason | UAT create category |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Open /admin/categories. | Create category form is visible with fields Code, Name, Active, Change reason and submit "Create category". |
| 2 | Fill Code UAT-CAT-01, Name UAT Category 01, leave Active checked, Change reason UAT create category. Click Create category. | Page refreshes; new row UAT Category 01 (UAT-CAT-01) appears in the list with Active badge. ER-SAVE-01: save succeeds without validation error. |
| 3 | Search UAT-CAT-01 in Search field, Status Active, click Apply. | Filtered list includes the created category. |

#### Expected final state

- Category UAT-CAT-01 exists and is Active in admin list.
- ER-AUDIT-01: change_reason UAT create category was required and persisted server-side.

#### Cleanup

1. Edit row: uncheck Active, Change reason UAT cleanup deactivate, Save (ER-DEACTIVATE-01).

<a id="rb-admin-category-edit"></a>

### RB-ADMIN-CATEGORY-EDIT — Admin edits an existing category

**Priority:** high  
**Status:** `blocked_ui`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-ADMIN-CATEGORIES-01`

> **Blocked UI:** procedure documents the intended path. Do not mark the requirement complete until the UI gap is closed.

**Role:** ACTOR-ADMIN (admin@example.com)  
**Page:** `/admin/categories`

#### Preconditions

- RB-ADMIN-CATEGORY-CREATE completed: UAT-CAT-01 exists and is Active.

#### Test data

| Field | Initial | Edited |
| --- | --- | --- |
| Name | UAT Category 01 | UAT Category 01 Edited |
| Change reason | — | UAT edit category |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | On /admin/categories, locate row UAT Category 01 (UAT-CAT-01). Open its Edit form (title Edit UAT Category 01). | Inline edit form shows Code, Name, Active checkbox, Change reason, Save button. |
| 2 | Change Name to UAT Category 01 Edited. Enter Change reason UAT edit category. Click Save. | List row title updates to UAT Category 01 Edited. Active badge unchanged. ER-SAVE-01. |
| 3 | Verify ER-AUDIT-01: change_reason was mandatory on save; values persist after refresh. | Edited name remains after browser refresh. Configuration audit captured with change_reason UAT edit category (see Organisation admin Configuration history pattern). |

#### Expected final state

- UAT-CAT-01 name is UAT Category 01 Edited.

#### Cleanup

1. Deactivate: uncheck Active, Change reason UAT cleanup deactivate, confirm deactivation dialog, Save (ER-DEACTIVATE-01).

<a id="rb-ui-subcategory-edit"></a>

### RB-UI-SUBCATEGORY-EDIT — Admin edits an existing subcategory

**Priority:** high  
**Status:** `blocked_ui`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-ADMIN-CATEGORIES-01`

> **Blocked UI:** procedure documents the intended path. Do not mark the requirement complete until the UI gap is closed.

**Role:** ACTOR-ADMIN (admin@example.com)  
**Page:** `/admin/subcategories`

#### Preconditions

- Wallet adjustments category exists from seed.
- Note: subcategory list currently has Create + list only (no inline Edit form); blocked_ui for edit until remediated.

#### Test data

| Field | Value |
| --- | --- |
| Category | Wallet adjustments |
| Code | UAT-SUB-01 |
| Name | UAT Subcategory 01 |
| Active | checked |
| Change reason | UAT create subcategory |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Open /admin/subcategories. In Create subcategory form select Category Wallet adjustments, Code UAT-SUB-01, Name UAT Subcategory 01, Active checked, Change reason UAT create subcategory. Click Create subcategory. | New row UAT Subcategory 01 (UAT-SUB-01) appears with Active badge. ER-SAVE-01. |
| 2 | When inline Edit subcategory form is available (mirrors Categories Edit pattern): open Edit UAT Subcategory 01, change Name to UAT Subcategory 01 Edited, Change reason UAT edit subcategory, click Save. | Row updates; ER-AUDIT-01 records change_reason. Until UI ships, skip and track as blocked_ui. |
| 3 | Search UAT-SUB-01, Status Active, Apply — confirm row visible. | Subcategory discoverable via admin filters. |

#### Expected final state

- UAT-SUB-01 exists (created); edit verified when Edit form is present.

#### Cleanup

1. When edit UI exists: deactivate with Change reason UAT cleanup deactivate (ER-DEACTIVATE-01).

<a id="uat-case-happy-01"></a>

## UAT-CASE-HAPPY-01 — Case happy path

**Actor:** `ACTOR-REQUESTER`  
**Starting page:** `/cases/new`  
**Shared data:** `TD-CASE-HAPPY-01`

### Shared preconditions

- Sign in as `ACTOR-REQUESTER` from the actor catalogue.
- Open `/cases/new`.
- Local Supabase + app are running with seed data.
- Confirm shared test-data codes from this journey are free or cleaned from prior runs.

### Shared cleanup

- Deactivate or delete journey-created rows where the product supports it.
- Prefer `ER-DEACTIVATE-01` for master data that must remain auditable.
- Leave seeded baseline users and org config unchanged.

<a id="rb-case-create-valid"></a>

### RB-CASE-CREATE-VALID — Requester creates a valid adjustment case

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-CASE-HAPPY-01`

**Role:** ACTOR-REQUESTER (requester@example.com)  
**Page:** `/cases/new`

#### Preconditions

- Signed in as requester@example.com.
- Wallet adjustments / Duplicate credit subcategory active in seed.

#### Test data

| Field | Value |
| --- | --- |
| Title | UAT Happy Path Case |
| Description | UAT duplicate credit adjustment |
| Adjustment amount | 210.00 |
| Adjustment type | Credit |
| Category | Wallet adjustments |
| Subcategory | Duplicate credit |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Open /cases/new (header New Case or direct URL). | Case creation form with Title, Description, amount, type, category, subcategory. |
| 2 | Enter TD-CASE-HAPPY-01 field values from data table. | All required fields accept input; subcategory options load after category. |
| 3 | Click Submit case. | Redirect to /cases/{uuid}. Case detail shows submitted title and Submitted status. ER-SAVE-01. |

#### Expected final state

- Case UAT Happy Path Case exists in Submitted status.

#### Cleanup

1. Leave case for downstream happy-path steps or resolve in later RBs.

<a id="rb-case-auto-assign-group"></a>

### RB-CASE-AUTO-ASSIGN-GROUP — Submitted case is auto-assigned to a matching group

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-CASE-HAPPY-01`

**Role:** ACTOR-REQUESTER (requester@example.com)  
**Page:** `/cases/new`

#### Preconditions

- Assignment rules route Wallet adjustments / Duplicate credit to Wallet Operations group (seed).

#### Test data

| Field | Value |
| --- | --- |
| Category | Wallet adjustments |
| Subcategory | Duplicate credit |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Create case per RB-CASE-CREATE-VALID (Duplicate credit, amount 125.50 or 210.00). | Case detail page loads after submit. |
| 2 | On case detail, locate assignment / group panel. | Assigned group shows "Wallet Operations" (or seeded matching group name). Case is group-owned before individual claim. |

#### Expected final state

- Case is assigned to Wallet Operations group, assignee empty until claim.

#### Cleanup

1. Continue happy path or leave for agent claim test.

<a id="rb-case-claim"></a>

### RB-CASE-CLAIM — Agent claims an unassigned group case

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-CASE-HAPPY-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/workspace`

#### Preconditions

- Unassigned group case from RB-CASE-CREATE-VALID / RB-CASE-AUTO-ASSIGN-GROUP exists.
- agent@example.com is member of Wallet Operations (Sam Operations).

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Sign in as agent@example.com. Open /workspace. Section Unassigned cases for my groups lists the case. | Target case title visible in unassigned queue. |
| 2 | Open the case from workspace link. Click Claim case. | Assigned agent shows "Sam Operations". Claim button no longer available to others. |

#### Expected final state

- Case assigned to agent@example.com (Sam Operations).

#### Cleanup

1. Sign out agent.

<a id="rb-case-acknowledge"></a>

### RB-CASE-ACKNOWLEDGE — Assigned agent acknowledges a case

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-CASE-HAPPY-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/cases/{id}`

#### Preconditions

- RB-CASE-CLAIM completed: case assigned to agent.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | On claimed case detail, click Acknowledge. | Banner or message "Case acknowledged by agent." ER-SAVE-01. |
| 2 | Refresh page. | Acknowledged state persists; workflow actions for agent become available. |

#### Expected final state

- Case acknowledged by assigned agent.

#### Cleanup

1. Proceed to approval path or sign out.

<a id="rb-approval-happy"></a>

### RB-APPROVAL-HAPPY — Approver completes a happy-path approval

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-CASE-HAPPY-01`

**Role:** ACTOR-APPROVER (approver@example.com)  
**Page:** `/cases/{id}`

#### Preconditions

- Case is Pending Approval (agent moved Under Review → Pending Approval).

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Sign in as approver@example.com. Open /cases and open the pending case. | Status Pending Approval; approval panel visible. |
| 2 | Click Move to Approved, then Confirm status change in dialog. | Status becomes Approved. ER-SAVE-01; audit timeline records Pending Approval → Approved. |

#### Expected final state

- Case status Approved; wallet execution job queued.

#### Cleanup

1. Sign out approver.

<a id="rb-case-pending-approval-notify"></a>

### RB-CASE-PENDING-APPROVAL-NOTIFY — Approver is notified when a case reaches pending approval

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-CASE-HAPPY-01`

**Role:** ACTOR-APPROVER (approver@example.com)  
**Page:** `/cases/{id}`

#### Preconditions

- Agent transitioned case to Pending Approval on a case requiring approval.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | As agent@example.com: Move to Under Review → Confirm status change, then Move to Pending Approval → Confirm status change. | Case status Pending Approval within 15s. |
| 2 | Sign out agent. Sign in as approver@example.com. Click Notifications bell / panel. | In-app notification "Approval requested" for the case is visible (ER-SAVE-01 for notification row). |

#### Expected final state

- Approver has unread Approval requested notification.

#### Cleanup

1. Sign out approver.

<a id="rb-case-resolve"></a>

### RB-CASE-RESOLVE — Approved case can be resolved after successful execution

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-CASE-HAPPY-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/cases/{id}`

#### Preconditions

- Case Approved and wallet mock configured for SUCCESS.
- Jobs drained so integration shows Succeeded.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Configure wallet mock SUCCESS (test-control or simulator). POST /api/jobs/tick twice to drain execution jobs. | Integration execution status Succeeded on case detail. |
| 2 | As agent@example.com open case. Click Move to Resolved → Confirm status change (add resolution notes if prompted). | Status Resolved. ER-SAVE-01. |

#### Expected final state

- Case Resolved after successful wallet execution.

#### Cleanup

1. Sign out.

<a id="rb-case-timeline-visible"></a>

### RB-CASE-TIMELINE-VISIBLE — Status history timeline is visible on the case

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-CASE-HAPPY-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/cases/{id}`

#### Preconditions

- Case progressed through submit → review → approval → resolved.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Open resolved case detail. Scroll to Status history section. | Heading "Status history" visible. |
| 2 | Review timeline entries. | Entries include Submitted → Under Review, Pending Approval → Approved, Approved → Resolved (and intermediate transitions). ER-AUDIT-01. |

#### Expected final state

- Full status history visible on case.

#### Cleanup

1. Sign out.

<a id="uat-case-exception-01"></a>

## UAT-CASE-EXCEPTION-01 — Case exception and concurrency path

**Actor:** `ACTOR-AGENT`  
**Starting page:** `/cases`  
**Shared data:** `TD-CASE-EXCEPTION-01`

### Shared preconditions

- Sign in as `ACTOR-AGENT` from the actor catalogue.
- Open `/cases`.
- Local Supabase + app are running with seed data.
- Confirm shared test-data codes from this journey are free or cleaned from prior runs.

### Shared cleanup

- Deactivate or delete journey-created rows where the product supports it.
- Prefer `ER-DEACTIVATE-01` for master data that must remain auditable.
- Leave seeded baseline users and org config unchanged.

<a id="rb-case-wait-requester"></a>

### RB-CASE-WAIT-REQUESTER — Case can wait for requester information

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-CASE-EXCEPTION-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/cases/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`

#### Preconditions

- Seed case bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb exists (or create + advance to Under Review).
- Alternative automation: npm run simulate -- --name=SIM-003

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Sign in as agent@example.com. Open seeded case /cases/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb. | Case detail loads for agent. |
| 2 | Click Move to Waiting for requester → Confirm status change. | Status Waiting for requester. SLA panel shows PAUSED for resolution SLA. |
| 3 | (Optional SIM-003) Run npm run simulate -- --name=SIM-003 or /simulator → Requester information required. | After requester submits information, status returns Under Review; resolution SLA RUNNING; sla_paused and sla_resumed audit events exist. |

#### Expected final state

- Case can enter and exit Waiting for requester.

#### Cleanup

1. Sign out; revert seed case if modified.

<a id="rb-case-reopen"></a>

### RB-CASE-REOPEN — Resolved case can be reopened

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-CASE-EXCEPTION-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- App running with test-control enabled.
- Simulator UI at /simulator or CLI available.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-010 (Reopen resolved case) OR open /simulator, select SIM-010, Run. | Scenario actions complete without error. |
| 2 | Review scenario report assertions. | case_status UNDER_REVIEW after reopen; notification case_reopening to requester; audit event case_reopened. |

#### Expected final state

- Resolved case reopened to Under Review in simulator fixture.

#### Cleanup

1. Simulator cleanup removes [sim-reopen] prefixed cases.

<a id="rb-case-stale-version"></a>

### RB-CASE-STALE-VERSION — Stale case version is rejected

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-CASE-EXCEPTION-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Test-control / simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-013 (Stale version conflict). | Scenario completes; stale approve attempt returns error. |
| 2 | Inspect assertions. | Case remains UNDER_REVIEW (ER-DENY-01). Optimistic lock rejects expectedVersion 999. |

#### Expected final state

- Stale version update rejected; no erroneous status change.

#### Cleanup

1. Simulator removes [sim-stale-version] cases.

<a id="rb-case-concurrent-update"></a>

### RB-CASE-CONCURRENT-UPDATE — Concurrent case updates are conflict-safe

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-CASE-EXCEPTION-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-012 (Concurrent case update). | Second transition with stale version fails. |
| 2 | Review assertions. | Final status WAITING_FOR_REQUESTER; conflicting approve with expectedVersion 1 rejected (ER-DENY-01). |

#### Expected final state

- Concurrent update conflict handled safely.

#### Cleanup

1. Simulator removes [sim-concurrent] cases.

<a id="rb-case-concurrent-claim"></a>

### RB-CASE-CONCURRENT-CLAIM — Concurrent claims result in a single assignee

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-CASE-EXCEPTION-01`

**Role:** ACTOR-AGENT + ACTOR-TEAMLEAD  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-009 (Two agents concurrently claiming one case). | First claim (agent) succeeds; second (teamlead) errors. |
| 2 | Review assigned_agent assertion. | Exactly one assignee: agent@example.com. ER-DENY-01 for loser claim. |

#### Expected final state

- Single assignee after concurrent claim race.

#### Cleanup

1. Simulator removes [sim-race-claim] cases.

<a id="uat-approval-controls-01"></a>

## UAT-APPROVAL-CONTROLS-01 — Approval controls

**Actor:** `ACTOR-APPROVER`  
**Starting page:** `/cases`  
**Shared data:** `TD-APPROVAL-CONTROLS-01`

### Shared preconditions

- Sign in as `ACTOR-APPROVER` from the actor catalogue.
- Open `/cases`.
- Local Supabase + app are running with seed data.
- Confirm shared test-data codes from this journey are free or cleaned from prior runs.

### Shared cleanup

- Deactivate or delete journey-created rows where the product supports it.
- Prefer `ER-DEACTIVATE-01` for master data that must remain auditable.
- Leave seeded baseline users and org config unchanged.

<a id="rb-admin-approval-rule-create"></a>

### RB-ADMIN-APPROVAL-RULE-CREATE — Administrator configures an approval rule

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-ADMIN (admin@example.com)  
**Page:** `/admin/approval-rules`

#### Preconditions

- Signed in as admin@example.com.
- Rule code UAT_RULE_01 from TD-APPROVAL-CONTROLS-01 is unused.

#### Test data

| Field | Value |
| --- | --- |
| Code | UAT_RULE_01 |
| Name | UAT approval rule 01 |
| Sequence | 5 |
| Min amount | 1 |
| Max amount | 50000 |
| Required approver role | approver |
| Approval levels | 1 |
| Active | checked |
| Change reason | UAT create approval rule |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Open /admin/approval-rules (Admin → sidebar Approval rules). | Create approval rule form with Code, Name, Sequence, amounts, role, levels, Change reason. |
| 2 | Fill TD-APPROVAL-CONTROLS-01 values above. Click Create approval rule. | List shows UAT approval rule 01 (UAT_RULE_01) with Active badge and version. ER-SAVE-01. |

#### Expected final state

- Approval rule UAT_RULE_01 exists in admin list.

#### Cleanup

1. Leave rule for approval journeys or deactivate when edit UI supports it.

<a id="rb-approval-reject"></a>

### RB-APPROVAL-REJECT — Approver can reject a pending case

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-APPROVER (approver@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-002 (Approval rejection). | Approver reject_case action succeeds. |
| 2 | Review assertions. | case_status REJECTED; requester receives approval_decision notification. |

#### Expected final state

- Case rejected with audit and requester notification.

#### Cleanup

1. Simulator removes [sim-reject] cases.

<a id="rb-approval-duplicate-submit"></a>

### RB-APPROVAL-DUPLICATE-SUBMIT — Duplicate approval submission is rejected or idempotent

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-APPROVER (approver@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-008 (Duplicate approval submission). | First approve succeeds; second approve expectError. |
| 2 | Review assertions. | case_status remains APPROVED; duplicate submit rejected or idempotent (ER-DENY-01). |

#### Expected final state

- Only one approval decision applied.

#### Cleanup

1. Simulator removes [sim-dup-approve] cases.

<a id="rb-approval-duplicate-request"></a>

### RB-APPROVAL-DUPLICATE-REQUEST — Duplicate approval request is blocked

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-011 (Duplicate approval request). | Second request_approval returns error. |
| 2 | Review assertions. | case_status PENDING_APPROVAL; duplicate request blocked (ER-DENY-01). |

#### Expected final state

- Single pending approval request on case.

#### Cleanup

1. Simulator removes [sim-dup-approval-req] cases.

<a id="rb-approval-sequential-two-level"></a>

### RB-APPROVAL-SEQUENTIAL-TWO-LEVEL — High-value cases require sequential two-level approval

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-APPROVER (approver@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled; admin can create rules via SIM-026 setup.

#### Test data

| Field | Value |
| --- | --- |
| Rule code | sim_high_sequential |
| Amount | 15000 |
| Approval levels | 2 |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-026 (High-value sequential two-level approval). | High-value case matches sim_high_sequential rule. |
| 2 | Review assertions after first approve_level. | approval_rule_selected sim_high_sequential; approval_level_sequence levels=2 approvedCount=1 pendingCount=1; case_status PENDING_APPROVAL. |

#### Expected final state

- Two-level sequential approval in progress after first level.

#### Cleanup

1. Simulator removes [sim-p9-seq] cases and test rule.

<a id="rb-approval-maker-checker-requester"></a>

### RB-APPROVAL-MAKER-CHECKER-REQUESTER — Requester cannot approve their own case

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-REQUESTER (requester@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-027 (Requester self-approval denied). | requester approve_case expectError true. |
| 2 | Review assertions. | error_code FORBIDDEN; maker_checker_denial; case_status PENDING_APPROVAL (ER-DENY-01). |

#### Expected final state

- Requester cannot approve own case.

#### Cleanup

1. Simulator removes [sim-p9-self] cases.

<a id="rb-approval-maker-checker-agent"></a>

### RB-APPROVAL-MAKER-CHECKER-AGENT — Assigned agent cannot approve the case they processed

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-028 (Assigned agent maker-checker denial). | Agent approve after processing returns error. |
| 2 | Review assertions. | error_code FORBIDDEN; maker_checker_denial; case_status PENDING_APPROVAL (ER-DENY-01). |

#### Expected final state

- Assigned agent cannot approve case they processed.

#### Cleanup

1. Simulator removes [sim-p9-mc] cases.

<a id="rb-approval-limit-exceeded"></a>

### RB-APPROVAL-LIMIT-EXCEEDED — Approval is denied when amount exceeds approver limit

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-APPROVER (approver@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Test data

| Field | Value |
| --- | --- |
| Rule | sim_low_limit (approver_limit 100) |
| Amount | 25000 |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-029 (Approver exceeds approval limit). | approve_case expectError for approver. |
| 2 | Review assertions. | approval_rule_selected sim_low_limit; error_code FORBIDDEN; approval_limit_enforcement; case stays PENDING_APPROVAL (ER-DENY-01). |

#### Expected final state

- Approval denied when amount exceeds approver limit.

#### Cleanup

1. Simulator removes [sim-p9-lim] cases.

<a id="rb-approval-delegation-valid"></a>

### RB-APPROVAL-DELEGATION-VALID — Valid delegated approval is accepted

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-TEAMLEAD (teamlead@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled; approver can create delegations.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-030 (Valid delegated approval). | Team lead approves via active delegation from approver. |
| 2 | Review assertions. | case_status APPROVED; complete_audit_trail includes status_change events. |

#### Expected final state

- Delegated approval accepted; case Approved.

#### Cleanup

1. Simulator deactivates test delegation; removes [sim-p9-del] cases.

<a id="rb-approval-delegation-expired"></a>

### RB-APPROVAL-DELEGATION-EXPIRED — Expired delegation cannot approve

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-TEAMLEAD (teamlead@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-031 (Expired delegation denied). | teamlead approve_case expectError with expired delegation. |
| 2 | Review assertions. | error_code FORBIDDEN; delegation_validity denial; case_status PENDING_APPROVAL (ER-DENY-01). |

#### Expected final state

- Expired delegation cannot approve.

#### Cleanup

1. Simulator removes [sim-p9-exp] cases.

<a id="rb-admin-config-version-retained"></a>

### RB-ADMIN-CONFIG-VERSION-RETAINED — Case retains approval rule version selected at request time

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-APPROVAL-CONTROLS-01`

**Role:** ACTOR-ADMIN (admin@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-038 (Admin configuration change retains rule version on case). | Case requests approval with sim_cfg_version; admin updates rule after request. |
| 2 | Review assertions. | approval_rule_selected still sim_cfg_version on case (version at request time retained); complete_audit_trail status_change events (ER-AUDIT-01). |

#### Expected final state

- Case keeps approval rule code/version from request time despite admin update.

#### Cleanup

1. Simulator removes [sim-p9-cfg] cases.

<a id="uat-sla-jobs-01"></a>

## UAT-SLA-JOBS-01 — SLA and background jobs

**Actor:** `ACTOR-AGENT`  
**Starting page:** `/workspace`  
**Shared data:** `TD-SLA-JOBS-01`

### Shared preconditions

- Sign in as `ACTOR-AGENT` from the actor catalogue.
- Open `/workspace`.
- Local Supabase + app are running with seed data.
- Confirm shared test-data codes from this journey are free or cleaned from prior runs.

### Shared cleanup

- Deactivate or delete journey-created rows where the product supports it.
- Prefer `ER-DEACTIVATE-01` for master data that must remain auditable.
- Leave seeded baseline users and org config unchanged.

<a id="rb-sla-first-response-breach"></a>

### RB-SLA-FIRST-RESPONSE-BREACH — First-response SLA breach is detected

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-SLA-JOBS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator test-control clock enabled.
- UI spot-check: seeded breached case Duplicate deposit correction in /workspace.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-004 (First-response SLA breach). | Clock advanced 2h; SLA processor marks first_response BREACHED. |
| 2 | Review assertions. | sla_state first_response BREACHED; sla_breach notification to agent; audit sla_breach event. |
| 3 | (UI) As agent@example.com open /workspace → Breached cases section. | Breached seed case Duplicate deposit correction visible (RB-SLA-BREACHED-QUEUE overlap). |

#### Expected final state

- First-response SLA breach detected and surfaced.

#### Cleanup

1. Simulator removes [sim-sla-fr] cases; reset clock if needed.

<a id="rb-sla-resolution-pause-resume"></a>

### RB-SLA-RESOLUTION-PAUSE-RESUME — Resolution SLA pauses while waiting for requester

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-SLA-JOBS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/cases/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`

#### Preconditions

- Case in Under Review or use SIM-005 for full pause/resume cycle.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | (UI) Move seeded case to Waiting for requester (see RB-CASE-WAIT-REQUESTER). | Resolution SLA shows PAUSED badge on case detail. |
| 2 | Run npm run simulate -- --name=SIM-005 (Resolution SLA pause and resume). | Wait → submit information returns case to Under Review. |
| 3 | Review SIM-005 assertions. | resolution sla_state RUNNING; audit sla_paused and sla_resumed events (ER-AUDIT-01). |

#### Expected final state

- Resolution SLA pauses while waiting for requester and resumes after response.

#### Cleanup

1. Sign out; simulator cleanup [sim-sla-pause].

<a id="rb-sla-breached-queue"></a>

### RB-SLA-BREACHED-QUEUE — Breached cases appear in the agent workspace queue

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-SLA-JOBS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/workspace`

#### Preconditions

- Seed includes breached case Duplicate deposit correction.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Sign in as agent@example.com. Open /workspace. | Section "Breached cases" is visible. |
| 2 | Locate Duplicate deposit correction in breached queue. | Breached SLA case listed and openable. |

#### Expected final state

- Agent workspace breached queue shows seeded breached case.

#### Cleanup

1. Sign out.

<a id="rb-job-retry"></a>

### RB-JOB-RETRY — Failed background job is retried

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-SLA-JOBS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled; jobs.tick secret configured.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-014 (Failed job retry). | Test job jobs.fail_once succeeds after 3 drain attempts. |
| 2 | Review job_status assertion. | job status succeeded with minAttempts 3. |

#### Expected final state

- Failed background job retried until success.

#### Cleanup

1. No persistent UI state.

<a id="rb-job-dead-letter"></a>

### RB-JOB-DEAD-LETTER — Exhausted job moves to dead-letter

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-SLA-JOBS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-015 (Dead-letter job). | Job exhausts maxAttempts without success. |
| 2 | Review job_status assertion. | job status dead_letter with minAttempts 2. |

#### Expected final state

- Exhausted job moved to dead-letter state.

#### Cleanup

1. No persistent UI state.

<a id="rb-api-idempotency-key"></a>

### RB-API-IDEMPOTENCY-KEY — Duplicate Idempotency-Key returns consistent result

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-SLA-JOBS-01`

**Role:** ACTOR-REQUESTER (requester@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-016 (Duplicate idempotency key). | Two creates with same Idempotency-Key return same case; third with different body errors. |
| 2 | Review assertions. | Original case SUBMITTED; replay consistent; conflicting payload rejected (ER-DENY-01). |

#### Expected final state

- Duplicate Idempotency-Key returns consistent result.

#### Cleanup

1. Simulator removes [sim-idem] cases.

<a id="rb-email-outbox-deliver"></a>

### RB-EMAIL-OUTBOX-DELIVER — Email outbox row is created when flag enabled

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-SLA-JOBS-01`

**Role:** ACTOR-ADMIN (admin@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enables email_notifications_enabled flag during scenario.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-023 (Email outbox delivery when flag enabled). | Approval request triggers email pipeline after jobs drain. |
| 2 | Review email_delivery_exists assertion. | email outbox row for approval_requested with status DELIVERED for case. |

#### Expected final state

- Email outbox DELIVERED row created when flag enabled.

#### Cleanup

1. Scenario resets email_notifications_enabled to false; removes [sim-email] cases.

<a id="rb-email-dedupe"></a>

### RB-EMAIL-DEDUPE — Duplicate email notifications are suppressed

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-SLA-JOBS-01`

**Role:** ACTOR-ADMIN (admin@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-034 (Duplicate email suppression). | Multiple notification worker runs do not duplicate delivery. |
| 2 | Review email_dedupe assertion. | At most one DELIVERED outbox row for approval_requested on case (maxDelivered 1). |

#### Expected final state

- Duplicate email notifications suppressed.

#### Cleanup

1. Scenario disables email flag; removes [sim-p9-eded] cases.

<a id="uat-wallet-exceptions-01"></a>

## UAT-WALLET-EXCEPTIONS-01 — Wallet execution and exceptions

**Actor:** `ACTOR-AGENT`  
**Starting page:** `/operations/exceptions`  
**Shared data:** `TD-WALLET-01`

### Shared preconditions

- Sign in as `ACTOR-AGENT` from the actor catalogue.
- Open `/operations/exceptions`.
- Local Supabase + app are running with seed data.
- Confirm shared test-data codes from this journey are free or cleaned from prior runs.

### Shared cleanup

- Deactivate or delete journey-created rows where the product supports it.
- Prefer `ER-DEACTIVATE-01` for master data that must remain auditable.
- Leave seeded baseline users and org config unchanged.

<a id="rb-wallet-success"></a>

### RB-WALLET-SUCCESS — Mock wallet execute succeeds

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/cases/{id}`

#### Preconditions

- Wallet mock reset and configured SUCCESS.
- Approved case ready for execution OR use SIM-017 for API-level check.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | (UI path per RB-CASE-RESOLVE) Configure mock SUCCESS, drain jobs, open approved case. | Integration status Succeeded; outcome SUCCESS (ER-SAVE-01). |
| 2 | Optional: npm run simulate -- --name=SIM-017 (Wallet mock API success). | wallet_execute_outcome SUCCESS, processingCertainty PROCESSED, requiresStatusInquiry false. |

#### Expected final state

- Mock wallet execute succeeds.

#### Cleanup

1. Reset wallet mock via test-control if needed.

<a id="rb-wallet-exec-after-approval"></a>

### RB-WALLET-EXEC-AFTER-APPROVAL — Approval queues wallet execution to SUCCEEDED

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled; wallet mock SUCCESS.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-021 (Integration execution after approval). | Approve then drain_jobs twice. |
| 2 | Review assertions. | case_status APPROVED; integration_execution_status SUCCEEDED. |

#### Expected final state

- Approval queues wallet execution to SUCCEEDED.

#### Cleanup

1. Simulator removes [sim-exec] cases.

<a id="rb-wallet-temp-failure"></a>

### RB-WALLET-TEMP-FAILURE — Temporary wallet failure is retryable

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-018 (Wallet mock temporary failure). | execute_wallet_adjustment returns TEMPORARY_FAILURE. |
| 2 | Review wallet_execute_outcome assertion. | outcome TEMPORARY_FAILURE; processingCertainty NOT_PROCESSED; requiresStatusInquiry false; canScheduleExecuteRetry true. |

#### Expected final state

- Temporary wallet failure marked retryable without inquiry.

#### Cleanup

1. Reset wallet mock.

<a id="rb-wallet-retry-success"></a>

### RB-WALLET-RETRY-SUCCESS — Wallet retries then succeeds for the same key

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-TEAMLEAD (teamlead@example.com)  
**Page:** `/operations/exceptions`

#### Preconditions

- Retry case created with TEMPORARY_FAILURE then SUCCESS mock (see RB-EXCEPTION-RETRY-UI / pilot e2e).
- Or SIM-019 for API-level retry.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | (UI) teamlead@example.com → /operations/exceptions → Retry execution on retryable failure case; drain jobs. | Case integration shows Succeeded after retry. |
| 2 | Optional: npm run simulate -- --name=SIM-019 (Wallet mock retry then success). | Second execute with same idempotency key returns SUCCESS, processingCertainty PROCESSED. |

#### Expected final state

- Wallet retries then succeeds for same idempotency key.

#### Cleanup

1. Reset wallet mock; sign out.

<a id="rb-wallet-unknown-inquiry"></a>

### RB-WALLET-UNKNOWN-INQUIRY — Uncertain timeout requires status inquiry

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-020 (Wallet mock uncertain timeout then status inquiry). | Timeout then inquire_wallet_status then retry execute. |
| 2 | Review assertions. | status inquiry STATUS_NOT_FOUND, safeToRetryExecute true; final execute SUCCESS PROCESSED. |

#### Expected final state

- Uncertain timeout requires status inquiry before safe retry.

#### Cleanup

1. Reset wallet mock.

<a id="rb-wallet-exec-idempotent"></a>

### RB-WALLET-EXEC-IDEMPOTENT — Duplicate wallet execution is idempotent

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-032 (Duplicate wallet execution is idempotent). | Two execute_wallet_adjustment calls with same idempotency key. |
| 2 | Review idempotent_execution assertion. | Consistent success without double-processing side effects. |

#### Expected final state

- Duplicate wallet execution is idempotent.

#### Cleanup

1. Reset wallet mock.

<a id="rb-wallet-concurrent-workers"></a>

### RB-WALLET-CONCURRENT-WORKERS — Concurrent integration workers leave a single success

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-033 (Concurrent integration workers drain safely). | Two run_integration_worker plus drain_jobs after approval. |
| 2 | Review assertions. | execution_record_state SUCCEEDED; integration_attempt_count min 1 (single success despite concurrent drains). |

#### Expected final state

- Concurrent workers leave one SUCCEEDED execution.

#### Cleanup

1. Simulator removes [sim-p9-cw] cases.

<a id="rb-wallet-timeout-safe-retry"></a>

### RB-WALLET-TIMEOUT-SAFE-RETRY — Confirmed non-processing timeout allows safe retry

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-040 (Timeout confirmed non-processing then safe retry). | TIMEOUT_AFTER_POSSIBLE_PROCESSING then status inquiry. |
| 2 | Review assertions. | wallet_status_outcome STATUS_NOT_FOUND with safeToRetryExecute true (confirmed non-processing). |

#### Expected final state

- Confirmed non-processing timeout allows safe retry path.

#### Cleanup

1. Reset wallet mock.

<a id="rb-exception-permanent-failure"></a>

### RB-EXCEPTION-PERMANENT-FAILURE — Permanent wallet failure creates an operations exception

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-TEAMLEAD (teamlead@example.com)  
**Page:** `/operations/exceptions`

#### Preconditions

- Wallet mock PERMANENT_FAILURE or TEMPORARY_FAILURE exhausted.
- Approved case with drained failed jobs.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | (UI) Create case, approve, configure mock failure, drain jobs (see pilot e2e RB-EXCEPTION-PERMANENT-FAILURE). | Case appears on /operations/exceptions for team lead. |
| 2 | Optional: npm run simulate -- --name=SIM-022. | integration_execution_status FAILED_FINAL; exception_queue_contains integration_failed_final. |

#### Expected final state

- Permanent wallet failure creates operations exception row.

#### Cleanup

1. Resolve or dismiss exception in later RB; sign out.

<a id="rb-exception-resolve"></a>

### RB-EXCEPTION-RESOLVE — Operations can resolve an operational exception

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-037 (Resolve operational exception). | Permanent failure creates exception; resolve_operational_exception action runs. |
| 2 | Review execution_record_state assertion. | Execution remains FAILED_FINAL; exception resolved in ops queue (ER-SAVE-01). |

#### Expected final state

- Operational exception resolved by ops with resolution note.

#### Cleanup

1. Simulator removes [sim-p9-rexc] cases.

<a id="rb-exception-retry-ui"></a>

### RB-EXCEPTION-RETRY-UI — Team lead can retry a retryable failure from exceptions UI

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-WALLET-EXCEPTIONS-01`

**Role:** ACTOR-TEAMLEAD (teamlead@example.com)  
**Page:** `/operations/exceptions`

#### Preconditions

- Retryable failure case exists in exceptions queue (TEMPORARY_FAILURE after approval).

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Sign in as teamlead@example.com. Open /operations/exceptions. Locate failure case row. | Exception row shows case title and Retry execution button. |
| 2 | Configure wallet mock SUCCESS. Click Retry execution. Drain jobs via /api/jobs/tick (test-control secret). | Retry dispatches without error (ER-SAVE-01). |
| 3 | Open case detail from /cases. | Integration status Succeeded within 20s. |

#### Expected final state

- Team lead retried retryable failure successfully from exceptions UI.

#### Cleanup

1. Sign out; reset wallet mock.

<a id="uat-views-dashboard-01"></a>

## UAT-VIEWS-DASHBOARD-01 — Views and management dashboard

**Actor:** `ACTOR-AGENT`  
**Starting page:** `/cases`  
**Shared data:** `TD-VIEW-01`, `TD-DASHBOARD-01`

### Shared preconditions

- Sign in as `ACTOR-AGENT` from the actor catalogue.
- Open `/cases`.
- Local Supabase + app are running with seed data.
- Confirm shared test-data codes from this journey are free or cleaned from prior runs.

### Shared cleanup

- Deactivate or delete journey-created rows where the product supports it.
- Prefer `ER-DEACTIVATE-01` for master data that must remain auditable.
- Leave seeded baseline users and org config unchanged.

<a id="rb-view-list-create-personal"></a>

### RB-VIEW-LIST-CREATE-PERSONAL — User can list system views and create a personal view

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-VIEWS-DASHBOARD-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/cases`

#### Preconditions

- Signed in as agent@example.com.

#### Test data

| Field | Value |
| --- | --- |
| View name | UAT Personal View |
| Filter | status=UNDER_REVIEW (example) |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Open /cases?status=UNDER_REVIEW. In Save current filters enter UAT Personal View. Click Save personal view. | Saved view name appears in selector within 15s (ER-SAVE-01). |
| 2 | Navigate /cases. Open Saved view dropdown; select UAT Personal View. | URL includes viewId=; filters applied. |
| 3 | Optional: npm run simulate -- --name=SIM-024. | System view my_open listed; personal view exists in API assertions. |

#### Expected final state

- Personal saved view UAT Personal View created and reloadable.

#### Cleanup

1. Delete personal view if UI supports; otherwise leave for manual cleanup.

<a id="rb-view-team-shared"></a>

### RB-VIEW-TEAM-SHARED — Team member can create and load a team-scoped view

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-VIEWS-DASHBOARD-01`

**Role:** ACTOR-AGENT + ACTOR-TEAMLEAD  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-035 (Team-shared saved view access). | Agent creates team-scoped view; teamlead loads it. |
| 2 | Review assertions. | saved_view_access allowed true for teamlead; saved_view_exists sharingScope team. |

#### Expected final state

- Team member can create and peer can load team-scoped view.

#### Cleanup

1. Simulator removes [sim-p9-tv] fixtures.

<a id="rb-view-cross-org-deny"></a>

### RB-VIEW-CROSS-ORG-DENY — Cross-organisation saved view access is denied

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-VIEWS-DASHBOARD-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-036 (Cross-organisation saved view denial). | load_saved_view on foreign org view expectError. |
| 2 | Review assertions. | saved_view_access allowed false; error_code NOT_FOUND (ER-DENY-01). |

#### Expected final state

- Cross-organisation saved view access denied.

#### Cleanup

1. Simulator removes foreign org fixture.

<a id="rb-dashboard-kpi-load"></a>

### RB-DASHBOARD-KPI-LOAD — Authorised user can load management dashboard KPIs

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`  
**Journey:** `UAT-VIEWS-DASHBOARD-01`

**Role:** ACTOR-TEAMLEAD (teamlead@example.com)  
**Page:** `/dashboard/management`

#### Preconditions

- User role can access management dashboard (team lead or manager).

#### Test data

| Field | Value |
| --- | --- |
| Route | /dashboard/management |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Sign in as teamlead@example.com. Open /dashboard/management (header Management link). | Page title "Management dashboard" with KPI tiles: Cases submitted, Pending approval, Failed integration, etc. |
| 2 | Optional: npm run simulate -- --name=SIM-025. | management_kpis_present assertion passes for agent API snapshot. |

#### Expected final state

- Management dashboard KPI section loads without error.

#### Cleanup

1. Sign out.

<a id="rb-dashboard-kpi-value"></a>

### RB-DASHBOARD-KPI-VALUE — Dashboard KPI values reflect submitted cases

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-VIEWS-DASHBOARD-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/dashboard/management`

#### Preconditions

- At least one case submitted in date range.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-039 (Dashboard KPI validation after case create). | create_case then get_management_dashboard. |
| 2 | Review dashboard_kpi_value assertion. | cases_submitted min 1 in dashboard snapshot. |
| 3 | (UI) teamlead@example.com → /dashboard/management; note Cases submitted count ≥ prior after creating a case. | KPI values reflect submitted cases in selected date range. |

#### Expected final state

- Dashboard KPI values reflect case activity.

#### Cleanup

1. Simulator removes [sim-p9-kpi] cases.

<a id="rb-dashboard-csv-export"></a>

### RB-DASHBOARD-CSV-EXPORT — Management dashboard CSV export downloads safely

**Priority:** medium  
**Status:** `blocked_ui`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`  
**Journey:** `UAT-VIEWS-DASHBOARD-01`

> **Blocked UI:** procedure documents the intended path. Do not mark the requirement complete until the UI gap is closed.

**Role:** ACTOR-TEAMLEAD (teamlead@example.com)  
**Page:** `/dashboard/management`

#### Preconditions

- blocked_ui: Export CSV link exists but full download UX may be incomplete — document intended steps.

#### Test data

| Field | Value |
| --- | --- |
| From | last 30 days (default) |
| To | now |

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Sign in as teamlead@example.com. Open /dashboard/management (TD-DASHBOARD-01). | Management dashboard with date range filters and Export CSV button visible. |
| 2 | Set From/To if needed. Click Apply range. | KPI tiles refresh for selected window. |
| 3 | Click Export CSV (links to /api/v1/management/dashboard/export?from=&to=). | Browser downloads CSV file with KPI/export columns; no auth error. If blocked_ui, file may be empty or headers-only — log defect and verify API returns 200. |

#### Expected final state

- CSV export attempted for management dashboard date range.

#### Cleanup

1. Sign out.

<a id="uat-security-01"></a>

## UAT-SECURITY-01 — Security boundaries

**Actor:** `ACTOR-AGENT`  
**Starting page:** `/cases`  
**Shared data:** `TD-SECURITY-01`

### Shared preconditions

- Sign in as `ACTOR-AGENT` from the actor catalogue.
- Open `/cases`.
- Local Supabase + app are running with seed data.
- Confirm shared test-data codes from this journey are free or cleaned from prior runs.

### Shared cleanup

- Deactivate or delete journey-created rows where the product supports it.
- Prefer `ER-DEACTIVATE-01` for master data that must remain auditable.
- Leave seeded baseline users and org config unchanged.

<a id="rb-sec-cross-team-deny"></a>

### RB-SEC-CROSS-TEAM-DENY — Unauthorized cross-team case access is denied

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-SECURITY-01`

**Role:** ACTOR-REQUESTER (requester@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-006 (Unauthorized cross-team access). | Requester cannot request_approval on chargeback case. |
| 2 | Review assertions. | Agent with team access sees case; unauthorized mutation rejected (ER-DENY-01). |

#### Expected final state

- Cross-team unauthorized action denied.

#### Cleanup

1. Simulator removes [sim-xteam] cases.

<a id="rb-sec-cross-org-deny"></a>

### RB-SEC-CROSS-ORG-DENY — Unauthorized cross-organisation access is denied

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-SECURITY-01`

**Role:** ACTOR-AGENT (agent@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-007 (Unauthorized cross-organization access). | get_case on foreign org UUID expectError. |
| 2 | Review assertions. | Own-org case visible to requester; foreign case access denied (ER-DENY-01). |

#### Expected final state

- Cross-organisation case access denied.

#### Cleanup

1. Simulator removes [sim-xorg] cases.

<a id="rb-sec-internal-comment-hidden"></a>

### RB-SEC-INTERNAL-COMMENT-HIDDEN — Internal comments are hidden from requesters

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`  
**Journey:** `UAT-SECURITY-01`

**Role:** ACTOR-REQUESTER (requester@example.com)  
**Page:** `/simulator`

#### Preconditions

- Simulator enabled.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Run npm run simulate -- --name=SIM-041 (Internal comment hidden from requester). | Agent adds public and internal comments on case. |
| 2 | Review internal_comment_hidden assertion. | Requester sees public comment; internal ops note marker hidden (ER-DENY-01 visibility). |
| 3 | (UI spot-check) requester opens case comments — Internal badge comments absent. | Internal comment checkbox content not shown to requester role. |

#### Expected final state

- Internal comments hidden from requesters.

#### Cleanup

1. Simulator removes [sim-p11-int] cases.

<a id="rb-ui-layout-responsive"></a>

### RB-UI-LAYOUT-RESPONSIVE — Primary pages remain usable on desktop and mobile widths

**Priority:** medium  
**Status:** `manual_only`  
**Procedure level:** `detailed`  
**Expected layers:** `manual`  
**Journey:** `UAT-SECURITY-01`

> **Manual only:** record tester, device, date and evidence before treating as passed.

**Role:** Any authenticated user  
**Page:** `/dashboard`

#### Preconditions

- manual_only: visual check on desktop and mobile widths.
- TD-SECURITY-01 not required; use browser devtools device toolbar.

#### Procedure

| Step | Tester action | Expected result |
| ---: | --- | --- |
| 1 | Desktop (~1280px): sign in, visit /dashboard, /cases, /cases/new (requester), /workspace (agent), /admin (admin). | Header nav, main content, and action buttons visible without horizontal scroll; primary tasks completable. |
| 2 | Mobile (~375px): repeat key routes. Confirm header collapses gracefully (nav may hide md:flex links; core content readable). | Forms and case detail usable; status action buttons wrap; no overlapping text. |
| 3 | Rotate to landscape on mobile width for case detail timeline. | Status history and comments remain readable. |

#### Expected final state

- Primary pages usable at desktop and mobile breakpoints.

#### Cleanup

1. Sign out.

## Traceability

- Simulator scenarios: `tools/case-simulator/scenarios/*.yaml` (`id: SIM-NNN`, `runbookRefs`)
- Playwright: `e2e/**/*.spec.ts` titles include `[RB-…]`
- Sync gate: `npm run test:runbook-sync`
- Coverage: `npm run generate:runbook-coverage` → `tools/case-simulator/reports/runbook-coverage.*`
