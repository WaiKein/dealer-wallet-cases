import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { adminUpsertApprovalRuleAction } from "@/lib/admin/actions";
import { listAdminApprovalRules } from "@/lib/admin/config";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminApprovalRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const result = await listAdminApprovalRules(profile, {
    q: params.q,
    active: (params.active as "all" | "active" | "inactive") ?? "all",
  });
  if (!result.success || !result.data) {
    return <p className="text-destructive">{result.error}</p>;
  }

  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const fields = [
    { name: "code", label: "Code", type: "text" as const },
    { name: "name", label: "Name", type: "text" as const },
    { name: "sequence", label: "Sequence", type: "number" as const },
    { name: "min_amount", label: "Min amount", type: "number" as const },
    { name: "max_amount", label: "Max amount", type: "number" as const },
    {
      name: "required_approver_role",
      label: "Required approver role",
      type: "select" as const,
      options: roleOptions,
    },
    { name: "approval_levels", label: "Approval levels", type: "number" as const },
    {
      name: "sequential_required",
      label: "Sequential required",
      type: "checkbox" as const,
    },
    { name: "approver_limit", label: "Approver limit", type: "number" as const },
    { name: "is_active", label: "Active", type: "checkbox" as const },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Approval rules are managed here. Runtime matching and maker-checker
        enforcement arrive in Phase 2.
      </p>
      <AdminFilterBar q={params.q} active={params.active} />
      <AdminUpsertForm
        title="Create approval rule"
        fields={fields}
        action={adminUpsertApprovalRuleAction}
        submitLabel="Create approval rule"
      />
      {result.data.items.length === 0 ? (
        <EmptyState message="No approval rules found." />
      ) : (
        result.data.items.map((item) => (
          <div key={item.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {item.name}{" "}
                  <span className="text-muted-foreground">({item.code})</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  seq {item.sequence} · levels {item.approval_levels} · v
                  {item.version}
                </p>
              </div>
              <ActiveBadge active={item.is_active} />
            </div>
            <AdminUpsertForm
              title={`Edit ${item.name}`}
              initial={item as unknown as Record<string, unknown>}
              fields={fields}
              action={adminUpsertApprovalRuleAction}
              submitLabel="Save approval rule"
            />
          </div>
        ))
      )}
    </div>
  );
}
