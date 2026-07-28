import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { adminUpsertFeatureFlagAction } from "@/lib/admin/actions";
import { listAdminFeatureFlags } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminFeatureFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const result = await listAdminFeatureFlags(profile, {
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
        title="Create feature flag"
        fields={[
          { name: "code", label: "Code", type: "text" },
          { name: "name", label: "Name", type: "text" },
          { name: "description", label: "Description", type: "textarea" },
          { name: "is_enabled", label: "Enabled", type: "checkbox" },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        action={adminUpsertFeatureFlagAction}
        submitLabel="Create flag"
      />
      {result.data.items.length === 0 ? (
        <EmptyState message="No feature flags found." />
      ) : (
        result.data.items.map((item) => (
          <div key={item.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  <code>{item.code}</code> · enabled={String(item.is_enabled)} · v
                  {item.version}
                </p>
              </div>
              <ActiveBadge active={item.is_active} />
            </div>
            <AdminUpsertForm
              title={`Edit ${item.code}`}
              initial={item as unknown as Record<string, unknown>}
              fields={[
                { name: "code", label: "Code", type: "text" },
                { name: "name", label: "Name", type: "text" },
                { name: "description", label: "Description", type: "textarea" },
                { name: "is_enabled", label: "Enabled", type: "checkbox" },
                { name: "is_active", label: "Active", type: "checkbox" },
              ]}
              action={adminUpsertFeatureFlagAction}
            />
          </div>
        ))
      )}
    </div>
  );
}
