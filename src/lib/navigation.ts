import type { UserRole } from "@/types";
import {
  canAccessAdminConsole,
  canAccessAgentWorkspace,
  canAccessExceptionQueues,
  canAccessManagementDashboard,
  canCreateCase,
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

  if (canAccessManagementDashboard(role)) {
    items.push({
      href: "/dashboard/management",
      label: "Analytics",
      icon: LineChart,
      match: "prefix",
    });
  }

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
      mobilePrimary: true,
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

export function getMobileNavItems(role: UserRole): NavItem[] {
  const primary = getPrimaryNavItems(role).filter((item) => item.mobilePrimary);
  if (canCreateCase(role) && !primary.some((item) => item.href === "/cases/new")) {
    // New case stays reachable from Cases; keep five highest-use areas.
  }
  return primary.slice(0, 5);
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
