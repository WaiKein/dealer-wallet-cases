import { createServiceClient } from "@/lib/supabase/api";
import { runWithSupabaseClient } from "@/lib/supabase/context";
import { runWithCorrelationId } from "@/lib/observability/correlation";
import { backoffMs, type BackgroundJob } from "@/lib/jobs/enqueue";
import { handleSlaRefreshJob } from "@/lib/jobs/handlers/sla-refresh";
import { handleNotificationDispatchJob } from "@/lib/jobs/handlers/notification-dispatch";
import { handleFailOnceJob } from "@/lib/jobs/handlers/fail-once";
import { handleIntegrationExecuteJob } from "@/lib/jobs/handlers/integration-execute";
import { handleIntegrationStatusInquiryJob } from "@/lib/jobs/handlers/integration-status";

const HEARTBEAT_MS = 60_000;

/**
 * System job handlers (documented auth bypass):
 * - sla.refresh_case: evaluates SLA state for a case; org-scoped payload
 * - notification.dispatch: inserts in-app notifications; org-scoped payload
 * - integration.execute_wallet: calls wallet provider; updates execution tables only
 * - integration.inquire_wallet_status: status inquiry; updates execution tables only
 * - jobs.fail_once: test-only controlled failure for retry/DLQ scenarios
 *
 * Handlers must not change case workflow status. They run with service-role
 * only inside the worker process (server-only).
 *
 * Completion/failure updates are fenced by locked_by + attempt_count so a
 * reclaimed job cannot be finalized by its previous worker.
 */
export async function processClaimedJobs(
  workerId: string,
  limit = 10
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const service = createServiceClient();
  const { data: jobs, error } = await service.rpc("claim_background_jobs", {
    p_limit: limit,
    p_worker_id: workerId,
  });

  if (error) {
    throw new Error(error.message);
  }

  let succeeded = 0;
  let failed = 0;

  for (const job of (jobs ?? []) as BackgroundJob[]) {
    const correlationId = job.correlation_id ?? crypto.randomUUID();
    const attemptNo = job.attempt_count;
    const fence = {
      jobId: job.id,
      lockedBy: workerId,
      attemptCount: attemptNo,
    };

    await service.from("background_job_attempts").insert({
      job_id: job.id,
      attempt_no: attemptNo,
      status: "running",
      correlation_id: correlationId,
    });

    const stopHeartbeat = startJobHeartbeat(service, fence);

    try {
      await runWithCorrelationId(correlationId, async () =>
        runWithSupabaseClient(service, async () => {
          await dispatchJob(job);
        })
      );

      const kept = await finalizeJob(service, fence, {
        status: "succeeded",
        completed_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        last_error: null,
      });

      if (!kept) {
        // Lost fence to a reclaiming worker — do not touch attempt rows further.
        continue;
      }

      await service
        .from("background_job_attempts")
        .update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
        })
        .eq("job_id", job.id)
        .eq("attempt_no", attemptNo);

      succeeded += 1;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Job handler failed.";
      const dead = job.attempt_count >= job.max_attempts;
      const immediate =
        job.payload.immediateRetry === true ||
        job.job_type === "jobs.fail_once";
      const nextRun = new Date(
        Date.now() + (immediate ? 0 : backoffMs(job.attempt_count))
      );

      const kept = await finalizeJob(service, fence, {
        status: dead ? "dead_letter" : "failed",
        last_error: message.slice(0, 2000),
        run_at: dead ? job.run_at : nextRun.toISOString(),
        locked_at: null,
        locked_by: null,
        completed_at: dead ? new Date().toISOString() : null,
      });

      if (!kept) {
        continue;
      }

      await service
        .from("background_job_attempts")
        .update({
          status: dead ? "dead_letter" : "failed",
          error: message.slice(0, 2000),
          finished_at: new Date().toISOString(),
        })
        .eq("job_id", job.id)
        .eq("attempt_no", attemptNo);

      if (dead) {
        const { upsertOperationalException } = await import(
          "@/lib/exceptions/sync"
        );
        const caseId =
          typeof job.payload.caseId === "string" ? job.payload.caseId : null;
        await upsertOperationalException({
          organizationId: job.organization_id,
          queueType: "dead_letter_job",
          sourceRef: `job:${job.id}:dead_letter`,
          caseId,
          jobId: job.id,
          title: `Dead-letter job ${job.job_type}`,
          failureCategory: "dead_letter",
        });
      }

      failed += 1;
    } finally {
      stopHeartbeat();
    }
  }

  return {
    processed: (jobs ?? []).length,
    succeeded,
    failed,
  };
}

type JobFence = {
  jobId: string;
  lockedBy: string;
  attemptCount: number;
};

async function finalizeJob(
  service: ReturnType<typeof createServiceClient>,
  fence: JobFence,
  patch: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await service
    .from("background_jobs")
    .update(patch)
    .eq("id", fence.jobId)
    .eq("locked_by", fence.lockedBy)
    .eq("attempt_count", fence.attemptCount)
    .eq("status", "running")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return Boolean(data);
}

function startJobHeartbeat(
  service: ReturnType<typeof createServiceClient>,
  fence: JobFence
): () => void {
  const timer = setInterval(() => {
    void service
      .from("background_jobs")
      .update({ locked_at: new Date().toISOString() })
      .eq("id", fence.jobId)
      .eq("locked_by", fence.lockedBy)
      .eq("attempt_count", fence.attemptCount)
      .eq("status", "running");
  }, HEARTBEAT_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return () => clearInterval(timer);
}

async function dispatchJob(job: BackgroundJob): Promise<void> {
  const orgId = String(
    job.payload.organizationId ?? job.organization_id ?? ""
  );
  if (!orgId || orgId !== job.organization_id) {
    throw new Error("Job organization context missing or mismatched.");
  }

  switch (job.job_type) {
    case "sla.refresh_case":
      await handleSlaRefreshJob(job);
      return;
    case "notification.dispatch":
      await handleNotificationDispatchJob(job);
      return;
    case "integration.execute_wallet":
      await handleIntegrationExecuteJob(job);
      return;
    case "integration.inquire_wallet_status":
      await handleIntegrationStatusInquiryJob(job);
      return;
    case "jobs.fail_once":
      await handleFailOnceJob(job);
      return;
    default:
      throw new Error(`Unknown job type: ${job.job_type}`);
  }
}
