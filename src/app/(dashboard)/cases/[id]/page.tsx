import { notFound } from "next/navigation";
import { CaseDetail } from "@/components/cases/case-detail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireProfile } from "@/lib/auth/session";
import { getCaseById } from "@/lib/cases/queries";

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

  return <CaseDetail caseData={data} profile={profile} />;
}
