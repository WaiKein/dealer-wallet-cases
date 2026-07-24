import { notFound } from "next/navigation";
import { CaseDetail } from "@/components/cases/case-detail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { canAssignAgent } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { getCaseById, listOperationsAgents } from "@/lib/cases/queries";

interface CaseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const profile = await requireProfile();
  const { id } = await params;
  const { data, error } = await getCaseById(id);

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

  const agentsResult = canAssignAgent(profile.role, data.status)
    ? await listOperationsAgents()
    : { data: [], error: null };

  return (
    <CaseDetail
      caseData={data}
      profile={profile}
      agents={agentsResult.data}
    />
  );
}
