"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getMobileMoreItems,
  getMobilePrimaryItems,
  getPrimaryNavItems,
  isNavActive,
  type NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { FolderKanban, MoreHorizontal, X } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";

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

function MobileNavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isNavActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-medium",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function MobileBottomNav({
  role,
  fullName,
}: {
  role: UserRole;
  fullName: string;
}) {
  const pathname = usePathname();
  const primary = getMobilePrimaryItems(role);
  const moreItems = getMobileMoreItems(role);
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive =
    moreItems.some((item) => isNavActive(pathname, item)) || moreOpen;

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-16 z-50 mx-auto max-w-lg rounded-t-xl border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABELS[role]}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ul className="space-y-1">
              {moreItems.map((item) => {
                const active = isNavActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <form action={signOut} className="mt-3 border-t pt-3">
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden"
        aria-label="Mobile primary"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-2">
          {primary.map((item) => (
            <li key={item.href}>
              <MobileNavLink item={item} pathname={pathname} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((value) => !value)}
              className={cn(
                "flex w-full flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-medium",
                moreActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
