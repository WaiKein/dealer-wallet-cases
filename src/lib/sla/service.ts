import {
  calculateSlaDueAt,
  calculateSlaState,
  isWaitingStatus,
  pauseResolutionSla,
  resumeResolutionSla,
  slaTypeLabel,
} from "@/lib/assignment/rules";
import { recordAuditEntry } from "@/lib/cases/audit";
import { getClock } from "@/lib/clock";
import { notifyUsers } from "@/lib/notifications/service";
import { createClient } from "@/lib/supabase/server";
import type {
  CasePriority,
  CaseSla,
  CaseStatus,
  Profile,
  SlaType,
  UserRole,
} from "@/types";

async function getSlaDurationMinutes(
  organizationId: string,
  priority: CasePriority,
  slaType: SlaType
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sla_definitions")
    .select("duration_minutes")
    .eq("organization_id", organizationId)
    .eq("priority", priority)
    .eq("sla_type", slaType)
    .maybeSingle();

  return data?.duration_minutes ?? null;
}

async function getGroupRecipients(groupId: string): Promise<
  { id: string; role: UserRole }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignment_group_members")
    .select("user_id, profile:profiles!assignment_group_members_user_id_fkey(id, role)")
    .eq("group_id", groupId);

  const recipients: { id: string; role: UserRole }[] = [];
  for (const row of data ?? []) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    if (profile) {
      recipients.push({ id: profile.id, role: profile.role as UserRole });
    }
  }
  return recipients;
}

export async function startCaseSlas(params: {
  caseId: string;
  organizationId: string;
  priority: CasePriority;
  startedAt: Date;
  actorId: string;
}): Promise<string | null> {
  const supabase = await createClient();

  for (const slaType of ["first_response", "resolution"] as SlaType[]) {
    const duration = await getSlaDurationMinutes(
      params.organizationId,
      params.priority,
      slaType
    );
    if (!duration) {
      return `Missing SLA definition for ${params.priority}/${slaType}.`;
    }

    const dueAt = calculateSlaDueAt(params.startedAt, duration);
    const { error } = await supabase.from("case_sla").upsert(
      {
        case_id: params.caseId,
        sla_type: slaType,
        state: "RUNNING",
        due_at: dueAt.toISOString(),
        started_at: params.startedAt.toISOString(),
        completed_at: null,
        paused_at: null,
        paused_elapsed_seconds: 0,
        breached_at: null,
      },
      { onConflict: "case_id,sla_type", ignoreDuplicates: true }
    );

    if (error) {
      return error.message;
    }
  }

  return null;
}

export async function refreshCaseSlaStates(params: {
  caseId: string;
  organizationId: string;
  priority: CasePriority;
  assignedGroupId: string | null;
  actor: Profile;
}): Promise<void> {
  const supabase = await createClient();
  const { data: records } = await supabase
    .from("case_sla")
    .select("*")
    .eq("case_id", params.caseId);

  const now = getClock().now();

  for (const record of (records ?? []) as CaseSla[]) {
    if (record.state === "COMPLETED" || record.state === "PAUSED") {
      continue;
    }

    const duration = await getSlaDurationMinutes(
      params.organizationId,
      params.priority,
      record.sla_type
    );
    if (!duration) {
      continue;
    }

    const nextState = calculateSlaState({
      now,
      startedAt: new Date(record.started_at),
      dueAt: new Date(record.due_at),
      durationMinutes: duration,
      state: record.state,
      pausedAt: record.paused_at,
      pausedElapsedSeconds: record.paused_elapsed_seconds,
      completedAt: record.completed_at,
    });

    if (nextState === record.state) {
      continue;
    }

    const patch: Record<string, unknown> = { state: nextState };
    if (nextState === "BREACHED" && !record.breached_at) {
      patch.breached_at = now.toISOString();
    }

    const { error } = await supabase
      .from("case_sla")
      .update(patch)
      .eq("id", record.id)
      .eq("state", record.state);

    if (error) {
      continue;
    }

    if (nextState === "DUE_SOON" && !record.due_soon_notified_at) {
      await recordAuditEntry({
        caseId: params.caseId,
        eventType: "sla_due_soon",
        changedBy: params.actor.id,
        comment: `${slaTypeLabel(record.sla_type)} SLA due soon.`,
        metadata: { sla_type: record.sla_type },
      });
      await supabase
        .from("case_sla")
        .update({ due_soon_notified_at: now.toISOString() })
        .eq("id", record.id)
        .is("due_soon_notified_at", null);

      if (params.assignedGroupId) {
        const recipients = await getGroupRecipients(params.assignedGroupId);
        await notifyUsers({
          organizationId: params.organizationId,
          recipients,
          caseId: params.caseId,
          type: "sla_due_soon",
          title: "SLA due soon",
          body: `${slaTypeLabel(record.sla_type)} SLA is approaching the deadline.`,
          suffix: record.sla_type,
        });
      }
    }

    if (nextState === "BREACHED" && !record.breach_notified_at) {
      await recordAuditEntry({
        caseId: params.caseId,
        eventType: "sla_breach",
        changedBy: params.actor.id,
        comment: `${slaTypeLabel(record.sla_type)} SLA breached.`,
        metadata: { sla_type: record.sla_type },
      });
      await supabase
        .from("case_sla")
        .update({ breach_notified_at: now.toISOString() })
        .eq("id", record.id)
        .is("breach_notified_at", null);

      if (params.assignedGroupId) {
        const recipients = await getGroupRecipients(params.assignedGroupId);
        await notifyUsers({
          organizationId: params.organizationId,
          recipients,
          caseId: params.caseId,
          type: "sla_breach",
          title: "SLA breached",
          body: `${slaTypeLabel(record.sla_type)} SLA has been breached.`,
          suffix: record.sla_type,
        });
      }
    }
  }
}

export async function completeSla(params: {
  caseId: string;
  slaType: SlaType;
  actorId: string;
  now?: Date;
}): Promise<string | null> {
  const supabase = await createClient();
  const now = params.now ?? getClock().now();

  const { data: record } = await supabase
    .from("case_sla")
    .select("*")
    .eq("case_id", params.caseId)
    .eq("sla_type", params.slaType)
    .maybeSingle();

  if (!record) {
    return null;
  }
  if (record.state === "COMPLETED") {
    return null;
  }

  const { error } = await supabase
    .from("case_sla")
    .update({
      state: "COMPLETED",
      completed_at: now.toISOString(),
      paused_at: null,
    })
    .eq("id", record.id)
    .neq("state", "COMPLETED");

  if (error) {
    return error.message;
  }

  await recordAuditEntry({
    caseId: params.caseId,
    eventType: "sla_completed",
    changedBy: params.actorId,
    comment: `${slaTypeLabel(params.slaType)} SLA completed.`,
    metadata: { sla_type: params.slaType },
  });

  return null;
}

export async function syncResolutionSlaForStatus(params: {
  caseId: string;
  organizationId: string;
  priority: CasePriority;
  fromStatus: CaseStatus;
  toStatus: CaseStatus;
  actorId: string;
}): Promise<string | null> {
  const supabase = await createClient();
  const now = getClock().now();

  const { data: record } = await supabase
    .from("case_sla")
    .select("*")
    .eq("case_id", params.caseId)
    .eq("sla_type", "resolution")
    .maybeSingle();

  if (!record || record.state === "COMPLETED") {
    return null;
  }

  const duration = await getSlaDurationMinutes(
    params.organizationId,
    params.priority,
    "resolution"
  );
  if (!duration) {
    return "Missing resolution SLA definition.";
  }

  const enteringWait =
    !isWaitingStatus(params.fromStatus) && isWaitingStatus(params.toStatus);
  const leavingWait =
    isWaitingStatus(params.fromStatus) && !isWaitingStatus(params.toStatus);

  if (enteringWait) {
    const paused = pauseResolutionSla({
      now,
      state: record.state,
      pausedAt: record.paused_at,
      pausedElapsedSeconds: record.paused_elapsed_seconds,
    });
    if (!paused) {
      return null;
    }

    const { error } = await supabase
      .from("case_sla")
      .update({
        state: paused.state,
        paused_at: paused.pausedAt,
      })
      .eq("id", record.id)
      .neq("state", "COMPLETED");

    if (error) {
      return error.message;
    }

    await recordAuditEntry({
      caseId: params.caseId,
      eventType: "sla_paused",
      changedBy: params.actorId,
      comment: "Resolution SLA paused while waiting.",
      metadata: { sla_type: "resolution", status: params.toStatus },
    });
    return null;
  }

  if (leavingWait) {
    const resumed = resumeResolutionSla({
      now,
      state: record.state,
      pausedAt: record.paused_at,
      pausedElapsedSeconds: record.paused_elapsed_seconds,
      startedAt: new Date(record.started_at),
      durationMinutes: duration,
    });
    if (!resumed) {
      return null;
    }

    const { error } = await supabase
      .from("case_sla")
      .update({
        state: resumed.state,
        paused_at: resumed.pausedAt,
        paused_elapsed_seconds: resumed.pausedElapsedSeconds,
        due_at: resumed.dueAt,
      })
      .eq("id", record.id)
      .eq("state", "PAUSED");

    if (error) {
      return error.message;
    }

    await recordAuditEntry({
      caseId: params.caseId,
      eventType: "sla_resumed",
      changedBy: params.actorId,
      comment: "Resolution SLA resumed.",
      metadata: { sla_type: "resolution", status: params.toStatus },
    });
  }

  return null;
}
