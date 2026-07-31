"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getMobileNavItems,
  getPrimaryNavItems,
  isNavActive,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { FolderKanban } from "lucide-react";

export function AppSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = getPrimaryNavItems(role);

  return (
    <aside className="hidden w-56 shrink-0 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <FolderKanban className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight">CaseOps</p>
          <p className="text-[10px] uppercase tracking-wide text-white/50">
            Operations
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
        {items.map((item) => {
          const active = isNavActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileBottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = getMobileNavItems(role);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden"
      aria-label="Mobile primary"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-2">
        {items.map((item) => {
          const active = isNavActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-medium",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
