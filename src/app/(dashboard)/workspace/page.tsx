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
    cases: CaseWithRelations[];
    tone?: "warning";
  }[] = [
    { key: "mine", label: "My queue", cases: data.myAssigned },
    { key: "group", label: "Group queue", cases: data.unassignedForTeam },
    { key: "approvals", label: "Approvals waiting", cases: data.pendingApprovals },
    { key: "due", label: "Due soon", cases: data.dueSoon, tone: "warning" },
    { key: "breached", label: "At risk", cases: data.breached, tone: "warning" },
  ];

  const activeKey = (queues.find((q) => q.key === params.queue)?.key ??
    "mine") as QueueKey;
  const active = queues.find((q) => q.key === activeKey)!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My workspace"
        description="Prioritised by SLA and responsibility."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {queues.slice(0, 3).map((queue) => (
          <div key={queue.key} className="ops-panel p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {queue.label}
            </p>
            <p className="mt-2 text-3xl font-semibold">{queue.cases.length}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {queues.map((queue) => (
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
