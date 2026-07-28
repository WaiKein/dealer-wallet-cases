import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import {
  deactivateSavedCaseView,
  getSavedCaseView,
  updateSavedCaseView,
} from "@/lib/cases/saved-views";
import { updateSavedViewSchema } from "@/lib/cases/saved-view-schema";
import type { ApiErrorCode } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  return withActor(request, async ({ profile }) => {
    const { id } = await params;
    const result = await getSavedCaseView(profile, id);
    if (!result.data) {
      return apiError({
        code: (result.code as ApiErrorCode) ?? "NOT_FOUND",
        message: result.error ?? "View not found.",
      });
    }
    return jsonOk({ view: result.data });
  });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  return withActor(request, async ({ profile }) => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = updateSavedViewSchema.safeParse(body);
    if (!parsed.success) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid view payload.",
      });
    }

    const result = await updateSavedCaseView(profile, id, parsed.data);
    if (!result.success || !result.data) {
      return apiError({
        code: (result.code as ApiErrorCode) ?? "VALIDATION_ERROR",
        message: result.error ?? "Failed to update view.",
      });
    }
    return jsonOk({ view: result.data });
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  return withActor(request, async ({ profile }) => {
    const { id } = await params;
    const result = await deactivateSavedCaseView(profile, id);
    if (!result.success) {
      return apiError({
        code: (result.code as ApiErrorCode) ?? "VALIDATION_ERROR",
        message: result.error ?? "Failed to delete view.",
      });
    }
    return jsonOk({ deleted: true });
  });
}
