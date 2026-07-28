import {
  canActAsGroupLead,
  canClaimCase,
  matchAssignmentRule,
} from "@/lib/assignment/rules";
import { recordAuditEntry } from "@/lib/cases/audit";
import { getClock } from "@/lib/clock";
import { notifyUsers } from "@/lib/notifications/service";
import { createClient } from "@/lib/supabase/server";
import type {
  CasePriority,
  LeadAuthorizationMode,
  Profile,
  UserRole,
} from "@/types";

export async function applyAssignmentRules(params: {
  caseId: string;
  organizationId: string;
  categoryId: string;
  subcategoryId: string;
  priority: CasePriority;
  actor: Profile;
}): Promise<{ groupId: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data: rules, error } = await supabase
    .from("assignment_rules")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("is_active", true)
    .order("sequence", { ascending: true });

  if (error) {
    return { groupId: null, error: error.message };
  }

  const matched = matchAssignmentRule(rules ?? [], {
    categoryId: params.categoryId,
    subcategoryId: params.subcategoryId,
    priority: params.priority,
  });

  if (!matched) {
    return { groupId: null, error: null };
  }

  const { error: updateError } = await supabase
    .from("cases")
    .update({ assigned_group_id: matched.assignment_group_id })
    .eq("id", params.caseId);

  if (updateError) {
    return { groupId: null, error: updateError.message };
  }

  await recordAuditEntry({
    caseId: params.caseId,
    eventType: "assignment",
    changedBy: params.actor.id,
    comment: "Case automatically assigned to group by rule.",
    metadata: {
      assignment_group_id: matched.assignment_group_id,
      rule_id: matched.id,
      sequence: matched.sequence,
    },
  });

  const recipients = await listGroupMembers(matched.assignment_group_id);
  await notifyUsers({
    organizationId: params.organizationId,
    recipients,
    caseId: params.caseId,
    type: "case_assignment",
    title: "Case assigned to your group",
    body: "A new case was assigned to your assignment group.",
    suffix: matched.assignment_group_id,
    emailEventType: "case_assigned",
  });

  return { groupId: matched.assignment_group_id, error: null };
}

export async function listGroupMembers(
  groupId: string
): Promise<{ id: string; role: UserRole }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignment_group_members")
    .select(
      "user_id, profile:profiles!assignment_group_members_user_id_fkey(id, role)"
    )
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

async function getOrgLeadMode(
  organizationId: string
): Promise<LeadAuthorizationMode> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("lead_authorization_mode")
    .eq("id", organizationId)
    .single();

  return (data?.lead_authorization_mode as LeadAuthorizationMode) ?? "both";
}

async function getMembership(groupId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignment_group_members")
    .select("id, is_lead")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

export async function claimCase(params: {
  caseId: string;
  actor: Profile;
}): Promise<{ error: string | null }> {
  if (!params.actor.organization_id) {
    return { error: "Missing organization context." };
  }

  const supabase = await createClient();
  const { data: existingCase, error } = await supabase
    .from("cases")
    .select("id, status, assigned_group_id, assigned_agent_id, organization_id")
    .eq("id", params.caseId)
    .single();

  if (error || !existingCase) {
    return { error: "Case not found." };
  }

  if (!existingCase.assigned_group_id) {
    return { error: "Case has no assignment group." };
  }

  const membership = await getMembership(
    existingCase.assigned_group_id,
    params.actor.id
  );

  if (
    !canClaimCase({
      role: params.actor.role,
      isGroupMember: Boolean(membership),
      assignedAgentId: existingCase.assigned_agent_id,
    })
  ) {
    return { error: "You cannot claim this case." };
  }

  const { error: updateError } = await supabase
    .from("cases")
    .update({ assigned_agent_id: params.actor.id })
    .eq("id", params.caseId)
    .is("assigned_agent_id", null);

  if (updateError) {
    return { error: updateError.message };
  }

  await recordAuditEntry({
    caseId: params.caseId,
    eventType: "claim",
    changedBy: params.actor.id,
    comment: "Case claimed by agent.",
    metadata: {
      assigned_agent_id: params.actor.id,
      assigned_group_id: existingCase.assigned_group_id,
    },
  });

  const leads = (await listGroupMembers(existingCase.assigned_group_id)).filter(
    (member) => member.role === "team_lead" || member.id !== params.actor.id
  );

  await notifyUsers({
    organizationId: params.actor.organization_id,
    recipients: leads,
    caseId: params.caseId,
    type: "case_assignment",
    title: "Case claimed",
    body: `${params.actor.full_name} claimed a case in your group.`,
    suffix: `claim:${params.actor.id}`,
    emailEventType: "case_assigned",
  });

  const { systemResolveExceptionSources } = await import(
    "@/lib/exceptions/service"
  );
  await systemResolveExceptionSources({
    organizationId: params.actor.organization_id,
    sourceRefs: [`case:${params.caseId}:unassigned`],
    note: "Case claimed by agent.",
  });

  return { error: null };
}

export async function reassignWithinGroup(params: {
  caseId: string;
  agentId: string;
  actor: Profile;
}): Promise<{ error: string | null }> {
  if (!params.actor.organization_id) {
    return { error: "Missing organization context." };
  }

  const supabase = await createClient();
  const { data: existingCase, error } = await supabase
    .from("cases")
    .select(
      "id, status, assigned_group_id, assigned_agent_id, organization_id"
    )
    .eq("id", params.caseId)
    .single();

  if (error || !existingCase?.assigned_group_id) {
    return { error: "Case not found or has no assignment group." };
  }

  if (existingCase.organization_id !== params.actor.organization_id) {
    return { error: "Case is outside your organization." };
  }

  const actorMembership = await getMembership(
    existingCase.assigned_group_id,
    params.actor.id
  );
  const mode = await getOrgLeadMode(params.actor.organization_id);

  if (
    !canActAsGroupLead({
      role: params.actor.role,
      isGroupMember: Boolean(actorMembership),
      isMembershipLead: Boolean(actorMembership?.is_lead),
      mode,
    })
  ) {
    return { error: "Only group leads can reassign cases." };
  }

  const targetMembership = await getMembership(
    existingCase.assigned_group_id,
    params.agentId
  );
  if (!targetMembership) {
    return { error: "Target agent is not a member of this assignment group." };
  }

  const { data: agent } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", params.agentId)
    .single();

  if (!agent || !["operations_agent", "team_lead"].includes(agent.role)) {
    return { error: "Target user cannot be assigned as agent." };
  }

  const previousAgentId = existingCase.assigned_agent_id;
  const { error: updateError } = await supabase
    .from("cases")
    .update({ assigned_agent_id: agent.id })
    .eq("id", params.caseId);

  if (updateError) {
    return { error: updateError.message };
  }

  await recordAuditEntry({
    caseId: params.caseId,
    eventType: "reassignment",
    changedBy: params.actor.id,
    comment: `Reassigned to ${agent.full_name}.`,
    metadata: {
      from_agent_id: previousAgentId,
      to_agent_id: agent.id,
      assigned_group_id: existingCase.assigned_group_id,
    },
  });

  const recipients = [{ id: agent.id, role: agent.role as UserRole }];
  if (previousAgentId && previousAgentId !== agent.id) {
    const { data: previous } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", previousAgentId)
      .maybeSingle();
    if (previous) {
      recipients.push({
        id: previous.id,
        role: previous.role as UserRole,
      });
    }
  }

  await notifyUsers({
    organizationId: params.actor.organization_id,
    recipients,
    caseId: params.caseId,
    type: "case_reassignment",
    title: "Case reassigned",
    body: `Case reassigned to ${agent.full_name}.`,
    suffix: `${previousAgentId ?? "none"}:${agent.id}`,
  });

  return { error: null };
}

export async function acknowledgeCase(params: {
  caseId: string;
  actor: Profile;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: existingCase, error } = await supabase
    .from("cases")
    .select(
      "id, status, assigned_group_id, assigned_agent_id, acknowledged_at, organization_id, priority"
    )
    .eq("id", params.caseId)
    .single();

  if (error || !existingCase) {
    return { error: "Case not found." };
  }

  if (
    params.actor.role !== "operations_agent" &&
    params.actor.role !== "team_lead"
  ) {
    return { error: "Only agents can acknowledge cases." };
  }

  if (existingCase.assigned_group_id) {
    const membership = await getMembership(
      existingCase.assigned_group_id,
      params.actor.id
    );
    if (!membership) {
      return { error: "You are not a member of this case's assignment group." };
    }
  }

  if (
    existingCase.assigned_agent_id &&
    existingCase.assigned_agent_id !== params.actor.id
  ) {
    return { error: "Only the assigned agent can acknowledge this case." };
  }

  if (existingCase.acknowledged_at) {
    return { error: null };
  }

  const now = getClock().now().toISOString();
  const { error: updateError } = await supabase
    .from("cases")
    .update({
      acknowledged_at: now,
      first_responded_at: now,
      assigned_agent_id: existingCase.assigned_agent_id ?? params.actor.id,
    })
    .eq("id", params.caseId)
    .is("acknowledged_at", null);

  if (updateError) {
    return { error: updateError.message };
  }

  await recordAuditEntry({
    caseId: params.caseId,
    eventType: "acknowledge",
    changedBy: params.actor.id,
    comment: "Case acknowledged by agent.",
    metadata: {},
  });

  const { completeSla } = await import("@/lib/sla/service");
  await completeSla({
    caseId: params.caseId,
    slaType: "first_response",
    actorId: params.actor.id,
  });

  return { error: null };
}
