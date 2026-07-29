/**
 * Step 2: rebuild runbook as UAT journeys + stamp journey ids onto the registry.
 * Run: node scripts/build-uat-journeys.mjs
 */
import fs from "node:fs";
import { parse, stringify } from "yaml";
import { DETAILED } from "./uat-detailed-procedures.mjs";

const RUNBOOK_FILE = "docs/system-full-feature-test-runbook.md";

/** @type {Array<{id:string,title:string,actor:string,startPage:string,data:string[],requirements:string[]}>} */
const JOURNEYS = [
  {
    id: "UAT-AUTH-ACCESS-01",
    title: "Authentication and access",
    actor: "ACTOR-ADMIN",
    startPage: "/login",
    data: ["TD-SEED-USERS"],
    requirements: ["RB-AUTH-LOGIN-VALID", "RB-NAV-ADMIN-DENIED"],
  },
  {
    id: "UAT-ADMIN-CATEGORIES-01",
    title: "Category maintenance",
    actor: "ACTOR-ADMIN",
    startPage: "/admin/categories",
    data: ["TD-CATEGORY-01"],
    requirements: [
      "RB-NAV-ADMIN-CATEGORIES",
      "RB-ADMIN-CATEGORY-CREATE",
      "RB-ADMIN-CATEGORY-EDIT",
      "RB-UI-SUBCATEGORY-EDIT",
    ],
  },
  {
    id: "UAT-CASE-HAPPY-01",
    title: "Case happy path",
    actor: "ACTOR-REQUESTER",
    startPage: "/cases/new",
    data: ["TD-CASE-HAPPY-01"],
    requirements: [
      "RB-CASE-CREATE-VALID",
      "RB-CASE-AUTO-ASSIGN-GROUP",
      "RB-CASE-CLAIM",
      "RB-CASE-ACKNOWLEDGE",
      "RB-APPROVAL-HAPPY",
      "RB-CASE-PENDING-APPROVAL-NOTIFY",
      "RB-CASE-RESOLVE",
      "RB-CASE-TIMELINE-VISIBLE",
    ],
  },
  {
    id: "UAT-CASE-EXCEPTION-01",
    title: "Case exception and concurrency path",
    actor: "ACTOR-AGENT",
    startPage: "/cases",
    data: ["TD-CASE-EXCEPTION-01"],
    requirements: [
      "RB-CASE-WAIT-REQUESTER",
      "RB-CASE-REOPEN",
      "RB-CASE-STALE-VERSION",
      "RB-CASE-CONCURRENT-UPDATE",
      "RB-CASE-CONCURRENT-CLAIM",
    ],
  },
  {
    id: "UAT-APPROVAL-CONTROLS-01",
    title: "Approval controls",
    actor: "ACTOR-APPROVER",
    startPage: "/cases",
    data: ["TD-APPROVAL-CONTROLS-01"],
    requirements: [
      "RB-ADMIN-APPROVAL-RULE-CREATE",
      "RB-APPROVAL-REJECT",
      "RB-APPROVAL-DUPLICATE-SUBMIT",
      "RB-APPROVAL-DUPLICATE-REQUEST",
      "RB-APPROVAL-SEQUENTIAL-TWO-LEVEL",
      "RB-APPROVAL-MAKER-CHECKER-REQUESTER",
      "RB-APPROVAL-MAKER-CHECKER-AGENT",
      "RB-APPROVAL-LIMIT-EXCEEDED",
      "RB-APPROVAL-DELEGATION-VALID",
      "RB-APPROVAL-DELEGATION-EXPIRED",
      "RB-ADMIN-CONFIG-VERSION-RETAINED",
    ],
  },
  {
    id: "UAT-SLA-JOBS-01",
    title: "SLA and background jobs",
    actor: "ACTOR-AGENT",
    startPage: "/workspace",
    data: ["TD-SLA-JOBS-01"],
    requirements: [
      "RB-SLA-FIRST-RESPONSE-BREACH",
      "RB-SLA-RESOLUTION-PAUSE-RESUME",
      "RB-SLA-BREACHED-QUEUE",
      "RB-JOB-RETRY",
      "RB-JOB-DEAD-LETTER",
      "RB-API-IDEMPOTENCY-KEY",
      "RB-EMAIL-OUTBOX-DELIVER",
      "RB-EMAIL-DEDUPE",
    ],
  },
  {
    id: "UAT-WALLET-EXCEPTIONS-01",
    title: "Wallet execution and exceptions",
    actor: "ACTOR-AGENT",
    startPage: "/operations/exceptions",
    data: ["TD-WALLET-01"],
    requirements: [
      "RB-WALLET-SUCCESS",
      "RB-WALLET-EXEC-AFTER-APPROVAL",
      "RB-WALLET-TEMP-FAILURE",
      "RB-WALLET-RETRY-SUCCESS",
      "RB-WALLET-UNKNOWN-INQUIRY",
      "RB-WALLET-EXEC-IDEMPOTENT",
      "RB-WALLET-CONCURRENT-WORKERS",
      "RB-WALLET-TIMEOUT-SAFE-RETRY",
      "RB-EXCEPTION-PERMANENT-FAILURE",
      "RB-EXCEPTION-RESOLVE",
      "RB-EXCEPTION-RETRY-UI",
    ],
  },
  {
    id: "UAT-VIEWS-DASHBOARD-01",
    title: "Views and management dashboard",
    actor: "ACTOR-AGENT",
    startPage: "/cases",
    data: ["TD-VIEW-01", "TD-DASHBOARD-01"],
    requirements: [
      "RB-VIEW-LIST-CREATE-PERSONAL",
      "RB-VIEW-TEAM-SHARED",
      "RB-VIEW-CROSS-ORG-DENY",
      "RB-DASHBOARD-KPI-LOAD",
      "RB-DASHBOARD-KPI-VALUE",
      "RB-DASHBOARD-CSV-EXPORT",
    ],
  },
  {
    id: "UAT-SECURITY-01",
    title: "Security boundaries",
    actor: "ACTOR-AGENT",
    startPage: "/cases",
    data: ["TD-SECURITY-01"],
    requirements: [
      "RB-SEC-CROSS-TEAM-DENY",
      "RB-SEC-CROSS-ORG-DENY",
      "RB-SEC-INTERNAL-COMMENT-HIDDEN",
      "RB-UI-LAYOUT-RESPONSIVE",
    ],
  },
];

const registry = parse(
  fs.readFileSync("quality/runbook-requirements.yaml", "utf8")
);
const byId = new Map(registry.requirements.map((r) => [r.id, r]));

const mapped = new Set(JOURNEYS.flatMap((j) => j.requirements));
const missing = registry.requirements
  .map((r) => r.id)
  .filter((id) => !mapped.has(id));
if (missing.length) {
  throw new Error(`Unmapped requirements: ${missing.join(", ")}`);
}

const journeyByReq = new Map();
for (const journey of JOURNEYS) {
  for (const id of journey.requirements) {
    if (journeyByReq.has(id)) {
      throw new Error(`${id} mapped to multiple journeys`);
    }
    journeyByReq.set(id, journey.id);
  }
}

for (const req of registry.requirements) {
  const journey = journeyByReq.get(req.id);
  const hasDetailed = Boolean(DETAILED[req.id]);
  req.runbook = {
    ...req.runbook,
    journey,
    file: RUNBOOK_FILE,
    anchor: req.runbook?.anchor ?? req.id.toLowerCase(),
    procedureLevel: hasDetailed ? "detailed" : "draft",
  };
}

registry.updatedAt = new Date().toISOString().slice(0, 10);
registry.journeys = JOURNEYS.map((j) => ({
  id: j.id,
  title: j.title,
  actor: j.actor,
  startPage: j.startPage,
  data: j.data,
  requirements: j.requirements,
}));

fs.writeFileSync(
  "quality/runbook-requirements.yaml",
  stringify(registry, { lineWidth: 100 })
);

function reqBlock(req) {
  const detail = DETAILED[req.id];
  const lines = [];
  lines.push(`<a id="${req.runbook.anchor}"></a>`);
  lines.push("");
  lines.push(`### ${req.id} — ${req.title}`);
  lines.push("");
  lines.push(`**Priority:** ${req.priority}  `);
  lines.push(`**Status:** \`${req.status}\`  `);
  lines.push(`**Procedure level:** \`${req.runbook.procedureLevel}\`  `);
  lines.push(
    `**Expected layers:** ${(req.expectedLayers ?? []).map((l) => `\`${l}\``).join(", ") || "—"}  `
  );
  lines.push(`**Journey:** \`${req.runbook.journey}\``);
  lines.push("");

  if (req.status === "blocked_ui") {
    lines.push(
      "> **Blocked UI:** procedure documents the intended path. Do not mark the requirement complete until the UI gap is closed."
    );
    lines.push("");
  }
  if (req.status === "manual_only") {
    lines.push(
      "> **Manual only:** record tester, device, date and evidence before treating as passed."
    );
    lines.push("");
  }

  if (!detail) {
    lines.push("| Step | Action | Expected result |");
    lines.push("| ---: | --- | --- |");
    lines.push(
      `| 1 | Perform the behaviour for \`${req.id}\` using this journey’s shared actor/data. | Outcome matches the requirement title and linked automation assertions. |`
    );
    lines.push("");
    lines.push(
      "_Draft scaffold — replace with field-level actions during enrichment._"
    );
    lines.push("");
    return lines.join("\n");
  }

  lines.push(`**Role:** ${detail.role}  `);
  lines.push(`**Page:** \`${detail.page}\``);
  lines.push("");
  lines.push("#### Preconditions");
  lines.push("");
  for (const item of detail.preconditions ?? []) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  if (detail.dataTable) {
    lines.push("#### Test data");
    lines.push("");
    lines.push(detail.dataTable);
    lines.push("");
  }
  lines.push("#### Procedure");
  lines.push("");
  lines.push("| Step | Tester action | Expected result |");
  lines.push("| ---: | --- | --- |");
  for (const step of detail.steps ?? []) {
    lines.push(
      `| ${step.step} | ${step.action.replace(/\|/g, "\\|")} | ${step.expected.replace(/\|/g, "\\|")} |`
    );
  }
  lines.push("");
  if (detail.finalState?.length) {
    lines.push("#### Expected final state");
    lines.push("");
    for (const item of detail.finalState) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  if (detail.cleanup?.length) {
    lines.push("#### Cleanup");
    lines.push("");
    for (const [index, item] of detail.cleanup.entries()) {
      lines.push(`${index + 1}. ${item}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const md = [];
md.push("# System full-feature test runbook");
md.push("");
md.push(
  "> **Authoritative copy.** Version-controlled under `docs/`. Any `outputs/` export is a delivered snapshot only."
);
md.push("");
md.push("- **Version:** 2026-07-29");
md.push("- **Structure:** Shared catalogues + UAT journeys (step 2 scaffold)");
md.push("- **Machine registry:** `quality/runbook-requirements.yaml`");
md.push("");
md.push(
  "Requirements keep stable `RB-*` anchors inside shared **UAT journeys**. Procedure levels: `index_only` → `draft` → `detailed`. Most requirements are now `detailed` with field-level steps; regenerate via `npm run generate:uat-journeys`."
);
md.push("");
md.push("## Procedure levels");
md.push("");
md.push("| Level | Meaning |");
md.push("| --- | --- |");
md.push("| `index_only` | ID, title and anchor only |");
md.push(
  "| `draft` | Journey subsection present; not yet fully executable without tester invention |"
);
md.push(
  "| `detailed` | Complete actor, route, data, step/expected pairs, final state and cleanup |"
);
md.push("");
md.push("## Status legend");
md.push("");
md.push("| Status | Meaning |");
md.push("| --- | --- |");
md.push("| `active` | In scope for automation or already covered |");
md.push("| `blocked_ui` | Requirement blocked by known UI gap (Plan 2+) |");
md.push("| `manual_only` | Human / visual check |");
md.push("| `retired` | Do not reuse |");
md.push("");

md.push("## Catalogues");
md.push("");
md.push("### Actor catalogue");
md.push("");
md.push("| Actor ID | Login | Role | Password |");
md.push("| --- | --- | --- | --- |");
md.push("| `ACTOR-ADMIN` | `admin@example.com` | Admin | `Password123!` |");
md.push(
  "| `ACTOR-REQUESTER` | `requester@example.com` | Requester | `Password123!` |"
);
md.push("| `ACTOR-AGENT` | `agent@example.com` | Operations agent | `Password123!` |");
md.push("| `ACTOR-APPROVER` | `approver@example.com` | Approver | `Password123!` |");
md.push(
  "| `ACTOR-TEAMLEAD` | `teamlead@example.com` | Team lead | `Password123!` |"
);
md.push("");
md.push("### Test-data catalogue");
md.push("");
md.push("#### `TD-SEED-USERS`");
md.push("");
md.push("- Use seeded accounts from the actor catalogue.");
md.push("- Do not create ad-hoc users during UAT unless the journey says so.");
md.push("");
md.push("#### `TD-CATEGORY-01`");
md.push("");
md.push("| Field | Initial value | Edited value |");
md.push("| --- | --- | --- |");
md.push("| Code | `UAT-CAT-01` | Unchanged |");
md.push("| Name | `UAT Category 01` | `UAT Category 01 Edited` |");
md.push("| Active | Checked | Unchecked during cleanup |");
md.push("| Change reason | `UAT create category` | `UAT edit category` |");
md.push("");
md.push("#### `TD-CASE-HAPPY-01`");
md.push("");
md.push("| Field | Value |");
md.push("| --- | --- |");
md.push("| Title | `UAT Happy Path Case` |");
md.push("| Category | Wallet adjustments |");
md.push("| Subcategory | Duplicate credit |");
md.push("| Adjustment type | Credit |");
md.push("| Amount | `210.00` |");
md.push("");
md.push("#### `TD-CASE-EXCEPTION-01`");
md.push("");
md.push("| Field | Value |");
md.push("| --- | --- |");
md.push("| Title prefix | `UAT Exception Path` |");
md.push("| Amount | `125.50` |");
md.push("");
md.push("#### `TD-APPROVAL-CONTROLS-01`");
md.push("");
md.push("| Field | Value |");
md.push("| --- | --- |");
md.push("| Rule code | `UAT_RULE_01` |");
md.push("| High-value amount | Per sequential-approval scenario |");
md.push("");
md.push("#### `TD-SLA-JOBS-01`");
md.push("");
md.push("| Field | Value |");
md.push("| --- | --- |");
md.push("| Clock control | test-control clock advance |");
md.push("| Job drain | `/api/jobs/tick` via simulator/test-control |");
md.push("");
md.push("#### `TD-WALLET-01`");
md.push("");
md.push("| Field | Value |");
md.push("| --- | --- |");
md.push("| Provider | mock wallet |");
md.push("| Success outcome | `SUCCESS` |");
md.push("| Temp failure | `TEMPORARY_FAILURE` then retry |");
md.push("");
md.push("#### `TD-VIEW-01` / `TD-DASHBOARD-01`");
md.push("");
md.push("| Field | Value |");
md.push("| --- | --- |");
md.push("| Personal view name | `UAT Personal View` |");
md.push("| Dashboard route | `/dashboard/management` |");
md.push("");
md.push("#### `TD-SECURITY-01`");
md.push("");
md.push("- Use cross-team / cross-org fixtures from simulator scenarios.");
md.push("- Internal comments must remain hidden from requesters.");
md.push("");
md.push("### Common-result catalogue");
md.push("");
md.push("| Result ID | Meaning |");
md.push("| --- | --- |");
md.push("| `ER-SAVE-01` | Success notification appears |");
md.push(
  "| `ER-AUDIT-01` | Actor, timestamp, reason, old/new values recorded where applicable |"
);
md.push(
  "| `ER-DEACTIVATE-01` | Record remains stored but is excluded from active selection |"
);
md.push("| `ER-DENY-01` | Action is rejected; no forbidden side effects persist |");
md.push("");

md.push("## Journey index");
md.push("");
md.push("| Journey | Title | Actor | Start page | Requirements |");
md.push("| --- | --- | --- | --- | ---: |");
for (const j of JOURNEYS) {
  md.push(
    `| [\`${j.id}\`](#${j.id.toLowerCase()}) | ${j.title} | \`${j.actor}\` | \`${j.startPage}\` | ${j.requirements.length} |`
  );
}
md.push("");

md.push("## Requirement index");
md.push("");
md.push("| ID | Journey | Title | Priority | Status | Procedure |");
md.push("| --- | --- | --- | --- | --- | --- |");
for (const req of registry.requirements) {
  md.push(
    `| [\`${req.id}\`](#${req.runbook.anchor}) | \`${req.runbook.journey}\` | ${req.title} | ${req.priority} | \`${req.status}\` | \`${req.runbook.procedureLevel}\` |`
  );
}
md.push("");

md.push("## UAT journeys");
md.push("");

for (const journey of JOURNEYS) {
  md.push(`<a id="${journey.id.toLowerCase()}"></a>`);
  md.push("");
  md.push(`## ${journey.id} — ${journey.title}`);
  md.push("");
  md.push(`**Actor:** \`${journey.actor}\`  `);
  md.push(`**Starting page:** \`${journey.startPage}\`  `);
  md.push(
    `**Shared data:** ${journey.data.map((d) => `\`${d}\``).join(", ")}`
  );
  md.push("");
  md.push("### Shared preconditions");
  md.push("");
  md.push(`- Sign in as \`${journey.actor}\` from the actor catalogue.`);
  md.push(`- Open \`${journey.startPage}\`.`);
  md.push("- Local Supabase + app are running with seed data.");
  md.push(
    "- Confirm shared test-data codes from this journey are free or cleaned from prior runs."
  );
  md.push("");
  md.push("### Shared cleanup");
  md.push("");
  md.push("- Deactivate or delete journey-created rows where the product supports it.");
  md.push("- Prefer `ER-DEACTIVATE-01` for master data that must remain auditable.");
  md.push("- Leave seeded baseline users and org config unchanged.");
  md.push("");

  for (const reqId of journey.requirements) {
    const req = byId.get(reqId);
    if (!req) throw new Error(`Missing requirement ${reqId}`);
    md.push(reqBlock(req));
  }
}

md.push("## Traceability");
md.push("");
md.push(
  "- Simulator scenarios: `tools/case-simulator/scenarios/*.yaml` (`id: SIM-NNN`, `runbookRefs`)"
);
md.push("- Playwright: `e2e/**/*.spec.ts` titles include `[RB-…]`");
md.push("- Sync gate: `npm run test:runbook-sync`");
md.push(
  "- Coverage: `npm run generate:runbook-coverage` → `tools/case-simulator/reports/runbook-coverage.*`"
);
md.push("");

fs.writeFileSync(RUNBOOK_FILE, md.join("\n"));
console.log(
  `Wrote ${JOURNEYS.length} journeys covering ${mapped.size} requirements`
);
