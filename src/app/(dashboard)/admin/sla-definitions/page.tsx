import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { adminUpsertSlaDefinitionAction } from "@/lib/admin/actions";
import { listAdminSlaDefinitions } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminSlaDefinitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ active?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const result = await listAdminSlaDefinitions(profile, {
    active: (params.active as "all" | "active" | "inactive") ?? "all",
  });
  if (!result.success || !result.data) {
    return <p className="text-destructive">{result.error}</p>;
  }

  return (
    <div className="space-y-6">
      <AdminFilterBar active={params.active} />
      <AdminUpsertForm
        title="Create / update SLA definition"
        fields={[
          {
            name: "priority",
            label: "Priority",
            type: "select",
            options: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ],
          },
          {
            name: "sla_type",
            label: "SLA type",
            type: "select",
            options: [
              { value: "first_response", label: "First response" },
              { value: "resolution", label: "Resolution" },
            ],
          },
          { name: "duration_minutes", label: "Duration (minutes)", type: "number" },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        action={adminUpsertSlaDefinitionAction}
        submitLabel="Save SLA definition"
      />
      {result.data.items.length === 0 ? (
        <EmptyState message="No SLA definitions found." />
      ) : (
        result.data.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">
                {item.priority} · {item.sla_type}
              </p>
              <p className="text-sm text-muted-foreground">
                {item.duration_minutes} minutes · v{item.version ?? 1}
              </p>
            </div>
            <ActiveBadge active={item.is_active !== false} />
          </div>
        ))
      )}
    </div>
  );
}
