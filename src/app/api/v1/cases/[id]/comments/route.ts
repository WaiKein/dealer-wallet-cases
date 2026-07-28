import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { assertCaseAccess } from "@/lib/cases/access";
import {
  canCommentOnCase,
  canPostInternalComment,
} from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { addCommentSchema } from "@/lib/validations/case";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withActor(request, async ({ profile }) => {
    if (!canCommentOnCase(profile.role)) {
      return apiError({
        code: "FORBIDDEN",
        message: "You cannot comment on cases.",
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = addCommentSchema.safeParse({
      caseId: id,
      body: body?.body,
      is_internal: body?.is_internal,
    });
    if (!parsed.success) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid comment.",
      });
    }

    if (parsed.data.is_internal && !canPostInternalComment(profile.role)) {
      return apiError({
        code: "FORBIDDEN",
        message: "You cannot post internal comments.",
      });
    }

    const supabase = await createClient();
    const { data: existingCase } = await supabase
      .from("cases")
      .select(
        "id, organization_id, requester_id, assigned_agent_id, assigned_group_id, status, approver_id"
      )
      .eq("id", id)
      .maybeSingle();

    const access = await assertCaseAccess(profile, existingCase);
    if (!access.success) {
      return apiError({
        code: (access.code as never) ?? "NOT_FOUND",
        message: access.error ?? "Case not found.",
      });
    }

    const insertRow: {
      case_id: string;
      author_id: string;
      body: string;
      is_internal?: boolean;
    } = {
      case_id: id,
      author_id: profile.id,
      body: parsed.data.body.trim(),
    };
    if (parsed.data.is_internal) {
      insertRow.is_internal = true;
    }

    const { data, error } = await supabase
      .from("case_comments")
      .insert(insertRow)
      .select("id, case_id, body, created_at")
      .single();

    if (error) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }

    return jsonOk({ comment: data }, { status: 201 });
  });
}
