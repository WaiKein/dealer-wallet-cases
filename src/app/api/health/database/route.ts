import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { apiError, jsonOk } from "@/lib/api/response";
import {
  resolveCorrelationId,
  runWithCorrelationId,
} from "@/lib/observability/correlation";

/**
 * Database connectivity check.
 * Prefer service role so RLS on orgs does not look like an outage; fall back to anon.
 */
export async function GET(request: Request) {
  return runWithCorrelationId(resolveCorrelationId(request), async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const key = serviceKey || anon;
    if (!url || !key) {
      return apiError({
        code: "SERVICE_UNAVAILABLE",
        message: "Database configuration missing.",
      });
    }

    try {
      const client = createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client.from("organizations").select("id").limit(1);
      if (error) {
        return apiError({
          code: "SERVICE_UNAVAILABLE",
          message: "Database unreachable.",
        });
      }
      return jsonOk({ status: "ok", database: "reachable" });
    } catch {
      return apiError({
        code: "SERVICE_UNAVAILABLE",
        message: "Database unreachable.",
      });
    }
  });
}
