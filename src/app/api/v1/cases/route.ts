import { jsonError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { createCaseRecord } from "@/lib/cases/create";
import { listCases } from "@/lib/cases/queries";
import { createCaseSchema } from "@/lib/validations/case";

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
      return jsonError(result.error, 400);
    }
    return jsonOk({ cases: result.data });
  });
}

export async function POST(request: Request) {
  return withActor(request, async ({ profile }) => {
    const body = await request.json().catch(() => null);
    const parsed = createCaseSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "Invalid case payload.",
        400
      );
    }

    const result = await createCaseRecord(profile, parsed.data);
    if (!result.success || !result.data) {
      return jsonError(result.error ?? "Failed to create case.", 400);
    }
    return jsonOk(result.data, { status: 201 });
  });
}
