import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  SimulatorReport,
  SimulatorScenarioResult,
  SimulatorScenarioSummary,
} from "@/lib/simulator/types";

const ROOT = process.cwd();

export function getSimulatorScenariosDir() {
  return path.join(ROOT, "tools", "case-simulator", "scenarios");
}

export function getSimulatorReportsDir() {
  return path.join(ROOT, "tools", "case-simulator", "reports");
}

export function getSimulatorResultsPath() {
  return path.join(getSimulatorReportsDir(), "simulator-results.json");
}

export function listSimulatorScenarios(): SimulatorScenarioSummary[] {
  const dir = getSimulatorScenariosDir();
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort()
    .map((file) => {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      const parsed = parseYaml(content) as {
        id?: string;
        name?: string;
        description?: string;
        tags?: string[];
        runbookRefs?: string[];
        actions?: unknown[];
        assertions?: unknown[];
      };
      return {
        file,
        id: parsed.id,
        name: parsed.name ?? file,
        description: parsed.description,
        tags: parsed.tags ?? [],
        runbookRefs: parsed.runbookRefs ?? [],
        actionCount: parsed.actions?.length ?? 0,
        assertionCount: parsed.assertions?.length ?? 0,
      };
    });
}

export function readSimulatorReport(): SimulatorReport {
  const file = getSimulatorResultsPath();
  if (!fs.existsSync(file)) {
    return { results: [], updatedAt: null };
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
    results?: SimulatorScenarioResult[];
  };
  const stats = fs.statSync(file);
  return {
    results: raw.results ?? [],
    updatedAt: stats.mtime.toISOString(),
  };
}
