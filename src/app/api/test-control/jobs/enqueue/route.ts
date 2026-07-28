import { apiError, jsonOk } from "@/lib/api/response";
import { authorizeTestControl } from "@/lib/test-control/authorize";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { createServiceClient } from "@/lib/supabase/api";

export async function POST(request: Request) {
  const denied = authorizeTestControl(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    jobType?: string;
    organizationId?: string;
    payload?: Record<string, unknown>;
    maxAttempts?: number;
    idempotencyKey?: string;
  };

  let organizationId = body.organizationId;
  if (!organizationId) {
    const service = createServiceClient();
    const { data: org } = await service
      .from("organizations")
      .select("id")
      .limit(1)
      .maybeSingle();
    organizationId = org?.id;
  }

  if (!organizationId) {
    return apiError({
      code: "VALIDATION_ERROR",
      message: "organizationId is required.",
    });
  }

  const result = await enqueueJob({
    organizationId,
    jobType: body.jobType ?? "jobs.fail_once",
    payload: body.payload ?? {},
    maxAttempts: body.maxAttempts ?? 3,
    idempotencyKey: body.idempotencyKey,
  });

  if (result.error || !result.id) {
    return apiError({
      code: "INTERNAL_ERROR",
      message: "Failed to enqueue job.",
    });
  }

  return jsonOk({ jobId: result.id }, { status: 201 });
}
