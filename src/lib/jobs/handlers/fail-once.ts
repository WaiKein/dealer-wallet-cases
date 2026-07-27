import type { BackgroundJob } from "@/lib/jobs/enqueue";

/**
 * Test helper job: fails until attempt_count reaches succeedAfterAttempt
 * (defaults to never succeeding → dead letter).
 */
export async function handleFailOnceJob(job: BackgroundJob): Promise<void> {
  const succeedAfter = Number(job.payload.succeedAfterAttempt ?? 99);
  if (job.attempt_count < succeedAfter) {
    throw new Error(
      `Controlled failure at attempt ${job.attempt_count} (succeedAfter=${succeedAfter}).`
    );
  }
}
