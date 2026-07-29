import fs from "node:fs";
import path from "node:path";
import type { ScenarioResult, StepResult } from "../types.js";

export function printConsoleReport(results: ScenarioResult[]): void {
  for (const result of results) {
    const mark = result.ok ? "PASS" : "FAIL";
    const idLabel = result.id ? `${result.id} — ` : "";
    console.log(`\n[${mark}] ${idLabel}${result.name}`);
    if (result.runbookRefs?.length) {
      console.log(`       covers: ${result.runbookRefs.join(", ")}`);
    }
    for (const step of result.steps) {
      const stepMark = step.ok ? "✓" : "✗";
      console.log(
        `  ${stepMark} ${step.step} (${step.actor}) ${step.durationMs}ms` +
          (step.correlationId ? ` corr=${step.correlationId}` : "")
      );
      if (!step.ok) {
        console.log(`     expected: ${JSON.stringify(step.expected)}`);
        console.log(`     actual:   ${JSON.stringify(step.actual)}`);
        if (step.error) console.log(`     error:    ${step.error}`);
        if (step.apiResponse) {
          console.log(`     api:      ${JSON.stringify(step.apiResponse)}`);
        }
      }
    }
  }

  const passed = results.filter((item) => item.ok).length;
  console.log(`\nSummary: ${passed}/${results.length} scenarios passed`);
}

export function writeJsonReport(results: ScenarioResult[], outDir: string): string {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, "simulator-results.json");
  fs.writeFileSync(file, JSON.stringify({ results }, null, 2));
  return file;
}

export function writeJUnitReport(results: ScenarioResult[], outDir: string): string {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, "simulator-junit.xml");
  const suites = results
    .map((result) => {
      const failures = result.steps.filter((step) => !step.ok);
      const classname = escapeXml(
        result.id ? `${result.id}:${result.name}` : result.name
      );
      const testcases = result.steps
        .map((step) => {
          const name = escapeXml(`${step.step} [${step.actor}]`);
          if (step.ok) {
            return `<testcase classname="${classname}" name="${name}" time="${(step.durationMs / 1000).toFixed(3)}" />`;
          }
          const message = escapeXml(
            [
              `expected=${JSON.stringify(step.expected)}`,
              `actual=${JSON.stringify(step.actual)}`,
              step.error ? `error=${step.error}` : "",
              step.correlationId ? `correlationId=${step.correlationId}` : "",
              step.apiResponse ? `api=${JSON.stringify(step.apiResponse)}` : "",
              result.runbookRefs?.length
                ? `runbookRefs=${result.runbookRefs.join(",")}`
                : "",
            ]
              .filter(Boolean)
              .join(" | ")
          );
          return `<testcase classname="${classname}" name="${name}" time="${(step.durationMs / 1000).toFixed(3)}"><failure message="${message}" /></testcase>`;
        })
        .join("\n");
      const props = (result.runbookRefs ?? [])
        .map(
          (ref) =>
            `<property name="runbookRef" value="${escapeXml(ref)}" />`
        )
        .join("");
      const suiteName = escapeXml(result.id ?? result.name);
      return `<testsuite name="${suiteName}" tests="${result.steps.length}" failures="${failures.length}"><properties>${props}</properties>${testcases}</testsuite>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>${suites}</testsuites>\n`;
  fs.writeFileSync(file, xml);
  return file;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function failedStepDetails(step: StepResult): string {
  return JSON.stringify(step, null, 2);
}
