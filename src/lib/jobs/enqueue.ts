import { getCorrelationId } from "@/lib/observability/correlation";
import { createServiceClient } from "@/lib/supabase/api";

export type JobType =
  | "sla.refresh_case"
  | "notification.dispatch"
  | "jobs.fail_once"; // test helper for retry/DLQ scenarios

export type JobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "dead_letter"
  | "cancelled";

export interface BackgroundJob {
  id: string;
  organization_id: string;
  job_type: JobType | string;
  payload: Record<string, unknown>;
  status: JobStatus;
  idempotency_key: string | null;
  attempt_count: number;
  max_attempts: number;
  run_at: string;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  correlation_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export async function enqueueJob(params: {
  organizationId: string;
  jobType: JobType | string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  runAt?: Date;
  maxAttempts?: number;
  correlationId?: string;
}): Promise<{ id: string | null; error: string | null }> {
  const service = createServiceClient();
  const correlationId = params.correlationId ?? getCorrelationId();

  const row = {
    organization_id: params.organizationId,
    job_type: params.jobType,
    payload: {
      ...params.payload,
      organizationId: params.organizationId,
    },
    idempotency_key: params.idempotencyKey ?? null,
    run_at: (params.runAt ?? new Date()).toISOString(),
    max_attempts: params.maxAttempts ?? 5,
    correlation_id: correlationId,
    status: "pending" as const,
  };

  if (params.idempotencyKey) {
    const { data: existing } = await service
      .from("background_jobs")
      .select("id")
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return { id: existing.id, error: null };
    }
  }

  const { data, error } = await service
    .from("background_jobs")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    // Unique race on idempotency_key
    if (error.code === "23505" && params.idempotencyKey) {
      const { data: again } = await service
        .from("background_jobs")
        .select("id")
        .eq("idempotency_key", params.idempotencyKey)
        .maybeSingle();
      return { id: again?.id ?? null, error: null };
    }
    return { id: null, error: error.message };
  }

  return { id: data.id, error: null };
}

export function backoffMs(attemptCount: number): number {
  const base = 1000 * Math.pow(2, Math.max(attemptCount - 1, 0));
  return Math.min(base, 15 * 60 * 1000);
}
