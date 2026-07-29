/**
 * Generates runbook coverage JSON + Markdown from the registry and linked tests.
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const RB_RE = /RB-[A-Z0-9]+(?:-[A-Z0-9]+)+/g;
const REPORT_DIR = path.join(ROOT, "tools", "case-simulator", "reports");

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
    journey?: string;
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

function toPosixRelative(fromDir: string, targetPath: string): string {
  return path.relative(fromDir, targetPath).split(path.sep).join("/");
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

  const resultsPath = path.join(REPORT_DIR, "simulator-results.json");
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
    const isManualOnly =
      req.status === "manual_only" ||
      (expected.length === 1 && expected[0] === "manual");

    // Manual expectation is ownership, not execution evidence.
    const coveredLayers: Record<LayerKey, boolean> = {
      simulator: simulatorLinks.length > 0,
      playwright: playwrightLinks.length > 0,
      unit: false,
      manual: false,
    };

    const automationExpected = expected.filter((layer) => layer !== "manual");
    const coveredCount = automationExpected.filter(
      (layer) => coveredLayers[layer]
    ).length;
    const fullyAutomated =
      automationExpected.length > 0 &&
      coveredCount === automationExpected.length &&
      !isManualOnly;
    const partiallyCovered =
      coveredCount > 0 && coveredCount < automationExpected.length;
    const missing =
      automationExpected.length > 0 &&
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

    const runbookFile = req.runbook?.file ?? "";
    const runbookAnchor = req.runbook?.anchor ?? "";
    const runbookLink =
      runbookFile && runbookAnchor ? `${runbookFile}#${runbookAnchor}` : "";
    const sectionLabel = req.runbook?.section
      ? `${req.runbook.section} — ${req.title}`
      : req.title;
    const markdownHref =
      runbookFile && runbookAnchor
        ? `${toPosixRelative(REPORT_DIR, path.join(ROOT, runbookFile))}#${runbookAnchor}`
        : "";

    const coverageStatus = req.status === "blocked_ui"
      ? "blocked_ui"
      : isManualOnly
        ? "manual_only"
        : fullyAutomated
          ? "fully_covered"
          : partiallyCovered
            ? "partial"
            : missing
              ? "missing"
              : "unspecified";

    return {
      id: req.id,
      title: req.title,
      runbookSection: req.runbook?.section ?? "",
      runbookFile,
      runbookAnchor,
      runbookLink,
      markdownHref,
      sectionLabel,
      procedureLevel: req.runbook?.procedureLevel ?? "",
      journey: req.runbook?.journey ?? "",
      area: req.area ?? "",
      status: req.status,
      expectedLayers: expected,
      simulator: simulatorLinks.join(", ") || "—",
      playwright: playwrightLinks.length
        ? `${playwrightLinks.length} linked`
        : "—",
      unit: expected.includes("unit") ? "expected (undiscovered)" : "—",
      manual: isManualOnly ? "expected (not run)" : "—",
      coverageStatus,
      lastSimulatorResult,
      fullyCovered: fullyAutomated,
      partiallyCovered,
      missing,
      isManualOnly,
    };
  });

  const summary = {
    total: rows.length,
    activeFullyAutomated: rows.filter(
      (r) => r.status === "active" && r.fullyCovered
    ).length,
    partiallyAutomated: rows.filter((r) => r.partiallyCovered).length,
    missingRequiredAutomation: rows.filter((r) => r.missing).length,
    blockedByUi: rows.filter((r) => r.status === "blocked_ui").length,
    manualOnly: rows.filter((r) => r.isManualOnly).length,
    simulatorPass: rows.filter((r) => r.lastSimulatorResult === "pass").length,
    simulatorFail: rows.filter((r) => r.lastSimulatorResult === "fail").length,
    simulatorNotRun: rows.filter((r) => r.lastSimulatorResult === "not_run")
      .length,
    simulatorNotRequired: rows.filter(
      (r) => r.lastSimulatorResult === "not_required"
    ).length,
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const jsonPath = path.join(REPORT_DIR, "runbook-coverage.json");
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
  md.push(`- **Total requirements:** ${summary.total}`);
  md.push(`- **Active fully automated:** ${summary.activeFullyAutomated}`);
  md.push(`- **Partially automated:** ${summary.partiallyAutomated}`);
  md.push(
    `- **Missing required automation:** ${summary.missingRequiredAutomation}`
  );
  md.push(`- **Blocked by UI:** ${summary.blockedByUi}`);
  md.push(`- **Manual only:** ${summary.manualOnly}`);
  md.push(`- **Simulator pass:** ${summary.simulatorPass}`);
  md.push(`- **Simulator fail:** ${summary.simulatorFail}`);
  md.push(`- **Simulator not run:** ${summary.simulatorNotRun}`);
  md.push(`- **Simulator not required:** ${summary.simulatorNotRequired}`);
  md.push("");
  md.push(
    "| Requirement | Journey | Runbook | Simulator | Playwright | Unit | Manual | Coverage | Last simulator result |"
  );
  md.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    const runbookCell = row.markdownHref
      ? `[${row.sectionLabel.replace(/\|/g, "\\|")}](${row.markdownHref})`
      : "—";
    md.push(
      `| \`${row.id}\` | \`${row.journey || "—"}\` | ${runbookCell} | ${row.simulator} | ${row.playwright} | ${row.unit} | ${row.manual} | ${row.coverageStatus} | ${row.lastSimulatorResult} |`
    );
  }
  md.push("");
  const mdPath = path.join(REPORT_DIR, "runbook-coverage.md");
  fs.writeFileSync(mdPath, md.join("\n"));

  console.log(`Wrote ${path.relative(ROOT, jsonPath)}`);
  console.log(`Wrote ${path.relative(ROOT, mdPath)}`);
  console.log(
    `Summary: activeFullyAutomated=${summary.activeFullyAutomated} partial=${summary.partiallyAutomated} missing=${summary.missingRequiredAutomation} blocked_ui=${summary.blockedByUi} manualOnly=${summary.manualOnly}`
  );
}

main();
