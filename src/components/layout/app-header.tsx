import { NotificationBell } from "@/components/layout/notification-bell";
import { signOut } from "@/lib/auth/actions";
import { getCurrentProfile } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import {
  canAccessAdminConsole,
  canAccessAgentWorkspace,
  canAccessExceptionQueues,
  canAccessManagementDashboard,
} from "@/lib/auth/permissions";
import { isTestControlEnabled } from "@/lib/clock";
import {
  countUnreadNotifications,
  listNotificationsForUser,
} from "@/lib/notifications/service";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export async function AppHeader() {
  const profile = await getCurrentProfile();
  const unread = profile
    ? await countUnreadNotifications(profile.id)
    : { count: 0 };
  const notifications = profile
    ? await listNotificationsForUser(profile.id, 15)
    : { data: [] };

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-semibold">
            Case Management
          </Link>
          <nav className="hidden gap-4 text-sm md:flex">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            {profile && canAccessManagementDashboard(profile.role) && (
              <Link
                href="/dashboard/management"
                className="text-muted-foreground hover:text-foreground"
              >
                Management
              </Link>
            )}
            <Link href="/cases" className="text-muted-foreground hover:text-foreground">
              Cases
            </Link>
            {profile && canAccessAgentWorkspace(profile.role) && (
              <Link
                href="/workspace"
                className="text-muted-foreground hover:text-foreground"
              >
                Workspace
              </Link>
            )}
            {profile && canAccessExceptionQueues(profile.role) && (
              <Link
                href="/operations/exceptions"
                className="text-muted-foreground hover:text-foreground"
              >
                Exceptions
              </Link>
            )}
            {profile && canAccessAgentWorkspace(profile.role) && (
              <Link
                href="/assignment-groups"
                className="text-muted-foreground hover:text-foreground"
              >
                Assignment groups
              </Link>
            )}
            {profile && canAccessAdminConsole(profile.role) && (
              <Link
                href="/admin"
                className="text-muted-foreground hover:text-foreground"
              >
                Admin
              </Link>
            )}
            {profile &&
              (profile.role === "approver" || profile.role === "admin") && (
              <Link
                href="/delegations"
                className="text-muted-foreground hover:text-foreground"
              >
                Delegations
              </Link>
            )}
            {profile?.role === "requester" && (
              <Link
                href="/cases/new"
                className="text-muted-foreground hover:text-foreground"
              >
                New Case
              </Link>
            )}
            {isTestControlEnabled() && (
              <Link
                href="/simulator"
                className="text-muted-foreground hover:text-foreground"
              >
                Simulator
              </Link>
            )}
          </nav>
        </div>

        {profile && (
          <div className="flex items-center gap-3">
            <NotificationBell
              unreadCount={unread.count}
              notifications={notifications.data}
            />
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium">{profile.full_name}</p>
              <p className="text-muted-foreground">
                {ROLE_LABELS[profile.role]}
              </p>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
