import { apiError, jsonOk } from "@/lib/api/response";
import { authorizeTestControl } from "@/lib/test-control/authorize";
import { createServiceClient } from "@/lib/supabase/api";

export async function GET(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return denied;
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return apiError({
      code: "VALIDATION_ERROR",
      message: "jobId is required.",
    });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("background_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) {
    return apiError({ code: "NOT_FOUND", message: "Job not found." });
  }

  return jsonOk({ job: data });
}
