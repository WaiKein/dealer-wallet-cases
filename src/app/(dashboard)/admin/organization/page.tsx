import {
  AdminUpsertForm,
  ConfigHistoryPanel,
} from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/layout/page-header";
import { adminUpdateOrganizationAction } from "@/lib/admin/actions";
import {
  getAdminOrganization,
  listConfigurationHistory,
} from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminOrganizationPage() {
  const profile = await requireAdmin();
  const result = await getAdminOrganization(profile);
  if (!result.success || !result.data) {
    return <p className="text-destructive">{result.error}</p>;
  }
  const org = result.data.organization;
  const history = await listConfigurationHistory(profile, "organization", org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation"
        title="Organisation settings"
        description="Tenant identity and lead authorization mode"
      />
      <div className="ops-panel p-4">
        <AdminUpsertForm
          title="Edit organisation"
          initial={org as unknown as Record<string, unknown>}
          fields={[
            { name: "name", label: "Name", type: "text" },
            {
              name: "lead_authorization_mode",
              label: "Lead authorization mode",
              type: "select",
              options: [
                { value: "role", label: "Role" },
                { value: "membership", label: "Membership" },
                { value: "both", label: "Both" },
              ],
            },
            { name: "is_active", label: "Active", type: "checkbox" },
          ]}
          action={adminUpdateOrganizationAction}
        />
      </div>
      <ConfigHistoryPanel entries={history.data?.items ?? []} />
    </div>
  );
}
