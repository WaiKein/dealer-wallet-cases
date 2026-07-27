import { apiError, jsonOk } from "@/lib/api/response";
import { isTestControlEnabled } from "@/lib/clock";
import { processClaimedJobs } from "@/lib/jobs/worker";
import {
  resolveCorrelationId,
  runWithCorrelationId,
} from "@/lib/observability/correlation";

/**
 * Internal job tick. In pilot, protect with JOBS_TICK_SECRET (or test-control).
 * Production cron should call this with the secret; never expose publicly.
 */
export async function POST(request: Request) {
  return runWithCorrelationId(resolveCorrelationId(request), async () => {
    const secret = request.headers.get("x-jobs-tick-secret");
    const jobsSecret = process.env.JOBS_TICK_SECRET;
    const allowed =
      (jobsSecret && secret === jobsSecret) ||
      (isTestControlEnabled() &&
        secret === process.env.TEST_CONTROL_SECRET);

    if (!allowed) {
      return apiError({ code: "UNAUTHORIZED" });
    }

    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      workerId?: string;
    };

    const result = await processClaimedJobs(
      body.workerId ?? `tick-${crypto.randomUUID()}`,
      body.limit ?? 10
    );

    return jsonOk(result);
  });
}
