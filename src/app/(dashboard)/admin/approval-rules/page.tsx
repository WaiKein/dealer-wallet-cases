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

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Approval rules are managed here. Runtime matching and maker-checker
        enforcement arrive in Phase 2.
      </p>
      <AdminFilterBar q={params.q} active={params.active} />
      <AdminUpsertForm
        title="Create approval rule"
        fields={[
          { name: "code", label: "Code", type: "text" },
          { name: "name", label: "Name", type: "text" },
          { name: "sequence", label: "Sequence", type: "number" },
          { name: "min_amount", label: "Min amount", type: "number" },
          { name: "max_amount", label: "Max amount", type: "number" },
          {
            name: "required_approver_role",
            label: "Required approver role",
            type: "select",
            options: roleOptions,
          },
          { name: "approval_levels", label: "Approval levels", type: "number" },
          { name: "sequential_required", label: "Sequential required", type: "checkbox" },
          { name: "approver_limit", label: "Approver limit", type: "number" },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        action={adminUpsertApprovalRuleAction}
        submitLabel="Create approval rule"
      />
      {result.data.items.length === 0 ? (
        <EmptyState message="No approval rules found." />
      ) : (
        result.data.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">
                {item.name} <span className="text-muted-foreground">({item.code})</span>
              </p>
              <p className="text-sm text-muted-foreground">
                seq {item.sequence} · levels {item.approval_levels} · v{item.version}
              </p>
            </div>
            <ActiveBadge active={item.is_active} />
          </div>
        ))
      )}
    </div>
  );
}
