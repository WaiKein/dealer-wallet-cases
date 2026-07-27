import { headers } from "next/headers";
import {
  CORRELATION_HEADER,
  createCorrelationId,
  getCorrelationId,
  runWithCorrelationId,
} from "@/lib/observability/correlation";

/** Bind a correlation ID for server actions (from header or newly minted). */
export async function withServerActionCorrelation<T>(
  fn: () => Promise<T>
): Promise<T> {
  const headerStore = await headers();
  const correlationId =
    headerStore.get(CORRELATION_HEADER)?.trim() || createCorrelationId();
  return runWithCorrelationId(correlationId, fn);
}

export function actionFailure(
  error: string,
  extra?: { code?: string; details?: Record<string, unknown> }
) {
  return {
    success: false as const,
    error,
    code: extra?.code,
    details: extra?.details,
    correlationId: getCorrelationId(),
  };
}

export function actionSuccess<T>(data?: T) {
  return {
    success: true as const,
    data,
    correlationId: getCorrelationId(),
  };
}
