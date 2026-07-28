import { createServiceClient } from "@/lib/supabase/api";
import { getCorrelationId } from "@/lib/observability/correlation";
import {
  OPEN_EXCEPTION_STATUSES,
  type ExceptionItemStatus,
  type ExceptionQueueType,
} from "@/lib/exceptions/types";
import { planExceptionProjection } from "@/lib/exceptions/projection";

export async function upsertOperationalException(params: {
  organizationId: string;
  queueType: ExceptionQueueType;
  sourceRef: string;
  caseId?: string | null;
  executionId?: string | null;
  jobId?: string | null;
  title?: string | null;
  failureCategory?: string | null;
  reconciliationRequired?: boolean;
}): Promise<{ id: string | null; error: string | null }> {
  const service = createServiceClient();
  const correlationId = getCorrelationId();

  const { data: existing } = await service
    .from("operational_exceptions")
    .select("id, status, version")
    .eq("organization_id", params.organizationId)
    .eq("source_ref", params.sourceRef)
    .maybeSingle();

  if (existing) {
    if (
      existing.status === "RESOLVED" ||
      existing.status === "DISMISSED"
    ) {
      // Re-open if the underlying problem reappears.
      const { data, error } = await service
        .from("operational_exceptions")
        .update({
          status: "OPEN",
          queue_type: params.queueType,
          case_id: params.caseId ?? null,
          execution_id: params.executionId ?? null,
          job_id: params.jobId ?? null,
          title: params.title ?? null,
          failure_category: params.failureCategory ?? null,
          reconciliation_required: params.reconciliationRequired ?? false,
          resolved_at: null,
          resolved_by: null,
          resolution_note: null,
          version: Number(existing.version) + 1,
          correlation_id: correlationId,
        })
        .eq("id", existing.id)
        .eq("version", existing.version)
        .select("id")
        .maybeSingle();
      return { id: data?.id ?? existing.id, error: error?.message ?? null };
    }

    const { data, error } = await service
      .from("operational_exceptions")
      .update({
        queue_type: params.queueType,
        case_id: params.caseId ?? null,
        execution_id: params.executionId ?? null,
        job_id: params.jobId ?? null,
        title: params.title ?? null,
        failure_category: params.failureCategory ?? null,
        reconciliation_required:
          params.reconciliationRequired ?? undefined,
        version: Number(existing.version) + 1,
        correlation_id: correlationId,
      })
      .eq("id", existing.id)
      .eq("version", existing.version)
      .select("id")
      .maybeSingle();
    return { id: data?.id ?? existing.id, error: error?.message ?? null };
  }

  const { data, error } = await service
    .from("operational_exceptions")
    .insert({
      organization_id: params.organizationId,
      queue_type: params.queueType,
      status: "OPEN" satisfies ExceptionItemStatus,
      source_ref: params.sourceRef,
      case_id: params.caseId ?? null,
      execution_id: params.executionId ?? null,
      job_id: params.jobId ?? null,
      title: params.title ?? null,
      failure_category: params.failureCategory ?? null,
      reconciliation_required: params.reconciliationRequired ?? false,
      correlation_id: correlationId,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const { data: again } = await service
      .from("operational_exceptions")
      .select("id")
      .eq("organization_id", params.organizationId)
      .eq("source_ref", params.sourceRef)
      .maybeSingle();
    return { id: again?.id ?? null, error: null };
  }

  return { id: data?.id ?? null, error: error?.message ?? null };
}

/** Close open exceptions that match a source_ref prefix or exact refs. */
export async function resolveExceptionsBySource(params: {
  organizationId: string;
  sourceRefs: string[];
  resolutionNote?: string;
  actorId?: string | null;
}): Promise<void> {
  if (!params.sourceRefs.length) return;
  const service = createServiceClient();
  await service
    .from("operational_exceptions")
    .update({
      status: "RESOLVED",
      resolved_at: new Date().toISOString(),
      resolved_by: params.actorId ?? null,
      resolution_note: params.resolutionNote ?? "Auto-resolved by system.",
    })
    .eq("organization_id", params.organizationId)
    .in("source_ref", params.sourceRefs)
    .in("status", OPEN_EXCEPTION_STATUSES);
}

export async function syncExceptionsForExecution(params: {
  organizationId: string;
  caseId: string;
  executionId: string;
  executionStatus: string;
  failureCategory?: string | null;
  summary?: string | null;
}): Promise<void> {
  const actions = planExceptionProjection({
    executionId: params.executionId,
    executionStatus: params.executionStatus,
    failureCategory: params.failureCategory,
    summary: params.summary,
  });

  for (const action of actions) {
    if (action.kind === "resolve") {
      await resolveExceptionsBySource({
        organizationId: params.organizationId,
        sourceRefs: action.sourceRefs,
        resolutionNote: action.resolutionNote,
      });
    } else if (action.kind === "upsert") {
      await upsertOperationalException({
        organizationId: params.organizationId,
        queueType: action.queueType,
        sourceRef: action.sourceRef,
        caseId: params.caseId,
        executionId: params.executionId,
        title: action.title,
        failureCategory: action.failureCategory,
        reconciliationRequired: action.reconciliationRequired,
      });
    }
  }
}
