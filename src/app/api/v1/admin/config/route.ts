import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { canAccessAdminConsole } from "@/lib/auth/permissions";
import {
  listAdminApprovalRules,
  listAdminAssignmentRules,
  listAdminCategories,
  listAdminFeatureFlags,
  listAdminNotificationTemplates,
  listAdminProfiles,
  listAdminSlaDefinitions,
  listAdminSubcategories,
  listAdminTeamMemberships,
  listAdminTeams,
  updateAdminOrganization,
  updateAdminProfile,
  upsertAdminApprovalRule,
  upsertAdminAssignmentRule,
  upsertAdminCategory,
  upsertAdminFeatureFlag,
  upsertAdminNotificationTemplate,
  upsertAdminSlaDefinition,
  upsertAdminSubcategory,
  upsertAdminTeam,
  upsertAdminTeamMembership,
  getAdminOrganization,
} from "@/lib/admin/config";

function forbidUnlessAdmin(role: string) {
  if (!canAccessAdminConsole(role as never)) {
    return apiError({ code: "FORBIDDEN", message: "Administrator access is required." });
  }
  return null;
}

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    const denied = forbidUnlessAdmin(profile.role);
    if (denied) return denied;

    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "organization";
    const q = url.searchParams.get("q") ?? undefined;
    const active = (url.searchParams.get("active") as "all" | "active" | "inactive") ?? "all";
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    const paging = { q, active, page, pageSize };

    switch (resource) {
      case "organization": {
        const result = await getAdminOrganization(profile);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      case "users": {
        const result = await listAdminProfiles(profile, paging);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      case "teams": {
        const result = await listAdminTeams(profile, paging);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      case "team-memberships": {
        const result = await listAdminTeamMemberships(profile, paging);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      case "categories": {
        const result = await listAdminCategories(profile, paging);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      case "subcategories": {
        const result = await listAdminSubcategories(profile, paging);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      case "assignment-rules": {
        const result = await listAdminAssignmentRules(profile, paging);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      case "sla-definitions": {
        const result = await listAdminSlaDefinitions(profile, paging);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      case "approval-rules": {
        const result = await listAdminApprovalRules(profile, paging);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      case "notification-templates": {
        const result = await listAdminNotificationTemplates(profile, paging);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      case "feature-flags": {
        const result = await listAdminFeatureFlags(profile, paging);
        if (!result.success) {
          return apiError({
            code: (result.code as never) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to load.",
          });
        }
        return jsonOk(result.data);
      }
      default:
        return apiError({ code: "VALIDATION_ERROR", message: "Unknown admin resource." });
    }
  });
}

export async function POST(request: Request) {
  return withActor(request, async ({ profile }) => {
    const denied = forbidUnlessAdmin(profile.role);
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const resource = body?.resource as string | undefined;
    const payload = body?.payload ?? body;

    let result;
    switch (resource) {
      case "organization":
        result = await updateAdminOrganization(profile, payload);
        break;
      case "users":
        result = await updateAdminProfile(profile, payload);
        break;
      case "teams":
        result = await upsertAdminTeam(profile, payload);
        break;
      case "team-memberships":
        result = await upsertAdminTeamMembership(profile, payload);
        break;
      case "categories":
        result = await upsertAdminCategory(profile, payload);
        break;
      case "subcategories":
        result = await upsertAdminSubcategory(profile, payload);
        break;
      case "assignment-rules":
        result = await upsertAdminAssignmentRule(profile, payload);
        break;
      case "sla-definitions":
        result = await upsertAdminSlaDefinition(profile, payload);
        break;
      case "approval-rules":
        result = await upsertAdminApprovalRule(profile, payload);
        break;
      case "notification-templates":
        result = await upsertAdminNotificationTemplate(profile, payload);
        break;
      case "feature-flags":
        result = await upsertAdminFeatureFlag(profile, payload);
        break;
      default:
        return apiError({ code: "VALIDATION_ERROR", message: "Unknown admin resource." });
    }

    if (!result.success) {
      return apiError({
        code: (result.code as never) ?? "VALIDATION_ERROR",
        message: result.error ?? "Admin update failed.",
        details: "details" in result ? result.details : undefined,
      });
    }
    return jsonOk(result.data);
  });
}
