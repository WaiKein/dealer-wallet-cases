import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";

const GROUPS = [
  {
    title: "People & access",
    items: [
      { href: "/admin/users", title: "Users", body: "Accounts and status" },
      { href: "/admin/roles", title: "Roles", body: "Permissions catalogue" },
      { href: "/admin/teams", title: "Teams", body: "Membership and routing" },
      {
        href: "/admin/team-memberships",
        title: "Memberships",
        body: "Members and lead flags",
      },
      {
        href: "/admin/organization",
        title: "Organisation",
        body: "Name and lead mode",
      },
    ],
  },
  {
    title: "Workflow configuration",
    items: [
      {
        href: "/admin/categories",
        title: "Classification",
        body: "Categories and taxonomy",
      },
      {
        href: "/admin/subcategories",
        title: "Subcategories",
        body: "Category children",
      },
      {
        href: "/admin/assignment-rules",
        title: "Routing",
        body: "Assignment rules",
      },
      {
        href: "/admin/sla-definitions",
        title: "Service policy",
        body: "SLA definitions",
      },
      {
        href: "/admin/approval-rules",
        title: "Approval rules",
        body: "Levels and limits",
      },
    ],
  },
  {
    title: "Communication & control",
    items: [
      {
        href: "/admin/notification-templates",
        title: "Templates",
        body: "Notifications",
      },
      {
        href: "/admin/delegations",
        title: "Delegations",
        body: "Temporary coverage",
      },
      {
        href: "/admin/feature-flags",
        title: "Feature flags",
        body: "Controlled rollout",
      },
    ],
  },
] as const;

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();

  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q)
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        description="Searchable settings directory. Changes are versioned and audited."
      />

      <form method="get" className="ops-panel p-3">
        <label className="sr-only" htmlFor="admin-settings-search">
          Find a setting
        </label>
        <Input
          id="admin-settings-search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Find a setting, user, rule or template..."
        />
      </form>

      <div className="grid gap-6 lg:grid-cols-3">
        {groups.map((group) => (
          <section key={group.title} className="space-y-3">
            <h2 className="text-sm font-semibold">{group.title}</h2>
            <ul className="ops-panel divide-y overflow-hidden">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No settings matched.</p>
      ) : null}
    </div>
  );
}
