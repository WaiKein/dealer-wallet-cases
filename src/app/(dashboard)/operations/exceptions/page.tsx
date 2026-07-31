import { ExceptionsWorkspace } from "@/components/operations/exceptions-workspace";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  canAccessExceptionQueues,
  canManageExceptions,
} from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { listExceptionQueues } from "@/lib/exceptions/service";
import type { ExceptionQueueType } from "@/lib/exceptions/types";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ queue?: string }>;
}

const QUEUE_TYPES = new Set([
  "integration_failed_final",
  "integration_retry_pending",
  "integration_unknown",
  "approval_expired",
  "approval_rejected",
  "sla_breached",
  "unassigned_case",
  "duplicate_transaction_suspected",
  "manual_reconciliation_required",
  "dead_letter_job",
]);

export default async function OperationsExceptionsPage({
  searchParams,
}: PageProps) {
  const profile = await requireProfile();
  if (!canAccessExceptionQueues(profile.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const queueParam = params.queue;
  const activeQueue =
    queueParam && QUEUE_TYPES.has(queueParam)
      ? (queueParam as ExceptionQueueType)
      : "all";

  const { data, error } = await listExceptionQueues({
    profile,
    queueType: "all",
    includeResolved: false,
  });

  if (error) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTitle>Unable to load exceptions</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const supabase = await createClient();
  const { data: agents } = profile.organization_id
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("organization_id", profile.organization_id)
        .in("role", ["operations_agent", "team_lead", "admin"])
        .order("full_name")
    : { data: [] };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Exceptions"
        description="Triage failed integrations, SLA breaches, unassigned cases, and dead-letter jobs. Unknown financial results require status inquiry before retry."
      />

      <ExceptionsWorkspace
        rows={data}
        agents={agents ?? []}
        canManage={canManageExceptions(profile.role)}
        activeQueue={activeQueue}
      />
    </div>
  );
}
