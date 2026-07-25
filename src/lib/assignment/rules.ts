import type {
  AssignmentRule,
  CasePriority,
  LeadAuthorizationMode,
  SlaState,
  SlaType,
  UserRole,
} from "@/types";

export interface AssignmentMatchInput {
  categoryId: string;
  subcategoryId: string;
  priority: CasePriority;
}

/** First active rule by sequence wins. Null matchers act as wildcards. */
export function matchAssignmentRule(
  rules: AssignmentRule[],
  input: AssignmentMatchInput
): AssignmentRule | null {
  const ordered = [...rules]
    .filter((rule) => rule.is_active)
    .sort((a, b) => a.sequence - b.sequence);

  for (const rule of ordered) {
    if (rule.category_id && rule.category_id !== input.categoryId) {
      continue;
    }
    if (rule.subcategory_id && rule.subcategory_id !== input.subcategoryId) {
      continue;
    }
    if (rule.priority && rule.priority !== input.priority) {
      continue;
    }
    return rule;
  }

  return null;
}

export function canActAsGroupLead(params: {
  role: UserRole;
  isGroupMember: boolean;
  isMembershipLead: boolean;
  mode: LeadAuthorizationMode;
}): boolean {
  const { role, isGroupMember, isMembershipLead, mode } = params;
  if (!isGroupMember) {
    return false;
  }

  const byRole = role === "team_lead";
  const byMembership = isMembershipLead;

  if (mode === "role") {
    return byRole;
  }
  if (mode === "membership") {
    return byMembership;
  }
  return byRole || byMembership;
}

export function canClaimCase(params: {
  role: UserRole;
  isGroupMember: boolean;
  assignedAgentId: string | null;
}): boolean {
  return (
    params.role === "operations_agent" &&
    params.isGroupMember &&
    params.assignedAgentId === null
  );
}

export function calculateSlaDueAt(
  startedAt: Date,
  durationMinutes: number,
  pausedElapsedSeconds = 0
): Date {
  return new Date(
    startedAt.getTime() +
      durationMinutes * 60_000 +
      pausedElapsedSeconds * 1000
  );
}

export function getEffectiveElapsedMs(params: {
  now: Date;
  startedAt: Date;
  pausedAt: string | null;
  pausedElapsedSeconds: number;
  state: SlaState;
}): number {
  const pausedMs = params.pausedElapsedSeconds * 1000;
  if (params.state === "PAUSED" && params.pausedAt) {
    return (
      new Date(params.pausedAt).getTime() -
      params.startedAt.getTime() -
      pausedMs
    );
  }
  return params.now.getTime() - params.startedAt.getTime() - pausedMs;
}

/** Derive SLA state from stored timestamps. COMPLETED/PAUSED are sticky until mutated. */
export function calculateSlaState(params: {
  now: Date;
  startedAt: Date;
  dueAt: Date;
  durationMinutes: number;
  state: SlaState;
  pausedAt: string | null;
  pausedElapsedSeconds: number;
  completedAt: string | null;
}): SlaState {
  if (params.state === "COMPLETED" || params.completedAt) {
    return "COMPLETED";
  }
  if (params.state === "PAUSED") {
    return "PAUSED";
  }

  const elapsedMs = getEffectiveElapsedMs(params);
  const durationMs = params.durationMinutes * 60_000;
  const dueSoonThreshold = durationMs * 0.8;

  if (elapsedMs >= durationMs || params.now >= params.dueAt) {
    return "BREACHED";
  }
  if (elapsedMs >= dueSoonThreshold) {
    return "DUE_SOON";
  }
  return "RUNNING";
}

export function pauseResolutionSla(params: {
  now: Date;
  state: SlaState;
  pausedAt: string | null;
  pausedElapsedSeconds: number;
}): {
  state: SlaState;
  pausedAt: string;
  pausedElapsedSeconds: number;
} | null {
  if (params.state === "COMPLETED" || params.state === "PAUSED") {
    return null;
  }
  return {
    state: "PAUSED",
    pausedAt: params.now.toISOString(),
    pausedElapsedSeconds: params.pausedElapsedSeconds,
  };
}

export function resumeResolutionSla(params: {
  now: Date;
  state: SlaState;
  pausedAt: string | null;
  pausedElapsedSeconds: number;
  startedAt: Date;
  durationMinutes: number;
}): {
  state: SlaState;
  pausedAt: null;
  pausedElapsedSeconds: number;
  dueAt: string;
} | null {
  if (params.state !== "PAUSED" || !params.pausedAt) {
    return null;
  }

  const pauseStarted = new Date(params.pausedAt).getTime();
  const additionalPauseSeconds = Math.max(
    0,
    Math.floor((params.now.getTime() - pauseStarted) / 1000)
  );
  const pausedElapsedSeconds =
    params.pausedElapsedSeconds + additionalPauseSeconds;
  const dueAt = calculateSlaDueAt(
    params.startedAt,
    params.durationMinutes,
    pausedElapsedSeconds
  );

  const nextState = calculateSlaState({
    now: params.now,
    startedAt: params.startedAt,
    dueAt,
    durationMinutes: params.durationMinutes,
    state: "RUNNING",
    pausedAt: null,
    pausedElapsedSeconds,
    completedAt: null,
  });

  return {
    state: nextState === "PAUSED" ? "RUNNING" : nextState,
    pausedAt: null,
    pausedElapsedSeconds,
    dueAt: dueAt.toISOString(),
  };
}

export function isWaitingStatus(status: string): boolean {
  return (
    status === "WAITING_FOR_REQUESTER" ||
    status === "WAITING_FOR_EXTERNAL_PARTY"
  );
}

export function slaTypeLabel(type: SlaType): string {
  return type === "first_response" ? "First response" : "Resolution";
}
