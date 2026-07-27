import { processClaimedJobs } from "../src/lib/jobs/worker";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce(workerId: string, limit: number) {
  const result = await processClaimedJobs(workerId, limit);
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      workerId,
      ...result,
    })
  );
  return result;
}

async function main() {
  const workerId = process.env.JOBS_WORKER_ID ?? `worker-${process.pid}`;
  const limit = Number(process.env.JOBS_BATCH_SIZE ?? 10);
  const pollMs = Number(process.env.JOBS_POLL_INTERVAL_MS ?? 0);

  if (!Number.isFinite(pollMs) || pollMs <= 0) {
    await runOnce(workerId, limit);
    return;
  }

  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      message: "jobs worker loop started",
      workerId,
      limit,
      pollMs,
    })
  );

  // Long-running process for pilot deploys (or use cron → POST /api/jobs/tick).
  for (;;) {
    try {
      await runOnce(workerId, limit);
    } catch (error) {
      console.error(
        JSON.stringify({
          at: new Date().toISOString(),
          workerId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
    await sleep(pollMs);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
