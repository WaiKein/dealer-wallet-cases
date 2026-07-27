import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { canCommentOnCase } from "@/lib/auth/permissions";
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
    });
    if (!parsed.success) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid comment.",
      });
    }

    const supabase = await createClient();
    const { data: existingCase, error: fetchError } = await supabase
      .from("cases")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingCase) {
      return apiError({ code: "NOT_FOUND", message: "Case not found." });
    }

    const { data, error } = await supabase
      .from("case_comments")
      .insert({
        case_id: id,
        author_id: profile.id,
        body: parsed.data.body.trim(),
      })
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
