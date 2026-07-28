import type { ExceptionQueueType } from "@/lib/exceptions/types";

export type ExceptionProjectionAction =
  | {
      kind: "resolve";
      sourceRefs: string[];
      resolutionNote: string;
    }
  | {
      kind: "upsert";
      queueType: ExceptionQueueType;
      sourceRef: string;
      title: string;
      failureCategory?: string | null;
      reconciliationRequired?: boolean;
    }
  | { kind: "none" };

export function executionExceptionSourceRefs(executionId: string): string[] {
  const base = `execution:${executionId}`;
  return [
    `${base}:failed_final`,
    `${base}:retry_pending`,
    `${base}:unknown`,
    `${base}:duplicate`,
  ];
}

/**
 * Maps integration execution status to exception-queue projection actions.
 */
export function planExceptionProjection(params: {
  executionId: string;
  executionStatus: string;
  failureCategory?: string | null;
  summary?: string | null;
}): ExceptionProjectionAction[] {
  const base = `execution:${params.executionId}`;
  const openRefs = executionExceptionSourceRefs(params.executionId);

  if (params.executionStatus === "SUCCEEDED") {
    const actions: ExceptionProjectionAction[] = [
      {
        kind: "resolve",
        sourceRefs: openRefs,
        resolutionNote: "Execution succeeded.",
      },
    ];
    if (params.failureCategory === "duplicate") {
      actions.push({
        kind: "upsert",
        queueType: "duplicate_transaction_suspected",
        sourceRef: `${base}:duplicate`,
        title: params.summary ?? "Duplicate provider response",
        failureCategory: "duplicate",
        reconciliationRequired: true,
      });
    }
    return actions;
  }

  if (params.executionStatus === "FAILED_FINAL") {
    return [
      {
        kind: "resolve",
        sourceRefs: [`${base}:retry_pending`, `${base}:unknown`],
        resolutionNote: "Superseded by permanent failure.",
      },
      {
        kind: "upsert",
        queueType: "integration_failed_final",
        sourceRef: `${base}:failed_final`,
        title: params.summary ?? "Permanent integration failure",
        failureCategory: params.failureCategory,
      },
    ];
  }

  if (params.executionStatus === "FAILED_RETRYABLE") {
    return [
      {
        kind: "resolve",
        sourceRefs: [`${base}:unknown`],
        resolutionNote: "Moved to retryable failure.",
      },
      {
        kind: "upsert",
        queueType: "integration_retry_pending",
        sourceRef: `${base}:retry_pending`,
        title: params.summary ?? "Retryable integration failure",
        failureCategory: params.failureCategory,
      },
    ];
  }

  if (params.executionStatus === "UNKNOWN") {
    return [
      {
        kind: "resolve",
        sourceRefs: [`${base}:retry_pending`],
        resolutionNote: "Moved to unknown result.",
      },
      {
        kind: "upsert",
        queueType: "integration_unknown",
        sourceRef: `${base}:unknown`,
        title: params.summary ?? "Unknown integration result",
        failureCategory: params.failureCategory,
        reconciliationRequired: true,
      },
    ];
  }

  return [{ kind: "none" }];
}
