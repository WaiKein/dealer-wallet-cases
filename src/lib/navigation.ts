import type { UserRole } from "@/types";
import {
  canAccessAdminConsole,
  canAccessAgentWorkspace,
  canAccessExceptionQueues,
  canAccessManagementDashboard,
} from "@/lib/auth/permissions";
import { isTestControlEnabled } from "@/lib/clock";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  ShieldAlert,
  Settings,
  Users,
  FlaskConical,
  KeyRound,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: "exact" | "prefix";
  /** Shown in the fixed mobile bottom bar (max 4 + More). */
  mobilePrimary?: boolean;
};

export function getPrimaryNavItems(role: UserRole): NavItem[] {
  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: "Overview",
      icon: LayoutDashboard,
      match: "exact",
      mobilePrimary: true,
    },
  ];

  items.push({
    href: "/cases",
    label: "Cases",
    icon: ClipboardList,
    match: "prefix",
    mobilePrimary: true,
  });

  if (canAccessAgentWorkspace(role)) {
    items.push({
      href: "/workspace",
      label: "Workspace",
      icon: Briefcase,
      match: "prefix",
      mobilePrimary: true,
    });
  }

  if (canAccessExceptionQueues(role)) {
    items.push({
      href: "/operations/exceptions",
      label: "Exceptions",
      icon: ShieldAlert,
      match: "prefix",
      mobilePrimary: true,
    });
  }

  if (canAccessManagementDashboard(role)) {
    items.push({
      href: "/dashboard/management",
      label: "Analytics",
      icon: LineChart,
      match: "prefix",
    });
  }

  if (canAccessAgentWorkspace(role)) {
    items.push({
      href: "/assignment-groups",
      label: "Teams",
      icon: Users,
      match: "prefix",
    });
  }

  if (role === "approver" || role === "admin") {
    items.push({
      href: "/delegations",
      label: "Delegations",
      icon: KeyRound,
      match: "prefix",
    });
  }

  if (canAccessAdminConsole(role)) {
    items.push({
      href: "/admin",
      label: "Admin",
      icon: Settings,
      match: "prefix",
    });
  }

  if (isTestControlEnabled()) {
    items.push({
      href: "/simulator",
      label: "Simulator",
      icon: FlaskConical,
      match: "prefix",
    });
  }

  return items;
}

/** Fixed bottom slots excluding More — prefer Overview | Cases | Workspace | Exceptions. */
export function getMobilePrimaryItems(role: UserRole): NavItem[] {
  const preferred = ["/dashboard", "/cases", "/workspace", "/operations/exceptions"];
  const all = getPrimaryNavItems(role);
  const primary = preferred
    .map((href) => all.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
  if (primary.length >= 4) return primary.slice(0, 4);
  // Fill remaining slots from other items if role lacks some preferred routes.
  for (const item of all) {
    if (primary.length >= 4) break;
    if (!primary.some((p) => p.href === item.href)) primary.push(item);
  }
  return primary.slice(0, 4);
}

export function getMobileMoreItems(role: UserRole): NavItem[] {
  const primaryHrefs = new Set(getMobilePrimaryItems(role).map((i) => i.href));
  return getPrimaryNavItems(role).filter((item) => !primaryHrefs.has(item.href));
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") {
    return pathname === item.href;
  }
  if (item.href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (item.href === "/cases") {
    return pathname === "/cases" || pathname.startsWith("/cases/");
  }
  if (item.href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
  }
  if (item.href === "/dashboard/management") {
    return pathname.startsWith("/dashboard/management");
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
