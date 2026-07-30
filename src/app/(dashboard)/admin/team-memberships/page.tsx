import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { adminUpsertTeamMembershipAction } from "@/lib/admin/actions";
import { listAdminProfiles, listAdminTeamMemberships, listAdminTeams } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminTeamMembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const [memberships, teams, users] = await Promise.all([
    listAdminTeamMemberships(profile, {
      active: (params.active as "all" | "active" | "inactive") ?? "all",
    }),
    listAdminTeams(profile, { active: "active", pageSize: 100 }),
    listAdminProfiles(profile, { active: "active", pageSize: 100 }),
  ]);

  if (!memberships.success || !memberships.data) {
    return <p className="text-destructive">{memberships.error}</p>;
  }

  const teamOptions =
    teams.data?.items.map((team) => ({
      value: team.id,
      label: `${team.name} (${team.code})`,
    })) ?? [];
  const userOptions =
    users.data?.items.map((user) => ({
      value: user.id,
      label: `${user.full_name} <${user.email}>`,
    })) ?? [];

  const fields = [
    { name: "group_id", label: "Team", type: "select" as const, options: teamOptions },
    { name: "user_id", label: "User", type: "select" as const, options: userOptions },
    { name: "is_lead", label: "Team lead", type: "checkbox" as const },
    { name: "is_active", label: "Active", type: "checkbox" as const },
  ];

  return (
    <div className="space-y-6">
      <AdminFilterBar q={params.q} active={params.active} />
      <AdminUpsertForm
        title="Add membership"
        fields={fields}
        action={adminUpsertTeamMembershipAction}
        submitLabel="Add member"
      />
      {memberships.data.items.length === 0 ? (
        <EmptyState message="No memberships found." />
      ) : (
        memberships.data.items.map((row) => (
          <div key={row.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {row.profile?.full_name ?? row.user_id}{" "}
                  {row.is_lead ? "(lead)" : ""}
                </p>
                <p className="text-sm text-muted-foreground">{row.profile?.email}</p>
              </div>
              <ActiveBadge active={row.is_active !== false} />
            </div>
            <AdminUpsertForm
              title={`Edit membership · ${row.profile?.full_name ?? row.user_id}`}
              initial={row as unknown as Record<string, unknown>}
              fields={fields}
              action={adminUpsertTeamMembershipAction}
              submitLabel="Save membership"
            />
          </div>
        ))
      )}
    </div>
  );
}
