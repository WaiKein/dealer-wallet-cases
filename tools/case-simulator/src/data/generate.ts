/** Deterministic test-data helpers for scenario authors. */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${new Date().toISOString()}`;
}

export function defaultCasePayload(overrides: Record<string, unknown> = {}) {
  return {
    title: uniqueTitle("[sim]"),
    description:
      "Simulator-generated wallet adjustment case for workflow validation.",
    adjustment_amount: 125,
    adjustment_type: "credit",
    currency: "USD",
    priority: "medium",
    ...overrides,
  };
}
