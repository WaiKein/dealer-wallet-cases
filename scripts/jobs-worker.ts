import { processClaimedJobs } from "../src/lib/jobs/worker";

async function main() {
  const workerId = process.env.JOBS_WORKER_ID ?? `worker-${process.pid}`;
  const limit = Number(process.env.JOBS_BATCH_SIZE ?? 10);
  const result = await processClaimedJobs(workerId, limit);
  console.log(JSON.stringify({ workerId, ...result }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
