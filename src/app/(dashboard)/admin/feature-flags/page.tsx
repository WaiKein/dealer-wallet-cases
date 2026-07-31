import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { AdminEditorPanel } from "@/components/admin/admin-editor-panel";
import { PageHeader } from "@/components/layout/page-header";
import { adminUpsertFeatureFlagAction } from "@/lib/admin/actions";
import { listAdminFeatureFlags } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

const fields = [
  { name: "code", label: "Code", type: "text" as const },
  { name: "name", label: "Name", type: "text" as const },
  { name: "description", label: "Description", type: "textarea" as const },
  { name: "is_enabled", label: "Enabled", type: "checkbox" as const },
  { name: "is_active", label: "Active", type: "checkbox" as const },
];

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
      <PageHeader
        eyebrow="Communication & control"
        title="Feature flags"
        description={`${result.data.items.length} flags · guarded rollout`}
      />
      <AdminFilterBar q={params.q} active={params.active} />
      <AdminEditorPanel title="Create feature flag" triggerLabel="New flag">
        <AdminUpsertForm
          title="Create feature flag"
          fields={fields}
          action={adminUpsertFeatureFlagAction}
          submitLabel="Create flag"
        />
      </AdminEditorPanel>
      {result.data.items.length === 0 ? (
        <EmptyState message="No feature flags found." />
      ) : (
        <div className="space-y-3">
          {result.data.items.map((item) => (
            <div key={item.id} className="ops-panel space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    <code>{item.code}</code> · enabled=
                    {String(item.is_enabled)} · v{item.version}
                  </p>
                </div>
                <ActiveBadge active={item.is_active} />
              </div>
              <details className="rounded-md border bg-muted/20 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Edit {item.code}
                </summary>
                <div className="mt-3">
                  <AdminUpsertForm
                    title={`Edit ${item.code}`}
                    initial={item as unknown as Record<string, unknown>}
                    fields={fields}
                    action={adminUpsertFeatureFlagAction}
                    submitLabel="Save flag"
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
