import { maskAccountId } from "@/lib/wallet/hash";
import type {
  CaseIntegrationAttempt,
  CaseIntegrationExecution,
} from "@/lib/executions/types";
import type { Profile, UserRole } from "@/types";

const MASKED_ROLES = new Set<UserRole>(["requester", "approver"]);

export function shouldMaskFinancialIdentifiers(role: UserRole): boolean {
  return MASKED_ROLES.has(role);
}

export function maskFinancialIdentifier(
  value: string | null | undefined,
  role: UserRole
): string | null | undefined {
  if (!value || !shouldMaskFinancialIdentifiers(role)) {
    return value;
  }
  return maskAccountId(value);
}

export function maskCaseFinancialFields<
  T extends { dealer_id?: string; wallet_id?: string }
>(caseRow: T, profile: Profile): T {
  if (!shouldMaskFinancialIdentifiers(profile.role)) {
    return caseRow;
  }
  return {
    ...caseRow,
    dealer_id: maskFinancialIdentifier(caseRow.dealer_id, profile.role) ?? "",
    wallet_id: maskFinancialIdentifier(caseRow.wallet_id, profile.role) ?? "",
  };
}

export function maskExecutionPayloadForRole(params: {
  execution: CaseIntegrationExecution | null;
  attempts: CaseIntegrationAttempt[];
  role: UserRole;
}): {
  execution: CaseIntegrationExecution | null;
  attempts: CaseIntegrationAttempt[];
} {
  if (!params.execution || !shouldMaskFinancialIdentifiers(params.role)) {
    return { execution: params.execution, attempts: params.attempts };
  }

  const execution = {
    ...params.execution,
    account_id: maskAccountId(params.execution.account_id),
    reference_id: maskAccountId(params.execution.reference_id),
  };

  return { execution, attempts: params.attempts };
}
