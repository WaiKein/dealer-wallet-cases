import { APPLICATION_ROLES } from "@/lib/admin/config";
import { PageHeader } from "@/components/layout/page-header";

export default function AdminRolesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People & access"
        title="Roles"
        description="System-defined application roles (Postgres enum)"
      />
      <p className="text-sm text-muted-foreground">
        Assign roles on the Users screen. Do not delete roles that have been
        applied to users or cases.
      </p>
      <div className="grid gap-3">
        {APPLICATION_ROLES.map((role) => (
          <div key={role.role} className="ops-panel p-4">
            <p className="font-medium">{role.label}</p>
            <code className="text-xs text-muted-foreground">{role.role}</code>
            <p className="mt-2 text-sm text-muted-foreground">
              {role.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
