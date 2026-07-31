import {
  ActiveBadge,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { AdminEditorPanel } from "@/components/admin/admin-editor-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { upsertApprovalDelegationAction } from "@/lib/approvals/actions";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type DelegationBucket = "active" | "upcoming" | "expired";

function bucketFor(
  item: {
    is_active: boolean;
    effective_from?: string | null;
    effective_to?: string | null;
  },
  now: Date
): DelegationBucket {
  const from = item.effective_from ? new Date(item.effective_from) : null;
  const to = item.effective_to ? new Date(item.effective_to) : null;
  if (to && to.getTime() < now.getTime()) return "expired";
  if (from && from.getTime() > now.getTime()) return "upcoming";
  if (!item.is_active) return "expired";
  return "active";
}

const BUCKET_LABELS: Record<DelegationBucket, string> = {
  active: "Active",
  upcoming: "Upcoming",
  expired: "Expired",
};

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

  const usersById = new Map(
    (orgUsers ?? []).map((user) => [user.id, user] as const)
  );
  usersById.set(profile.id, {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
  });

  const userOptions = (orgUsers ?? []).map((user) => ({
    value: user.id,
    label: `${user.full_name} <${user.email}>`,
  }));

  const fields = [
    {
      name: "delegate_id",
      label: "Delegate",
      type: "select" as const,
      options: userOptions,
    },
    {
      name: "approval_limit",
      label: "Approval limit (optional)",
      type: "number" as const,
    },
    { name: "is_active", label: "Active", type: "checkbox" as const },
  ];

  function userLabel(id: string) {
    const user = usersById.get(id);
    return user ? `${user.full_name}` : id.slice(0, 8);
  }

  const now = new Date();
  const buckets: Record<DelegationBucket, typeof items> = {
    active: [],
    upcoming: [],
    expired: [],
  };
  for (const item of items ?? []) {
    buckets[bucketFor(item, now)].push(item);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title="Delegations"
        description="Time-bounded approval delegation. Limits cannot exceed your authority."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(BUCKET_LABELS) as DelegationBucket[]).map((key) => (
          <div key={key} className="ops-panel p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {BUCKET_LABELS[key]}
            </p>
            <p className="mt-2 text-3xl font-semibold">
              {buckets[key].length}
            </p>
          </div>
        ))}
      </div>

      <AdminEditorPanel title="Create delegation" triggerLabel="New delegation">
        <AdminUpsertForm
          title="Create delegation"
          fields={fields}
          action={upsertApprovalDelegationAction}
          submitLabel="Create delegation"
        />
      </AdminEditorPanel>

      {(items ?? []).length === 0 ? (
        <EmptyState message="No delegations found." />
      ) : (
        (Object.keys(BUCKET_LABELS) as DelegationBucket[]).map((key) =>
          buckets[key].length === 0 ? null : (
            <section key={key} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {BUCKET_LABELS[key]}
              </h2>
              <div className="space-y-3">
                {buckets[key].map((item) => (
                  <div key={item.id} className="ops-panel space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {userLabel(item.delegator_id)} →{" "}
                          {userLabel(item.delegate_id)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          limit {item.approval_limit ?? "unlimited"} · v
                          {item.version}
                          {item.effective_from
                            ? ` · from ${new Date(item.effective_from).toLocaleDateString()}`
                            : ""}
                          {item.effective_to
                            ? ` · to ${new Date(item.effective_to).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{BUCKET_LABELS[key]}</Badge>
                        <ActiveBadge active={item.is_active} />
                      </div>
                    </div>
                    {(profile.role === "admin" ||
                      item.delegator_id === profile.id) && (
                      <details className="rounded-md border bg-muted/20 p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          Edit delegation
                        </summary>
                        <div className="mt-3">
                          <AdminUpsertForm
                            title={`Edit delegation · ${userLabel(item.delegate_id)}`}
                            initial={
                              item as unknown as Record<string, unknown>
                            }
                            fields={fields}
                            action={upsertApprovalDelegationAction}
                            submitLabel="Save delegation"
                          />
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        )
      )}
    </div>
  );
}
