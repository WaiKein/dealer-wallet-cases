import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { recordConfigurationAudit } from "@/lib/admin/audit";
import { validateDelegationAuthority } from "@/lib/approvals/delegation";
import { changeReasonSchema } from "@/lib/validations/admin";
import { createClient } from "@/lib/supabase/server";
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

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    if (!profile.organization_id) {
      return apiError({ code: "FORBIDDEN", message: "Organization required." });
    }
    if (profile.role !== "approver" && profile.role !== "admin") {
      return apiError({
        code: "FORBIDDEN",
        message: "Only approvers or admins can list delegations.",
      });
    }

    const supabase = await createClient();
    let query = supabase
      .from("approval_delegations")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    if (profile.role !== "admin") {
      query = query.or(
        `delegator_id.eq.${profile.id},delegate_id.eq.${profile.id}`
      );
    }

    const { data, error } = await query;
    if (error) {
      return apiError({ code: "VALIDATION_ERROR", message: error.message });
    }
    return jsonOk({ delegations: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withActor(request, async ({ profile }) => {
    const canManage = profile.role === "admin" || profile.role === "approver";
    if (!canManage) {
      return apiError({
        code: "FORBIDDEN",
        message: "Only approvers or admins can manage delegations.",
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = delegationSchema.safeParse(body);
    if (!parsed.success) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid delegation.",
      });
    }

    const orgId = profile.organization_id;
    if (!orgId) {
      return apiError({ code: "FORBIDDEN", message: "Organization required." });
    }

    const supabase = await createClient();
    const { data: delegate } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", parsed.data.delegate_id)
      .eq("organization_id", orgId)
      .single();

    if (!delegate) {
      return apiError({
        code: "NOT_FOUND",
        message: "Delegate must belong to your organisation.",
      });
    }

    const authority = validateDelegationAuthority({
      delegator: profile,
      delegate: delegate as never,
      approvalLimit: parsed.data.approval_limit ?? null,
      delegatorLimit: null,
    });
    if (!authority.ok) {
      return apiError({ code: "FORBIDDEN", message: authority.message });
    }

    if (parsed.data.id) {
      const { data: existing } = await supabase
        .from("approval_delegations")
        .select("*")
        .eq("id", parsed.data.id)
        .eq("organization_id", orgId)
        .single();
      if (!existing) {
        return apiError({ code: "NOT_FOUND", message: "Delegation not found." });
      }
      if (profile.role !== "admin" && existing.delegator_id !== profile.id) {
        return apiError({
          code: "FORBIDDEN",
          message: "You can only update your own delegations.",
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
        return apiError({
          code: "VALIDATION_ERROR",
          message: error?.message ?? "Update failed.",
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

      return jsonOk({ delegation: data });
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
      return apiError({
        code: "VALIDATION_ERROR",
        message: error?.message ?? "Create failed.",
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

    return jsonOk({ delegation: data }, { status: 201 });
  });
}
