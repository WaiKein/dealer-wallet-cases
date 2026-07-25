import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { canAccessAgentWorkspace } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { listAssignmentGroups } from "@/lib/cases/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ROLE_LABELS } from "@/lib/auth/roles";

export default async function AssignmentGroupsPage() {
  const profile = await requireProfile();
  if (!canAccessAgentWorkspace(profile.role) || !profile.organization_id) {
    redirect("/cases");
  }

  const { data: groups, error } = await listAssignmentGroups(
    profile.organization_id
  );

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, lead_authorization_mode")
    .eq("id", profile.organization_id)
    .single();

  if (error) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTitle>Unable to load assignment groups</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Assignment groups</h1>
        <p className="text-muted-foreground">
          Groups that own case queues. Lead authorization mode:{" "}
          <span className="font-medium">
            {org?.lead_authorization_mode ?? "both"}
          </span>
          .
        </p>
      </div>

      <div className="grid gap-4">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{group.name}</CardTitle>
                  <CardDescription>
                    {group.code}
                    {group.description ? ` · ${group.description}` : ""}
                  </CardDescription>
                </div>
                <Badge variant={group.is_active ? "secondary" : "outline"}>
                  {group.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {group.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {group.members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {member.profile?.full_name ?? member.user_id}
                        </p>
                        <p className="text-muted-foreground">
                          {member.profile
                            ? ROLE_LABELS[member.profile.role]
                            : "Unknown role"}
                        </p>
                      </div>
                      {member.is_lead && <Badge>Group lead</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
