import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { canAccessAgentWorkspace } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireProfile } from "@/lib/auth/session";
import { listAssignmentGroups } from "@/lib/cases/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AssignmentGroupsPage() {
  const profile = await requireProfile();
  if (!canAccessAgentWorkspace(profile.role) || !profile.organization_id) {
    redirect("/cases");
  }

  const { data: groups, error } = await listAssignmentGroups(
    profile.organization_id
  );

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, lead_authorization_mode")
    .eq("id", profile.organization_id)
    .single();

  if (error) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTitle>Unable to load assignment groups</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const activeGroups = groups.filter((g) => g.is_active).length;
  const totalMembers = groups.reduce((sum, g) => sum + g.members.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Capacity"
        title="Assignment groups"
        description={`Lead authorization: ${org?.lead_authorization_mode ?? "both"} · ${activeGroups} active groups · ${totalMembers} members`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="ops-panel p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Groups
          </p>
          <p className="mt-2 text-3xl font-semibold">{groups.length}</p>
        </div>
        <div className="ops-panel p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Active
          </p>
          <p className="mt-2 text-3xl font-semibold">{activeGroups}</p>
        </div>
        <div className="ops-panel p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Members
          </p>
          <p className="mt-2 text-3xl font-semibold">{totalMembers}</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assignment groups yet.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{group.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {group.code}
                    {group.description ? ` · ${group.description}` : ""}
                  </p>
                </div>
                <Badge variant={group.is_active ? "success" : "outline"}>
                  {group.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {group.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                <DataTable headers={["Member", "Role", "Capacity"]}>
                  {group.members.map((member) => (
                    <DataTableRow key={member.id}>
                      <DataTableCell primary>
                        {member.profile?.full_name ?? member.user_id}
                      </DataTableCell>
                      <DataTableCell>
                        {member.profile
                          ? ROLE_LABELS[member.profile.role]
                          : "Unknown role"}
                      </DataTableCell>
                      <DataTableCell>
                        {member.is_lead ? (
                          <Badge>Group lead</Badge>
                        ) : (
                          <span>Agent</span>
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTable>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
