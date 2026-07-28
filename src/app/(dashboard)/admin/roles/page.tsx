import { APPLICATION_ROLES } from "@/lib/admin/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminRolesPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Application roles are system-defined (Postgres enum). Assign roles on the
        Users screen. Do not delete roles that have been applied to users or cases.
      </p>
      <div className="grid gap-3">
        {APPLICATION_ROLES.map((role) => (
          <Card key={role.role}>
            <CardHeader>
              <CardTitle className="text-base">{role.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <code className="text-xs">{role.role}</code>
              <p className="mt-2">{role.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
