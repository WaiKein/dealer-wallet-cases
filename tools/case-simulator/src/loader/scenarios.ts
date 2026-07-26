import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { ScenarioFile } from "../types.js";

export function loadScenarioFile(filePath: string): ScenarioFile {
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = parseYaml(content) as ScenarioFile;
  if (!parsed?.name || !parsed.actors?.length || !parsed.actions) {
    throw new Error(`Invalid scenario file: ${filePath}`);
  }
  return parsed;
}

export function loadScenarios(
  dir: string,
  filter?: { tags?: string[]; nameIncludes?: string }
): { file: string; scenario: ScenarioFile }[] {
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort();

  const loaded = files.map((name) => {
    const file = path.join(dir, name);
    return { file, scenario: loadScenarioFile(file) };
  });

  return loaded.filter(({ scenario }) => {
    if (filter?.nameIncludes && !scenario.name.includes(filter.nameIncludes)) {
      return false;
    }
    if (filter?.tags?.length) {
      const tags = scenario.tags ?? [];
      return filter.tags.some((tag) => tags.includes(tag));
    }
    return true;
  });
}
