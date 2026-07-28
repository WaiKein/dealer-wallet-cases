"use server";

import { revalidatePath } from "next/cache";
import { recordConfigurationAudit } from "@/lib/admin/audit";
import { requireOrgId } from "@/lib/admin/guard";
import { validateDelegationAuthority } from "@/lib/approvals/delegation";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  actionFailure,
  actionSuccess,
  withServerActionCorrelation,
} from "@/lib/observability/server-action";
import { createClient } from "@/lib/supabase/server";
import { changeReasonSchema } from "@/lib/validations/admin";
import { z } from "zod";

const delegationSchema = z.object({
  id: z.string().uuid().optional(),
  delegate_id: z.string().uuid(),
  approval_limit: z.coerce.number().positive().nullable().optional(),
  effective_from: z.string().datetime().optional(),
  effective_to: z.string().datetime().nullable().optional(),
  is_active: z.boolean().default(true),
  change_reason: changeReasonSchema,
});

export async function upsertApprovalDelegationAction(input: unknown) {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }

    const canManage =
      profile.role === "admin" || profile.role === "approver";
    if (!canManage) {
      return actionFailure("Only approvers or admins can manage delegations.", {
        code: "FORBIDDEN",
      });
    }

    const parsed = delegationSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(
        parsed.error.issues[0]?.message ?? "Invalid delegation.",
        { code: "VALIDATION_ERROR" }
      );
    }

    const orgId = profile.organization_id;
    if (!orgId) {
      return actionFailure("Missing organization.", { code: "FORBIDDEN" });
    }

    const supabase = await createClient();
    const { data: delegate } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", parsed.data.delegate_id)
      .eq("organization_id", orgId)
      .single();

    if (!delegate) {
      return actionFailure("Delegate must belong to your organisation.", {
        code: "NOT_FOUND",
      });
    }

    const authority = validateDelegationAuthority({
      delegator: profile,
      delegate: delegate as never,
      approvalLimit: parsed.data.approval_limit ?? null,
      delegatorLimit: null,
    });
    if (!authority.ok) {
      return actionFailure(authority.message, { code: "FORBIDDEN" });
    }

    if (parsed.data.id) {
      const { data: existing } = await supabase
        .from("approval_delegations")
        .select("*")
        .eq("id", parsed.data.id)
        .eq("organization_id", orgId)
        .single();
      if (!existing) {
        return actionFailure("Delegation not found.", { code: "NOT_FOUND" });
      }
      if (
        profile.role !== "admin" &&
        existing.delegator_id !== profile.id
      ) {
        return actionFailure("You can only update your own delegations.", {
          code: "FORBIDDEN",
        });
      }

      const { data, error } = await supabase
        .from("approval_delegations")
        .update({
          delegate_id: parsed.data.delegate_id,
          approval_limit: parsed.data.approval_limit ?? null,
          effective_from:
            parsed.data.effective_from ?? existing.effective_from,
          effective_to: parsed.data.effective_to ?? null,
          is_active: parsed.data.is_active,
          version: Number(existing.version ?? 1) + 1,
          updated_by: profile.id,
          change_reason: parsed.data.change_reason,
        })
        .eq("id", parsed.data.id)
        .select("*")
        .single();

      if (error || !data) {
        return actionFailure(error?.message ?? "Update failed.", {
          code: "VALIDATION_ERROR",
        });
      }

      await recordConfigurationAudit({
        organizationId: orgId,
        configurationType: "approval_delegation",
        configurationId: parsed.data.id,
        previousValue: existing as Record<string, unknown>,
        newValue: data as Record<string, unknown>,
        actor: profile,
        changeReason: parsed.data.change_reason,
      });

      revalidatePath("/admin/delegations");
      revalidatePath("/delegations");
      return actionSuccess({ record: data });
    }

    const { data, error } = await supabase
      .from("approval_delegations")
      .insert({
        organization_id: orgId,
        delegator_id: profile.id,
        delegate_id: parsed.data.delegate_id,
        approval_limit: parsed.data.approval_limit ?? null,
        effective_from: parsed.data.effective_from ?? new Date().toISOString(),
        effective_to: parsed.data.effective_to ?? null,
        is_active: parsed.data.is_active,
        version: 1,
        created_by: profile.id,
        updated_by: profile.id,
        change_reason: parsed.data.change_reason,
      })
      .select("*")
      .single();

    if (error || !data) {
      return actionFailure(error?.message ?? "Create failed.", {
        code: "VALIDATION_ERROR",
      });
    }

    await recordConfigurationAudit({
      organizationId: orgId,
      configurationType: "approval_delegation",
      configurationId: data.id,
      previousValue: null,
      newValue: data as Record<string, unknown>,
      actor: profile,
      changeReason: parsed.data.change_reason,
    });

    revalidatePath("/admin/delegations");
    revalidatePath("/delegations");
    return actionSuccess({ record: data });
  });
}

export async function listApprovalDelegationsForAdmin() {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }
    if (profile.role !== "admin" && profile.role !== "approver") {
      return actionFailure("Forbidden.", { code: "FORBIDDEN" });
    }
    const orgId = requireOrgId(profile);
    const supabase = await createClient();
    let query = supabase
      .from("approval_delegations")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (profile.role !== "admin") {
      query = query.or(
        `delegator_id.eq.${profile.id},delegate_id.eq.${profile.id}`
      );
    }

    const { data, error } = await query;
    if (error) {
      return actionFailure(error.message, { code: "VALIDATION_ERROR" });
    }
    return actionSuccess({ items: data ?? [] });
  });
}
