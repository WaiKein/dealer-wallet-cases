import { AppShell } from "@/components/layout/app-shell";
import { requireProfile } from "@/lib/auth/session";
import {
  countUnreadNotifications,
  listNotificationsForUser,
} from "@/lib/notifications/service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const unread = await countUnreadNotifications(profile.id);
  const notifications = await listNotificationsForUser(profile.id, 15);

  return (
    <AppShell
      profile={profile}
      unreadCount={unread.count}
      notifications={notifications.data}
    >
      {children}
    </AppShell>
  );
}
