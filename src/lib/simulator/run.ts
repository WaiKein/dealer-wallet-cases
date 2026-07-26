import { spawn } from "node:child_process";
import { readSimulatorReport } from "@/lib/simulator/fs";
import type { SimulatorReport } from "@/lib/simulator/types";

export async function runSimulatorCli(options?: {
  tags?: string[];
  name?: string;
}): Promise<{
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  report: SimulatorReport;
}> {
  const args = ["tsx", "tools/case-simulator/src/cli.ts"];
  if (options?.tags?.length) {
    args.push(`--tags=${options.tags.join(",")}`);
  }
  if (options?.name?.trim()) {
    args.push(`--name=${options.name.trim()}`);
  }

  const baseUrl =
    process.env.SIMULATOR_BASE_URL ?? "http://127.0.0.1:3000";

  const { stdout, stderr, exitCode } = await spawnNpx(args, {
    SIMULATOR_BASE_URL: baseUrl,
    TEST_CONTROL_SECRET:
      process.env.TEST_CONTROL_SECRET ?? "local-simulator-secret",
  });

  return {
    ok: exitCode === 0,
    exitCode,
    stdout,
    stderr,
    report: readSimulatorReport(),
  };
}

function spawnNpx(
  args: string[],
  env: Record<string, string>
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      shell: true,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}
