"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/cases/collaboration";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/types";

interface NotificationBellProps {
  unreadCount: number;
  notifications: Notification[];
}

export function NotificationBell({
  unreadCount,
  notifications,
}: NotificationBellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function markOne(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
        Notifications
        {unreadCount > 0 && (
          <span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Inbox</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending || unreadCount === 0}
            onClick={markAll}
          >
            Mark all read
          </Button>
        </div>
        <ul className="max-h-80 overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              No notifications yet.
            </li>
          ) : (
            notifications.map((notification) => (
              <li key={notification.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {notification.case_id ? (
                      <Link
                        href={`/cases/${notification.case_id}`}
                        className="text-sm font-medium hover:underline"
                        onClick={() => {
                          if (!notification.read_at) {
                            markOne(notification.id);
                          }
                        }}
                      >
                        {notification.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{notification.title}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {notification.body}
                    </p>
                  </div>
                  {!notification.read_at && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => markOne(notification.id)}
                    >
                      Read
                    </Button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </details>
  );
}
