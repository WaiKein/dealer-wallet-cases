import { apiError, jsonOk } from "@/lib/api/response";
import { authorizeTestControl } from "@/lib/test-control/authorize";
import { createServiceClient } from "@/lib/supabase/api";

export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    caseIds?: string[];
    prefix?: string;
  };

  const service = createServiceClient();
  let deleted = 0;

  if (body.caseIds?.length) {
    const { error, count } = await service
      .from("cases")
      .delete({ count: "exact" })
      .in("id", body.caseIds);
    if (error) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
    deleted += count ?? body.caseIds.length;
  }

  if (body.prefix) {
    const { data: matches, error } = await service
      .from("cases")
      .select("id")
      .ilike("title", `${body.prefix}%`);
    if (error) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
    const ids = (matches ?? []).map((row) => row.id);
    if (ids.length) {
      const { error: delError, count } = await service
        .from("cases")
        .delete({ count: "exact" })
        .in("id", ids);
      if (delError) {
        return apiError({
          code: "VALIDATION_ERROR",
          message: delError.message,
        });
      }
      deleted += count ?? ids.length;
    }
  }

  console.info("[test-control] cleanup", { deleted, prefix: body.prefix });
  return jsonOk({ deleted });
}
