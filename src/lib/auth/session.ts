import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, organization_id, created_at")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}

export async function requireRole(allowedRoles: Profile["role"][]): Promise<Profile> {
  const profile = await requireProfile();
  if (!allowedRoles.includes(profile.role)) {
    redirect("/cases");
  }
  return profile;
}
