import {
  ActiveBadge,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { upsertApprovalDelegationAction } from "@/lib/approvals/actions";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DelegationsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "approver") {
    redirect("/dashboard");
  }
  if (!profile.organization_id) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  let query = supabase
    .from("approval_delegations")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });
  if (profile.role !== "admin") {
    query = query.or(
      `delegator_id.eq.${profile.id},delegate_id.eq.${profile.id}`
    );
  }
  const { data: items, error } = await query;
  if (error) {
    return <p className="text-destructive">{error.message}</p>;
  }

  const { data: orgUsers } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", profile.organization_id)
    .neq("id", profile.id)
    .order("full_name");

  const userOptions = (orgUsers ?? []).map((user) => ({
    value: user.id,
    label: `${user.full_name} <${user.email}>`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approval delegations</h1>
        <p className="text-sm text-muted-foreground">
          Time-bounded approval delegation. Limits cannot exceed your authority.
        </p>
      </div>
      <AdminUpsertForm
        title="Create delegation"
        fields={[
          {
            name: "delegate_id",
            label: "Delegate",
            type: "select",
            options: userOptions,
          },
          {
            name: "approval_limit",
            label: "Approval limit (optional)",
            type: "number",
          },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        action={upsertApprovalDelegationAction}
        submitLabel="Create delegation"
      />
      {(items ?? []).length === 0 ? (
        <EmptyState message="No delegations found." />
      ) : (
        (items ?? []).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div>
              <p className="font-medium text-sm">
                {item.delegator_id.slice(0, 8)} → {item.delegate_id.slice(0, 8)}
              </p>
              <p className="text-xs text-muted-foreground">
                limit {item.approval_limit ?? "unlimited"} · v{item.version}
              </p>
            </div>
            <ActiveBadge active={item.is_active} />
          </div>
        ))
      )}
    </div>
  );
}
