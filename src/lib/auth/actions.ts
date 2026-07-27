"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  actionFailure,
  withServerActionCorrelation,
} from "@/lib/observability/server-action";
import type { ActionResult } from "@/types";

export async function signIn(
  email: string,
  password: string
): Promise<ActionResult> {
  return withServerActionCorrelation(async () => {
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return actionFailure("Authentication failed.", {
        code: "UNAUTHORIZED",
      });
    }

    redirect("/dashboard");
  });
}

export async function signOut(): Promise<void> {
  return withServerActionCorrelation(async () => {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  });
}
