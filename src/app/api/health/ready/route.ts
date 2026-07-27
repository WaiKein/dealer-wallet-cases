import { apiError, jsonOk } from "@/lib/api/response";
import {
  resolveCorrelationId,
  runWithCorrelationId,
} from "@/lib/observability/correlation";

/** Readiness — required env present for serving traffic. */
export async function GET(request: Request) {
  return runWithCorrelationId(resolveCorrelationId(request), async () => {
    const required = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) {
      return apiError({
        code: "SERVICE_UNAVAILABLE",
        message: "Service not ready.",
        details: { missing },
      });
    }
    return jsonOk({ status: "ready" });
  });
}
