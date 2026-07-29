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
const TITLE_RB_RE = /\[((?:RB-[A-Z0-9]+(?:-[A-Z0-9]+)+(?:\s+)?)+)\]/g;

type Requirement = {
  id: string;
  title: string;
  runbookSection?: string;
  area?: string;
  priority?: string;
  automationRequired?: boolean;
  expectedLayers?: string[];
  status: string;
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
  console.error("");
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

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  const registryPath = path.join(ROOT, "quality", "runbook-requirements.yaml");
  const runbookPath = path.join(
    ROOT,
    "docs",
    "system-full-feature-test-runbook.md"
  );
  const scenariosDir = path.join(
    ROOT,
    "tools",
    "case-simulator",
    "scenarios"
  );

  if (!fs.existsSync(registryPath)) {
    fail([`Missing registry: ${registryPath}`]);
  }
  if (!fs.existsSync(runbookPath)) {
    fail([`Missing runbook: ${runbookPath}`]);
  }

  const registry = parseYaml(fs.readFileSync(registryPath, "utf8")) as {
    requirements?: Requirement[];
  };
  const requirements = registry.requirements ?? [];
  if (!requirements.length) {
    fail(["Registry contains no requirements"]);
  }

  const byId = new Map<string, Requirement>();
  for (const req of requirements) {
    if (!req.id) {
      errors.push("Requirement missing id");
      continue;
    }
    if (byId.has(req.id)) {
      errors.push(`Duplicate requirement id ${req.id}`);
    }
    byId.set(req.id, req);
  }

  const runbookText = fs.readFileSync(runbookPath, "utf8");
  for (const req of requirements) {
    if (req.status === "retired") continue;
    if (!runbookText.includes(req.id)) {
      errors.push(
        `Requirement ${req.id} missing from runbook ${path.relative(ROOT, runbookPath)}`
      );
    }
  }

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
    if (req.status !== "active") continue;
    if (!req.automationRequired) continue;
    const layers = req.expectedLayers ?? [];
    const hasSim = coveredBySimulator.has(req.id);
    const hasPw = coveredByPlaywright.has(req.id);
    const expectsSim = layers.includes("simulator");
    const expectsPw = layers.includes("playwright");
    const expectsUnit = layers.includes("unit");
    const expectsManual = layers.includes("manual");

    if (expectsSim && !hasSim && !expectsPw && !expectsUnit) {
      errors.push(
        `Active automation-required ${req.id} expects simulator coverage but none found`
      );
    } else if (expectsPw && !hasPw && !expectsSim && !expectsUnit) {
      errors.push(
        `Active automation-required ${req.id} expects Playwright coverage but none found`
      );
    } else if (
      !hasSim &&
      !hasPw &&
      !expectsUnit &&
      !expectsManual &&
      (expectsSim || expectsPw)
    ) {
      errors.push(
        `Active automation-required ${req.id} has no simulator or Playwright coverage`
      );
    } else if (!hasSim && !hasPw && expectsSim && expectsPw) {
      errors.push(
        `Active automation-required ${req.id} missing both expected layers`
      );
    } else if (expectsSim && !hasSim) {
      warnings.push(`${req.id} expected simulator coverage but none linked`);
    } else if (expectsPw && !hasPw) {
      warnings.push(`${req.id} expected Playwright coverage but none linked`);
    }
  }

  for (const req of requirements) {
    if (req.status === "blocked_ui" && coveredByPlaywright.has(req.id)) {
      // Linked titles are fine; "passed" enforcement needs runtime — warn only.
      warnings.push(
        `blocked_ui ${req.id} is referenced by Playwright; keep test failing or skip until UI lands`
      );
    }
    if (req.status === "manual_only" && (coveredBySimulator.has(req.id) || coveredByPlaywright.has(req.id))) {
      warnings.push(`manual_only ${req.id} also has automation references`);
    }
  }

  // Unused TITLE_RB_RE kept for clarity in future extensions.
  void TITLE_RB_RE;

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
