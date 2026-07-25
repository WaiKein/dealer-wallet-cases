import { CaseList } from "@/components/cases/case-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canAccessAgentWorkspace } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { getWorkspaceQueues } from "@/lib/cases/queries";
import { redirect } from "next/navigation";
import type { CaseWithRelations } from "@/types";

export default async function WorkspacePage() {
  const profile = await requireProfile();
  if (!canAccessAgentWorkspace(profile.role)) {
    redirect("/cases");
  }

  const { data, error } = await getWorkspaceQueues(profile);

  if (error) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTitle>Unable to load workspace</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Agent workspace</h1>
        <p className="text-muted-foreground">
          Queues for your assignment groups, SLAs, and approvals.
        </p>
      </div>

      <QueueSection title="My assigned cases" cases={data.myAssigned} />
      <QueueSection
        title="Unassigned cases for my groups"
        cases={data.unassignedForTeam}
      />
      <QueueSection title="Cases due soon" cases={data.dueSoon} />
      <QueueSection title="Breached cases" cases={data.breached} />
      <QueueSection title="Pending approvals" cases={data.pendingApprovals} />
    </div>
  );
}

function QueueSection({
  title,
  cases,
}: {
  title: string;
  cases: CaseWithRelations[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{cases.length} case(s)</CardDescription>
      </CardHeader>
      <CardContent>
        <CaseList cases={cases} />
      </CardContent>
    </Card>
  );
}
