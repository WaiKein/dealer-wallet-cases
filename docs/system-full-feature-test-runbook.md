# System full-feature test runbook

> **Authoritative copy.** Version-controlled under `docs/`. Any `outputs/` export is a delivered snapshot only.

- **Version:** 2026-07-29
- **Baseline commit:** a6e8746
- **Machine registry:** `quality/runbook-requirements.yaml`

Each requirement has a stable `RB-*` ID and a unique HTML anchor. `procedureLevel: detailed` sections include executable steps; `index_only` entries are placeholders pending enrichment.

## Status legend

| Status | Meaning |
| --- | --- |
| `active` | In scope for automation or already covered |
| `blocked_ui` | Requirement blocked by known UI gap (Plan 2+) |
| `manual_only` | Human / visual check |
| `retired` | Do not reuse |

## Requirement index

### 1. Authentication

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-AUTH-LOGIN-VALID`](#rb-auth-login-valid) | 1.1 | Valid user can sign in | critical | `active` | `detailed` |

### 2. Case workflow

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-CASE-CREATE-VALID`](#rb-case-create-valid) | 2.1 | Requester creates a valid adjustment case | critical | `active` | `detailed` |
| [`RB-CASE-CLAIM`](#rb-case-claim) | 2.2 | Agent claims an unassigned group case | critical | `active` | `detailed` |
| [`RB-CASE-ACKNOWLEDGE`](#rb-case-acknowledge) | 2.3 | Assigned agent acknowledges a case | critical | `active` | `detailed` |
| [`RB-CASE-WAIT-REQUESTER`](#rb-case-wait-requester) | 2.4 | Case can wait for requester information | high | `active` | `detailed` |
| [`RB-CASE-RESOLVE`](#rb-case-resolve) | 2.5 | Approved case can be resolved after successful execution | critical | `active` | `detailed` |
| [`RB-CASE-REOPEN`](#rb-case-reopen) | 2.6 | Resolved case can be reopened | high | `active` | `index_only` |
| [`RB-CASE-CONCURRENT-CLAIM`](#rb-case-concurrent-claim) | 2.7 | Concurrent claims result in a single assignee | critical | `active` | `detailed` |
| [`RB-CASE-CONCURRENT-UPDATE`](#rb-case-concurrent-update) | 2.8 | Concurrent case updates are conflict-safe | high | `active` | `index_only` |
| [`RB-CASE-STALE-VERSION`](#rb-case-stale-version) | 2.9 | Stale case version is rejected | high | `active` | `index_only` |
| [`RB-CASE-TIMELINE-VISIBLE`](#rb-case-timeline-visible) | 2.10 | Status history timeline is visible on the case | high | `active` | `index_only` |
| [`RB-CASE-AUTO-ASSIGN-GROUP`](#rb-case-auto-assign-group) | 2.11 | Submitted case is auto-assigned to a matching group | critical | `active` | `detailed` |
| [`RB-CASE-PENDING-APPROVAL-NOTIFY`](#rb-case-pending-approval-notify) | 2.12 | Approver is notified when a case reaches pending approval | high | `active` | `index_only` |

### 3. Approvals

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-APPROVAL-HAPPY`](#rb-approval-happy) | 3.1 | Approver completes a happy-path approval | critical | `active` | `detailed` |
| [`RB-APPROVAL-REJECT`](#rb-approval-reject) | 3.2 | Approver can reject a pending case | critical | `active` | `detailed` |
| [`RB-APPROVAL-DUPLICATE-SUBMIT`](#rb-approval-duplicate-submit) | 3.3 | Duplicate approval submission is rejected or idempotent | high | `active` | `index_only` |
| [`RB-APPROVAL-DUPLICATE-REQUEST`](#rb-approval-duplicate-request) | 3.4 | Duplicate approval request is blocked | high | `active` | `index_only` |
| [`RB-APPROVAL-SEQUENTIAL-TWO-LEVEL`](#rb-approval-sequential-two-level) | 3.5 | High-value cases require sequential two-level approval | critical | `active` | `detailed` |
| [`RB-APPROVAL-MAKER-CHECKER-REQUESTER`](#rb-approval-maker-checker-requester) | 3.6 | Requester cannot approve their own case | critical | `active` | `detailed` |
| [`RB-APPROVAL-MAKER-CHECKER-AGENT`](#rb-approval-maker-checker-agent) | 3.7 | Assigned agent cannot approve the case they processed | critical | `active` | `detailed` |
| [`RB-APPROVAL-LIMIT-EXCEEDED`](#rb-approval-limit-exceeded) | 3.8 | Approval is denied when amount exceeds approver limit | high | `active` | `index_only` |
| [`RB-APPROVAL-DELEGATION-VALID`](#rb-approval-delegation-valid) | 3.9 | Valid delegated approval is accepted | high | `active` | `index_only` |
| [`RB-APPROVAL-DELEGATION-EXPIRED`](#rb-approval-delegation-expired) | 3.10 | Expired delegation cannot approve | high | `active` | `index_only` |

### 3/15. Administration

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-ADMIN-CATEGORY-CREATE`](#rb-admin-category-create) | 15.21 | Admin creates a category | critical | `blocked_ui` | `detailed` |
| [`RB-ADMIN-CATEGORY-EDIT`](#rb-admin-category-edit) | 15.21 | Admin edits an existing category | high | `blocked_ui` | `detailed` |
| [`RB-UI-SUBCATEGORY-EDIT`](#rb-ui-subcategory-edit) | 15.22 | Admin edits an existing subcategory | high | `blocked_ui` | `detailed` |
| [`RB-ADMIN-APPROVAL-RULE-CREATE`](#rb-admin-approval-rule-create) | 3.11 | Administrator configures an approval rule | critical | `active` | `detailed` |
| [`RB-ADMIN-CONFIG-VERSION-RETAINED`](#rb-admin-config-version-retained) | 3.12 | Case retains approval rule version selected at request time | high | `active` | `index_only` |

### 4. SLA

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-SLA-FIRST-RESPONSE-BREACH`](#rb-sla-first-response-breach) | 4.1 | First-response SLA breach is detected | high | `active` | `detailed` |
| [`RB-SLA-RESOLUTION-PAUSE-RESUME`](#rb-sla-resolution-pause-resume) | 4.2 | Resolution SLA pauses while waiting for requester | high | `active` | `detailed` |
| [`RB-SLA-BREACHED-QUEUE`](#rb-sla-breached-queue) | 4.3 | Breached cases appear in the agent workspace queue | high | `active` | `index_only` |

### 5. Security boundaries

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-NAV-ADMIN-DENIED`](#rb-nav-admin-denied) | 1.2 | Non-admin is redirected away from administration | critical | `active` | `detailed` |
| [`RB-SEC-CROSS-TEAM-DENY`](#rb-sec-cross-team-deny) | 5.1 | Unauthorized cross-team case access is denied | critical | `active` | `detailed` |
| [`RB-SEC-CROSS-ORG-DENY`](#rb-sec-cross-org-deny) | 5.2 | Unauthorized cross-organisation access is denied | critical | `active` | `detailed` |
| [`RB-SEC-INTERNAL-COMMENT-HIDDEN`](#rb-sec-internal-comment-hidden) | 5.3 | Internal comments are hidden from requesters | high | `active` | `index_only` |

### 6. Reliability and jobs

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-JOB-RETRY`](#rb-job-retry) | 6.1 | Failed background job is retried | high | `active` | `index_only` |
| [`RB-JOB-DEAD-LETTER`](#rb-job-dead-letter) | 6.2 | Exhausted job moves to dead-letter | high | `active` | `index_only` |
| [`RB-API-IDEMPOTENCY-KEY`](#rb-api-idempotency-key) | 6.3 | Duplicate Idempotency-Key returns consistent result | critical | `active` | `detailed` |

### 7. Wallet and integration

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-WALLET-SUCCESS`](#rb-wallet-success) | 7.1 | Mock wallet execute succeeds | critical | `active` | `detailed` |
| [`RB-WALLET-TEMP-FAILURE`](#rb-wallet-temp-failure) | 7.2 | Temporary wallet failure is retryable | high | `active` | `index_only` |
| [`RB-WALLET-RETRY-SUCCESS`](#rb-wallet-retry-success) | 7.3 | Wallet retries then succeeds for the same key | high | `active` | `detailed` |
| [`RB-WALLET-UNKNOWN-INQUIRY`](#rb-wallet-unknown-inquiry) | 7.4 | Uncertain timeout requires status inquiry | critical | `active` | `detailed` |
| [`RB-WALLET-EXEC-AFTER-APPROVAL`](#rb-wallet-exec-after-approval) | 7.5 | Approval queues wallet execution to SUCCEEDED | critical | `active` | `detailed` |
| [`RB-WALLET-EXEC-IDEMPOTENT`](#rb-wallet-exec-idempotent) | 7.6 | Duplicate wallet execution is idempotent | critical | `active` | `detailed` |
| [`RB-WALLET-CONCURRENT-WORKERS`](#rb-wallet-concurrent-workers) | 7.7 | Concurrent integration workers leave a single success | high | `active` | `index_only` |
| [`RB-WALLET-TIMEOUT-SAFE-RETRY`](#rb-wallet-timeout-safe-retry) | 7.8 | Confirmed non-processing timeout allows safe retry | high | `active` | `index_only` |

### 8. Exceptions

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-EXCEPTION-PERMANENT-FAILURE`](#rb-exception-permanent-failure) | 8.1 | Permanent wallet failure creates an operations exception | critical | `active` | `detailed` |
| [`RB-EXCEPTION-RESOLVE`](#rb-exception-resolve) | 8.2 | Operations can resolve an operational exception | critical | `active` | `detailed` |
| [`RB-EXCEPTION-RETRY-UI`](#rb-exception-retry-ui) | 8.3 | Team lead can retry a retryable failure from exceptions UI | high | `active` | `index_only` |

### 9. Email and notifications

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-EMAIL-OUTBOX-DELIVER`](#rb-email-outbox-deliver) | 9.1 | Email outbox row is created when flag enabled | high | `active` | `index_only` |
| [`RB-EMAIL-DEDUPE`](#rb-email-dedupe) | 9.2 | Duplicate email notifications are suppressed | high | `active` | `index_only` |

### 10. Saved views

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-VIEW-LIST-CREATE-PERSONAL`](#rb-view-list-create-personal) | 10.1 | User can list system views and create a personal view | high | `active` | `detailed` |
| [`RB-VIEW-TEAM-SHARED`](#rb-view-team-shared) | 10.2 | Team member can create and load a team-scoped view | high | `active` | `index_only` |
| [`RB-VIEW-CROSS-ORG-DENY`](#rb-view-cross-org-deny) | 10.3 | Cross-organisation saved view access is denied | critical | `active` | `detailed` |

### 11. Management dashboard

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-DASHBOARD-KPI-LOAD`](#rb-dashboard-kpi-load) | 11.1 | Authorised user can load management dashboard KPIs | high | `active` | `detailed` |
| [`RB-DASHBOARD-KPI-VALUE`](#rb-dashboard-kpi-value) | 11.2 | Dashboard KPI values reflect submitted cases | high | `active` | `index_only` |
| [`RB-DASHBOARD-CSV-EXPORT`](#rb-dashboard-csv-export) | 11.3 | Management dashboard CSV export downloads safely | medium | `blocked_ui` | `detailed` |

### 12. Manual UI checks

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-UI-LAYOUT-RESPONSIVE`](#rb-ui-layout-responsive) | 12.1 | Primary pages remain usable on desktop and mobile widths | medium | `manual_only` | `index_only` |

### 15. Admin navigation (UI remediation)

| ID | Section | Title | Priority | Status | Procedure |
| --- | --- | --- | --- | --- | --- |
| [`RB-NAV-ADMIN-CATEGORIES`](#rb-nav-admin-categories) | 15.1 | Admin locates Categories from overview or navigation | critical | `blocked_ui` | `detailed` |

## Procedures

<a id="rb-auth-login-valid"></a>

### RB-AUTH-LOGIN-VALID — Valid user can sign in

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`

**Role:** Any seeded user  
**Page:** `/login`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/login`.
3. Execute the behaviour: Valid user can sign in.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-AUTH-LOGIN-VALID` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-nav-admin-denied"></a>

### RB-NAV-ADMIN-DENIED — Non-admin is redirected away from administration

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`

**Role:** Cross-role negative test  
**Page:** `API / UI as stated`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `API / UI as stated`.
3. Execute the behaviour: Non-admin is redirected away from administration.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-NAV-ADMIN-DENIED` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-nav-admin-categories"></a>

### RB-NAV-ADMIN-CATEGORIES — Admin locates Categories from overview or navigation

**Priority:** critical  
**Status:** `blocked_ui`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`

**Role:** Admin  
**Page:** `/admin`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.
- **Blocked:** UI remediation is required before this procedure can pass.

**Steps**

1. Sign in as the required role.
2. Open `/admin`.
3. Execute the behaviour: Admin locates Categories from overview or navigation.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-NAV-ADMIN-CATEGORIES` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.
- Until UI work lands, keep this requirement `blocked_ui` and do not mark it complete.

<a id="rb-admin-category-create"></a>

### RB-ADMIN-CATEGORY-CREATE — Admin creates a category

**Priority:** critical  
**Status:** `blocked_ui`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`

**Role:** Admin  
**Page:** `/admin`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.
- **Blocked:** UI remediation is required before this procedure can pass.

**Steps**

1. Sign in as the required role.
2. Open `/admin`.
3. Execute the behaviour: Admin creates a category.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-ADMIN-CATEGORY-CREATE` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.
- Until UI work lands, keep this requirement `blocked_ui` and do not mark it complete.

<a id="rb-admin-category-edit"></a>

### RB-ADMIN-CATEGORY-EDIT — Admin edits an existing category

**Priority:** high  
**Status:** `blocked_ui`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`

**Role:** Admin  
**Page:** `/admin`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.
- **Blocked:** UI remediation is required before this procedure can pass.

**Steps**

1. Sign in as the required role.
2. Open `/admin`.
3. Execute the behaviour: Admin edits an existing category.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-ADMIN-CATEGORY-EDIT` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.
- Until UI work lands, keep this requirement `blocked_ui` and do not mark it complete.

<a id="rb-ui-subcategory-edit"></a>

### RB-UI-SUBCATEGORY-EDIT — Admin edits an existing subcategory

**Priority:** high  
**Status:** `blocked_ui`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`

**Role:** Admin  
**Page:** `/admin`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.
- **Blocked:** UI remediation is required before this procedure can pass.

**Steps**

1. Sign in as the required role.
2. Open `/admin`.
3. Execute the behaviour: Admin edits an existing subcategory.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-UI-SUBCATEGORY-EDIT` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.
- Until UI work lands, keep this requirement `blocked_ui` and do not mark it complete.

<a id="rb-case-create-valid"></a>

### RB-CASE-CREATE-VALID — Requester creates a valid adjustment case

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Requester / Agent / Approver as stated  
**Page:** `/cases`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases`.
3. Execute the behaviour: Requester creates a valid adjustment case.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-CASE-CREATE-VALID` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-case-claim"></a>

### RB-CASE-CLAIM — Agent claims an unassigned group case

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Requester / Agent / Approver as stated  
**Page:** `/cases`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases`.
3. Execute the behaviour: Agent claims an unassigned group case.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-CASE-CLAIM` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-case-acknowledge"></a>

### RB-CASE-ACKNOWLEDGE — Assigned agent acknowledges a case

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Requester / Agent / Approver as stated  
**Page:** `/cases`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases`.
3. Execute the behaviour: Assigned agent acknowledges a case.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-CASE-ACKNOWLEDGE` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-case-wait-requester"></a>

### RB-CASE-WAIT-REQUESTER — Case can wait for requester information

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Requester / Agent / Approver as stated  
**Page:** `/cases`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases`.
3. Execute the behaviour: Case can wait for requester information.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-CASE-WAIT-REQUESTER` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-case-resolve"></a>

### RB-CASE-RESOLVE — Approved case can be resolved after successful execution

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Requester / Agent / Approver as stated  
**Page:** `/cases`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases`.
3. Execute the behaviour: Approved case can be resolved after successful execution.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-CASE-RESOLVE` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-case-reopen"></a>

### RB-CASE-REOPEN — Resolved case can be reopened

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-case-concurrent-claim"></a>

### RB-CASE-CONCURRENT-CLAIM — Concurrent claims result in a single assignee

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Requester / Agent / Approver as stated  
**Page:** `/cases`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases`.
3. Execute the behaviour: Concurrent claims result in a single assignee.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-CASE-CONCURRENT-CLAIM` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-case-concurrent-update"></a>

### RB-CASE-CONCURRENT-UPDATE — Concurrent case updates are conflict-safe

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-case-stale-version"></a>

### RB-CASE-STALE-VERSION — Stale case version is rejected

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-case-timeline-visible"></a>

### RB-CASE-TIMELINE-VISIBLE — Status history timeline is visible on the case

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `playwright`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-case-auto-assign-group"></a>

### RB-CASE-AUTO-ASSIGN-GROUP — Submitted case is auto-assigned to a matching group

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`

**Role:** Requester / Agent / Approver as stated  
**Page:** `/cases`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases`.
3. Execute the behaviour: Submitted case is auto-assigned to a matching group.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-CASE-AUTO-ASSIGN-GROUP` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-case-pending-approval-notify"></a>

### RB-CASE-PENDING-APPROVAL-NOTIFY — Approver is notified when a case reaches pending approval

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `playwright`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-approval-happy"></a>

### RB-APPROVAL-HAPPY — Approver completes a happy-path approval

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Approver (or delegated lead)  
**Page:** `/cases/{id}`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases/{id}`.
3. Execute the behaviour: Approver completes a happy-path approval.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-APPROVAL-HAPPY` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-approval-reject"></a>

### RB-APPROVAL-REJECT — Approver can reject a pending case

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Approver (or delegated lead)  
**Page:** `/cases/{id}`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases/{id}`.
3. Execute the behaviour: Approver can reject a pending case.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-APPROVAL-REJECT` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-approval-duplicate-submit"></a>

### RB-APPROVAL-DUPLICATE-SUBMIT — Duplicate approval submission is rejected or idempotent

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-approval-duplicate-request"></a>

### RB-APPROVAL-DUPLICATE-REQUEST — Duplicate approval request is blocked

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-approval-sequential-two-level"></a>

### RB-APPROVAL-SEQUENTIAL-TWO-LEVEL — High-value cases require sequential two-level approval

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Approver (or delegated lead)  
**Page:** `/cases/{id}`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases/{id}`.
3. Execute the behaviour: High-value cases require sequential two-level approval.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-APPROVAL-SEQUENTIAL-TWO-LEVEL` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-approval-maker-checker-requester"></a>

### RB-APPROVAL-MAKER-CHECKER-REQUESTER — Requester cannot approve their own case

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Approver (or delegated lead)  
**Page:** `/cases/{id}`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases/{id}`.
3. Execute the behaviour: Requester cannot approve their own case.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-APPROVAL-MAKER-CHECKER-REQUESTER` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-approval-maker-checker-agent"></a>

### RB-APPROVAL-MAKER-CHECKER-AGENT — Assigned agent cannot approve the case they processed

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Approver (or delegated lead)  
**Page:** `/cases/{id}`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases/{id}`.
3. Execute the behaviour: Assigned agent cannot approve the case they processed.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-APPROVAL-MAKER-CHECKER-AGENT` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-approval-limit-exceeded"></a>

### RB-APPROVAL-LIMIT-EXCEEDED — Approval is denied when amount exceeds approver limit

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-approval-delegation-valid"></a>

### RB-APPROVAL-DELEGATION-VALID — Valid delegated approval is accepted

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-approval-delegation-expired"></a>

### RB-APPROVAL-DELEGATION-EXPIRED — Expired delegation cannot approve

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-admin-approval-rule-create"></a>

### RB-ADMIN-APPROVAL-RULE-CREATE — Administrator configures an approval rule

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`

**Role:** Admin  
**Page:** `/admin`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/admin`.
3. Execute the behaviour: Administrator configures an approval rule.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-ADMIN-APPROVAL-RULE-CREATE` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-admin-config-version-retained"></a>

### RB-ADMIN-CONFIG-VERSION-RETAINED — Case retains approval rule version selected at request time

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-sla-first-response-breach"></a>

### RB-SLA-FIRST-RESPONSE-BREACH — First-response SLA breach is detected

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Operations agent  
**Page:** `/workspace`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/workspace`.
3. Execute the behaviour: First-response SLA breach is detected.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-SLA-FIRST-RESPONSE-BREACH` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-sla-resolution-pause-resume"></a>

### RB-SLA-RESOLUTION-PAUSE-RESUME — Resolution SLA pauses while waiting for requester

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Operations agent  
**Page:** `/workspace`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/workspace`.
3. Execute the behaviour: Resolution SLA pauses while waiting for requester.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-SLA-RESOLUTION-PAUSE-RESUME` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-sla-breached-queue"></a>

### RB-SLA-BREACHED-QUEUE — Breached cases appear in the agent workspace queue

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `playwright`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-sec-cross-team-deny"></a>

### RB-SEC-CROSS-TEAM-DENY — Unauthorized cross-team case access is denied

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Cross-role negative test  
**Page:** `API / UI as stated`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `API / UI as stated`.
3. Execute the behaviour: Unauthorized cross-team case access is denied.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-SEC-CROSS-TEAM-DENY` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-sec-cross-org-deny"></a>

### RB-SEC-CROSS-ORG-DENY — Unauthorized cross-organisation access is denied

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Cross-role negative test  
**Page:** `API / UI as stated`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `API / UI as stated`.
3. Execute the behaviour: Unauthorized cross-organisation access is denied.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-SEC-CROSS-ORG-DENY` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-sec-internal-comment-hidden"></a>

### RB-SEC-INTERNAL-COMMENT-HIDDEN — Internal comments are hidden from requesters

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-job-retry"></a>

### RB-JOB-RETRY — Failed background job is retried

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-job-dead-letter"></a>

### RB-JOB-DEAD-LETTER — Exhausted job moves to dead-letter

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-api-idempotency-key"></a>

### RB-API-IDEMPOTENCY-KEY — Duplicate Idempotency-Key returns consistent result

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Service / test-control  
**Page:** `Simulator / jobs`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `Simulator / jobs`.
3. Execute the behaviour: Duplicate Idempotency-Key returns consistent result.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-API-IDEMPOTENCY-KEY` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-wallet-success"></a>

### RB-WALLET-SUCCESS — Mock wallet execute succeeds

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Agent after approval  
**Page:** `Simulator / case detail`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `Simulator / case detail`.
3. Execute the behaviour: Mock wallet execute succeeds.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-WALLET-SUCCESS` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-wallet-temp-failure"></a>

### RB-WALLET-TEMP-FAILURE — Temporary wallet failure is retryable

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-wallet-retry-success"></a>

### RB-WALLET-RETRY-SUCCESS — Wallet retries then succeeds for the same key

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Agent after approval  
**Page:** `Simulator / case detail`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `Simulator / case detail`.
3. Execute the behaviour: Wallet retries then succeeds for the same key.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-WALLET-RETRY-SUCCESS` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-wallet-unknown-inquiry"></a>

### RB-WALLET-UNKNOWN-INQUIRY — Uncertain timeout requires status inquiry

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Agent after approval  
**Page:** `Simulator / case detail`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `Simulator / case detail`.
3. Execute the behaviour: Uncertain timeout requires status inquiry.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-WALLET-UNKNOWN-INQUIRY` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-wallet-exec-after-approval"></a>

### RB-WALLET-EXEC-AFTER-APPROVAL — Approval queues wallet execution to SUCCEEDED

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Agent after approval  
**Page:** `Simulator / case detail`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `Simulator / case detail`.
3. Execute the behaviour: Approval queues wallet execution to SUCCEEDED.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-WALLET-EXEC-AFTER-APPROVAL` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-wallet-exec-idempotent"></a>

### RB-WALLET-EXEC-IDEMPOTENT — Duplicate wallet execution is idempotent

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Agent after approval  
**Page:** `Simulator / case detail`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `Simulator / case detail`.
3. Execute the behaviour: Duplicate wallet execution is idempotent.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-WALLET-EXEC-IDEMPOTENT` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-wallet-concurrent-workers"></a>

### RB-WALLET-CONCURRENT-WORKERS — Concurrent integration workers leave a single success

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-wallet-timeout-safe-retry"></a>

### RB-WALLET-TIMEOUT-SAFE-RETRY — Confirmed non-processing timeout allows safe retry

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-exception-permanent-failure"></a>

### RB-EXCEPTION-PERMANENT-FAILURE — Permanent wallet failure creates an operations exception

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Team lead / ops  
**Page:** `/operations/exceptions`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/operations/exceptions`.
3. Execute the behaviour: Permanent wallet failure creates an operations exception.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-EXCEPTION-PERMANENT-FAILURE` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-exception-resolve"></a>

### RB-EXCEPTION-RESOLVE — Operations can resolve an operational exception

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Team lead / ops  
**Page:** `/operations/exceptions`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/operations/exceptions`.
3. Execute the behaviour: Operations can resolve an operational exception.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-EXCEPTION-RESOLVE` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-exception-retry-ui"></a>

### RB-EXCEPTION-RETRY-UI — Team lead can retry a retryable failure from exceptions UI

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `playwright`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-email-outbox-deliver"></a>

### RB-EMAIL-OUTBOX-DELIVER — Email outbox row is created when flag enabled

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-email-dedupe"></a>

### RB-EMAIL-DEDUPE — Duplicate email notifications are suppressed

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-view-list-create-personal"></a>

### RB-VIEW-LIST-CREATE-PERSONAL — User can list system views and create a personal view

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Agent  
**Page:** `/cases`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases`.
3. Execute the behaviour: User can list system views and create a personal view.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-VIEW-LIST-CREATE-PERSONAL` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-view-team-shared"></a>

### RB-VIEW-TEAM-SHARED — Team member can create and load a team-scoped view

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-view-cross-org-deny"></a>

### RB-VIEW-CROSS-ORG-DENY — Cross-organisation saved view access is denied

**Priority:** critical  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`

**Role:** Agent  
**Page:** `/cases`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/cases`.
3. Execute the behaviour: Cross-organisation saved view access is denied.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-VIEW-CROSS-ORG-DENY` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-dashboard-kpi-load"></a>

### RB-DASHBOARD-KPI-LOAD — Authorised user can load management dashboard KPIs

**Priority:** high  
**Status:** `active`  
**Procedure level:** `detailed`  
**Expected layers:** `simulator`, `playwright`

**Role:** Team lead / manager  
**Page:** `/dashboard/management`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.

**Steps**

1. Sign in as the required role.
2. Open `/dashboard/management`.
3. Execute the behaviour: Authorised user can load management dashboard KPIs.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-DASHBOARD-KPI-LOAD` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.

<a id="rb-dashboard-kpi-value"></a>

### RB-DASHBOARD-KPI-VALUE — Dashboard KPI values reflect submitted cases

**Priority:** high  
**Status:** `active`  
**Procedure level:** `index_only`  
**Expected layers:** `simulator`

_Index only — detailed field-level steps will be added in a later enrichment pass._

<a id="rb-dashboard-csv-export"></a>

### RB-DASHBOARD-CSV-EXPORT — Management dashboard CSV export downloads safely

**Priority:** medium  
**Status:** `blocked_ui`  
**Procedure level:** `detailed`  
**Expected layers:** `playwright`

**Role:** Team lead / manager  
**Page:** `/dashboard/management`

**Preconditions**

- Local app and Supabase are running with seed data.
- Actor has the role listed above.
- **Blocked:** UI remediation is required before this procedure can pass.

**Steps**

1. Sign in as the required role.
2. Open `/dashboard/management`.
3. Execute the behaviour: Management dashboard CSV export downloads safely.
4. Confirm expected UI/API outcome and any audit side effects.
5. Clean up created test data when the scenario leaves durable rows.

**Expected results**

- The behaviour described by `RB-DASHBOARD-CSV-EXPORT` succeeds (or fails as specified for negative tests).
- Linked automation (`expectedLayers`) covers the same behaviour.
- Until UI work lands, keep this requirement `blocked_ui` and do not mark it complete.

<a id="rb-ui-layout-responsive"></a>

### RB-UI-LAYOUT-RESPONSIVE — Primary pages remain usable on desktop and mobile widths

**Priority:** medium  
**Status:** `manual_only`  
**Procedure level:** `index_only`  
**Expected layers:** `manual`

_Index only — detailed field-level steps will be added in a later enrichment pass._

## Traceability

- Simulator scenarios: `tools/case-simulator/scenarios/*.yaml` (`id: SIM-NNN`, `runbookRefs`)
- Playwright: `e2e/**/*.spec.ts` titles include `[RB-…]`
- Sync gate: `npm run test:runbook-sync`
- Coverage: `npm run generate:runbook-coverage` → `tools/case-simulator/reports/runbook-coverage.*`
