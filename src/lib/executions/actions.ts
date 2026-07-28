"use server";

import {
  requestStatusInquiry,
  retryIntegrationExecution,
} from "@/lib/executions/service";
import { requireProfile } from "@/lib/auth/session";
import { getCorrelationId } from "@/lib/observability/correlation";

export async function retryCaseExecutionAction(input: {
  caseId: string;
  expectedVersion?: number;
}) {
  const profile = await requireProfile();
  const result = await retryIntegrationExecution({
    profile,
    caseId: input.caseId,
    expectedVersion: input.expectedVersion,
  });
  return {
    ...result,
    correlationId: getCorrelationId(),
  };
}

export async function inquireCaseExecutionAction(input: {
  caseId: string;
  expectedVersion?: number;
}) {
  const profile = await requireProfile();
  const result = await requestStatusInquiry({
    profile,
    caseId: input.caseId,
    expectedVersion: input.expectedVersion,
  });
  return {
    ...result,
    correlationId: getCorrelationId(),
  };
}
