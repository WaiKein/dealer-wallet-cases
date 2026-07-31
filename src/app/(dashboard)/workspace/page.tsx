import Link from "next/link";
import { CaseList } from "@/components/cases/case-list";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { canAccessAgentWorkspace } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { getWorkspaceQueues } from "@/lib/cases/queries";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import type { CaseWithRelations } from "@/types";

type QueueKey = "mine" | "group" | "due" | "breached" | "approvals";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ queue?: string }>;
}) {
  const profile = await requireProfile();
  if (!canAccessAgentWorkspace(profile.role)) {
    redirect("/cases");
  }

  const params = await searchParams;
  const { data, error } = await getWorkspaceQueues(profile);

  if (error || !data) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTitle>Unable to load workspace</AlertTitle>
        <AlertDescription>{error ?? "Unknown error"}</AlertDescription>
      </Alert>
    );
  }

  const queues: {
    key: QueueKey;
    label: string;
    metricLabel: string;
    cases: CaseWithRelations[];
    tone?: "warning";
    showInMetrics?: boolean;
  }[] = [
    {
      key: "mine",
      label: "My queue",
      metricLabel: "Assigned to me",
      cases: data.myAssigned,
      showInMetrics: true,
    },
    {
      key: "group",
      label: "Group queue",
      metricLabel: "Unassigned in my groups",
      cases: data.unassignedForTeam,
      showInMetrics: true,
    },
    {
      key: "approvals",
      label: "Approvals",
      metricLabel: "Approvals waiting",
      cases: data.pendingApprovals,
      showInMetrics: true,
    },
    {
      key: "due",
      label: "Due soon",
      metricLabel: "Due soon",
      cases: data.dueSoon,
      tone: "warning",
    },
    {
      key: "breached",
      label: "At risk",
      metricLabel: "At risk",
      cases: data.breached,
      tone: "warning",
    },
  ];

  const activeKey = (queues.find((q) => q.key === params.queue)?.key ??
    "mine") as QueueKey;
  const active = queues.find((q) => q.key === activeKey)!;
  const metricQueues = queues.filter((q) => q.showInMetrics);
  const pillQueues = queues.filter((q) =>
    ["mine", "group", "breached"].includes(q.key)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My workspace"
        description="Prioritised by SLA and responsibility."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {metricQueues.map((queue) => (
          <Link
            key={queue.key}
            href={`/workspace?queue=${queue.key}`}
            className="ops-panel p-4 transition-colors hover:bg-muted/30"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {queue.metricLabel}
            </p>
            <p className="mt-2 text-3xl font-semibold">{queue.cases.length}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {pillQueues.map((queue) => (
          <Link
            key={queue.key}
            href={`/workspace?queue=${queue.key}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium",
              activeKey === queue.key
                ? "border-primary bg-accent text-accent-foreground"
                : queue.tone === "warning"
                  ? "border-amber-300 text-amber-800"
                  : "text-muted-foreground hover:bg-muted"
            )}
          >
            {queue.label} {queue.cases.length}
          </Link>
        ))}
      </div>

      <CaseList cases={active.cases} />
    </div>
  );
}
