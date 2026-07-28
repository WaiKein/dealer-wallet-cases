import type { NextResponse } from "next/server";
import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { canAccessAdminConsole } from "@/lib/auth/permissions";
import type { ActionResult, Profile } from "@/types";

export type AdminPaging = {
  q?: string;
  active: "all" | "active" | "inactive";
  page: number;
  pageSize: number;
};

export function parseAdminPaging(request: Request): AdminPaging {
  const url = new URL(request.url);
  return {
    q: url.searchParams.get("q") ?? undefined,
    active: (url.searchParams.get("active") as AdminPaging["active"]) ?? "all",
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 20),
  };
}

function denyAdmin(role: string): NextResponse | null {
  if (!canAccessAdminConsole(role as never)) {
    return apiError({
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
  return null;
}

export function mapActionResult<T>(result: ActionResult<T>): NextResponse {
  if (!result.success) {
    return apiError({
      code: (result.code as never) ?? "VALIDATION_ERROR",
      message: result.error ?? "Request failed.",
      details: "details" in result ? result.details : undefined,
    });
  }
  return jsonOk(result.data);
}

export function adminListRoute(
  handler: (
    profile: Profile,
    paging: AdminPaging
  ) => Promise<ActionResult<unknown>>
) {
  return (request: Request) =>
    withActor(request, async ({ profile }) => {
      const denied = denyAdmin(profile.role);
      if (denied) return denied;
      return mapActionResult(await handler(profile, parseAdminPaging(request)));
    });
}

export function adminUpsertRoute(
  handler: (profile: Profile, body: unknown) => Promise<ActionResult<unknown>>
) {
  return (request: Request) =>
    withActor(request, async ({ profile }) => {
      const denied = denyAdmin(profile.role);
      if (denied) return denied;
      const body = await request.json().catch(() => null);
      return mapActionResult(await handler(profile, body));
    });
}
