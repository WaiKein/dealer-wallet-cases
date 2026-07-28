import {
  listAdminAssignmentRules,
  upsertAdminAssignmentRule,
} from "@/lib/admin/config";
import { adminListRoute, adminUpsertRoute } from "@/lib/api/admin-routes";

export const GET = adminListRoute((profile, paging) =>
  listAdminAssignmentRules(profile, paging)
);

export const POST = adminUpsertRoute((profile, body) =>
  upsertAdminAssignmentRule(profile, body)
);
