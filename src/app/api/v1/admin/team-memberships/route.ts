import {
  listAdminTeamMemberships,
  upsertAdminTeamMembership,
} from "@/lib/admin/config";
import { adminListRoute, adminUpsertRoute } from "@/lib/api/admin-routes";

export const GET = adminListRoute((profile, paging) =>
  listAdminTeamMemberships(profile, paging)
);

export const POST = adminUpsertRoute((profile, body) =>
  upsertAdminTeamMembership(profile, body)
);
