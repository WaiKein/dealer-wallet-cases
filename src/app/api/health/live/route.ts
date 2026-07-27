import { jsonOk } from "@/lib/api/response";
import {
  resolveCorrelationId,
  runWithCorrelationId,
} from "@/lib/observability/correlation";

/** Liveness — process is up. */
export async function GET(request: Request) {
  return runWithCorrelationId(resolveCorrelationId(request), async () =>
    jsonOk({ status: "live" })
  );
}
