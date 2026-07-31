import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { AdminEditorPanel } from "@/components/admin/admin-editor-panel";
import { PageHeader } from "@/components/layout/page-header";
import { adminUpsertCategoryAction } from "@/lib/admin/actions";
import { listAdminCategories } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

const fields = [
  { name: "code", label: "Code", type: "text" as const },
  { name: "name", label: "Name", type: "text" as const },
  { name: "is_active", label: "Active", type: "checkbox" as const },
];

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const result = await listAdminCategories(profile, {
    q: params.q,
    active: (params.active as "all" | "active" | "inactive") ?? "all",
  });
  if (!result.success || !result.data) {
    return <p className="text-destructive">{result.error}</p>;
  }

  const activeCount = result.data.items.filter((item) => item.is_active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflow configuration"
        title="Categories"
        description={`${result.data.items.length} values · ${activeCount} active`}
      />
      <AdminFilterBar q={params.q} active={params.active} />
      <AdminEditorPanel title="Create category" triggerLabel="New category">
        <AdminUpsertForm
          title="Create category"
          fields={fields}
          action={adminUpsertCategoryAction}
          submitLabel="Create category"
        />
      </AdminEditorPanel>
      {result.data.items.length === 0 ? (
        <EmptyState message="No categories found." />
      ) : (
        <div className="space-y-3">
          {result.data.items.map((item) => (
            <div key={item.id} className="ops-panel space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {item.name}{" "}
                    <span className="text-muted-foreground">({item.code})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    v{item.version ?? 1}
                  </p>
                </div>
                <ActiveBadge active={item.is_active} />
              </div>
              <details className="rounded-md border bg-muted/20 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Edit {item.name}
                </summary>
                <div className="mt-3">
                  <AdminUpsertForm
                    title={`Edit ${item.name}`}
                    initial={item as unknown as Record<string, unknown>}
                    fields={fields}
                    action={adminUpsertCategoryAction}
                    submitLabel="Save category"
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
