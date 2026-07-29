/**
 * Verifies runbook ↔ registry ↔ simulator ↔ Playwright ID sync.
 *
 * Failures block CI. Warnings are printed but do not fail the gate.
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const RB_RE = /RB-[A-Z0-9]+(?:-[A-Z0-9]+)+/g;
const SIM_ID_RE = /^SIM-[0-9]{3}$/;
const SUPPORTED_STATUSES = new Set([
  "active",
  "manual_only",
  "blocked_ui",
  "blocked_environment",
  "retired",
]);
const SUPPORTED_LAYERS = new Set([
  "simulator",
  "playwright",
  "unit",
  "manual",
]);
const SUPPORTED_PROCEDURE_LEVELS = new Set([
  "index_only",
  "draft",
  "detailed",
]);

type RunbookMeta = {
  file: string;
  anchor: string;
  procedureLevel: string;
  section?: string;
  journey?: string;
};

type Requirement = {
  id: string;
  title: string;
  area?: string;
  priority?: string;
  automationRequired?: boolean;
  expectedLayers?: string[];
  status: string;
  runbook?: RunbookMeta;
};

type ScenarioDoc = {
  id?: string;
  name?: string;
  runbookRefs?: string[];
};

function fail(errors: string[]): never {
  console.error("\nRunbook sync FAILED:\n");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  console.error(`\n${errors.length} error(s) found.\n`);
  process.exit(1);
}

function collectFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full, ext));
    } else if (entry.name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out.sort();
}

function countHtmlAnchor(text: string, anchor: string): number {
  const htmlId = new RegExp(
    `<a\\s+id=["']${escapeRegExp(anchor)}["']\\s*/?>`,
    "gi"
  );
  return (text.match(htmlId) ?? []).length;
}

/**
 * Anchor must immediately precede a markdown heading that starts with the same RB-* ID.
 */
function resolveAnchorHeading(
  text: string,
  anchor: string
): { ok: true; headingId: string } | { ok: false; detail: string } {
  const marker = new RegExp(
    `<a\\s+id=["']${escapeRegExp(anchor)}["']\\s*/?>\\s*`,
    "i"
  );
  const match = marker.exec(text);
  if (!match || match.index === undefined) {
    return { ok: false, detail: "anchor not found" };
  }

  const after = text.slice(match.index + match[0].length);
  const headingMatch = /^(?:[ \t]*\r?\n)*[ \t]*#{1,6}[ \t]+([^\r\n]+)/m.exec(
    after
  );
  if (!headingMatch) {
    return {
      ok: false,
      detail: "no markdown heading immediately follows the anchor",
    };
  }

  const heading = headingMatch[1].trim();
  const headingIdMatch = /^(RB-[A-Z0-9]+(?:-[A-Z0-9]+)+)\b/.exec(heading);
  if (!headingIdMatch) {
    return {
      ok: false,
      detail: `following heading does not start with an RB-* id ("${heading}")`,
    };
  }

  return { ok: true, headingId: headingIdMatch[1] };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  const registryPath = path.join(ROOT, "quality", "runbook-requirements.yaml");
  if (!fs.existsSync(registryPath)) {
    fail([`Missing registry: ${registryPath}`]);
  }

  const registry = parseYaml(fs.readFileSync(registryPath, "utf8")) as {
    requirements?: Requirement[];
  };
  const requirements = registry.requirements ?? [];
  if (!requirements.length) {
    fail(["Registry contains no requirements"]);
  }

  const byId = new Map<string, Requirement>();
  const anchors = new Map<string, string>();

  for (const req of requirements) {
    if (!req.id) {
      errors.push("Requirement missing id");
      continue;
    }
    if (byId.has(req.id)) {
      errors.push(`Duplicate requirement id ${req.id}`);
    }
    byId.set(req.id, req);

    if (!SUPPORTED_STATUSES.has(req.status)) {
      errors.push(`${req.id} has unsupported status "${req.status}"`);
    }

    for (const layer of req.expectedLayers ?? []) {
      if (!SUPPORTED_LAYERS.has(layer)) {
        errors.push(`${req.id} has unsupported expectedLayer "${layer}"`);
      }
    }

    if (!req.runbook?.file || !req.runbook.anchor || !req.runbook.procedureLevel) {
      errors.push(
        `${req.id} missing runbook.file, runbook.anchor, or runbook.procedureLevel`
      );
      continue;
    }

    if (!req.runbook.journey) {
      errors.push(`${req.id} missing runbook.journey`);
    } else if (!/^UAT-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2}$/.test(req.runbook.journey)) {
      errors.push(
        `${req.id} has malformed journey id "${req.runbook.journey}"`
      );
    }

    if (!SUPPORTED_PROCEDURE_LEVELS.has(req.runbook.procedureLevel)) {
      errors.push(
        `${req.id} has unsupported procedureLevel "${req.runbook.procedureLevel}"`
      );
    }

    const needsProcedure =
      req.priority === "critical" ||
      req.status === "blocked_ui" ||
      ((req.expectedLayers ?? []).includes("simulator") &&
        (req.expectedLayers ?? []).includes("playwright"));
    if (
      needsProcedure &&
      req.runbook.procedureLevel !== "draft" &&
      req.runbook.procedureLevel !== "detailed"
    ) {
      errors.push(
        `${req.id} must use procedureLevel draft or detailed (critical, blocked_ui, or dual-layer)`
      );
    }

    const prior = anchors.get(req.runbook.anchor);
    if (prior) {
      errors.push(
        `Duplicate runbook anchor "${req.runbook.anchor}" used by ${prior} and ${req.id}`
      );
    } else {
      anchors.set(req.runbook.anchor, req.id);
    }

    const runbookAbs = path.join(ROOT, req.runbook.file);
    if (!fs.existsSync(runbookAbs)) {
      errors.push(`${req.id} runbook file missing: ${req.runbook.file}`);
      continue;
    }

    const runbookText = fs.readFileSync(runbookAbs, "utf8");
    const count = countHtmlAnchor(runbookText, req.runbook.anchor);
    if (count === 0) {
      errors.push(
        `${req.id} anchor "#${req.runbook.anchor}" missing from ${req.runbook.file}`
      );
    } else if (count > 1) {
      errors.push(
        `${req.id} anchor "#${req.runbook.anchor}" appears ${count} times in ${req.runbook.file}`
      );
    } else {
      const paired = resolveAnchorHeading(runbookText, req.runbook.anchor);
      if (!paired.ok) {
        errors.push(
          `${req.id} anchor #${req.runbook.anchor}: ${paired.detail}`
        );
      } else if (paired.headingId !== req.id) {
        errors.push(
          `${req.id} anchor #${req.runbook.anchor} points to ${paired.headingId}`
        );
      }
    }

    if (req.runbook.journey) {
      const journeyAnchor = req.runbook.journey.toLowerCase();
      const journeyHeading = new RegExp(
        `^##\\s+${escapeRegExp(req.runbook.journey)}\\b`,
        "m"
      );
      if (countHtmlAnchor(runbookText, journeyAnchor) !== 1) {
        errors.push(
          `${req.id} journey ${req.runbook.journey} missing unique anchor #${journeyAnchor}`
        );
      } else if (!journeyHeading.test(runbookText)) {
        errors.push(
          `${req.id} journey heading "## ${req.runbook.journey}" missing from ${req.runbook.file}`
        );
      }
    }
  }

  const scenariosDir = path.join(
    ROOT,
    "tools",
    "case-simulator",
    "scenarios"
  );
  const scenarioFiles = collectFiles(scenariosDir, ".yaml").concat(
    collectFiles(scenariosDir, ".yml")
  );
  const seenScenarioIds = new Set<string>();
  const coveredBySimulator = new Set<string>();

  for (const file of scenarioFiles) {
    const rel = path.relative(ROOT, file);
    const doc = parseYaml(fs.readFileSync(file, "utf8")) as ScenarioDoc;
    if (!doc.id || !SIM_ID_RE.test(doc.id)) {
      errors.push(`Invalid or missing scenario id in ${rel}`);
    } else if (seenScenarioIds.has(doc.id)) {
      errors.push(`Duplicate scenario id ${doc.id} in ${rel}`);
    } else {
      seenScenarioIds.add(doc.id);
    }

    if (!Array.isArray(doc.runbookRefs) || doc.runbookRefs.length === 0) {
      errors.push(`Missing runbookRefs in ${rel}`);
      continue;
    }

    for (const ref of doc.runbookRefs) {
      const req = byId.get(ref);
      if (!req) {
        errors.push(`Unknown runbookRef ${ref} in ${rel}`);
        continue;
      }
      if (req.status === "retired") {
        errors.push(`Retired runbookRef ${ref} in ${rel}`);
        continue;
      }
      coveredBySimulator.add(ref);
    }
  }

  const e2eFiles = collectFiles(path.join(ROOT, "e2e"), ".spec.ts");
  const coveredByPlaywright = new Set<string>();
  const testTitleRe =
    /\b(?:test|it)\(\s*(?:\/\*[\s\S]*?\*\/\s*)?["'`](\[[^\]]+\].*?|[^"'`]+)["'`]/g;

  for (const file of e2eFiles) {
    const rel = path.relative(ROOT, file);
    const text = fs.readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    const titles: string[] = [];
    while ((match = testTitleRe.exec(text))) {
      titles.push(match[1]);
    }
    if (!titles.length) {
      warnings.push(`No Playwright test titles found in ${rel}`);
      continue;
    }
    for (const title of titles) {
      const ids = title.match(RB_RE) ?? [];
      if (!ids.length) {
        errors.push(`Playwright test missing [RB-*] id: "${title}" in ${rel}`);
        continue;
      }
      for (const id of ids) {
        const req = byId.get(id);
        if (!req) {
          errors.push(`Unknown runbook id ${id} in ${rel} ("${title}")`);
          continue;
        }
        if (req.status === "retired") {
          errors.push(`Retired runbook id ${id} in ${rel}`);
          continue;
        }
        coveredByPlaywright.add(id);
      }
    }
  }

  for (const req of requirements) {
    if (req.status === "active" && req.automationRequired) {
      const layers = req.expectedLayers ?? [];
      const expectsSim = layers.includes("simulator");
      const expectsPw = layers.includes("playwright");
      const expectsUnit = layers.includes("unit");
      const hasSim = coveredBySimulator.has(req.id);
      const hasPw = coveredByPlaywright.has(req.id);

      if (expectsSim && !hasSim) {
        errors.push(`${req.id} is missing simulator coverage`);
      }
      if (expectsPw && !hasPw) {
        errors.push(`${req.id} is missing Playwright coverage`);
      }
      if (expectsUnit) {
        warnings.push(
          `${req.id} expects unit coverage; unit-test ID discovery is not enforced yet`
        );
      }
    }

    if (req.status === "blocked_ui") {
      // Missing automation is allowed until UI work starts.
      continue;
    }

    if (
      req.status === "manual_only" &&
      (coveredBySimulator.has(req.id) || coveredByPlaywright.has(req.id))
    ) {
      warnings.push(`manual_only ${req.id} also has automation references`);
    }
  }

  console.log(
    `Runbook sync checked ${requirements.length} requirements, ${scenarioFiles.length} scenarios, ${e2eFiles.length} e2e files.`
  );
  if (warnings.length) {
    console.log("\nWarnings:");
    for (const warning of warnings) console.log(`  - ${warning}`);
  }
  if (errors.length) fail(errors);
  console.log("\nRunbook sync OK.");
}

main();
