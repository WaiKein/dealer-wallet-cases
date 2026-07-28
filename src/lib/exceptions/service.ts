import { recordAuditEntry } from "@/lib/cases/audit";
import {
  OPEN_EXCEPTION_STATUSES,
  type ExceptionQueueRow,
  type ExceptionQueueType,
  type OperationalException,
} from "@/lib/exceptions/types";
import { upsertOperationalException } from "@/lib/exceptions/sync";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/api";
import type { ActionResult, Profile } from "@/types";

function canManageExceptions(role: Profile["role"]): boolean {
  return (
    role === "operations_agent" ||
    role === "team_lead" ||
    role === "admin"
  );
}

export function canAccessExceptionQueues(role: Profile["role"]): boolean {
  return (
    role === "operations_agent" ||
    role === "team_lead" ||
    role === "admin" ||
    role === "approver"
  );
}

export async function listExceptionQueues(params: {
  profile: Profile;
  queueType?: ExceptionQueueType | "all";
  includeResolved?: boolean;
}): Promise<{ data: ExceptionQueueRow[]; error: string | null }> {
  if (!params.profile.organization_id) {
    return { data: [], error: "Organization required." };
  }
  if (!canAccessExceptionQueues(params.profile.role)) {
    return { data: [], error: "Not allowed." };
  }

  const supabase = await createClient();
  let query = supabase
    .from("operational_exceptions")
    .select("*")
    .eq("organization_id", params.profile.organization_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.queueType && params.queueType !== "all") {
    query = query.eq("queue_type", params.queueType);
  }
  if (!params.includeResolved) {
    query = query.in("status", OPEN_EXCEPTION_STATUSES);
  }

  const { data: exceptions, error } = await query;
  if (error) {
    return { data: [], error: error.message };
  }

  const rows = (exceptions ?? []) as OperationalException[];
  const caseIds = [
    ...new Set(rows.map((r) => r.case_id).filter(Boolean) as string[]),
  ];
  const executionIds = [
    ...new Set(rows.map((r) => r.execution_id).filter(Boolean) as string[]),
  ];

  const casesById = new Map<string, Record<string, unknown>>();
  const execById = new Map<string, Record<string, unknown>>();
  const groupById = new Map<string, string>();
  const agentById = new Map<string, string>();

  if (caseIds.length) {
    const { data: cases } = await supabase
      .from("cases")
      .select(
        "id, case_number, title, dealer_id, adjustment_amount, status, assigned_group_id, assigned_agent_id, created_at"
      )
      .in("id", caseIds);
    for (const c of cases ?? []) {
      casesById.set(c.id, c);
    }

    const groupIds = [
      ...new Set(
        (cases ?? [])
          .map((c) => c.assigned_group_id)
          .filter(Boolean) as string[]
      ),
    ];
    const agentIds = [
      ...new Set(
        (cases ?? [])
          .map((c) => c.assigned_agent_id)
          .filter(Boolean) as string[]
      ),
    ];
    if (groupIds.length) {
      const { data: groups } = await supabase
        .from("assignment_groups")
        .select("id, name")
        .in("id", groupIds);
      for (const g of groups ?? []) {
        groupById.set(g.id, g.name);
      }
    }
    if (agentIds.length) {
      const { data: agents } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", agentIds);
      for (const a of agents ?? []) {
        agentById.set(a.id, a.full_name);
      }
    }
  }

  if (executionIds.length) {
    const { data: executions } = await supabase
      .from("case_integration_executions")
      .select(
        "id, status, requested_amount, approved_amount, last_attempt_at, next_retry_at, external_transaction_ref, correlation_id, failure_category"
      )
      .in("id", executionIds);
    for (const e of executions ?? []) {
      execById.set(e.id, e);
    }
  }

  const enriched: ExceptionQueueRow[] = rows.map((row) => {
    const c = row.case_id ? casesById.get(row.case_id) : null;
    const e = row.execution_id ? execById.get(row.execution_id) : null;
    return {
      ...row,
      case_number: (c?.case_number as string) ?? null,
      case_title: (c?.title as string) ?? row.title,
      account_id: (c?.dealer_id as string) ?? null,
      requested_amount: e
        ? Number(e.requested_amount)
        : c
          ? Number(c.adjustment_amount)
          : null,
      approved_amount: e ? Number(e.approved_amount) : null,
      case_status: (c?.status as string) ?? null,
      execution_status: (e?.status as string) ?? null,
      assigned_group_name: c?.assigned_group_id
        ? groupById.get(String(c.assigned_group_id)) ?? null
        : null,
      assigned_agent_name: c?.assigned_agent_id
        ? agentById.get(String(c.assigned_agent_id)) ?? null
        : null,
      last_attempt_at: (e?.last_attempt_at as string) ?? null,
      next_retry_at: (e?.next_retry_at as string) ?? null,
      external_transaction_ref:
        (e?.external_transaction_ref as string) ?? null,
      execution_correlation_id:
        (e?.correlation_id as string) ?? row.correlation_id,
      case_created_at: (c?.created_at as string) ?? null,
      failure_category:
        row.failure_category ??
        (e?.failure_category as string | null) ??
        null,
    };
  });

  return { data: enriched, error: null };
}

export async function countOpenExceptionsByQueue(
  profile: Profile
): Promise<Record<string, number>> {
  const { data } = await listExceptionQueues({
    profile,
    queueType: "all",
    includeResolved: false,
  });
  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.queue_type] = (counts[row.queue_type] ?? 0) + 1;
  }
  return counts;
}

async function loadExceptionForAction(
  profile: Profile,
  exceptionId: string
): Promise<ActionResult<OperationalException>> {
  if (!canManageExceptions(profile.role)) {
    return { success: false, error: "Not allowed.", code: "FORBIDDEN" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operational_exceptions")
    .select("*")
    .eq("id", exceptionId)
    .maybeSingle();
  if (error || !data) {
    return { success: false, error: "Exception not found.", code: "NOT_FOUND" };
  }
  if (
    profile.organization_id &&
    data.organization_id !== profile.organization_id
  ) {
    return { success: false, error: "Forbidden.", code: "FORBIDDEN" };
  }
  return { success: true, data: data as OperationalException };
}

async function auditExceptionAction(params: {
  caseId: string | null;
  actorId: string;
  action: string;
  exceptionId: string;
  comment?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!params.caseId) return;
  await recordAuditEntry({
    caseId: params.caseId,
    eventType: "exception_action",
    changedBy: params.actorId,
    comment: params.comment ?? params.action,
    metadata: {
      exceptionId: params.exceptionId,
      action: params.action,
      ...(params.metadata ?? {}),
    },
  });
}

export async function assignExceptionOwner(params: {
  profile: Profile;
  exceptionId: string;
  ownerId: string;
  expectedVersion?: number;
}): Promise<ActionResult<{ version: number }>> {
  const loaded = await loadExceptionForAction(
    params.profile,
    params.exceptionId
  );
  if (!loaded.success || !loaded.data) return loaded as ActionResult<{ version: number }>;

  const supabase = await createClient();
  const nextVersion = loaded.data.version + 1;
  const { data, error } = await supabase
    .from("operational_exceptions")
    .update({
      assigned_owner_id: params.ownerId,
      status:
        loaded.data.status === "OPEN" ? "ASSIGNED" : loaded.data.status,
      version: nextVersion,
    })
    .eq("id", params.exceptionId)
    .eq(
      "version",
      params.expectedVersion != null
        ? params.expectedVersion
        : loaded.data.version
    )
    .select("id, version")
    .maybeSingle();
  if (error || !data) {
    return {
      success: false,
      error: "Exception conflict. Refresh and retry.",
      code: "VERSION_CONFLICT",
    };
  }

  await auditExceptionAction({
    caseId: loaded.data.case_id,
    actorId: params.profile.id,
    action: "assign_owner",
    exceptionId: params.exceptionId,
    comment: `Assigned exception owner`,
    metadata: { ownerId: params.ownerId },
  });

  return { success: true, data: { version: Number(data.version) } };
}

export async function addExceptionNote(params: {
  profile: Profile;
  exceptionId: string;
  note: string;
  expectedVersion?: number;
}): Promise<ActionResult<{ version: number }>> {
  const loaded = await loadExceptionForAction(
    params.profile,
    params.exceptionId
  );
  if (!loaded.success || !loaded.data) return loaded as ActionResult<{ version: number }>;

  const note = params.note.trim();
  if (!note) {
    return {
      success: false,
      error: "Note is required.",
      code: "VALIDATION_ERROR",
    };
  }

  const supabase = await createClient();
  const nextVersion = loaded.data.version + 1;
  const { data, error } = await supabase
    .from("operational_exceptions")
    .update({
      last_internal_note: note,
      status:
        loaded.data.status === "OPEN" || loaded.data.status === "ASSIGNED"
          ? "IN_PROGRESS"
          : loaded.data.status,
      version: nextVersion,
    })
    .eq("id", params.exceptionId)
    .eq("version", loaded.data.version)
    .select("id, version")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: "Exception conflict. Refresh and retry.",
      code: "VERSION_CONFLICT",
    };
  }

  await auditExceptionAction({
    caseId: loaded.data.case_id,
    actorId: params.profile.id,
    action: "add_note",
    exceptionId: params.exceptionId,
    comment: note,
  });

  return { success: true, data: { version: Number(data.version) } };
}

export async function escalateException(params: {
  profile: Profile;
  exceptionId: string;
  note?: string;
}): Promise<ActionResult<{ version: number }>> {
  const loaded = await loadExceptionForAction(
    params.profile,
    params.exceptionId
  );
  if (!loaded.success || !loaded.data) return loaded as ActionResult<{ version: number }>;

  const supabase = await createClient();
  const nextVersion = loaded.data.version + 1;
  const { data, error } = await supabase
    .from("operational_exceptions")
    .update({
      status: "ESCALATED",
      escalated_at: new Date().toISOString(),
      last_internal_note: params.note?.trim() || loaded.data.last_internal_note,
      version: nextVersion,
    })
    .eq("id", params.exceptionId)
    .eq("version", loaded.data.version)
    .select("id, version")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: "Exception conflict. Refresh and retry.",
      code: "VERSION_CONFLICT",
    };
  }

  await auditExceptionAction({
    caseId: loaded.data.case_id,
    actorId: params.profile.id,
    action: "escalate",
    exceptionId: params.exceptionId,
    comment: params.note?.trim() || "Exception escalated",
  });

  return { success: true, data: { version: Number(data.version) } };
}

export async function markExceptionForReconciliation(params: {
  profile: Profile;
  exceptionId: string;
}): Promise<ActionResult<{ version: number }>> {
  const loaded = await loadExceptionForAction(
    params.profile,
    params.exceptionId
  );
  if (!loaded.success || !loaded.data) return loaded as ActionResult<{ version: number }>;

  const supabase = await createClient();
  const nextVersion = loaded.data.version + 1;
  const { data, error } = await supabase
    .from("operational_exceptions")
    .update({
      reconciliation_required: true,
      queue_type: "manual_reconciliation_required",
      version: nextVersion,
    })
    .eq("id", params.exceptionId)
    .eq("version", loaded.data.version)
    .select("id, version")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: "Exception conflict. Refresh and retry.",
      code: "VERSION_CONFLICT",
    };
  }

  // Also ensure a dedicated reconciliation source exists
  await upsertOperationalException({
    organizationId: loaded.data.organization_id,
    queueType: "manual_reconciliation_required",
    sourceRef: `reconciliation:${loaded.data.id}`,
    caseId: loaded.data.case_id,
    executionId: loaded.data.execution_id,
    title: loaded.data.title ?? "Manual reconciliation required",
    failureCategory: loaded.data.failure_category,
    reconciliationRequired: true,
  });

  await auditExceptionAction({
    caseId: loaded.data.case_id,
    actorId: params.profile.id,
    action: "mark_reconciliation",
    exceptionId: params.exceptionId,
    comment: "Marked for manual reconciliation",
  });

  return { success: true, data: { version: Number(data.version) } };
}

export async function resolveExceptionItem(params: {
  profile: Profile;
  exceptionId: string;
  resolutionNote: string;
  dismiss?: boolean;
}): Promise<ActionResult<{ version: number }>> {
  const loaded = await loadExceptionForAction(
    params.profile,
    params.exceptionId
  );
  if (!loaded.success || !loaded.data) return loaded as ActionResult<{ version: number }>;

  const note = params.resolutionNote.trim();
  if (!note) {
    return {
      success: false,
      error: "Resolution note is required.",
      code: "VALIDATION_ERROR",
    };
  }

  const supabase = await createClient();
  const nextVersion = loaded.data.version + 1;
  const { data, error } = await supabase
    .from("operational_exceptions")
    .update({
      status: params.dismiss ? "DISMISSED" : "RESOLVED",
      resolved_at: new Date().toISOString(),
      resolved_by: params.profile.id,
      resolution_note: note,
      version: nextVersion,
    })
    .eq("id", params.exceptionId)
    .eq("version", loaded.data.version)
    .select("id, version")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: "Exception conflict. Refresh and retry.",
      code: "VERSION_CONFLICT",
    };
  }

  await auditExceptionAction({
    caseId: loaded.data.case_id,
    actorId: params.profile.id,
    action: params.dismiss ? "dismiss" : "resolve",
    exceptionId: params.exceptionId,
    comment: note,
  });

  return { success: true, data: { version: Number(data.version) } };
}

/** Used by system sync when case becomes assigned / SLA recovered / etc. */
export async function systemResolveExceptionSources(params: {
  organizationId: string;
  sourceRefs: string[];
  note: string;
}) {
  const service = createServiceClient();
  await service
    .from("operational_exceptions")
    .update({
      status: "RESOLVED",
      resolved_at: new Date().toISOString(),
      resolution_note: params.note,
    })
    .eq("organization_id", params.organizationId)
    .in("source_ref", params.sourceRefs)
    .in("status", OPEN_EXCEPTION_STATUSES);
}
