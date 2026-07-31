import { NotificationBell } from "@/components/layout/notification-bell";
import { AppSidebar, MobileBottomNav } from "@/components/layout/app-navigation";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import type { Notification, Profile } from "@/types";
import { FolderKanban } from "lucide-react";
import Link from "next/link";

export function AppShell({
  profile,
  unreadCount,
  notifications,
  children,
}: {
  profile: Profile;
  unreadCount: number;
  notifications: Notification[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 lg:hidden"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <FolderKanban className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm font-semibold">CaseOps</span>
            </Link>
            <div className="hidden min-w-0 flex-1 md:block">
              <label className="sr-only" htmlFor="global-search">
                Search cases or commands
              </label>
              <input
                id="global-search"
                type="search"
                placeholder="Search cases or commands..."
                className="h-9 w-full max-w-xl rounded-full border bg-background px-4 text-sm"
                disabled
                title="Global search arrives with the cases command toolbar"
              />
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <span className="hidden rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
                My organisation
              </span>
              <NotificationBell
                unreadCount={unreadCount}
                notifications={notifications}
              />
              <div className="hidden text-right text-sm sm:block">
                <p className="font-medium leading-tight">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABELS[profile.role]}
                </p>
              </div>
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 pb-24 lg:px-6 lg:pb-8">
          {children}
        </main>
        <MobileBottomNav role={profile.role} />
      </div>
    </div>
  );
}
