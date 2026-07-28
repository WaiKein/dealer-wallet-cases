import {
  listAdminNotificationTemplates,
  upsertAdminNotificationTemplate,
} from "@/lib/admin/config";
import { adminListRoute, adminUpsertRoute } from "@/lib/api/admin-routes";

export const GET = adminListRoute((profile, paging) =>
  listAdminNotificationTemplates(profile, paging)
);

export const POST = adminUpsertRoute((profile, body) =>
  upsertAdminNotificationTemplate(profile, body)
);
