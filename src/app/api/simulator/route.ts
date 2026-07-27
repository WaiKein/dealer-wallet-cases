import { apiError, jsonOk } from "@/lib/api/response";
import { getCurrentProfile } from "@/lib/auth/session";
import { isTestControlEnabled } from "@/lib/clock";
import {
  listSimulatorScenarios,
  readSimulatorReport,
} from "@/lib/simulator/fs";

export async function GET() {
  if (!isTestControlEnabled()) {
    return apiError({
      code: "FORBIDDEN",
      message: "Simulator UI is disabled outside test-control environments.",
    });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return apiError({ code: "UNAUTHORIZED" });
  }

  const scenarios = listSimulatorScenarios();
  const report = readSimulatorReport();
  const passed = report.results.filter((item) => item.ok).length;

  return jsonOk({
    scenarios,
    report,
    summary: {
      total: report.results.length,
      passed,
      failed: report.results.length - passed,
      updatedAt: report.updatedAt,
    },
  });
}
