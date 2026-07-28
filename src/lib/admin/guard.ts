import { canAccessAdminConsole } from "@/lib/auth/permissions";
import type { Profile } from "@/types";

export type AdminDenied = {
  success: false;
  error: string;
  code: string;
};

export function assertAdmin(profile: Profile): AdminDenied | null {
  if (!canAccessAdminConsole(profile.role)) {
    return {
      success: false,
      error: "Administrator access is required.",
      code: "FORBIDDEN",
    };
  }
  if (!profile.organization_id) {
    return {
      success: false,
      error: "Your account is not linked to an organization.",
      code: "FORBIDDEN",
    };
  }
  return null;
}

export function requireOrgId(profile: Profile): string {
  if (!profile.organization_id) {
    throw new Error("Missing organization.");
  }
  return profile.organization_id;
}
