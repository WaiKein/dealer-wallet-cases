"use server";

import { revalidatePath } from "next/cache";
import {
  getAdminOrganization,
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
  listConfigurationHistory,
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
} from "@/lib/admin/config";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  actionFailure,
  actionSuccess,
  withServerActionCorrelation,
} from "@/lib/observability/server-action";
import type { ActionResult } from "@/types";

async function withAdmin<T>(
  fn: (profile: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>) => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }
    const result = await fn(profile);
    if (!result.success) {
      return actionFailure(result.error ?? "Request failed.", {
        code: result.code,
        details: result.details,
      });
    }
    return actionSuccess(result.data);
  });
}

function revalidateAdmin() {
  revalidatePath("/admin");
}

export async function adminUpdateOrganizationAction(input: unknown) {
  const result = await withAdmin((profile) => updateAdminOrganization(profile, input));
  if (result.success) revalidateAdmin();
  return result;
}

export async function adminUpdateProfileAction(input: unknown) {
  const result = await withAdmin((profile) => updateAdminProfile(profile, input));
  if (result.success) revalidateAdmin();
  return result;
}

export async function adminUpsertCategoryAction(input: unknown) {
  const result = await withAdmin((profile) => upsertAdminCategory(profile, input));
  if (result.success) revalidateAdmin();
  return result;
}

export async function adminUpsertSubcategoryAction(input: unknown) {
  const result = await withAdmin((profile) => upsertAdminSubcategory(profile, input));
  if (result.success) revalidateAdmin();
  return result;
}

export async function adminUpsertTeamAction(input: unknown) {
  const result = await withAdmin((profile) => upsertAdminTeam(profile, input));
  if (result.success) revalidateAdmin();
  return result;
}

export async function adminUpsertTeamMembershipAction(input: unknown) {
  const result = await withAdmin((profile) => upsertAdminTeamMembership(profile, input));
  if (result.success) revalidateAdmin();
  return result;
}

export async function adminUpsertAssignmentRuleAction(input: unknown) {
  const result = await withAdmin((profile) => upsertAdminAssignmentRule(profile, input));
  if (result.success) revalidateAdmin();
  return result;
}

export async function adminUpsertSlaDefinitionAction(input: unknown) {
  const result = await withAdmin((profile) => upsertAdminSlaDefinition(profile, input));
  if (result.success) revalidateAdmin();
  return result;
}

export async function adminUpsertApprovalRuleAction(input: unknown) {
  const result = await withAdmin((profile) => upsertAdminApprovalRule(profile, input));
  if (result.success) revalidateAdmin();
  return result;
}

export async function adminUpsertNotificationTemplateAction(input: unknown) {
  const result = await withAdmin((profile) =>
    upsertAdminNotificationTemplate(profile, {
      ...(typeof input === "object" && input ? input : {}),
      variables:
        typeof input === "object" &&
        input &&
        "variables" in input &&
        Array.isArray((input as { variables?: unknown }).variables)
          ? (input as { variables: string[] }).variables
          : [],
    })
  );
  if (result.success) revalidateAdmin();
  return result;
}

export async function previewNotificationTemplateAction(input: {
  subjectTemplate?: string | null;
  bodyTemplate: string;
  variables: Record<string, string>;
  declaredVariables?: string[];
}) {
  const { previewNotificationTemplate } = await import(
    "@/lib/notifications/templates"
  );
  try {
    return previewNotificationTemplate({
      subjectTemplate: input.subjectTemplate,
      bodyTemplate: input.bodyTemplate,
      variables: input.variables,
      declaredVariables:
        input.declaredVariables ?? Object.keys(input.variables ?? {}),
    });
  } catch (error) {
    return {
      ok: false,
      subject: "",
      body: "",
      missing: [] as string[],
      error: error instanceof Error ? error.message : "Preview failed.",
    };
  }
}

export async function adminUpsertFeatureFlagAction(input: unknown) {
  const result = await withAdmin((profile) => upsertAdminFeatureFlag(profile, input));
  if (result.success) revalidateAdmin();
  return result;
}

export async function adminListHistoryAction(
  configurationType: string,
  configurationId: string
) {
  return withAdmin((profile) =>
    listConfigurationHistory(profile, configurationType, configurationId)
  );
}

export {
  getAdminOrganization,
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
};
