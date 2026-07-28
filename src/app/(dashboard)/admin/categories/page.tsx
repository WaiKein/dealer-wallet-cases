import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { adminUpsertCategoryAction } from "@/lib/admin/actions";
import { listAdminCategories } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

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

  return (
    <div className="space-y-6">
      <AdminFilterBar q={params.q} active={params.active} />
      <AdminUpsertForm
        title="Create category"
        fields={[
          { name: "code", label: "Code", type: "text" },
          { name: "name", label: "Name", type: "text" },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        action={adminUpsertCategoryAction}
        submitLabel="Create category"
      />
      {result.data.items.length === 0 ? (
        <EmptyState message="No categories found." />
      ) : (
        result.data.items.map((item) => (
          <div key={item.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {item.name} <span className="text-muted-foreground">({item.code})</span>
              </p>
              <ActiveBadge active={item.is_active} />
            </div>
            <AdminUpsertForm
              title={`Edit ${item.name}`}
              initial={item as unknown as Record<string, unknown>}
              fields={[
                { name: "code", label: "Code", type: "text" },
                { name: "name", label: "Name", type: "text" },
                { name: "is_active", label: "Active", type: "checkbox" },
              ]}
              action={adminUpsertCategoryAction}
            />
          </div>
        ))
      )}
    </div>
  );
}
