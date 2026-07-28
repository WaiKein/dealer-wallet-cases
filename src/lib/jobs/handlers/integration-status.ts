import type { BackgroundJob } from "@/lib/jobs/enqueue";
import { processIntegrationStatusInquiryJob } from "@/lib/executions/service";

/** System action: wallet status inquiry; updates execution tables only. */
export async function handleIntegrationStatusInquiryJob(
  job: BackgroundJob
): Promise<void> {
  const executionId = String(job.payload.executionId ?? "");
  if (!executionId) {
    throw new Error(
      "integration.inquire_wallet_status payload missing executionId."
    );
  }

  await processIntegrationStatusInquiryJob({
    executionId,
    organizationId: job.organization_id,
    jobId: job.id,
  });
}
