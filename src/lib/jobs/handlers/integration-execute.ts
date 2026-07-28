import type { BackgroundJob } from "@/lib/jobs/enqueue";
import { processIntegrationExecuteJob } from "@/lib/executions/service";

/** System action: wallet execute via provider; updates execution tables only. */
export async function handleIntegrationExecuteJob(
  job: BackgroundJob
): Promise<void> {
  const executionId = String(job.payload.executionId ?? "");
  if (!executionId) {
    throw new Error("integration.execute_wallet payload missing executionId.");
  }

  await processIntegrationExecuteJob({
    executionId,
    organizationId: job.organization_id,
    jobId: job.id,
  });
}
