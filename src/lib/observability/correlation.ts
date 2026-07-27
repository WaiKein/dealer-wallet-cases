import { AsyncLocalStorage } from "node:async_hooks";
import { CORRELATION_HEADER } from "@/lib/api/errors";

type CorrelationStore = {
  correlationId: string;
};

const correlationContext = new AsyncLocalStorage<CorrelationStore>();

export function createCorrelationId(): string {
  return crypto.randomUUID();
}

export function getCorrelationId(): string {
  return correlationContext.getStore()?.correlationId ?? createCorrelationId();
}

export function runWithCorrelationId<T>(
  correlationId: string,
  fn: () => Promise<T>
): Promise<T> {
  return correlationContext.run({ correlationId }, fn);
}

export function resolveCorrelationId(request?: Request | null): string {
  const fromHeader = request?.headers.get(CORRELATION_HEADER)?.trim();
  if (fromHeader) {
    return fromHeader;
  }
  return getCorrelationId();
}

export { CORRELATION_HEADER };
