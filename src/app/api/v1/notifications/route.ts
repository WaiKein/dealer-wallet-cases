import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import {
  countUnreadNotifications,
  listNotificationsForUser,
} from "@/lib/notifications/service";

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    const [list, unread] = await Promise.all([
      listNotificationsForUser(profile.id, 50),
      countUnreadNotifications(profile.id),
    ]);

    if (list.error) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: list.error,
      });
    }

    return jsonOk({
      notifications: list.data,
      unreadCount: unread.count,
    });
  });
}
