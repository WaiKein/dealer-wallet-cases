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

type ScenarioResult = {
  id?: string;
  name?: string;
  runbookRefs?: string[];
  ok?: boolean;
};

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
  const lastByReq = new Map<string, "pass" | "fail" | "not_run">();
  if (fs.existsSync(resultsPath)) {
    const raw = JSON.parse(fs.readFileSync(resultsPath, "utf8")) as {
      results?: ScenarioResult[];
    };
    for (const result of raw.results ?? []) {
      const status = result.ok ? "pass" : "fail";
      for (const ref of result.runbookRefs ?? []) {
        const prev = lastByReq.get(ref);
        if (prev === "fail") continue;
        lastByReq.set(ref, status);
      }
    }
  }

  const rows = requirements.map((req) => {
    const simulator = simCoverage.get(req.id) ?? [];
    const playwright = pwCoverage.get(req.id) ?? [];
    const manual = (req.expectedLayers ?? []).includes("manual") || req.status === "manual_only";
    const unit = (req.expectedLayers ?? []).includes("unit");
    let lastResult: "pass" | "fail" | "not_run" | "blocked" | "manual" = "not_run";
    if (req.status === "blocked_ui") lastResult = "blocked";
    else if (req.status === "manual_only") lastResult = "manual";
    else if (lastByReq.has(req.id)) lastResult = lastByReq.get(req.id)!;
    else if (simulator.length || playwright.length) lastResult = "not_run";

    return {
      id: req.id,
      title: req.title,
      runbookSection: req.runbookSection ?? "",
      area: req.area ?? "",
      status: req.status,
      simulator: simulator.join(", ") || "—",
      playwright: playwright.length ? `${playwright.length} test(s)` : "—",
      unit: unit ? "expected" : "—",
      manual: manual ? "yes" : "—",
      uiStatus: req.status === "blocked_ui" ? "blocked_ui" : "ok",
      lastResult,
      implemented: Boolean(simulator.length || playwright.length || unit || manual),
    };
  });

  const summary = {
    total: rows.length,
    automated: rows.filter((r) => r.simulator !== "—" || r.playwright !== "—").length,
    partiallyCovered: rows.filter(
      (r) =>
        (r.simulator !== "—") !== (r.playwright !== "—") &&
        r.status === "active"
    ).length,
    manualOnly: rows.filter((r) => r.status === "manual_only").length,
    blockedUi: rows.filter((r) => r.status === "blocked_ui").length,
    missingRequiredAutomation: rows.filter(
      (r) =>
        r.status === "active" &&
        requirements.find((x) => x.id === r.id)?.automationRequired &&
        r.simulator === "—" &&
        r.playwright === "—" &&
        r.unit === "—"
    ).length,
    passing: rows.filter((r) => r.lastResult === "pass").length,
    failing: rows.filter((r) => r.lastResult === "fail").length,
    notRun: rows.filter((r) => r.lastResult === "not_run").length,
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
    "| Requirement | Runbook section | Simulator | Playwright | Unit | Manual | UI status | Last result |"
  );
  md.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    md.push(
      `| \`${row.id}\` | ${row.runbookSection} | ${row.simulator} | ${row.playwright} | ${row.unit} | ${row.manual} | ${row.uiStatus} | ${row.lastResult} |`
    );
  }
  md.push("");
  const mdPath = path.join(outDir, "runbook-coverage.md");
  fs.writeFileSync(mdPath, md.join("\n"));

  console.log(`Wrote ${path.relative(ROOT, jsonPath)}`);
  console.log(`Wrote ${path.relative(ROOT, mdPath)}`);
  console.log(
    `Summary: ${summary.automated}/${summary.total} automated links; blocked_ui=${summary.blockedUi}; missingRequired=${summary.missingRequiredAutomation}`
  );
}

main();
