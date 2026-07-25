"use server";

import { revalidatePath } from "next/cache";
import {
  acknowledgeCase,
  claimCase,
  reassignWithinGroup,
} from "@/lib/assignment/service";
import { canCommentOnCase } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/service";
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
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = caseIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid case ID." };
  }

  const result = await claimCase({ caseId: parsed.data.caseId, actor: profile });
  if (result.error) {
    return { success: false, error: result.error };
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/workspace");
  return { success: true };
}

export async function acknowledgeCaseAction(
  input: { caseId: string }
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = caseIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid case ID." };
  }

  const result = await acknowledgeCase({
    caseId: parsed.data.caseId,
    actor: profile,
  });
  if (result.error) {
    return { success: false, error: result.error };
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/workspace");
  return { success: true };
}

export async function reassignCaseAction(
  input: ReassignAgentInput
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = reassignAgentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid reassignment data.",
    };
  }

  const result = await reassignWithinGroup({
    caseId: parsed.data.caseId,
    agentId: parsed.data.agentId,
    actor: profile,
  });

  if (result.error) {
    return { success: false, error: result.error };
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/workspace");
  return { success: true };
}

export async function markNotificationReadAction(
  notificationId: string
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const error = await markNotificationRead(profile.id, notificationId);
  if (error) {
    return { success: false, error };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const error = await markAllNotificationsRead(profile.id);
  if (error) {
    return { success: false, error };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function addCaseComment(
  input: AddCommentInput
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  if (!canCommentOnCase(profile.role)) {
    return { success: false, error: "You cannot comment on cases." };
  }

  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid comment.",
    };
  }

  const supabase = await createClient();
  const { data: existingCase, error: fetchError } = await supabase
    .from("cases")
    .select("id")
    .eq("id", parsed.data.caseId)
    .single();

  if (fetchError || !existingCase) {
    return { success: false, error: "Case not found." };
  }

  const { error } = await supabase.from("case_comments").insert({
    case_id: parsed.data.caseId,
    author_id: profile.id,
    body: parsed.data.body.trim(),
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/cases/${parsed.data.caseId}`);
  return { success: true };
}

export async function uploadCaseAttachment(
  caseId: string,
  formData: FormData
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose a file to upload." };
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { success: false, error: "File must be 5MB or smaller." };
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      success: false,
      error: "Unsupported file type. Use PDF, image, text, or Word documents.",
    };
  }

  const supabase = await createClient();
  const { data: existingCase, error: fetchError } = await supabase
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .single();

  if (fetchError || !existingCase) {
    return { success: false, error: "Case not found." };
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
    return { success: false, error: uploadError.message };
  }

  const { error: insertError } = await supabase.from("case_attachments").insert({
    case_id: caseId,
    uploaded_by: profile.id,
    file_name: file.name,
    file_path: filePath,
    file_size: file.size,
    mime_type: file.type,
  });

  if (insertError) {
    await supabase.storage.from("case-attachments").remove([filePath]);
    return { success: false, error: insertError.message };
  }

  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}
