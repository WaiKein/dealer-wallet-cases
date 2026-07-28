import {
  listAdminApprovalRules,
  upsertAdminApprovalRule,
} from "@/lib/admin/config";
import { adminListRoute, adminUpsertRoute } from "@/lib/api/admin-routes";

export const GET = adminListRoute((profile, paging) =>
  listAdminApprovalRules(profile, paging)
);

export const POST = adminUpsertRoute((profile, body) =>
  upsertAdminApprovalRule(profile, body)
);
