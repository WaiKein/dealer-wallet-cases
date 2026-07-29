import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { ScenarioFile } from "../types.js";

const SIM_ID_RE = /^SIM-[0-9]{3}$/;
const RB_ID_RE = /^RB-[A-Z0-9]+(?:-[A-Z0-9]+)+$/;

function loadRequirementIds(projectRoot: string): Set<string> {
  const registryPath = path.join(
    projectRoot,
    "quality",
    "runbook-requirements.yaml"
  );
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Missing requirement registry: ${registryPath}`);
  }
  const parsed = parseYaml(fs.readFileSync(registryPath, "utf8")) as {
    requirements?: Array<{ id?: string; status?: string }>;
  };
  const ids = new Set<string>();
  for (const item of parsed.requirements ?? []) {
    if (item.id) ids.add(item.id);
  }
  return ids;
}

function loadRetiredIds(projectRoot: string): Set<string> {
  const registryPath = path.join(
    projectRoot,
    "quality",
    "runbook-requirements.yaml"
  );
  const parsed = parseYaml(fs.readFileSync(registryPath, "utf8")) as {
    requirements?: Array<{ id?: string; status?: string }>;
  };
  return new Set(
    (parsed.requirements ?? [])
      .filter((item) => item.status === "retired" && item.id)
      .map((item) => item.id as string)
  );
}

export function validateScenarioMetadata(
  filePath: string,
  scenario: ScenarioFile,
  options?: {
    knownIds?: Set<string>;
    retiredIds?: Set<string>;
    seenScenarioIds?: Set<string>;
  }
): void {
  const label = filePath;
  if (!scenario?.name || !scenario.actors?.length || !scenario.actions) {
    throw new Error(`Invalid scenario file: ${label}`);
  }
  if (!scenario.id || !SIM_ID_RE.test(scenario.id)) {
    throw new Error(
      `Invalid or missing scenario id in ${label} (expected SIM-NNN)`
    );
  }
  if (options?.seenScenarioIds?.has(scenario.id)) {
    throw new Error(`Duplicate scenario id ${scenario.id} in ${label}`);
  }
  options?.seenScenarioIds?.add(scenario.id);

  if (!Array.isArray(scenario.runbookRefs) || scenario.runbookRefs.length === 0) {
    throw new Error(`Missing runbookRefs in ${label}`);
  }
  for (const ref of scenario.runbookRefs) {
    if (!RB_ID_RE.test(ref)) {
      throw new Error(`Malformed runbookRef "${ref}" in ${label}`);
    }
    if (options?.knownIds && !options.knownIds.has(ref)) {
      throw new Error(`Unknown runbookRef "${ref}" in ${label}`);
    }
    if (options?.retiredIds?.has(ref)) {
      throw new Error(`Retired runbookRef "${ref}" referenced in ${label}`);
    }
  }
}

export function loadScenarioFile(
  filePath: string,
  options?: {
    knownIds?: Set<string>;
    retiredIds?: Set<string>;
    seenScenarioIds?: Set<string>;
  }
): ScenarioFile {
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = parseYaml(content) as ScenarioFile;
  validateScenarioMetadata(filePath, parsed, options);
  return parsed;
}

export function loadScenarios(
  dir: string,
  filter?: { tags?: string[]; nameIncludes?: string }
): { file: string; scenario: ScenarioFile }[] {
  const projectRoot = path.resolve(dir, "..", "..", "..");
  const knownIds = loadRequirementIds(projectRoot);
  const retiredIds = loadRetiredIds(projectRoot);
  const seenScenarioIds = new Set<string>();

  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort();

  const loaded = files.map((name) => {
    const file = path.join(dir, name);
    return {
      file,
      scenario: loadScenarioFile(file, {
        knownIds,
        retiredIds,
        seenScenarioIds,
      }),
    };
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
