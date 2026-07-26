"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { createCaseRecord } from "@/lib/cases/create";
import { executeTransition } from "@/lib/cases/transitions";
import {
  type CreateCaseInput,
  type StatusTransitionInput,
} from "@/lib/validations/case";
import type { ActionResult } from "@/types";

export async function createCase(
  input: CreateCaseInput
): Promise<ActionResult<{ id: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const result = await createCaseRecord(profile, input);
  if (!result.success || !result.data) {
    return { success: false, error: result.error ?? "Failed to create case." };
  }

  revalidatePath("/cases");
  redirect(`/cases/${result.data.id}`);
}

export async function transitionCaseStatus(
  input: StatusTransitionInput
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const result = await executeTransition(profile, input);
  if (!result.success) {
    return result;
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${input.caseId}`);
  revalidatePath("/workspace");
  return { success: true };
}
