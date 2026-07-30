import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { adminUpsertAssignmentRuleAction } from "@/lib/admin/actions";
import {
  listAdminAssignmentRules,
  listAdminCategories,
  listAdminSubcategories,
  listAdminTeams,
} from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminAssignmentRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ active?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const [result, teams, categories, subcategories] = await Promise.all([
    listAdminAssignmentRules(profile, {
      active: (params.active as "all" | "active" | "inactive") ?? "all",
    }),
    listAdminTeams(profile, { active: "active", pageSize: 100 }),
    listAdminCategories(profile, { active: "active", pageSize: 100 }),
    listAdminSubcategories(profile, { active: "active", pageSize: 100 }),
  ]);
  if (!result.success || !result.data) {
    return <p className="text-destructive">{result.error}</p>;
  }

  const fields = [
    { name: "sequence", label: "Sequence", type: "number" as const },
    {
      name: "category_id",
      label: "Category (optional)",
      type: "select" as const,
      options:
        categories.data?.items.map((item) => ({
          value: item.id,
          label: item.name,
        })) ?? [],
    },
    {
      name: "subcategory_id",
      label: "Subcategory (optional)",
      type: "select" as const,
      options:
        subcategories.data?.items.map((item) => ({
          value: item.id,
          label: item.name,
        })) ?? [],
    },
    {
      name: "priority",
      label: "Priority (optional)",
      type: "select" as const,
      options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "critical", label: "Critical" },
      ],
    },
    {
      name: "assignment_group_id",
      label: "Team",
      type: "select" as const,
      options:
        teams.data?.items.map((item) => ({
          value: item.id,
          label: item.name,
        })) ?? [],
    },
    { name: "is_active", label: "Active", type: "checkbox" as const },
  ];

  return (
    <div className="space-y-6">
      <AdminFilterBar active={params.active} />
      <AdminUpsertForm
        title="Create assignment rule"
        fields={fields}
        action={adminUpsertAssignmentRuleAction}
        submitLabel="Create rule"
      />
      {result.data.items.length === 0 ? (
        <EmptyState message="No assignment rules found." />
      ) : (
        result.data.items.map((item) => (
          <div key={item.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">Sequence {item.sequence}</p>
                <p className="text-sm text-muted-foreground">
                  Team {item.assignment_group_id.slice(0, 8)} · v{item.version ?? 1}
                </p>
              </div>
              <ActiveBadge active={item.is_active} />
            </div>
            <AdminUpsertForm
              title={`Edit rule · sequence ${item.sequence}`}
              initial={item as unknown as Record<string, unknown>}
              fields={fields}
              action={adminUpsertAssignmentRuleAction}
              submitLabel="Save rule"
            />
          </div>
        ))
      )}
    </div>
  );
}
