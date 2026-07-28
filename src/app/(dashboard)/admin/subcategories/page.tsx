import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
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

  return (
    <div className="space-y-6">
      <AdminFilterBar q={params.q} active={params.active} />
      <AdminUpsertForm
        title="Create subcategory"
        fields={[
          { name: "category_id", label: "Category", type: "select", options: categoryOptions },
          { name: "code", label: "Code", type: "text" },
          { name: "name", label: "Name", type: "text" },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        action={adminUpsertSubcategoryAction}
        submitLabel="Create subcategory"
      />
      {result.data.items.length === 0 ? (
        <EmptyState message="No subcategories found." />
      ) : (
        result.data.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">
                {item.name} <span className="text-muted-foreground">({item.code})</span>
              </p>
              <p className="text-xs text-muted-foreground">v{item.version ?? 1}</p>
            </div>
            <ActiveBadge active={item.is_active} />
          </div>
        ))
      )}
    </div>
  );
}
