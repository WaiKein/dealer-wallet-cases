export type ApprovalRuleVersionRow = {
  id: string;
  version: number;
};

/**
 * Resolves which approval-rule row to update and the next version number.
 * Keeps a single live row per code while monotonically increasing version.
 */
export function resolveApprovalRuleVersioning(params: {
  id?: string;
  code: string;
  rows: ApprovalRuleVersionRow[];
}): {
  resolvedId?: string;
  nextVersion?: number;
  staleIds: string[];
} {
  const sorted = [...params.rows].sort(
    (a, b) => Number(b.version ?? 0) - Number(a.version ?? 0)
  );
  const latest = sorted[0];
  const resolvedId = params.id ?? latest?.id;
  const maxVersion = Math.max(0, ...sorted.map((row) => Number(row.version ?? 0)));
  const staleIds =
    resolvedId && sorted.length > 1
      ? sorted.map((row) => row.id).filter((rowId) => rowId !== resolvedId)
      : [];

  return {
    resolvedId,
    nextVersion: resolvedId ? maxVersion + 1 : undefined,
    staleIds,
  };
}
