import {
  createBearerClient,
  getRequestProfile,
} from "@/lib/supabase/api";
import { runWithSupabaseClient } from "@/lib/supabase/context";
import { apiError } from "@/lib/api/response";
import {
  resolveCorrelationId,
  runWithCorrelationId,
} from "@/lib/observability/correlation";
import type { Profile } from "@/types";
import type { NextResponse } from "next/server";

export async function withActor(
  request: Request,
  handler: (ctx: {
    profile: Profile;
    accessToken: string;
  }) => Promise<NextResponse>
): Promise<NextResponse> {
  const correlationId = resolveCorrelationId(request);

  return runWithCorrelationId(correlationId, async () => {
    const auth = await getRequestProfile(request);
    if (!auth) {
      return apiError({ code: "UNAUTHORIZED" });
    }

    const client = createBearerClient(auth.accessToken);
    return runWithSupabaseClient(client, () =>
      handler({ profile: auth.profile, accessToken: auth.accessToken })
    );
  });
}
