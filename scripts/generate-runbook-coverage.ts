/**
 * Generates runbook coverage JSON + Markdown from the registry and linked tests.
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const RB_RE = /RB-[A-Z0-9]+(?:-[A-Z0-9]+)+/g;

type Requirement = {
  id: string;
  title: string;
  area?: string;
  priority?: string;
  automationRequired?: boolean;
  expectedLayers?: string[];
  status: string;
  runbook?: {
    file?: string;
    anchor?: string;
    procedureLevel?: string;
    section?: string;
  };
};

type ScenarioDoc = {
  id?: string;
  name?: string;
  runbookRefs?: string[];
};

type ScenarioResult = {
  id?: string;
  name?: string;
  runbookRefs?: string[];
  ok?: boolean;
};

type LayerKey = "simulator" | "playwright" | "unit" | "manual";

function collectFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out.sort();
}

function main() {
  const registry = parseYaml(
    fs.readFileSync(path.join(ROOT, "quality", "runbook-requirements.yaml"), "utf8")
  ) as { requirements?: Requirement[] };
  const requirements = registry.requirements ?? [];

  const simCoverage = new Map<string, string[]>();
  for (const file of collectFiles(
    path.join(ROOT, "tools", "case-simulator", "scenarios"),
    ".yaml"
  )) {
    const doc = parseYaml(fs.readFileSync(file, "utf8")) as ScenarioDoc;
    for (const ref of doc.runbookRefs ?? []) {
      const list = simCoverage.get(ref) ?? [];
      list.push(doc.id ?? path.basename(file));
      simCoverage.set(ref, list);
    }
  }

  const pwCoverage = new Map<string, string[]>();
  const titleRe =
    /\b(?:test|it)\(\s*(?:\/\*[\s\S]*?\*\/\s*)?["'`](\[[^\]]+\].*?|[^"'`]+)["'`]/g;
  for (const file of collectFiles(path.join(ROOT, "e2e"), ".spec.ts")) {
    const text = fs.readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = titleRe.exec(text))) {
      const title = match[1];
      for (const id of title.match(RB_RE) ?? []) {
        const list = pwCoverage.get(id) ?? [];
        list.push(title);
        pwCoverage.set(id, list);
      }
    }
  }

  const resultsPath = path.join(
    ROOT,
    "tools",
    "case-simulator",
    "reports",
    "simulator-results.json"
  );
  const lastSimByReq = new Map<string, "pass" | "fail">();
  if (fs.existsSync(resultsPath)) {
    const raw = JSON.parse(fs.readFileSync(resultsPath, "utf8")) as {
      results?: ScenarioResult[];
    };
    for (const result of raw.results ?? []) {
      const status = result.ok ? "pass" : "fail";
      for (const ref of result.runbookRefs ?? []) {
        const prev = lastSimByReq.get(ref);
        if (prev === "fail") continue;
        lastSimByReq.set(ref, status);
      }
    }
  }

  const rows = requirements.map((req) => {
    const expected = (req.expectedLayers ?? []) as LayerKey[];
    const simulatorLinks = simCoverage.get(req.id) ?? [];
    const playwrightLinks = pwCoverage.get(req.id) ?? [];
    const coveredLayers: Record<LayerKey, boolean> = {
      simulator: simulatorLinks.length > 0,
      playwright: playwrightLinks.length > 0,
      // Unit discovery is not implemented; never claim unit coverage from expectedLayers alone.
      unit: false,
      manual:
        expected.includes("manual") || req.status === "manual_only",
    };

    const coveredCount = expected.filter((layer) => coveredLayers[layer]).length;
    const fullyCovered =
      expected.length > 0 && coveredCount === expected.length;
    const partiallyCovered =
      coveredCount > 0 && coveredCount < expected.length;
    const missing =
      expected.length > 0 &&
      coveredCount === 0 &&
      req.status === "active" &&
      Boolean(req.automationRequired);

    let lastSimulatorResult:
      | "pass"
      | "fail"
      | "not_run"
      | "not_required"
      | "blocked_ui" = "not_run";

    if (req.status === "blocked_ui") {
      lastSimulatorResult = "blocked_ui";
    } else if (!expected.includes("simulator")) {
      lastSimulatorResult = "not_required";
    } else if (lastSimByReq.has(req.id)) {
      lastSimulatorResult = lastSimByReq.get(req.id)!;
    } else {
      lastSimulatorResult = "not_run";
    }

    const runbookLink = req.runbook?.file && req.runbook.anchor
      ? `${req.runbook.file}#${req.runbook.anchor}`
      : "";

    return {
      id: req.id,
      title: req.title,
      runbookSection: req.runbook?.section ?? "",
      runbookLink,
      procedureLevel: req.runbook?.procedureLevel ?? "",
      area: req.area ?? "",
      status: req.status,
      expectedLayers: expected,
      simulator: simulatorLinks.join(", ") || "—",
      playwright: playwrightLinks.length
        ? `${playwrightLinks.length} linked`
        : "—",
      unit: expected.includes("unit") ? "expected (undiscovered)" : "—",
      manual: coveredLayers.manual ? "yes" : "—",
      coverageStatus: req.status === "blocked_ui"
        ? "blocked_ui"
        : req.status === "manual_only"
          ? "manual_only"
          : fullyCovered
            ? "fully_covered"
            : partiallyCovered
              ? "partial"
              : missing
                ? "missing"
                : "unspecified",
      lastSimulatorResult,
      fullyCovered,
      partiallyCovered,
      missing,
    };
  });

  const summary = {
    total: rows.length,
    fullyCovered: rows.filter((r) => r.fullyCovered).length,
    partiallyCovered: rows.filter((r) => r.partiallyCovered).length,
    missingRequiredAutomation: rows.filter((r) => r.missing).length,
    manualOnly: rows.filter((r) => r.status === "manual_only").length,
    blockedUi: rows.filter((r) => r.status === "blocked_ui").length,
    simulatorPass: rows.filter((r) => r.lastSimulatorResult === "pass").length,
    simulatorFail: rows.filter((r) => r.lastSimulatorResult === "fail").length,
    simulatorNotRun: rows.filter((r) => r.lastSimulatorResult === "not_run")
      .length,
    simulatorNotRequired: rows.filter(
      (r) => r.lastSimulatorResult === "not_required"
    ).length,
  };

  const outDir = path.join(ROOT, "tools", "case-simulator", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "runbook-coverage.json");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2)
  );

  const md: string[] = [];
  md.push("# Runbook coverage");
  md.push("");
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push("");
  md.push("## Summary");
  md.push("");
  for (const [key, value] of Object.entries(summary)) {
    md.push(`- **${key}:** ${value}`);
  }
  md.push("");
  md.push(
    "| Requirement | Runbook | Simulator | Playwright | Unit | Manual | Coverage | Last simulator result |"
  );
  md.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    md.push(
      `| \`${row.id}\` | ${row.runbookLink || row.runbookSection || "—"} | ${row.simulator} | ${row.playwright} | ${row.unit} | ${row.manual} | ${row.coverageStatus} | ${row.lastSimulatorResult} |`
    );
  }
  md.push("");
  const mdPath = path.join(outDir, "runbook-coverage.md");
  fs.writeFileSync(mdPath, md.join("\n"));

  console.log(`Wrote ${path.relative(ROOT, jsonPath)}`);
  console.log(`Wrote ${path.relative(ROOT, mdPath)}`);
  console.log(
    `Summary: fully=${summary.fullyCovered} partial=${summary.partiallyCovered} missing=${summary.missingRequiredAutomation} blocked_ui=${summary.blockedUi}`
  );
}

main();
