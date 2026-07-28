import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/organization", label: "Organisation" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/team-memberships", label: "Memberships" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/subcategories", label: "Subcategories" },
  { href: "/admin/assignment-rules", label: "Assignment rules" },
  { href: "/admin/sla-definitions", label: "SLA definitions" },
  { href: "/admin/approval-rules", label: "Approval rules" },
  { href: "/admin/delegations", label: "Delegations" },
  { href: "/admin/notification-templates", label: "Notification templates" },
  { href: "/admin/feature-flags", label: "Feature flags" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="text-muted-foreground">
          Organisation-scoped configuration. Changes are versioned and audited.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1 rounded-lg border bg-card p-3 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
