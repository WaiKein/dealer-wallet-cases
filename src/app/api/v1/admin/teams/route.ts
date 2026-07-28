import { listAdminTeams, upsertAdminTeam } from "@/lib/admin/config";
import { adminListRoute, adminUpsertRoute } from "@/lib/api/admin-routes";

export const GET = adminListRoute((profile, paging) =>
  listAdminTeams(profile, paging)
);

export const POST = adminUpsertRoute((profile, body) =>
  upsertAdminTeam(profile, body)
);
