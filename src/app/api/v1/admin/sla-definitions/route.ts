import {
  listAdminSlaDefinitions,
  upsertAdminSlaDefinition,
} from "@/lib/admin/config";
import { adminListRoute, adminUpsertRoute } from "@/lib/api/admin-routes";

export const GET = adminListRoute((profile, paging) =>
  listAdminSlaDefinitions(profile, paging)
);

export const POST = adminUpsertRoute((profile, body) =>
  upsertAdminSlaDefinition(profile, body)
);
