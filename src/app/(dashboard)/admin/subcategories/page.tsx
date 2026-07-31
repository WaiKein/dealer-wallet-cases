import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { AdminEditorPanel } from "@/components/admin/admin-editor-panel";
import { PageHeader } from "@/components/layout/page-header";
import { adminUpsertSubcategoryAction } from "@/lib/admin/actions";
import { listAdminCategories, listAdminSubcategories } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminSubcategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const [result, categories] = await Promise.all([
    listAdminSubcategories(profile, {
      q: params.q,
      active: (params.active as "all" | "active" | "inactive") ?? "all",
    }),
    listAdminCategories(profile, { active: "active", pageSize: 100 }),
  ]);
  if (!result.success || !result.data) {
    return <p className="text-destructive">{result.error}</p>;
  }
  const categoryOptions =
    categories.data?.items.map((item) => ({
      value: item.id,
      label: `${item.name} (${item.code})`,
    })) ?? [];

  const fields = [
    {
      name: "category_id",
      label: "Category",
      type: "select" as const,
      options: categoryOptions,
    },
    { name: "code", label: "Code", type: "text" as const },
    { name: "name", label: "Name", type: "text" as const },
    { name: "is_active", label: "Active", type: "checkbox" as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflow configuration"
        title="Subcategories"
        description={`${result.data.items.length} values · nested under categories`}
      />
      <AdminFilterBar q={params.q} active={params.active} />
      <AdminEditorPanel title="Create subcategory" triggerLabel="New subcategory">
        <AdminUpsertForm
          title="Create subcategory"
          fields={fields}
          action={adminUpsertSubcategoryAction}
          submitLabel="Create subcategory"
        />
      </AdminEditorPanel>
      {result.data.items.length === 0 ? (
        <EmptyState message="No subcategories found." />
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
                    action={adminUpsertSubcategoryAction}
                    submitLabel="Save subcategory"
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
