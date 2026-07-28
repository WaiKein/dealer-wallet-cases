import { apiError, jsonOk } from "@/lib/api/response";
import { withActor } from "@/lib/api/with-actor";
import { canAccessExceptionQueues } from "@/lib/auth/permissions";
import { listExceptionQueues } from "@/lib/exceptions/service";
import type { ExceptionQueueType } from "@/lib/exceptions/types";

export async function GET(request: Request) {
  return withActor(request, async ({ profile }) => {
    if (!canAccessExceptionQueues(profile.role)) {
      return apiError({ code: "FORBIDDEN", message: "Not allowed." });
    }

    const url = new URL(request.url);
    const queueType = (url.searchParams.get("queueType") ??
      "all") as ExceptionQueueType | "all";
    const includeResolved = url.searchParams.get("includeResolved") === "true";

    const { data, error } = await listExceptionQueues({
      profile,
      queueType,
      includeResolved,
    });

    if (error) {
      return apiError({ code: "INTERNAL_ERROR", message: error });
    }

    return jsonOk({ exceptions: data });
  });
}
