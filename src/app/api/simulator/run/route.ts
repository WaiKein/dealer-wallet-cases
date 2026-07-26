import { jsonError, jsonOk } from "@/lib/api/response";
import { getCurrentProfile } from "@/lib/auth/session";
import { isTestControlEnabled } from "@/lib/clock";
import { listSimulatorScenarios } from "@/lib/simulator/fs";
import { runSimulatorCli } from "@/lib/simulator/run";

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isTestControlEnabled()) {
    return jsonError("Simulator UI is disabled outside test-control environments.", 403);
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return jsonError("Authentication required.", 401);
  }

  const body = (await request.json().catch(() => ({}))) as {
    tags?: string[];
    name?: string;
  };

  const tags = Array.isArray(body.tags)
    ? body.tags.map(String).filter(Boolean)
    : undefined;
  const name = typeof body.name === "string" ? body.name : undefined;

  try {
    const result = await runSimulatorCli({ tags, name });
    const passed = result.report.results.filter((item) => item.ok).length;

    return jsonOk({
      ok: result.ok,
      exitCode: result.exitCode,
      stdout: result.stdout.slice(-8000),
      stderr: result.stderr.slice(-4000),
      scenarios: listSimulatorScenarios(),
      report: result.report,
      summary: {
        total: result.report.results.length,
        passed,
        failed: result.report.results.length - passed,
        updatedAt: result.report.updatedAt,
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Simulator run failed.",
      500
    );
  }
}
