import { isRequireExecutionBeforeResolve } from "@/lib/executions/feature-flags";
import {
  enqueueIntegrationExecute,
  enqueueIntegrationStatusInquiry,
} from "@/lib/jobs/domain-enqueue";
import { backoffMs } from "@/lib/jobs/enqueue";
import { getCorrelationId } from "@/lib/observability/correlation";
import { notifyUsers } from "@/lib/notifications/service";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/api";
import { buildWalletAdjustmentCommand } from "@/lib/wallet/command";
import {
  canRetryAfterStatusInquiry,
  canScheduleExecuteRetry,
} from "@/lib/wallet/hash";
import { getWalletAdjustmentProvider } from "@/lib/wallet/provider";
import { maskAccountId } from "@/lib/wallet/hash";
import type { ActionResult, Profile, UserRole } from "@/types";
import {
  mapExecuteOutcomeToExecution,
  type CaseIntegrationAttempt,
  type CaseIntegrationExecution,
  type IntegrationExecutionStatus,
} from "@/lib/executions/types";

type CaseRowForExecution = {
  id: string;
  organization_id: string;
  dealer_id: string;
  wallet_id: string;
  adjustment_amount: number;
  adjustment_type: "credit" | "debit";
  currency: string;
  current_approval_request_id: string | null;
  requester_id: string;
  assigned_agent_id: string | null;
};

function executionIdempotencyKey(
  caseId: string,
  approvalRequestId: string
): string {
  return `wallet-exec:${caseId}:${approvalRequestId}`;
}

/** Defense in depth: retries must reference an APPROVED approval for the same case. */
async function assertExecutionLinkedToApprovedRequest(
  execution: CaseIntegrationExecution
): Promise<ActionResult> {
  if (!execution.approval_request_id) {
    return {
      success: false,
      error: "Execution is missing an approval link and cannot be retried.",
      code: "FORBIDDEN",
    };
  }

  const service = createServiceClient();
  const { data: approval } = await service
    .from("approval_requests")
    .select("id, status, case_id, organization_id")
    .eq("id", execution.approval_request_id)
    .maybeSingle();

  if (
    !approval ||
    approval.case_id !== execution.case_id ||
    approval.organization_id !== execution.organization_id ||
    approval.status !== "APPROVED"
  ) {
    return {
      success: false,
      error: "Execution is not linked to an approved request.",
      code: "FORBIDDEN",
    };
  }

  return { success: true };
}

/**
 * After final approval: create execution row (idempotent) and enqueue job.
 * Does not change case workflow status.
 */
export async function createExecutionForApprovedCase(params: {
  caseRow: CaseRowForExecution;
  approvalRequestId: string;
  requestedAmount: number;
  approvedAmount: number;
}): Promise<ActionResult<{ executionId: string }>> {
  const service = createServiceClient();
  const idempotencyKey = executionIdempotencyKey(
    params.caseRow.id,
    params.approvalRequestId
  );

  const { data: existing } = await service
    .from("case_integration_executions")
    .select("id, status")
    .eq("case_id", params.caseRow.id)
    .eq("approval_request_id", params.approvalRequestId)
    .maybeSingle();

  if (existing) {
    if (
      existing.status === "NOT_STARTED" ||
      existing.status === "QUEUED" ||
      existing.status === "FAILED_RETRYABLE"
    ) {
      await enqueueIntegrationExecute({
        organizationId: params.caseRow.organization_id,
        executionId: existing.id,
        caseId: params.caseRow.id,
      });
    }
    return { success: true, data: { executionId: existing.id } };
  }

  const command = buildWalletAdjustmentCommand({
    idempotencyKey,
    correlationId: getCorrelationId() ?? crypto.randomUUID(),
    caseId: params.caseRow.id,
    approvalRequestId: params.approvalRequestId,
    organizationId: params.caseRow.organization_id,
    requestedAmount: params.requestedAmount,
    approvedAmount: params.approvedAmount,
    accountId: params.caseRow.dealer_id,
    referenceId: params.caseRow.wallet_id,
    currency: params.caseRow.currency || "USD",
    adjustmentType: params.caseRow.adjustment_type,
  });

  const { data: created, error } = await service
    .from("case_integration_executions")
    .insert({
      organization_id: params.caseRow.organization_id,
      case_id: params.caseRow.id,
      approval_request_id: params.approvalRequestId,
      provider: "mock_wallet",
      operation: "wallet_adjustment",
      status: "QUEUED",
      idempotency_key: command.idempotencyKey,
      request_hash: command.requestHash,
      correlation_id: command.correlationId,
      internal_request_ref: command.idempotencyKey,
      requested_amount: command.requestedAmount,
      approved_amount: command.approvedAmount,
      account_id: command.accountId,
      reference_id: command.referenceId,
      currency: command.currency,
      adjustment_type: command.adjustmentType,
    })
    .select("id")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      const { data: again } = await service
        .from("case_integration_executions")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (again) {
        return { success: true, data: { executionId: again.id } };
      }
    }
    return {
      success: false,
      error: error?.message ?? "Failed to create integration execution.",
      code: "INTERNAL_ERROR",
    };
  }

  await service
    .from("cases")
    .update({ current_integration_execution_id: created.id })
    .eq("id", params.caseRow.id);

  await enqueueIntegrationExecute({
    organizationId: params.caseRow.organization_id,
    executionId: created.id,
    caseId: params.caseRow.id,
  });

  return { success: true, data: { executionId: created.id } };
}

export async function getLatestExecutionForCase(caseId: string): Promise<{
  execution: CaseIntegrationExecution | null;
  attempts: CaseIntegrationAttempt[];
}> {
  const supabase = await createClient();
  const { data: execution } = await supabase
    .from("case_integration_executions")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!execution) {
    return { execution: null, attempts: [] };
  }

  const { data: attempts } = await supabase
    .from("case_integration_attempts")
    .select("*")
    .eq("execution_id", execution.id)
    .order("attempt_no", { ascending: true });

  return {
    execution: execution as CaseIntegrationExecution,
    attempts: (attempts ?? []) as CaseIntegrationAttempt[],
  };
}

function assertExecutionReader(profile: Profile): ActionResult<never> | null {
  if (
    profile.role !== "operations_agent" &&
    profile.role !== "team_lead" &&
    profile.role !== "admin" &&
    profile.role !== "approver"
  ) {
    return { success: false, error: "Not allowed.", code: "FORBIDDEN" };
  }
  return null;
}

function assertExecutionOperator(profile: Profile): ActionResult<never> | null {
  if (
    profile.role !== "operations_agent" &&
    profile.role !== "team_lead" &&
    profile.role !== "admin"
  ) {
    return { success: false, error: "Not allowed.", code: "FORBIDDEN" };
  }
  return null;
}

async function loadExecutionForActor(params: {
  profile: Profile;
  executionId: string;
}): Promise<ActionResult<CaseIntegrationExecution>> {
  const service = createServiceClient();
  const { data: execution, error } = await service
    .from("case_integration_executions")
    .select("*")
    .eq("id", params.executionId)
    .maybeSingle();

  if (error || !execution) {
    return { success: false, error: "Execution not found.", code: "NOT_FOUND" };
  }

  if (
    params.profile.organization_id &&
    execution.organization_id !== params.profile.organization_id
  ) {
    return { success: false, error: "Forbidden.", code: "FORBIDDEN" };
  }

  return { success: true, data: execution as CaseIntegrationExecution };
}

export async function getIntegrationExecutionById(params: {
  profile: Profile;
  executionId: string;
}): Promise<
  ActionResult<{
    execution: CaseIntegrationExecution;
    attempts: CaseIntegrationAttempt[];
    caseId: string;
  }>
> {
  const denied = assertExecutionReader(params.profile);
  if (denied) {
    return denied as ActionResult<{
      execution: CaseIntegrationExecution;
      attempts: CaseIntegrationAttempt[];
      caseId: string;
    }>;
  }

  const loaded = await loadExecutionForActor(params);
  if (!loaded.success || !loaded.data) {
    return loaded as ActionResult<never>;
  }

  const service = createServiceClient();
  const { data: attempts } = await service
    .from("case_integration_attempts")
    .select("*")
    .eq("execution_id", loaded.data.id)
    .order("attempt_no", { ascending: true });

  return {
    success: true,
    data: {
      execution: loaded.data,
      attempts: (attempts ?? []) as CaseIntegrationAttempt[],
      caseId: loaded.data.case_id,
    },
  };
}

async function retryLoadedExecution(params: {
  profile: Profile;
  execution: CaseIntegrationExecution;
  expectedVersion?: number;
}): Promise<ActionResult<{ executionId: string; version: number }>> {
  const denied = assertExecutionOperator(params.profile);
  if (denied) {
    return denied as ActionResult<{ executionId: string; version: number }>;
  }

  const execution = params.execution;
  if (
    params.expectedVersion != null &&
    params.expectedVersion !== execution.version
  ) {
    return {
      success: false,
      error: "Execution was updated by someone else. Refresh and retry.",
      code: "VERSION_CONFLICT",
    };
  }

  const retryable =
    execution.status === "FAILED_RETRYABLE" ||
    (execution.status === "UNKNOWN" && !execution.requires_status_inquiry);

  if (!retryable) {
    return {
      success: false,
      error: execution.requires_status_inquiry
        ? "Status inquiry is required before retrying execution."
        : `Cannot retry execution in status ${execution.status}.`,
      code: "VALIDATION_ERROR",
    };
  }

  const service = createServiceClient();
  const approvalOk = await assertExecutionLinkedToApprovedRequest(execution);
  if (!approvalOk.success) {
    return approvalOk as ActionResult<{ executionId: string; version: number }>;
  }

  const nextVersion = Number(execution.version) + 1;
  const { data: updated, error } = await service
    .from("case_integration_executions")
    .update({
      status: "QUEUED",
      version: nextVersion,
      next_retry_at: null,
      failure_message: null,
      correlation_id: getCorrelationId(),
    })
    .eq("id", execution.id)
    .eq("version", execution.version)
    .select("id, version")
    .single();

  if (error || !updated) {
    return {
      success: false,
      error: "Execution conflict. Refresh and retry.",
      code: "VERSION_CONFLICT",
    };
  }

  await enqueueIntegrationExecute({
    organizationId: execution.organization_id,
    executionId: execution.id,
    caseId: execution.case_id,
    attemptSuffix: `manual-${nextVersion}`,
  });

  return {
    success: true,
    data: { executionId: updated.id, version: Number(updated.version) },
  };
}

async function inquireLoadedExecution(params: {
  profile: Profile;
  execution: CaseIntegrationExecution;
}): Promise<ActionResult<{ executionId: string }>> {
  const denied = assertExecutionOperator(params.profile);
  if (denied) {
    return denied as ActionResult<{ executionId: string }>;
  }

  const execution = params.execution;
  if (execution.status !== "UNKNOWN" && !execution.requires_status_inquiry) {
    return {
      success: false,
      error: "Status inquiry is only available for uncertain executions.",
      code: "VALIDATION_ERROR",
    };
  }

  await enqueueIntegrationStatusInquiry({
    organizationId: execution.organization_id,
    executionId: execution.id,
    caseId: execution.case_id,
    attemptSuffix: `manual-${execution.version}`,
  });

  return { success: true, data: { executionId: execution.id } };
}

export async function retryIntegrationExecutionById(params: {
  profile: Profile;
  executionId: string;
  expectedVersion?: number;
}): Promise<ActionResult<{ executionId: string; version: number }>> {
  const loaded = await loadExecutionForActor(params);
  if (!loaded.success || !loaded.data) {
    return loaded as ActionResult<never>;
  }
  return retryLoadedExecution({
    profile: params.profile,
    execution: loaded.data,
    expectedVersion: params.expectedVersion,
  });
}

export async function requestStatusInquiryById(params: {
  profile: Profile;
  executionId: string;
}): Promise<ActionResult<{ executionId: string }>> {
  const loaded = await loadExecutionForActor(params);
  if (!loaded.success || !loaded.data) {
    return loaded as ActionResult<never>;
  }
  return inquireLoadedExecution({
    profile: params.profile,
    execution: loaded.data,
  });
}

export async function assertExecutionAllowsResolve(params: {
  organizationId: string;
  caseId: string;
}): Promise<ActionResult> {
  const required = await isRequireExecutionBeforeResolve(params.organizationId);
  if (!required) {
    return { success: true };
  }

  const service = createServiceClient();
  const { data: execution } = await service
    .from("case_integration_executions")
    .select("id, status")
    .eq("case_id", params.caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!execution || execution.status !== "SUCCEEDED") {
    return {
      success: false,
      error:
        "Wallet execution must succeed before this case can be resolved.",
      code: "EXECUTION_REQUIRED",
      details: { executionStatus: execution?.status ?? "missing" },
    };
  }

  return { success: true };
}

/** Manual retry for FAILED_RETRYABLE (or UNKNOWN after safe status inquiry). */
export async function retryIntegrationExecution(params: {
  profile: Profile;
  caseId: string;
  expectedVersion?: number;
}): Promise<ActionResult<{ executionId: string; version: number }>> {
  const service = createServiceClient();
  const { data: execution } = await service
    .from("case_integration_executions")
    .select("*")
    .eq("case_id", params.caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!execution) {
    return { success: false, error: "No execution found.", code: "NOT_FOUND" };
  }

  if (
    params.profile.organization_id &&
    execution.organization_id !== params.profile.organization_id
  ) {
    return { success: false, error: "Forbidden.", code: "FORBIDDEN" };
  }

  return retryLoadedExecution({
    profile: params.profile,
    execution: execution as CaseIntegrationExecution,
    expectedVersion: params.expectedVersion,
  });
}

export async function requestStatusInquiry(params: {
  profile: Profile;
  caseId: string;
  expectedVersion?: number;
}): Promise<ActionResult<{ executionId: string }>> {
  const service = createServiceClient();
  const { data: execution } = await service
    .from("case_integration_executions")
    .select("*")
    .eq("case_id", params.caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!execution) {
    return { success: false, error: "No execution found.", code: "NOT_FOUND" };
  }

  if (
    params.profile.organization_id &&
    execution.organization_id !== params.profile.organization_id
  ) {
    return { success: false, error: "Forbidden.", code: "FORBIDDEN" };
  }

  if (
    params.expectedVersion != null &&
    params.expectedVersion !== execution.version
  ) {
    return {
      success: false,
      error: "Execution was updated by someone else. Refresh and retry.",
      code: "VERSION_CONFLICT",
    };
  }

  return inquireLoadedExecution({
    profile: params.profile,
    execution: execution as CaseIntegrationExecution,
  });
}

/**
 * Worker: run wallet execute against the mock/real provider.
 * Updates execution + append-only attempt. Never changes case.status.
 */
export async function processIntegrationExecuteJob(params: {
  executionId: string;
  organizationId: string;
  jobId?: string;
}): Promise<void> {
  const service = createServiceClient();
  const { data: execution, error } = await service
    .from("case_integration_executions")
    .select("*")
    .eq("id", params.executionId)
    .eq("organization_id", params.organizationId)
    .single();

  if (error || !execution) {
    throw new Error("Integration execution not found for job.");
  }

  if (execution.status === "SUCCEEDED" || execution.status === "FAILED_FINAL") {
    return;
  }

  if (execution.status === "CANCELLED") {
    return;
  }

  const approvalOk = await assertExecutionLinkedToApprovedRequest(
    execution as CaseIntegrationExecution
  );
  if (!approvalOk.success) {
    throw new Error(approvalOk.error ?? "Execution approval link invalid.");
  }

  const currentVersion = Number(execution.version);
  const claimVersion = currentVersion + 1;
  const { data: claimed, error: claimError } = await service
    .from("case_integration_executions")
    .update({
      status: "IN_PROGRESS",
      version: claimVersion,
      last_attempt_at: new Date().toISOString(),
      correlation_id: getCorrelationId(),
    })
    .eq("id", execution.id)
    .eq("version", currentVersion)
    .in("status", ["QUEUED", "FAILED_RETRYABLE", "NOT_STARTED", "IN_PROGRESS"])
    .select("id")
    .maybeSingle();

  if (claimError) {
    throw new Error(claimError.message);
  }
  if (!claimed) {
    // Lost race or terminal — treat as success (idempotent).
    return;
  }

  const attemptNo = Number(execution.attempt_count) + 1;
  const correlationId = getCorrelationId() ?? crypto.randomUUID();

  const { data: attemptRow, error: attemptInsertError } = await service
    .from("case_integration_attempts")
    .insert({
      organization_id: execution.organization_id,
      execution_id: execution.id,
      attempt_no: attemptNo,
      kind: "execute",
      started_at: new Date().toISOString(),
      correlation_id: correlationId,
      worker_job_id: params.jobId ?? null,
    })
    .select("id")
    .single();

  if (attemptInsertError || !attemptRow) {
    throw new Error(
      attemptInsertError?.message ?? "Failed to record execution attempt."
    );
  }

  const command = buildWalletAdjustmentCommand({
    idempotencyKey: execution.idempotency_key,
    correlationId,
    caseId: execution.case_id,
    approvalRequestId: execution.approval_request_id,
    organizationId: execution.organization_id,
    requestedAmount: Number(execution.requested_amount),
    approvedAmount: Number(execution.approved_amount),
    accountId: execution.account_id,
    referenceId: execution.reference_id,
    currency: execution.currency,
    adjustmentType: execution.adjustment_type as "credit" | "debit",
    requestHash: execution.request_hash,
  });

  const provider = getWalletAdjustmentProvider();
  const result = await provider.executeAdjustment(command);
  const mapped = mapExecuteOutcomeToExecution({
    outcome: result.outcome,
    requiresStatusInquiry: result.requiresStatusInquiry,
  });

  // Defence in depth: never schedule execute retry when inquiry required.
  const scheduleExecute =
    mapped.scheduleExecuteRetry &&
    canScheduleExecuteRetry({
      processingCertainty: result.processingCertainty,
      requiresStatusInquiry: result.requiresStatusInquiry,
    });

  const nextRetryAt = scheduleExecute
    ? new Date(Date.now() + backoffMs(attemptNo)).toISOString()
    : null;

  const terminal =
    mapped.status === "SUCCEEDED" || mapped.status === "FAILED_FINAL";

  await service
    .from("case_integration_attempts")
    .update({
      completed_at: new Date().toISOString(),
      outcome: result.outcome,
      processing_certainty: result.processingCertainty,
      response_code: result.responseCode,
      sanitised_error: result.sanitisedMessage,
    })
    .eq("id", attemptRow.id);

  const { error: updateError } = await service
    .from("case_integration_executions")
    .update({
      status: mapped.status,
      attempt_count: attemptNo,
      last_attempt_at: new Date().toISOString(),
      next_retry_at: nextRetryAt,
      response_code: result.responseCode,
      sanitised_response_summary: result.sanitisedMessage,
      failure_category: mapped.failureCategory,
      failure_message:
        mapped.status === "SUCCEEDED" ? null : result.sanitisedMessage,
      unknown_result_reason:
        mapped.status === "UNKNOWN" ? result.sanitisedMessage : null,
      requires_status_inquiry: mapped.requiresStatusInquiry,
      external_transaction_ref: result.externalTransactionRef,
      version: claimVersion + 1,
      completed_at: terminal ? new Date().toISOString() : null,
      correlation_id: correlationId,
    })
    .eq("id", execution.id)
    .eq("version", claimVersion);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { syncExceptionsForExecution } = await import(
    "@/lib/exceptions/sync"
  );
  await syncExceptionsForExecution({
    organizationId: execution.organization_id,
    caseId: execution.case_id,
    executionId: execution.id,
    executionStatus: mapped.status,
    failureCategory: mapped.failureCategory,
    summary: result.sanitisedMessage,
  });

  await notifyExecutionOutcome({
    organizationId: execution.organization_id,
    caseId: execution.case_id,
    status: mapped.status,
    summary: result.sanitisedMessage,
    accountId: execution.account_id,
  });

  if (scheduleExecute) {
    await enqueueIntegrationExecute({
      organizationId: execution.organization_id,
      executionId: execution.id,
      caseId: execution.case_id,
      runAt: new Date(nextRetryAt!),
      attemptSuffix: `auto-${attemptNo + 1}`,
    });
  }

  if (mapped.scheduleStatusInquiry) {
    await enqueueIntegrationStatusInquiry({
      organizationId: execution.organization_id,
      executionId: execution.id,
      caseId: execution.case_id,
      attemptSuffix: `auto-${attemptNo}`,
    });
  }
}

export async function processIntegrationStatusInquiryJob(params: {
  executionId: string;
  organizationId: string;
  jobId?: string;
}): Promise<void> {
  const service = createServiceClient();
  const { data: execution, error } = await service
    .from("case_integration_executions")
    .select("*")
    .eq("id", params.executionId)
    .eq("organization_id", params.organizationId)
    .single();

  if (error || !execution) {
    throw new Error("Integration execution not found for status inquiry.");
  }

  if (execution.status === "SUCCEEDED" || execution.status === "FAILED_FINAL") {
    return;
  }

  const currentVersion = Number(execution.version);
  const attemptNo = Number(execution.attempt_count) + 1;
  const correlationId = getCorrelationId() ?? crypto.randomUUID();

  const { data: attemptRow, error: attemptInsertError } = await service
    .from("case_integration_attempts")
    .insert({
      organization_id: execution.organization_id,
      execution_id: execution.id,
      attempt_no: attemptNo,
      kind: "status_inquiry",
      started_at: new Date().toISOString(),
      correlation_id: correlationId,
      worker_job_id: params.jobId ?? null,
    })
    .select("id")
    .single();

  if (attemptInsertError || !attemptRow) {
    throw new Error(
      attemptInsertError?.message ?? "Failed to record status inquiry attempt."
    );
  }

  const provider = getWalletAdjustmentProvider();
  const result = await provider.getAdjustmentStatus({
    organizationId: execution.organization_id,
    caseId: execution.case_id,
    approvalRequestId: execution.approval_request_id,
    idempotencyKey: execution.idempotency_key,
    requestHash: execution.request_hash,
    correlationId,
    externalTransactionRef: execution.external_transaction_ref,
    accountId: execution.account_id,
    referenceId: execution.reference_id,
  });

  await service
    .from("case_integration_attempts")
    .update({
      completed_at: new Date().toISOString(),
      outcome: result.outcome,
      processing_certainty: result.processingCertainty,
      response_code: result.responseCode,
      sanitised_error: result.sanitisedMessage,
    })
    .eq("id", attemptRow.id);

  let nextStatus: IntegrationExecutionStatus = execution.status;
  let requiresInquiry = execution.requires_status_inquiry;
  let scheduleExecute = false;
  let scheduleInquiryRetry = false;
  let failureCategory = execution.failure_category;
  let completedAt: string | null = execution.completed_at;

  if (
    result.outcome === "STATUS_SUCCESS" &&
    result.processingCertainty === "PROCESSED"
  ) {
    nextStatus = "SUCCEEDED";
    requiresInquiry = false;
    completedAt = new Date().toISOString();
    failureCategory = null;
  } else if (
    canRetryAfterStatusInquiry({
      processingCertainty: result.processingCertainty,
      safeToRetryExecute: result.safeToRetryExecute,
    })
  ) {
    nextStatus = "FAILED_RETRYABLE";
    requiresInquiry = false;
    scheduleExecute = true;
    failureCategory = "timeout_confirmed";
  } else if (result.outcome === "STATUS_TEMPORARY_FAILURE") {
    nextStatus = "UNKNOWN";
    requiresInquiry = true;
    scheduleInquiryRetry = true;
  } else {
    nextStatus = "UNKNOWN";
    requiresInquiry = true;
  }

  const nextRetryAt = scheduleExecute || scheduleInquiryRetry
    ? new Date(Date.now() + backoffMs(attemptNo)).toISOString()
    : null;

  const { error: updateError } = await service
    .from("case_integration_executions")
    .update({
      status: nextStatus,
      attempt_count: attemptNo,
      last_attempt_at: new Date().toISOString(),
      next_retry_at: nextRetryAt,
      response_code: result.responseCode,
      sanitised_response_summary: result.sanitisedMessage,
      failure_category: failureCategory,
      failure_message:
        nextStatus === "SUCCEEDED" ? null : result.sanitisedMessage,
      unknown_result_reason:
        nextStatus === "UNKNOWN" ? result.sanitisedMessage : null,
      requires_status_inquiry: requiresInquiry,
      external_transaction_ref:
        result.externalTransactionRef ?? execution.external_transaction_ref,
      version: currentVersion + 1,
      completed_at: completedAt,
      correlation_id: correlationId,
    })
    .eq("id", execution.id)
    .eq("version", currentVersion);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { syncExceptionsForExecution } = await import(
    "@/lib/exceptions/sync"
  );
  await syncExceptionsForExecution({
    organizationId: execution.organization_id,
    caseId: execution.case_id,
    executionId: execution.id,
    executionStatus: nextStatus,
    failureCategory: failureCategory,
    summary: result.sanitisedMessage,
  });

  await notifyExecutionOutcome({
    organizationId: execution.organization_id,
    caseId: execution.case_id,
    status: nextStatus,
    summary: result.sanitisedMessage,
    accountId: execution.account_id,
  });

  if (scheduleExecute) {
    await enqueueIntegrationExecute({
      organizationId: execution.organization_id,
      executionId: execution.id,
      caseId: execution.case_id,
      runAt: new Date(nextRetryAt!),
      attemptSuffix: `after-status-${attemptNo}`,
    });
  }

  if (scheduleInquiryRetry) {
    await enqueueIntegrationStatusInquiry({
      organizationId: execution.organization_id,
      executionId: execution.id,
      caseId: execution.case_id,
      runAt: new Date(nextRetryAt!),
      attemptSuffix: `retry-${attemptNo}`,
    });
  }
}

async function notifyExecutionOutcome(params: {
  organizationId: string;
  caseId: string;
  status: IntegrationExecutionStatus;
  summary: string;
  accountId: string;
}) {
  const service = createServiceClient();
  const { data: caseRow } = await service
    .from("cases")
    .select("requester_id, assigned_agent_id")
    .eq("id", params.caseId)
    .maybeSingle();

  if (!caseRow) return;

  const { data: profiles } = await service
    .from("profiles")
    .select("id, role")
    .in(
      "id",
      [caseRow.assigned_agent_id, caseRow.requester_id].filter(Boolean) as string[]
    );

  const recipients = (profiles ?? []).map((p) => ({
    id: p.id as string,
    role: p.role as UserRole,
  }));

  if (!recipients.length) return;

  const title =
    params.status === "SUCCEEDED"
      ? "Wallet execution succeeded"
      : params.status === "FAILED_FINAL"
        ? "Wallet execution failed"
        : params.status === "UNKNOWN"
          ? "Wallet execution needs attention"
          : "Wallet execution update";

  await notifyUsers({
    organizationId: params.organizationId,
    recipients,
    caseId: params.caseId,
    type: "integration_execution",
    title,
    body: `${params.summary} (account ${maskAccountId(params.accountId)}; status ${params.status})`,
    suffix: `${params.status}:${Date.now()}`,
    emailEventType:
      params.status === "SUCCEEDED"
        ? "execution_succeeded"
        : params.status === "FAILED_FINAL"
          ? "execution_failed"
          : params.status === "UNKNOWN"
            ? "execution_unknown"
            : "execution_failed",
    variables: {
      summary: params.summary,
    },
  });
}
