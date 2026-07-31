import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { AdminEditorPanel } from "@/components/admin/admin-editor-panel";
import { PageBreadcrumb, PageHeader } from "@/components/layout/page-header";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/ui/data-table";
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
  searchParams: Promise<{ q?: string; active?: string; edit?: string }>;
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
  const editing = params.edit
    ? result.data.items.find((item) => item.id === params.edit)
    : undefined;

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { href: "/admin", label: "Administration" },
          { label: "Categories" },
        ]}
      />
      <PageHeader
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
        <DataTable headers={["Code / name", "Status", "Version", "Updated"]}>
          {result.data.items.map((item) => (
            <DataTableRow key={item.id}>
              <DataTableCell primary>
                <a
                  href={`/admin/categories?edit=${item.id}${
                    params.q ? `&q=${encodeURIComponent(params.q)}` : ""
                  }${params.active ? `&active=${params.active}` : ""}`}
                  className="hover:underline"
                >
                  {item.code}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {item.name}
                  </span>
                </a>
              </DataTableCell>
              <DataTableCell>
                <ActiveBadge active={item.is_active} />
              </DataTableCell>
              <DataTableCell>v{item.version ?? 1}</DataTableCell>
              <DataTableCell>
                {item.updated_at
                  ? new Date(item.updated_at).toLocaleDateString()
                  : "—"}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      {editing ? (
        <div className="ops-panel space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Edit {editing.name}</h2>
            <a
              href="/admin/categories"
              className="text-sm text-muted-foreground hover:underline"
            >
              Close
            </a>
          </div>
          <AdminUpsertForm
            title={`Edit ${editing.name}`}
            initial={editing as unknown as Record<string, unknown>}
            fields={fields}
            action={adminUpsertCategoryAction}
            submitLabel="Save category"
          />
        </div>
      ) : null}
    </div>
  );
}
