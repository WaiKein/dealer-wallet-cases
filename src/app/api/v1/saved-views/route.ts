import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import {
  createSavedCaseView,
  listSavedCaseViews,
} from "@/lib/cases/saved-views";
import { createSavedViewSchema } from "@/lib/cases/saved-view-schema";
import type { ApiErrorCode } from "@/lib/api/errors";

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    const result = await listSavedCaseViews(profile);
    if (result.error) {
      return apiError({ code: "VALIDATION_ERROR", message: result.error });
    }
    return jsonOk({ views: result.data });
  });
}

export async function POST(request: Request) {
  return withActor(request, async ({ profile }) => {
    const body = await request.json().catch(() => null);
    const parsed = createSavedViewSchema.safeParse(body);
    if (!parsed.success) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid view payload.",
      });
    }

    const result = await createSavedCaseView(profile, parsed.data);
    if (!result.success || !result.data) {
      return apiError({
        code: (result.code as ApiErrorCode) ?? "VALIDATION_ERROR",
        message: result.error ?? "Failed to create view.",
      });
    }
    return jsonOk({ view: result.data }, { status: 201 });
  });
}
