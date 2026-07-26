import { jsonError, jsonOk } from "@/lib/api/response";
import { isTestControlEnabled } from "@/lib/clock";
import { createServiceClient } from "@/lib/supabase/api";

function authorizeTestControl(request: Request): string | null {
  if (!isTestControlEnabled()) {
    return "Test control is disabled.";
  }
  const secret = request.headers.get("x-test-control-secret");
  if (!secret || secret !== process.env.TEST_CONTROL_SECRET) {
    return "Invalid test-control secret.";
  }
  return null;
}

export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return jsonError(denied, 403);
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
      return jsonError(error.message, 400);
    }
    deleted += count ?? body.caseIds.length;
  }

  if (body.prefix) {
    const { data: matches, error } = await service
      .from("cases")
      .select("id")
      .ilike("title", `${body.prefix}%`);
    if (error) {
      return jsonError(error.message, 400);
    }
    const ids = (matches ?? []).map((row) => row.id);
    if (ids.length) {
      const { error: delError, count } = await service
        .from("cases")
        .delete({ count: "exact" })
        .in("id", ids);
      if (delError) {
        return jsonError(delError.message, 400);
      }
      deleted += count ?? ids.length;
    }
  }

  console.info("[test-control] cleanup", { deleted, prefix: body.prefix });
  return jsonOk({ deleted });
}
