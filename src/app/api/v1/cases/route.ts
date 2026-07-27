import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { withIdempotency } from "@/lib/api/idempotency";
import { createCaseRecord } from "@/lib/cases/create";
import { listCases } from "@/lib/cases/queries";
import { createCaseSchema } from "@/lib/validations/case";
import type { ApiErrorCode } from "@/lib/api/errors";

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;
    const result = await listCases(profile, {
      status: status as never,
      search,
    });
    if (result.error) {
      return apiError({ code: "VALIDATION_ERROR", message: result.error });
    }
    return jsonOk({ cases: result.data });
  });
}

export async function POST(request: Request) {
  return withActor(request, async ({ profile }) => {
    if (!profile.organization_id) {
      return apiError({
        code: "FORBIDDEN",
        message: "Your account is not linked to an organization.",
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = createCaseSchema.safeParse(body);
    if (!parsed.success) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid case payload.",
      });
    }

    return withIdempotency({
      request,
      organizationId: profile.organization_id,
      route: "/api/v1/cases",
      method: "POST",
      requestPayload: parsed.data,
      handler: async () => {
        const result = await createCaseRecord(profile, parsed.data);
        if (!result.success || !result.data) {
          return apiError({
            code: (result.code as ApiErrorCode) ?? "VALIDATION_ERROR",
            message: result.error ?? "Failed to create case.",
          });
        }
        return jsonOk(result.data, { status: 201 });
      },
    });
  });
}
