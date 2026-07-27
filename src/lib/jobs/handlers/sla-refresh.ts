import type { BackgroundJob } from "@/lib/jobs/enqueue";
import { refreshCaseSlaStates } from "@/lib/sla/service";
import type { CasePriority, Profile } from "@/types";

/** System action: SLA state evaluation only (no status transitions). */
export async function handleSlaRefreshJob(job: BackgroundJob): Promise<void> {
  const caseId = String(job.payload.caseId ?? "");
  const organizationId = job.organization_id;
  const priority = (job.payload.priority as CasePriority) ?? "medium";
  const assignedGroupId =
    (job.payload.assignedGroupId as string | null | undefined) ?? null;

  if (!caseId) {
    throw new Error("sla.refresh_case requires caseId.");
  }

  const actor: Profile = {
    id: String(job.payload.actorId ?? "00000000-0000-0000-0000-000000000000"),
    email: "system@jobs.local",
    full_name: "Background Job",
    role: "operations_agent",
    organization_id: organizationId,
    created_at: new Date().toISOString(),
  };

  await refreshCaseSlaStates({
    caseId,
    organizationId,
    priority,
    assignedGroupId,
    actor,
  });
}
