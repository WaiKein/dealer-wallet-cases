import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MODULES = [
  {
    href: "/admin/organization",
    title: "Organisation",
    body: "Name, lead authorization mode, active status.",
  },
  {
    href: "/admin/users",
    title: "Users",
    body: "Profiles, roles, and active flags within your organisation.",
  },
  {
    href: "/admin/roles",
    title: "Application roles",
    body: "Catalogue of system roles (enum-backed).",
  },
  {
    href: "/admin/teams",
    title: "Teams",
    body: "Assignment groups used for routing and ownership.",
  },
  {
    href: "/admin/team-memberships",
    title: "Team memberships",
    body: "Members and lead flags per team.",
  },
  {
    href: "/admin/categories",
    title: "Categories",
    body: "Case taxonomy categories.",
  },
  {
    href: "/admin/subcategories",
    title: "Subcategories",
    body: "Case taxonomy subcategories.",
  },
  {
    href: "/admin/assignment-rules",
    title: "Assignment rules",
    body: "Sequence-based routing to teams.",
  },
  {
    href: "/admin/sla-definitions",
    title: "SLA definitions",
    body: "First-response and resolution durations by priority.",
  },
  {
    href: "/admin/approval-rules",
    title: "Approval rules",
    body: "Configurable approval matrix (matching in Phase 2).",
  },
  {
    href: "/admin/notification-templates",
    title: "Notification templates",
    body: "Organisation-scoped message templates.",
  },
  {
    href: "/admin/feature-flags",
    title: "Feature flags",
    body: "Pilot toggles such as execution-before-resolve.",
  },
] as const;

export default function AdminHomePage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {MODULES.map((mod) => (
        <Link key={mod.href} href={mod.href}>
          <Card className="h-full transition hover:border-foreground/30">
            <CardHeader>
              <CardTitle className="text-base">{mod.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {mod.body}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
