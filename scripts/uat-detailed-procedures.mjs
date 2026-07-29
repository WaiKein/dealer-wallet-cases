/**
 * Detailed UAT procedures for runbook requirement IDs (RB-*).
 * Used by build-uat-journeys enrichment and coverage verification.
 *
 * Seed password for all actors: Password123!
 * Actors: admin@example.com, requester@example.com, agent@example.com,
 *         approver@example.com, teamlead@example.com
 */

export const DETAILED = {
  "RB-AUTH-LOGIN-VALID": {
    role: "Any seeded user (e.g. ACTOR-ADMIN / admin@example.com)",
    page: "/login",
    preconditions: [
      "Local Supabase and app are running with seed data (TD-SEED-USERS).",
      "Browser session is signed out.",
    ],
    dataTable:
      "| Field | Value |\n| --- | --- |\n| Email | admin@example.com |\n| Password | Password123! |",
    steps: [
      {
        step: 1,
        action:
          "Open /login. Enter Email admin@example.com and Password Password123!. Click Sign in.",
        expected:
          "Redirect to /dashboard (or /cases / /workspace / /admin for the role). Header shows the user's name and role. No error banner.",
      },
      {
        step: 2,
        action: "Repeat sign-in for requester@example.com and agent@example.com.",
        expected:
          "Each valid seeded account reaches an authenticated landing page without credential errors (ER-SAVE-01 not applicable; ER-DENY-01 must not occur).",
      },
    ],
    finalState: ["Tester is signed in with a valid session."],
    cleanup: ["Sign out via header Sign out button; confirm redirect to /login."],
  },

  "RB-NAV-ADMIN-DENIED": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/admin",
    preconditions: [
      "TD-SEED-USERS: agent@example.com exists and is not an admin.",
      "Signed out before starting.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Sign in as agent@example.com / Password123!. Confirm header nav does not offer Admin (or it is absent for non-admins).",
        expected: "Agent workspace loads; no Administration console access in normal nav.",
      },
      {
        step: 2,
        action: "Manually navigate to /admin.",
        expected:
          "Browser redirects away from administration (typically to /dashboard). ER-DENY-01: no admin configuration UI is rendered.",
      },
    ],
    finalState: ["Non-admin cannot reach /admin content."],
    cleanup: ["Sign out."],
  },

  "RB-NAV-ADMIN-CATEGORIES": {
    role: "ACTOR-ADMIN (admin@example.com)",
    page: "/admin",
    preconditions: [
      "Signed in as admin@example.com.",
      "TD-CATEGORY-01 codes are free or from a prior cleanup run.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: 'In header nav, click Admin. Confirm URL is /admin and page title "Administration".',
        expected:
          'Overview grid shows card link "Categories" with body "Case taxonomy categories."',
      },
      {
        step: 2,
        action: 'Click the Categories card (or admin sidebar link Categories).',
        expected:
          "URL is /admin/categories. Page shows Search and Status filter with Apply, plus Create category form.",
      },
      {
        step: 3,
        action: "Use admin sidebar Subcategories link, then return via Categories.",
        expected: "Both routes load under Administration layout without error.",
      },
    ],
    finalState: ["Admin can reach /admin/categories from overview and sidebar."],
    cleanup: ["Sign out."],
  },

  "RB-ADMIN-CATEGORY-CREATE": {
    role: "ACTOR-ADMIN (admin@example.com)",
    page: "/admin/categories",
    preconditions: [
      "Signed in as admin@example.com.",
      "Code UAT-CAT-01 from TD-CATEGORY-01 is not already an active duplicate.",
    ],
    dataTable:
      "| Field | Value |\n| --- | --- |\n| Code | UAT-CAT-01 |\n| Name | UAT Category 01 |\n| Active | checked |\n| Change reason | UAT create category |",
    steps: [
      {
        step: 1,
        action: "Open /admin/categories.",
        expected: 'Create category form is visible with fields Code, Name, Active, Change reason and submit "Create category".',
      },
      {
        step: 2,
        action:
          "Fill Code UAT-CAT-01, Name UAT Category 01, leave Active checked, Change reason UAT create category. Click Create category.",
        expected:
          "Page refreshes; new row UAT Category 01 (UAT-CAT-01) appears in the list with Active badge. ER-SAVE-01: save succeeds without validation error.",
      },
      {
        step: 3,
        action:
          "Search UAT-CAT-01 in Search field, Status Active, click Apply.",
        expected: "Filtered list includes the created category.",
      },
    ],
    finalState: [
      "Category UAT-CAT-01 exists and is Active in admin list.",
      "ER-AUDIT-01: change_reason UAT create category was required and persisted server-side.",
    ],
    cleanup: [
      "Edit row: uncheck Active, Change reason UAT cleanup deactivate, Save (ER-DEACTIVATE-01).",
    ],
  },

  "RB-ADMIN-CATEGORY-EDIT": {
    role: "ACTOR-ADMIN (admin@example.com)",
    page: "/admin/categories",
    preconditions: [
      "RB-ADMIN-CATEGORY-CREATE completed: UAT-CAT-01 exists and is Active.",
    ],
    dataTable:
      "| Field | Initial | Edited |\n| --- | --- | --- |\n| Name | UAT Category 01 | UAT Category 01 Edited |\n| Change reason | — | UAT edit category |",
    steps: [
      {
        step: 1,
        action:
          "On /admin/categories, locate row UAT Category 01 (UAT-CAT-01). Open its Edit form (title Edit UAT Category 01).",
        expected: "Inline edit form shows Code, Name, Active checkbox, Change reason, Save button.",
      },
      {
        step: 2,
        action:
          "Change Name to UAT Category 01 Edited. Enter Change reason UAT edit category. Click Save.",
        expected:
          "List row title updates to UAT Category 01 Edited. Active badge unchanged. ER-SAVE-01.",
      },
      {
        step: 3,
        action:
          "Verify ER-AUDIT-01: change_reason was mandatory on save; values persist after refresh.",
        expected:
          "Edited name remains after browser refresh. Configuration audit captured with change_reason UAT edit category (see Organisation admin Configuration history pattern).",
      },
    ],
    finalState: ["UAT-CAT-01 name is UAT Category 01 Edited."],
    cleanup: [
      "Deactivate: uncheck Active, Change reason UAT cleanup deactivate, confirm deactivation dialog, Save (ER-DEACTIVATE-01).",
    ],
  },

  "RB-UI-SUBCATEGORY-EDIT": {
    role: "ACTOR-ADMIN (admin@example.com)",
    page: "/admin/subcategories",
    preconditions: [
      "Wallet adjustments category exists from seed.",
      "Note: subcategory list currently has Create + list only (no inline Edit form); blocked_ui for edit until remediated.",
    ],
    dataTable:
      "| Field | Value |\n| --- | --- |\n| Category | Wallet adjustments |\n| Code | UAT-SUB-01 |\n| Name | UAT Subcategory 01 |\n| Active | checked |\n| Change reason | UAT create subcategory |",
    steps: [
      {
        step: 1,
        action:
          "Open /admin/subcategories. In Create subcategory form select Category Wallet adjustments, Code UAT-SUB-01, Name UAT Subcategory 01, Active checked, Change reason UAT create subcategory. Click Create subcategory.",
        expected:
          "New row UAT Subcategory 01 (UAT-SUB-01) appears with Active badge. ER-SAVE-01.",
      },
      {
        step: 2,
        action:
          "When inline Edit subcategory form is available (mirrors Categories Edit pattern): open Edit UAT Subcategory 01, change Name to UAT Subcategory 01 Edited, Change reason UAT edit subcategory, click Save.",
        expected:
          "Row updates; ER-AUDIT-01 records change_reason. Until UI ships, skip and track as blocked_ui.",
      },
      {
        step: 3,
        action:
          "Search UAT-SUB-01, Status Active, Apply — confirm row visible.",
        expected: "Subcategory discoverable via admin filters.",
      },
    ],
    finalState: ["UAT-SUB-01 exists (created); edit verified when Edit form is present."],
    cleanup: [
      "When edit UI exists: deactivate with Change reason UAT cleanup deactivate (ER-DEACTIVATE-01).",
    ],
  },

  "RB-ADMIN-APPROVAL-RULE-CREATE": {
    role: "ACTOR-ADMIN (admin@example.com)",
    page: "/admin/approval-rules",
    preconditions: [
      "Signed in as admin@example.com.",
      "Rule code UAT_RULE_01 from TD-APPROVAL-CONTROLS-01 is unused.",
    ],
    dataTable:
      "| Field | Value |\n| --- | --- |\n| Code | UAT_RULE_01 |\n| Name | UAT approval rule 01 |\n| Sequence | 5 |\n| Min amount | 1 |\n| Max amount | 50000 |\n| Required approver role | approver |\n| Approval levels | 1 |\n| Active | checked |\n| Change reason | UAT create approval rule |",
    steps: [
      {
        step: 1,
        action: "Open /admin/approval-rules (Admin → sidebar Approval rules).",
        expected: 'Create approval rule form with Code, Name, Sequence, amounts, role, levels, Change reason.',
      },
      {
        step: 2,
        action: "Fill TD-APPROVAL-CONTROLS-01 values above. Click Create approval rule.",
        expected:
          "List shows UAT approval rule 01 (UAT_RULE_01) with Active badge and version. ER-SAVE-01.",
      },
    ],
    finalState: ["Approval rule UAT_RULE_01 exists in admin list."],
    cleanup: ["Leave rule for approval journeys or deactivate when edit UI supports it."],
  },

  "RB-CASE-CREATE-VALID": {
    role: "ACTOR-REQUESTER (requester@example.com)",
    page: "/cases/new",
    preconditions: [
      "Signed in as requester@example.com.",
      "Wallet adjustments / Duplicate credit subcategory active in seed.",
    ],
    dataTable:
      "| Field | Value |\n| --- | --- |\n| Title | UAT Happy Path Case |\n| Description | UAT duplicate credit adjustment |\n| Adjustment amount | 210.00 |\n| Adjustment type | Credit |\n| Category | Wallet adjustments |\n| Subcategory | Duplicate credit |",
    steps: [
      {
        step: 1,
        action: "Open /cases/new (header New Case or direct URL).",
        expected: "Case creation form with Title, Description, amount, type, category, subcategory.",
      },
      {
        step: 2,
        action: "Enter TD-CASE-HAPPY-01 field values from data table.",
        expected: "All required fields accept input; subcategory options load after category.",
      },
      {
        step: 3,
        action: 'Click Submit case.',
        expected:
          "Redirect to /cases/{uuid}. Case detail shows submitted title and Submitted status. ER-SAVE-01.",
      },
    ],
    finalState: ["Case UAT Happy Path Case exists in Submitted status."],
    cleanup: ["Leave case for downstream happy-path steps or resolve in later RBs."],
  },

  "RB-CASE-AUTO-ASSIGN-GROUP": {
    role: "ACTOR-REQUESTER (requester@example.com)",
    page: "/cases/new",
    preconditions: [
      "Assignment rules route Wallet adjustments / Duplicate credit to Wallet Operations group (seed).",
    ],
    dataTable:
      "| Field | Value |\n| --- | --- |\n| Category | Wallet adjustments |\n| Subcategory | Duplicate credit |",
    steps: [
      {
        step: 1,
        action:
          "Create case per RB-CASE-CREATE-VALID (Duplicate credit, amount 125.50 or 210.00).",
        expected: "Case detail page loads after submit.",
      },
      {
        step: 2,
        action: "On case detail, locate assignment / group panel.",
        expected:
          'Assigned group shows "Wallet Operations" (or seeded matching group name). Case is group-owned before individual claim.',
      },
    ],
    finalState: ["Case is assigned to Wallet Operations group, assignee empty until claim."],
    cleanup: ["Continue happy path or leave for agent claim test."],
  },

  "RB-CASE-CLAIM": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/workspace",
    preconditions: [
      "Unassigned group case from RB-CASE-CREATE-VALID / RB-CASE-AUTO-ASSIGN-GROUP exists.",
      "agent@example.com is member of Wallet Operations (Sam Operations).",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Sign in as agent@example.com. Open /workspace. Section Unassigned cases for my groups lists the case.",
        expected: "Target case title visible in unassigned queue.",
      },
      {
        step: 2,
        action: "Open the case from workspace link. Click Claim case.",
        expected:
          'Assigned agent shows "Sam Operations". Claim button no longer available to others.',
      },
    ],
    finalState: ["Case assigned to agent@example.com (Sam Operations)."],
    cleanup: ["Sign out agent."],
  },

  "RB-CASE-ACKNOWLEDGE": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/cases/{id}",
    preconditions: ["RB-CASE-CLAIM completed: case assigned to agent."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "On claimed case detail, click Acknowledge.",
        expected: 'Banner or message "Case acknowledged by agent." ER-SAVE-01.',
      },
      {
        step: 2,
        action: "Refresh page.",
        expected: "Acknowledged state persists; workflow actions for agent become available.",
      },
    ],
    finalState: ["Case acknowledged by assigned agent."],
    cleanup: ["Proceed to approval path or sign out."],
  },

  "RB-APPROVAL-HAPPY": {
    role: "ACTOR-APPROVER (approver@example.com)",
    page: "/cases/{id}",
    preconditions: [
      "Case is Pending Approval (agent moved Under Review → Pending Approval).",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Sign in as approver@example.com. Open /cases and open the pending case.",
        expected: "Status Pending Approval; approval panel visible.",
      },
      {
        step: 2,
        action:
          'Click Move to Approved, then Confirm status change in dialog.',
        expected:
          'Status becomes Approved. ER-SAVE-01; audit timeline records Pending Approval → Approved.',
      },
    ],
    finalState: ["Case status Approved; wallet execution job queued."],
    cleanup: ["Sign out approver."],
  },

  "RB-CASE-PENDING-APPROVAL-NOTIFY": {
    role: "ACTOR-APPROVER (approver@example.com)",
    page: "/cases/{id}",
    preconditions: [
      "Agent transitioned case to Pending Approval on a case requiring approval.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "As agent@example.com: Move to Under Review → Confirm status change, then Move to Pending Approval → Confirm status change.",
        expected: 'Case status Pending Approval within 15s.',
      },
      {
        step: 2,
        action:
          "Sign out agent. Sign in as approver@example.com. Click Notifications bell / panel.",
        expected:
          'In-app notification "Approval requested" for the case is visible (ER-SAVE-01 for notification row).',
      },
    ],
    finalState: ["Approver has unread Approval requested notification."],
    cleanup: ["Sign out approver."],
  },

  "RB-CASE-RESOLVE": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/cases/{id}",
    preconditions: [
      "Case Approved and wallet mock configured for SUCCESS.",
      "Jobs drained so integration shows Succeeded.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Configure wallet mock SUCCESS (test-control or simulator). POST /api/jobs/tick twice to drain execution jobs.",
        expected: "Integration execution status Succeeded on case detail.",
      },
      {
        step: 2,
        action:
          "As agent@example.com open case. Click Move to Resolved → Confirm status change (add resolution notes if prompted).",
        expected: 'Status Resolved. ER-SAVE-01.',
      },
    ],
    finalState: ["Case Resolved after successful wallet execution."],
    cleanup: ["Sign out."],
  },

  "RB-CASE-TIMELINE-VISIBLE": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/cases/{id}",
    preconditions: ["Case progressed through submit → review → approval → resolved."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Open resolved case detail. Scroll to Status history section.",
        expected: 'Heading "Status history" visible.',
      },
      {
        step: 2,
        action: "Review timeline entries.",
        expected:
          "Entries include Submitted → Under Review, Pending Approval → Approved, Approved → Resolved (and intermediate transitions). ER-AUDIT-01.",
      },
    ],
    finalState: ["Full status history visible on case."],
    cleanup: ["Sign out."],
  },

  "RB-CASE-WAIT-REQUESTER": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/cases/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    preconditions: [
      "Seed case bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb exists (or create + advance to Under Review).",
      "Alternative automation: npm run simulate -- --name=SIM-003",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Sign in as agent@example.com. Open seeded case /cases/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.",
        expected: "Case detail loads for agent.",
      },
      {
        step: 2,
        action:
          'Click Move to Waiting for requester → Confirm status change.',
        expected:
          'Status Waiting for requester. SLA panel shows PAUSED for resolution SLA.',
      },
      {
        step: 3,
        action:
          "(Optional SIM-003) Run npm run simulate -- --name=SIM-003 or /simulator → Requester information required.",
        expected:
          "After requester submits information, status returns Under Review; resolution SLA RUNNING; sla_paused and sla_resumed audit events exist.",
      },
    ],
    finalState: ["Case can enter and exit Waiting for requester."],
    cleanup: ["Sign out; revert seed case if modified."],
  },

  "RB-CASE-REOPEN": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: [
      "App running with test-control enabled.",
      "Simulator UI at /simulator or CLI available.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Run npm run simulate -- --name=SIM-010 (Reopen resolved case) OR open /simulator, select SIM-010, Run.",
        expected: "Scenario actions complete without error.",
      },
      {
        step: 2,
        action: "Review scenario report assertions.",
        expected:
          "case_status UNDER_REVIEW after reopen; notification case_reopening to requester; audit event case_reopened.",
      },
    ],
    finalState: ["Resolved case reopened to Under Review in simulator fixture."],
    cleanup: ["Simulator cleanup removes [sim-reopen] prefixed cases."],
  },

  "RB-CASE-STALE-VERSION": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Test-control / simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-013 (Stale version conflict).",
        expected: "Scenario completes; stale approve attempt returns error.",
      },
      {
        step: 2,
        action: "Inspect assertions.",
        expected:
          "Case remains UNDER_REVIEW (ER-DENY-01). Optimistic lock rejects expectedVersion 999.",
      },
    ],
    finalState: ["Stale version update rejected; no erroneous status change."],
    cleanup: ["Simulator removes [sim-stale-version] cases."],
  },

  "RB-CASE-CONCURRENT-UPDATE": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-012 (Concurrent case update).",
        expected: "Second transition with stale version fails.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "Final status WAITING_FOR_REQUESTER; conflicting approve with expectedVersion 1 rejected (ER-DENY-01).",
      },
    ],
    finalState: ["Concurrent update conflict handled safely."],
    cleanup: ["Simulator removes [sim-concurrent] cases."],
  },

  "RB-CASE-CONCURRENT-CLAIM": {
    role: "ACTOR-AGENT + ACTOR-TEAMLEAD",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-009 (Two agents concurrently claiming one case).",
        expected: "First claim (agent) succeeds; second (teamlead) errors.",
      },
      {
        step: 2,
        action: "Review assigned_agent assertion.",
        expected:
          "Exactly one assignee: agent@example.com. ER-DENY-01 for loser claim.",
      },
    ],
    finalState: ["Single assignee after concurrent claim race."],
    cleanup: ["Simulator removes [sim-race-claim] cases."],
  },

  "RB-APPROVAL-REJECT": {
    role: "ACTOR-APPROVER (approver@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-002 (Approval rejection).",
        expected: "Approver reject_case action succeeds.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "case_status REJECTED; requester receives approval_decision notification.",
      },
    ],
    finalState: ["Case rejected with audit and requester notification."],
    cleanup: ["Simulator removes [sim-reject] cases."],
  },

  "RB-APPROVAL-DUPLICATE-SUBMIT": {
    role: "ACTOR-APPROVER (approver@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-008 (Duplicate approval submission).",
        expected: "First approve succeeds; second approve expectError.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected: "case_status remains APPROVED; duplicate submit rejected or idempotent (ER-DENY-01).",
      },
    ],
    finalState: ["Only one approval decision applied."],
    cleanup: ["Simulator removes [sim-dup-approve] cases."],
  },

  "RB-APPROVAL-DUPLICATE-REQUEST": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-011 (Duplicate approval request).",
        expected: "Second request_approval returns error.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected: "case_status PENDING_APPROVAL; duplicate request blocked (ER-DENY-01).",
      },
    ],
    finalState: ["Single pending approval request on case."],
    cleanup: ["Simulator removes [sim-dup-approval-req] cases."],
  },

  "RB-APPROVAL-SEQUENTIAL-TWO-LEVEL": {
    role: "ACTOR-APPROVER (approver@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled; admin can create rules via SIM-026 setup."],
    dataTable:
      "| Field | Value |\n| --- | --- |\n| Rule code | sim_high_sequential |\n| Amount | 15000 |\n| Approval levels | 2 |",
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-026 (High-value sequential two-level approval).",
        expected: "High-value case matches sim_high_sequential rule.",
      },
      {
        step: 2,
        action: "Review assertions after first approve_level.",
        expected:
          "approval_rule_selected sim_high_sequential; approval_level_sequence levels=2 approvedCount=1 pendingCount=1; case_status PENDING_APPROVAL.",
      },
    ],
    finalState: ["Two-level sequential approval in progress after first level."],
    cleanup: ["Simulator removes [sim-p9-seq] cases and test rule."],
  },

  "RB-APPROVAL-MAKER-CHECKER-REQUESTER": {
    role: "ACTOR-REQUESTER (requester@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-027 (Requester self-approval denied).",
        expected: "requester approve_case expectError true.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "error_code FORBIDDEN; maker_checker_denial; case_status PENDING_APPROVAL (ER-DENY-01).",
      },
    ],
    finalState: ["Requester cannot approve own case."],
    cleanup: ["Simulator removes [sim-p9-self] cases."],
  },

  "RB-APPROVAL-MAKER-CHECKER-AGENT": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-028 (Assigned agent maker-checker denial).",
        expected: "Agent approve after processing returns error.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "error_code FORBIDDEN; maker_checker_denial; case_status PENDING_APPROVAL (ER-DENY-01).",
      },
    ],
    finalState: ["Assigned agent cannot approve case they processed."],
    cleanup: ["Simulator removes [sim-p9-mc] cases."],
  },

  "RB-APPROVAL-LIMIT-EXCEEDED": {
    role: "ACTOR-APPROVER (approver@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable:
      "| Field | Value |\n| --- | --- |\n| Rule | sim_low_limit (approver_limit 100) |\n| Amount | 25000 |",
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-029 (Approver exceeds approval limit).",
        expected: "approve_case expectError for approver.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "approval_rule_selected sim_low_limit; error_code FORBIDDEN; approval_limit_enforcement; case stays PENDING_APPROVAL (ER-DENY-01).",
      },
    ],
    finalState: ["Approval denied when amount exceeds approver limit."],
    cleanup: ["Simulator removes [sim-p9-lim] cases."],
  },

  "RB-APPROVAL-DELEGATION-VALID": {
    role: "ACTOR-TEAMLEAD (teamlead@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled; approver can create delegations."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-030 (Valid delegated approval).",
        expected: "Team lead approves via active delegation from approver.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected: "case_status APPROVED; complete_audit_trail includes status_change events.",
      },
    ],
    finalState: ["Delegated approval accepted; case Approved."],
    cleanup: ["Simulator deactivates test delegation; removes [sim-p9-del] cases."],
  },

  "RB-APPROVAL-DELEGATION-EXPIRED": {
    role: "ACTOR-TEAMLEAD (teamlead@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-031 (Expired delegation denied).",
        expected: "teamlead approve_case expectError with expired delegation.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "error_code FORBIDDEN; delegation_validity denial; case_status PENDING_APPROVAL (ER-DENY-01).",
      },
    ],
    finalState: ["Expired delegation cannot approve."],
    cleanup: ["Simulator removes [sim-p9-exp] cases."],
  },

  "RB-ADMIN-CONFIG-VERSION-RETAINED": {
    role: "ACTOR-ADMIN (admin@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-038 (Admin configuration change retains rule version on case).",
        expected:
          "Case requests approval with sim_cfg_version; admin updates rule after request.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "approval_rule_selected still sim_cfg_version on case (version at request time retained); complete_audit_trail status_change events (ER-AUDIT-01).",
      },
    ],
    finalState: ["Case keeps approval rule code/version from request time despite admin update."],
    cleanup: ["Simulator removes [sim-p9-cfg] cases."],
  },

  "RB-SLA-FIRST-RESPONSE-BREACH": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: [
      "Simulator test-control clock enabled.",
      "UI spot-check: seeded breached case Duplicate deposit correction in /workspace.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-004 (First-response SLA breach).",
        expected: "Clock advanced 2h; SLA processor marks first_response BREACHED.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "sla_state first_response BREACHED; sla_breach notification to agent; audit sla_breach event.",
      },
      {
        step: 3,
        action:
          "(UI) As agent@example.com open /workspace → Breached cases section.",
        expected: "Breached seed case Duplicate deposit correction visible (RB-SLA-BREACHED-QUEUE overlap).",
      },
    ],
    finalState: ["First-response SLA breach detected and surfaced."],
    cleanup: ["Simulator removes [sim-sla-fr] cases; reset clock if needed."],
  },

  "RB-SLA-RESOLUTION-PAUSE-RESUME": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/cases/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    preconditions: [
      "Case in Under Review or use SIM-005 for full pause/resume cycle.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "(UI) Move seeded case to Waiting for requester (see RB-CASE-WAIT-REQUESTER).",
        expected: "Resolution SLA shows PAUSED badge on case detail.",
      },
      {
        step: 2,
        action: "Run npm run simulate -- --name=SIM-005 (Resolution SLA pause and resume).",
        expected: "Wait → submit information returns case to Under Review.",
      },
      {
        step: 3,
        action: "Review SIM-005 assertions.",
        expected:
          "resolution sla_state RUNNING; audit sla_paused and sla_resumed events (ER-AUDIT-01).",
      },
    ],
    finalState: ["Resolution SLA pauses while waiting for requester and resumes after response."],
    cleanup: ["Sign out; simulator cleanup [sim-sla-pause]."],
  },

  "RB-SLA-BREACHED-QUEUE": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/workspace",
    preconditions: ["Seed includes breached case Duplicate deposit correction."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Sign in as agent@example.com. Open /workspace.",
        expected: 'Section "Breached cases" is visible.',
      },
      {
        step: 2,
        action: "Locate Duplicate deposit correction in breached queue.",
        expected: "Breached SLA case listed and openable.",
      },
    ],
    finalState: ["Agent workspace breached queue shows seeded breached case."],
    cleanup: ["Sign out."],
  },

  "RB-JOB-RETRY": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled; jobs.tick secret configured."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-014 (Failed job retry).",
        expected: "Test job jobs.fail_once succeeds after 3 drain attempts.",
      },
      {
        step: 2,
        action: "Review job_status assertion.",
        expected: "job status succeeded with minAttempts 3.",
      },
    ],
    finalState: ["Failed background job retried until success."],
    cleanup: ["No persistent UI state."],
  },

  "RB-JOB-DEAD-LETTER": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-015 (Dead-letter job).",
        expected: "Job exhausts maxAttempts without success.",
      },
      {
        step: 2,
        action: "Review job_status assertion.",
        expected: "job status dead_letter with minAttempts 2.",
      },
    ],
    finalState: ["Exhausted job moved to dead-letter state."],
    cleanup: ["No persistent UI state."],
  },

  "RB-API-IDEMPOTENCY-KEY": {
    role: "ACTOR-REQUESTER (requester@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-016 (Duplicate idempotency key).",
        expected: "Two creates with same Idempotency-Key return same case; third with different body errors.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "Original case SUBMITTED; replay consistent; conflicting payload rejected (ER-DENY-01).",
      },
    ],
    finalState: ["Duplicate Idempotency-Key returns consistent result."],
    cleanup: ["Simulator removes [sim-idem] cases."],
  },

  "RB-EMAIL-OUTBOX-DELIVER": {
    role: "ACTOR-ADMIN (admin@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enables email_notifications_enabled flag during scenario."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-023 (Email outbox delivery when flag enabled).",
        expected: "Approval request triggers email pipeline after jobs drain.",
      },
      {
        step: 2,
        action: "Review email_delivery_exists assertion.",
        expected:
          "email outbox row for approval_requested with status DELIVERED for case.",
      },
    ],
    finalState: ["Email outbox DELIVERED row created when flag enabled."],
    cleanup: ["Scenario resets email_notifications_enabled to false; removes [sim-email] cases."],
  },

  "RB-EMAIL-DEDUPE": {
    role: "ACTOR-ADMIN (admin@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-034 (Duplicate email suppression).",
        expected: "Multiple notification worker runs do not duplicate delivery.",
      },
      {
        step: 2,
        action: "Review email_dedupe assertion.",
        expected:
          "At most one DELIVERED outbox row for approval_requested on case (maxDelivered 1).",
      },
    ],
    finalState: ["Duplicate email notifications suppressed."],
    cleanup: ["Scenario disables email flag; removes [sim-p9-eded] cases."],
  },

  "RB-WALLET-SUCCESS": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/cases/{id}",
    preconditions: [
      "Wallet mock reset and configured SUCCESS.",
      "Approved case ready for execution OR use SIM-017 for API-level check.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "(UI path per RB-CASE-RESOLVE) Configure mock SUCCESS, drain jobs, open approved case.",
        expected: 'Integration status Succeeded; outcome SUCCESS (ER-SAVE-01).',
      },
      {
        step: 2,
        action: "Optional: npm run simulate -- --name=SIM-017 (Wallet mock API success).",
        expected:
          "wallet_execute_outcome SUCCESS, processingCertainty PROCESSED, requiresStatusInquiry false.",
      },
    ],
    finalState: ["Mock wallet execute succeeds."],
    cleanup: ["Reset wallet mock via test-control if needed."],
  },

  "RB-WALLET-EXEC-AFTER-APPROVAL": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled; wallet mock SUCCESS."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-021 (Integration execution after approval).",
        expected: "Approve then drain_jobs twice.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "case_status APPROVED; integration_execution_status SUCCEEDED.",
      },
    ],
    finalState: ["Approval queues wallet execution to SUCCEEDED."],
    cleanup: ["Simulator removes [sim-exec] cases."],
  },

  "RB-WALLET-TEMP-FAILURE": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-018 (Wallet mock temporary failure).",
        expected: "execute_wallet_adjustment returns TEMPORARY_FAILURE.",
      },
      {
        step: 2,
        action: "Review wallet_execute_outcome assertion.",
        expected:
          "outcome TEMPORARY_FAILURE; processingCertainty NOT_PROCESSED; requiresStatusInquiry false; canScheduleExecuteRetry true.",
      },
    ],
    finalState: ["Temporary wallet failure marked retryable without inquiry."],
    cleanup: ["Reset wallet mock."],
  },

  "RB-WALLET-RETRY-SUCCESS": {
    role: "ACTOR-TEAMLEAD (teamlead@example.com)",
    page: "/operations/exceptions",
    preconditions: [
      "Retry case created with TEMPORARY_FAILURE then SUCCESS mock (see RB-EXCEPTION-RETRY-UI / pilot e2e).",
      "Or SIM-019 for API-level retry.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "(UI) teamlead@example.com → /operations/exceptions → Retry execution on retryable failure case; drain jobs.",
        expected: "Case integration shows Succeeded after retry.",
      },
      {
        step: 2,
        action: "Optional: npm run simulate -- --name=SIM-019 (Wallet mock retry then success).",
        expected:
          "Second execute with same idempotency key returns SUCCESS, processingCertainty PROCESSED.",
      },
    ],
    finalState: ["Wallet retries then succeeds for same idempotency key."],
    cleanup: ["Reset wallet mock; sign out."],
  },

  "RB-WALLET-UNKNOWN-INQUIRY": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Run npm run simulate -- --name=SIM-020 (Wallet mock uncertain timeout then status inquiry).",
        expected: "Timeout then inquire_wallet_status then retry execute.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "status inquiry STATUS_NOT_FOUND, safeToRetryExecute true; final execute SUCCESS PROCESSED.",
      },
    ],
    finalState: ["Uncertain timeout requires status inquiry before safe retry."],
    cleanup: ["Reset wallet mock."],
  },

  "RB-WALLET-EXEC-IDEMPOTENT": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-032 (Duplicate wallet execution is idempotent).",
        expected: "Two execute_wallet_adjustment calls with same idempotency key.",
      },
      {
        step: 2,
        action: "Review idempotent_execution assertion.",
        expected: "Consistent success without double-processing side effects.",
      },
    ],
    finalState: ["Duplicate wallet execution is idempotent."],
    cleanup: ["Reset wallet mock."],
  },

  "RB-WALLET-CONCURRENT-WORKERS": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Run npm run simulate -- --name=SIM-033 (Concurrent integration workers drain safely).",
        expected: "Two run_integration_worker plus drain_jobs after approval.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "execution_record_state SUCCEEDED; integration_attempt_count min 1 (single success despite concurrent drains).",
      },
    ],
    finalState: ["Concurrent workers leave one SUCCEEDED execution."],
    cleanup: ["Simulator removes [sim-p9-cw] cases."],
  },

  "RB-WALLET-TIMEOUT-SAFE-RETRY": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Run npm run simulate -- --name=SIM-040 (Timeout confirmed non-processing then safe retry).",
        expected: "TIMEOUT_AFTER_POSSIBLE_PROCESSING then status inquiry.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "wallet_status_outcome STATUS_NOT_FOUND with safeToRetryExecute true (confirmed non-processing).",
      },
    ],
    finalState: ["Confirmed non-processing timeout allows safe retry path."],
    cleanup: ["Reset wallet mock."],
  },

  "RB-EXCEPTION-PERMANENT-FAILURE": {
    role: "ACTOR-TEAMLEAD (teamlead@example.com)",
    page: "/operations/exceptions",
    preconditions: [
      "Wallet mock PERMANENT_FAILURE or TEMPORARY_FAILURE exhausted.",
      "Approved case with drained failed jobs.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "(UI) Create case, approve, configure mock failure, drain jobs (see pilot e2e RB-EXCEPTION-PERMANENT-FAILURE).",
        expected: "Case appears on /operations/exceptions for team lead.",
      },
      {
        step: 2,
        action: "Optional: npm run simulate -- --name=SIM-022.",
        expected:
          "integration_execution_status FAILED_FINAL; exception_queue_contains integration_failed_final.",
      },
    ],
    finalState: ["Permanent wallet failure creates operations exception row."],
    cleanup: ["Resolve or dismiss exception in later RB; sign out."],
  },

  "RB-EXCEPTION-RESOLVE": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-037 (Resolve operational exception).",
        expected: "Permanent failure creates exception; resolve_operational_exception action runs.",
      },
      {
        step: 2,
        action: "Review execution_record_state assertion.",
        expected: "Execution remains FAILED_FINAL; exception resolved in ops queue (ER-SAVE-01).",
      },
    ],
    finalState: ["Operational exception resolved by ops with resolution note."],
    cleanup: ["Simulator removes [sim-p9-rexc] cases."],
  },

  "RB-EXCEPTION-RETRY-UI": {
    role: "ACTOR-TEAMLEAD (teamlead@example.com)",
    page: "/operations/exceptions",
    preconditions: [
      "Retryable failure case exists in exceptions queue (TEMPORARY_FAILURE after approval).",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Sign in as teamlead@example.com. Open /operations/exceptions. Locate failure case row.",
        expected: "Exception row shows case title and Retry execution button.",
      },
      {
        step: 2,
        action:
          "Configure wallet mock SUCCESS. Click Retry execution. Drain jobs via /api/jobs/tick (test-control secret).",
        expected: "Retry dispatches without error (ER-SAVE-01).",
      },
      {
        step: 3,
        action: "Open case detail from /cases.",
        expected: 'Integration status Succeeded within 20s.',
      },
    ],
    finalState: ["Team lead retried retryable failure successfully from exceptions UI."],
    cleanup: ["Sign out; reset wallet mock."],
  },

  "RB-VIEW-LIST-CREATE-PERSONAL": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/cases",
    preconditions: ["Signed in as agent@example.com."],
    dataTable:
      "| Field | Value |\n| --- | --- |\n| View name | UAT Personal View |\n| Filter | status=UNDER_REVIEW (example) |",
    steps: [
      {
        step: 1,
        action:
          "Open /cases?status=UNDER_REVIEW. In Save current filters enter UAT Personal View. Click Save personal view.",
        expected: "Saved view name appears in selector within 15s (ER-SAVE-01).",
      },
      {
        step: 2,
        action:
          "Navigate /cases. Open Saved view dropdown; select UAT Personal View.",
        expected: "URL includes viewId=; filters applied.",
      },
      {
        step: 3,
        action: "Optional: npm run simulate -- --name=SIM-024.",
        expected: "System view my_open listed; personal view exists in API assertions.",
      },
    ],
    finalState: ["Personal saved view UAT Personal View created and reloadable."],
    cleanup: ["Delete personal view if UI supports; otherwise leave for manual cleanup."],
  },

  "RB-VIEW-TEAM-SHARED": {
    role: "ACTOR-AGENT + ACTOR-TEAMLEAD",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-035 (Team-shared saved view access).",
        expected: "Agent creates team-scoped view; teamlead loads it.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "saved_view_access allowed true for teamlead; saved_view_exists sharingScope team.",
      },
    ],
    finalState: ["Team member can create and peer can load team-scoped view."],
    cleanup: ["Simulator removes [sim-p9-tv] fixtures."],
  },

  "RB-VIEW-CROSS-ORG-DENY": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-036 (Cross-organisation saved view denial).",
        expected: "load_saved_view on foreign org view expectError.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "saved_view_access allowed false; error_code NOT_FOUND (ER-DENY-01).",
      },
    ],
    finalState: ["Cross-organisation saved view access denied."],
    cleanup: ["Simulator removes foreign org fixture."],
  },

  "RB-DASHBOARD-KPI-LOAD": {
    role: "ACTOR-TEAMLEAD (teamlead@example.com)",
    page: "/dashboard/management",
    preconditions: ["User role can access management dashboard (team lead or manager)."],
    dataTable: "| Field | Value |\n| --- | --- |\n| Route | /dashboard/management |",
    steps: [
      {
        step: 1,
        action:
          "Sign in as teamlead@example.com. Open /dashboard/management (header Management link).",
        expected:
          'Page title "Management dashboard" with KPI tiles: Cases submitted, Pending approval, Failed integration, etc.',
      },
      {
        step: 2,
        action: "Optional: npm run simulate -- --name=SIM-025.",
        expected: "management_kpis_present assertion passes for agent API snapshot.",
      },
    ],
    finalState: ["Management dashboard KPI section loads without error."],
    cleanup: ["Sign out."],
  },

  "RB-DASHBOARD-KPI-VALUE": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/dashboard/management",
    preconditions: ["At least one case submitted in date range."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-039 (Dashboard KPI validation after case create).",
        expected: "create_case then get_management_dashboard.",
      },
      {
        step: 2,
        action: "Review dashboard_kpi_value assertion.",
        expected: "cases_submitted min 1 in dashboard snapshot.",
      },
      {
        step: 3,
        action:
          "(UI) teamlead@example.com → /dashboard/management; note Cases submitted count ≥ prior after creating a case.",
        expected: "KPI values reflect submitted cases in selected date range.",
      },
    ],
    finalState: ["Dashboard KPI values reflect case activity."],
    cleanup: ["Simulator removes [sim-p9-kpi] cases."],
  },

  "RB-DASHBOARD-CSV-EXPORT": {
    role: "ACTOR-TEAMLEAD (teamlead@example.com)",
    page: "/dashboard/management",
    preconditions: [
      "blocked_ui: Export CSV link exists but full download UX may be incomplete — document intended steps.",
    ],
    dataTable:
      "| Field | Value |\n| --- | --- |\n| From | last 30 days (default) |\n| To | now |",
    steps: [
      {
        step: 1,
        action:
          "Sign in as teamlead@example.com. Open /dashboard/management (TD-DASHBOARD-01).",
        expected: "Management dashboard with date range filters and Export CSV button visible.",
      },
      {
        step: 2,
        action: "Set From/To if needed. Click Apply range.",
        expected: "KPI tiles refresh for selected window.",
      },
      {
        step: 3,
        action:
          "Click Export CSV (links to /api/v1/management/dashboard/export?from=&to=).",
        expected:
          "Browser downloads CSV file with KPI/export columns; no auth error. If blocked_ui, file may be empty or headers-only — log defect and verify API returns 200.",
      },
    ],
    finalState: ["CSV export attempted for management dashboard date range."],
    cleanup: ["Sign out."],
  },

  "RB-SEC-CROSS-TEAM-DENY": {
    role: "ACTOR-REQUESTER (requester@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-006 (Unauthorized cross-team access).",
        expected: "Requester cannot request_approval on chargeback case.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "Agent with team access sees case; unauthorized mutation rejected (ER-DENY-01).",
      },
    ],
    finalState: ["Cross-team unauthorized action denied."],
    cleanup: ["Simulator removes [sim-xteam] cases."],
  },

  "RB-SEC-CROSS-ORG-DENY": {
    role: "ACTOR-AGENT (agent@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-007 (Unauthorized cross-organization access).",
        expected: "get_case on foreign org UUID expectError.",
      },
      {
        step: 2,
        action: "Review assertions.",
        expected:
          "Own-org case visible to requester; foreign case access denied (ER-DENY-01).",
      },
    ],
    finalState: ["Cross-organisation case access denied."],
    cleanup: ["Simulator removes [sim-xorg] cases."],
  },

  "RB-SEC-INTERNAL-COMMENT-HIDDEN": {
    role: "ACTOR-REQUESTER (requester@example.com)",
    page: "/simulator",
    preconditions: ["Simulator enabled."],
    dataTable: null,
    steps: [
      {
        step: 1,
        action: "Run npm run simulate -- --name=SIM-041 (Internal comment hidden from requester).",
        expected: "Agent adds public and internal comments on case.",
      },
      {
        step: 2,
        action: "Review internal_comment_hidden assertion.",
        expected:
          "Requester sees public comment; internal ops note marker hidden (ER-DENY-01 visibility).",
      },
      {
        step: 3,
        action:
          "(UI spot-check) requester opens case comments — Internal badge comments absent.",
        expected: "Internal comment checkbox content not shown to requester role.",
      },
    ],
    finalState: ["Internal comments hidden from requesters."],
    cleanup: ["Simulator removes [sim-p11-int] cases."],
  },

  "RB-UI-LAYOUT-RESPONSIVE": {
    role: "Any authenticated user",
    page: "/dashboard",
    preconditions: [
      "manual_only: visual check on desktop and mobile widths.",
      "TD-SECURITY-01 not required; use browser devtools device toolbar.",
    ],
    dataTable: null,
    steps: [
      {
        step: 1,
        action:
          "Desktop (~1280px): sign in, visit /dashboard, /cases, /cases/new (requester), /workspace (agent), /admin (admin).",
        expected:
          "Header nav, main content, and action buttons visible without horizontal scroll; primary tasks completable.",
      },
      {
        step: 2,
        action:
          "Mobile (~375px): repeat key routes. Confirm header collapses gracefully (nav may hide md:flex links; core content readable).",
        expected:
          "Forms and case detail usable; status action buttons wrap; no overlapping text.",
      },
      {
        step: 3,
        action: "Rotate to landscape on mobile width for case detail timeline.",
        expected: "Status history and comments remain readable.",
      },
    ],
    finalState: ["Primary pages usable at desktop and mobile breakpoints."],
    cleanup: ["Sign out."],
  },
};

/** All requirement IDs that must appear in DETAILED (for sync scripts). */
export const DETAILED_REQUIREMENT_IDS = Object.keys(DETAILED);
