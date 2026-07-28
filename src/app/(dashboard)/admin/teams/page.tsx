import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { adminUpsertTeamAction } from "@/lib/admin/actions";
import { listAdminTeams } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const result = await listAdminTeams(profile, {
    q: params.q,
    active: (params.active as "all" | "active" | "inactive") ?? "all",
  });
  if (!result.success || !result.data) {
    return <p className="text-destructive">{result.error}</p>;
  }

  return (
    <div className="space-y-6">
      <AdminFilterBar q={params.q} active={params.active} />
      <AdminUpsertForm
        title="Create team"
        fields={[
          { name: "code", label: "Code", type: "text" },
          { name: "name", label: "Name", type: "text" },
          { name: "description", label: "Description", type: "textarea" },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        action={adminUpsertTeamAction}
        submitLabel="Create team"
      />
      {result.data.items.length === 0 ? (
        <EmptyState message="No teams found." />
      ) : (
        result.data.items.map((team) => (
          <div key={team.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {team.name}{" "}
                  <span className="text-sm text-muted-foreground">({team.code})</span>
                </p>
                <p className="text-xs text-muted-foreground">v{team.version ?? 1}</p>
              </div>
              <ActiveBadge active={team.is_active} />
            </div>
            <AdminUpsertForm
              title={`Edit ${team.name}`}
              initial={team as unknown as Record<string, unknown>}
              fields={[
                { name: "code", label: "Code", type: "text" },
                { name: "name", label: "Name", type: "text" },
                { name: "description", label: "Description", type: "textarea" },
                { name: "is_active", label: "Active", type: "checkbox" },
              ]}
              action={adminUpsertTeamAction}
            />
          </div>
        ))
      )}
    </div>
  );
}
