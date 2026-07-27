import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { listCategories, listSubcategories } from "@/lib/cases/queries";

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    if (!profile.organization_id) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: "Missing organization.",
      });
    }

    const [categories, subcategories] = await Promise.all([
      listCategories(profile.organization_id),
      listSubcategories(profile.organization_id),
    ]);

    if (categories.error || subcategories.error) {
      return apiError({
        code: "VALIDATION_ERROR",
        message:
          categories.error ??
          subcategories.error ??
          "Failed to load taxonomy.",
      });
    }

    return jsonOk({
      categories: categories.data,
      subcategories: subcategories.data,
    });
  });
}
