#!/usr/bin/env tsx
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadScenarios } from "./loader/scenarios.js";
import {
  printConsoleReport,
  writeJsonReport,
  writeJUnitReport,
} from "./report/index.js";
import { runScenario } from "./runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const tagArg = args.find((item) => item.startsWith("--tags="));
  const tags = tagArg
    ? tagArg
        .replace("--tags=", "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
  const nameArg = args.find((item) => item.startsWith("--name="));
  const nameIncludes = nameArg?.replace("--name=", "");

  const baseUrl =
    process.env.SIMULATOR_BASE_URL ?? "http://127.0.0.1:3000";
  const testControlSecret =
    process.env.TEST_CONTROL_SECRET ?? "local-simulator-secret";

  const scenariosDir = path.join(__dirname, "..", "scenarios");
  const loaded = loadScenarios(scenariosDir, { tags, nameIncludes });

  if (!loaded.length) {
    console.error("No scenarios matched.");
    process.exit(1);
  }

  console.log(`Running ${loaded.length} scenario(s) against ${baseUrl}`);
  const results = [];
  for (const item of loaded) {
    console.log(`\n→ ${item.scenario.name}`);
    results.push(
      await runScenario({
        scenario: item.scenario,
        baseUrl,
        testControlSecret,
      })
    );
  }

  printConsoleReport(results);
  const outDir = path.join(__dirname, "..", "reports");
  const jsonFile = writeJsonReport(results, outDir);
  const junitFile = writeJUnitReport(results, outDir);
  console.log(`JSON report: ${jsonFile}`);
  console.log(`JUnit report: ${junitFile}`);

  if (results.some((item) => !item.ok)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
