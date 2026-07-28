"use server";

import { revalidatePath } from "next/cache";
import {
  acknowledgeCase,
  claimCase,
  reassignWithinGroup,
} from "@/lib/assignment/service";
import { canCommentOnCase, canPostInternalComment } from "@/lib/auth/permissions";
import { assertCaseAccess } from "@/lib/cases/access";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/service";
import {
  actionFailure,
  actionSuccess,
  withServerActionCorrelation,
} from "@/lib/observability/server-action";
import { createClient } from "@/lib/supabase/server";
import {
  addCommentSchema,
  caseIdSchema,
  reassignAgentSchema,
  type AddCommentInput,
  type ReassignAgentInput,
} from "@/lib/validations/case";
import type { ActionResult } from "@/types";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function claimCaseAction(
  input: { caseId: string }
): Promise<ActionResult> {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }

    const parsed = caseIdSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure("Invalid case ID.", { code: "VALIDATION_ERROR" });
    }

    const result = await claimCase({
      caseId: parsed.data.caseId,
      actor: profile,
    });
    if (result.error) {
      return actionFailure(result.error, { code: "FORBIDDEN" });
    }

    revalidatePath("/cases");
    revalidatePath(`/cases/${parsed.data.caseId}`);
    revalidatePath("/workspace");
    return actionSuccess();
  });
}

export async function acknowledgeCaseAction(
  input: { caseId: string }
): Promise<ActionResult> {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }

    const parsed = caseIdSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure("Invalid case ID.", { code: "VALIDATION_ERROR" });
    }

    const result = await acknowledgeCase({
      caseId: parsed.data.caseId,
      actor: profile,
    });
    if (result.error) {
      return actionFailure(result.error, { code: "FORBIDDEN" });
    }

    revalidatePath("/cases");
    revalidatePath(`/cases/${parsed.data.caseId}`);
    revalidatePath("/workspace");
    return actionSuccess();
  });
}

export async function reassignCaseAction(
  input: ReassignAgentInput
): Promise<ActionResult> {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }

    const parsed = reassignAgentSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(
        parsed.error.issues[0]?.message ?? "Invalid reassignment data.",
        { code: "VALIDATION_ERROR" }
      );
    }

    const result = await reassignWithinGroup({
      caseId: parsed.data.caseId,
      agentId: parsed.data.agentId,
      actor: profile,
    });

    if (result.error) {
      return actionFailure(result.error, { code: "FORBIDDEN" });
    }

    revalidatePath("/cases");
    revalidatePath(`/cases/${parsed.data.caseId}`);
    revalidatePath("/workspace");
    return actionSuccess();
  });
}

export async function markNotificationReadAction(
  notificationId: string
): Promise<ActionResult> {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }

    const error = await markNotificationRead(profile.id, notificationId);
    if (error) {
      return actionFailure(error, { code: "VALIDATION_ERROR" });
    }

    revalidatePath("/", "layout");
    return actionSuccess();
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }

    const error = await markAllNotificationsRead(profile.id);
    if (error) {
      return actionFailure(error, { code: "VALIDATION_ERROR" });
    }

    revalidatePath("/", "layout");
    return actionSuccess();
  });
}

export async function addCaseComment(
  input: AddCommentInput
): Promise<ActionResult> {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }

    if (!canCommentOnCase(profile.role)) {
      return actionFailure("You cannot comment on cases.", {
        code: "FORBIDDEN",
      });
    }

    const parsed = addCommentSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(
        parsed.error.issues[0]?.message ?? "Invalid comment.",
        { code: "VALIDATION_ERROR" }
      );
    }

    const supabase = await createClient();
    const { data: existingCase, error: fetchError } = await supabase
      .from("cases")
      .select(
        "id, organization_id, requester_id, assigned_agent_id, assigned_group_id, status, approver_id"
      )
      .eq("id", parsed.data.caseId)
      .maybeSingle();

    const access = await assertCaseAccess(profile, existingCase);
    if (!access.success) {
      return actionFailure(access.error ?? "Case not found.", {
        code: access.code ?? "NOT_FOUND",
      });
    }

    if (parsed.data.is_internal && !canPostInternalComment(profile.role)) {
      return actionFailure("You cannot post internal comments.", {
        code: "FORBIDDEN",
      });
    }

    const insertRow: {
      case_id: string;
      author_id: string;
      body: string;
      is_internal?: boolean;
    } = {
      case_id: parsed.data.caseId,
      author_id: profile.id,
      body: parsed.data.body.trim(),
    };
    if (parsed.data.is_internal) {
      insertRow.is_internal = true;
    }

    const { error } = await supabase.from("case_comments").insert(insertRow);

    if (error) {
      return actionFailure(error.message, { code: "VALIDATION_ERROR" });
    }

    revalidatePath(`/cases/${parsed.data.caseId}`);
    return actionSuccess();
  });
}

export async function uploadCaseAttachment(
  caseId: string,
  formData: FormData
): Promise<ActionResult> {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return actionFailure("Choose a file to upload.", {
        code: "VALIDATION_ERROR",
      });
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      return actionFailure("File must be 5MB or smaller.", {
        code: "VALIDATION_ERROR",
      });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return actionFailure(
        "Unsupported file type. Use PDF, image, text, or Word documents.",
        { code: "VALIDATION_ERROR" }
      );
    }

    const supabase = await createClient();
    const { data: existingCase, error: fetchError } = await supabase
      .from("cases")
      .select(
        "id, organization_id, requester_id, assigned_agent_id, assigned_group_id, status, approver_id"
      )
      .eq("id", caseId)
      .maybeSingle();

    const access = await assertCaseAccess(profile, existingCase);
    if (!access.success) {
      return actionFailure(access.error ?? "Case not found.", {
        code: access.code ?? "NOT_FOUND",
      });
    }

    const safeName = file.name.replace(/[^\w.\-()+ ]/g, "_");
    const filePath = `${caseId}/${crypto.randomUUID()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("case-attachments")
      .upload(filePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return actionFailure(uploadError.message, { code: "VALIDATION_ERROR" });
    }

    const { error: insertError } = await supabase
      .from("case_attachments")
      .insert({
        case_id: caseId,
        uploaded_by: profile.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
      });

    if (insertError) {
      await supabase.storage.from("case-attachments").remove([filePath]);
      return actionFailure(insertError.message, { code: "VALIDATION_ERROR" });
    }

    revalidatePath(`/cases/${caseId}`);
    return actionSuccess();
  });
}
