"use server";

import { revalidatePath } from "next/cache";
import {
  canAssignAgent,
  canCommentOnCase,
} from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  addCommentSchema,
  assignAgentSchema,
  type AddCommentInput,
  type AssignAgentInput,
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

export async function assignCaseToAgent(
  input: AssignAgentInput
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = assignAgentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid assignment data.",
    };
  }

  const supabase = await createClient();
  const { data: existingCase, error: fetchError } = await supabase
    .from("cases")
    .select("id, status, assigned_agent_id")
    .eq("id", parsed.data.caseId)
    .single();

  if (fetchError || !existingCase) {
    return { success: false, error: "Case not found." };
  }

  if (!canAssignAgent(profile.role, existingCase.status)) {
    return {
      success: false,
      error: "You cannot assign an agent for this case right now.",
    };
  }

  const { data: agent, error: agentError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", parsed.data.agentId)
    .eq("role", "operations_agent")
    .single();

  if (agentError || !agent) {
    return { success: false, error: "Selected user is not an operations agent." };
  }

  const { error: updateError } = await supabase
    .from("cases")
    .update({ assigned_agent_id: agent.id })
    .eq("id", parsed.data.caseId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  await supabase.from("case_comments").insert({
    case_id: parsed.data.caseId,
    author_id: profile.id,
    body: `Assigned to ${agent.full_name}.`,
  });

  revalidatePath("/cases");
  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/dashboard");
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
