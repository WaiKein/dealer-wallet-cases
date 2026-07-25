import { notFound } from "next/navigation";
import { CaseDetail } from "@/components/cases/case-detail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { canActAsGroupLead, canClaimCase } from "@/lib/assignment/rules";
import { requireProfile } from "@/lib/auth/session";
import { getCaseById, listGroupAgents } from "@/lib/cases/queries";
import { createClient } from "@/lib/supabase/server";
import type { LeadAuthorizationMode } from "@/types";

interface CaseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const profile = await requireProfile();
  const { id } = await params;
  const { data, error } = await getCaseById(id, profile);

  if (error) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTitle>Unable to load case</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    notFound();
  }

  let canClaim = false;
  let canReassign = false;
  let agents: { id: string; full_name: string; email: string }[] = [];

  if (data.assigned_group_id && profile.organization_id) {
    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("assignment_group_members")
      .select("is_lead")
      .eq("group_id", data.assigned_group_id)
      .eq("user_id", profile.id)
      .maybeSingle();

    const { data: org } = await supabase
      .from("organizations")
      .select("lead_authorization_mode")
      .eq("id", profile.organization_id)
      .single();

    canClaim = canClaimCase({
      role: profile.role,
      isGroupMember: Boolean(membership),
      assignedAgentId: data.assigned_agent_id,
    });

    canReassign = canActAsGroupLead({
      role: profile.role,
      isGroupMember: Boolean(membership),
      isMembershipLead: Boolean(membership?.is_lead),
      mode:
        (org?.lead_authorization_mode as LeadAuthorizationMode | undefined) ??
        "both",
    });

    if (canReassign) {
      const agentsResult = await listGroupAgents(data.assigned_group_id);
      agents = agentsResult.data;
    }
  }

  return (
    <CaseDetail
      caseData={data}
      profile={profile}
      agents={agents}
      canClaim={canClaim}
      canReassign={canReassign}
    />
  );
}
