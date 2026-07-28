import {
  listAdminCategories,
  listAdminSubcategories,
  upsertAdminCategory,
  upsertAdminSubcategory,
} from "@/lib/admin/config";
import {
  adminListRoute,
  mapActionResult,
  parseAdminPaging,
} from "@/lib/api/admin-routes";
import { apiError } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { canAccessAdminConsole } from "@/lib/auth/permissions";

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    if (!canAccessAdminConsole(profile.role)) {
      return apiError({
        code: "FORBIDDEN",
        message: "Administrator access is required.",
      });
    }

    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "all";
    const paging = parseAdminPaging(request);

    if (resource === "categories") {
      return mapActionResult(await listAdminCategories(profile, paging));
    }
    if (resource === "subcategories") {
      return mapActionResult(await listAdminSubcategories(profile, paging));
    }

    const [categories, subcategories] = await Promise.all([
      listAdminCategories(profile, paging),
      listAdminSubcategories(profile, paging),
    ]);

    if (!categories.success) {
      return mapActionResult(categories);
    }
    if (!subcategories.success) {
      return mapActionResult(subcategories);
    }

    return mapActionResult({
      success: true,
      data: {
        categories: categories.data,
        subcategories: subcategories.data,
      },
    });
  });
}

export async function POST(request: Request) {
  return withActor(request, async ({ profile }) => {
    if (!canAccessAdminConsole(profile.role)) {
      return apiError({
        code: "FORBIDDEN",
        message: "Administrator access is required.",
      });
    }

    const body = (await request.json().catch(() => null)) as {
      resource?: string;
      payload?: unknown;
    } | null;
    const resource = body?.resource;
    const payload = body?.payload ?? body;

    if (resource === "subcategory" || resource === "subcategories") {
      return mapActionResult(await upsertAdminSubcategory(profile, payload));
    }
    if (resource === "category" || resource === "categories" || !resource) {
      return mapActionResult(await upsertAdminCategory(profile, payload));
    }

    return apiError({
      code: "VALIDATION_ERROR",
      message: "Unknown taxonomy resource. Use category or subcategory.",
    });
  });
}
