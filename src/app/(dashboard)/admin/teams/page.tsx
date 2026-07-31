import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { AdminEditorPanel } from "@/components/admin/admin-editor-panel";
import { PageHeader } from "@/components/layout/page-header";
import { adminUpsertTeamAction } from "@/lib/admin/actions";
import { listAdminTeams } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

const fields = [
  { name: "code", label: "Code", type: "text" as const },
  { name: "name", label: "Name", type: "text" as const },
  { name: "description", label: "Description", type: "textarea" as const },
  { name: "is_active", label: "Active", type: "checkbox" as const },
];

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
      <PageHeader
        eyebrow="People & access"
        title="Teams"
        description={`${result.data.items.length} teams · membership and routing`}
      />
      <AdminFilterBar q={params.q} active={params.active} />
      <AdminEditorPanel title="Create team" triggerLabel="New team">
        <AdminUpsertForm
          title="Create team"
          fields={fields}
          action={adminUpsertTeamAction}
          submitLabel="Create team"
        />
      </AdminEditorPanel>
      {result.data.items.length === 0 ? (
        <EmptyState message="No teams found." />
      ) : (
        <div className="space-y-3">
          {result.data.items.map((team) => (
            <div key={team.id} className="ops-panel space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {team.name}{" "}
                    <span className="text-sm text-muted-foreground">
                      ({team.code})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    v{team.version ?? 1}
                  </p>
                </div>
                <ActiveBadge active={team.is_active} />
              </div>
              <details className="rounded-md border bg-muted/20 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Edit {team.name}
                </summary>
                <div className="mt-3">
                  <AdminUpsertForm
                    title={`Edit ${team.name}`}
                    initial={team as unknown as Record<string, unknown>}
                    fields={fields}
                    action={adminUpsertTeamAction}
                    submitLabel="Save team"
                  />
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
