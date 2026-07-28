import { apiError } from "@/lib/api/response";
import { isTestControlEnabled } from "@/lib/clock";
import type { NextResponse } from "next/server";

/** Gate test-control and simulator APIs outside approved environments. */
export function authorizeTestControl(request: Request): NextResponse | null {
  if (!isTestControlEnabled()) {
    return apiError({
      code: "FORBIDDEN",
      message: "Test control is disabled.",
    });
  }

  const secret = request.headers.get("x-test-control-secret");
  if (!secret || secret !== process.env.TEST_CONTROL_SECRET) {
    return apiError({
      code: "FORBIDDEN",
      message: "Invalid test-control secret.",
    });
  }

  return null;
}
