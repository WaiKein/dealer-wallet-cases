"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { createCaseRecord } from "@/lib/cases/create";
import { executeTransition } from "@/lib/cases/transitions";
import {
  actionFailure,
  actionSuccess,
  withServerActionCorrelation,
} from "@/lib/observability/server-action";
import { getCorrelationId } from "@/lib/observability/correlation";
import {
  type CreateCaseInput,
  type StatusTransitionInput,
} from "@/lib/validations/case";
import type { ActionResult } from "@/types";

export async function createCase(
  input: CreateCaseInput
): Promise<ActionResult<{ id: string }>> {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }

    const result = await createCaseRecord(profile, input);
    if (!result.success || !result.data) {
      return actionFailure(result.error ?? "Failed to create case.", {
        code: result.code,
        details: result.details,
      });
    }

    revalidatePath("/cases");
    redirect(`/cases/${result.data.id}`);
  });
}

export async function transitionCaseStatus(
  input: StatusTransitionInput
): Promise<ActionResult<{ version?: number }>> {
  return withServerActionCorrelation(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      return actionFailure("You must be signed in.", { code: "UNAUTHORIZED" });
    }

    const result = await executeTransition(profile, input);
    if (!result.success) {
      return { ...result, correlationId: getCorrelationId() };
    }

    revalidatePath("/cases");
    revalidatePath(`/cases/${input.caseId}`);
    revalidatePath("/workspace");
    return actionSuccess(result.data);
  });
}
