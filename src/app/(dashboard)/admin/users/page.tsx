import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/layout/page-header";
import { adminUpdateProfileAction } from "@/lib/admin/actions";
import { listAdminProfiles } from "@/lib/admin/config";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const result = await listAdminProfiles(profile, {
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
        title="Users"
        description={`${result.data.items.length} accounts · role and status`}
      />
      <AdminFilterBar q={params.q} active={params.active} />
      {result.data.items.length === 0 ? (
        <EmptyState message="No users match the current filters." />
      ) : (
        <div className="space-y-3">
          {result.data.items.map((user) => (
            <div key={user.id} className="ops-panel space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.email} · {ROLE_LABELS[user.role]}
                  </p>
                </div>
                <ActiveBadge active={user.is_active !== false} />
              </div>
              <details className="rounded-md border bg-muted/20 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Edit {user.full_name}
                </summary>
                <div className="mt-3">
                  <AdminUpsertForm
                    title={`Edit ${user.full_name}`}
                    initial={user as unknown as Record<string, unknown>}
                    fields={[
                      { name: "full_name", label: "Full name", type: "text" },
                      {
                        name: "role",
                        label: "Role",
                        type: "select",
                        options: Object.entries(ROLE_LABELS).map(
                          ([value, label]) => ({ value, label })
                        ),
                      },
                      { name: "is_active", label: "Active", type: "checkbox" },
                    ]}
                    action={adminUpdateProfileAction}
                    submitLabel="Save user"
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
