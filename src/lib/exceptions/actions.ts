"use server";

import {
  addExceptionNote,
  assignExceptionOwner,
  escalateException,
  markExceptionForReconciliation,
  resolveExceptionItem,
} from "@/lib/exceptions/service";
import {
  requestStatusInquiry,
  retryIntegrationExecution,
} from "@/lib/executions/service";
import { requireProfile } from "@/lib/auth/session";
import { getCorrelationId } from "@/lib/observability/correlation";

export async function assignExceptionOwnerAction(input: {
  exceptionId: string;
  ownerId: string;
  expectedVersion?: number;
}) {
  const profile = await requireProfile();
  const result = await assignExceptionOwner({
    profile,
    ...input,
  });
  return { ...result, correlationId: getCorrelationId() };
}

export async function addExceptionNoteAction(input: {
  exceptionId: string;
  note: string;
  expectedVersion?: number;
}) {
  const profile = await requireProfile();
  const result = await addExceptionNote({ profile, ...input });
  return { ...result, correlationId: getCorrelationId() };
}

export async function escalateExceptionAction(input: {
  exceptionId: string;
  note?: string;
}) {
  const profile = await requireProfile();
  const result = await escalateException({ profile, ...input });
  return { ...result, correlationId: getCorrelationId() };
}

export async function markExceptionReconciliationAction(input: {
  exceptionId: string;
}) {
  const profile = await requireProfile();
  const result = await markExceptionForReconciliation({
    profile,
    exceptionId: input.exceptionId,
  });
  return { ...result, correlationId: getCorrelationId() };
}

export async function resolveExceptionAction(input: {
  exceptionId: string;
  resolutionNote: string;
  dismiss?: boolean;
}) {
  const profile = await requireProfile();
  const result = await resolveExceptionItem({ profile, ...input });
  return { ...result, correlationId: getCorrelationId() };
}

export async function retryExceptionExecutionAction(input: {
  caseId: string;
  expectedVersion?: number;
}) {
  const profile = await requireProfile();
  const result = await retryIntegrationExecution({
    profile,
    caseId: input.caseId,
    expectedVersion: input.expectedVersion,
  });
  return { ...result, correlationId: getCorrelationId() };
}

export async function inquireExceptionExecutionAction(input: {
  caseId: string;
  expectedVersion?: number;
}) {
  const profile = await requireProfile();
  const result = await requestStatusInquiry({
    profile,
    caseId: input.caseId,
    expectedVersion: input.expectedVersion,
  });
  return { ...result, correlationId: getCorrelationId() };
}
