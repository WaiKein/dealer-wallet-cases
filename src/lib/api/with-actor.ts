import {
  createBearerClient,
  getRequestProfile,
} from "@/lib/supabase/api";
import { runWithSupabaseClient } from "@/lib/supabase/context";
import { jsonError } from "@/lib/api/response";
import type { Profile } from "@/types";
import type { NextResponse } from "next/server";

export async function withActor(
  request: Request,
  handler: (ctx: {
    profile: Profile;
    accessToken: string;
  }) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await getRequestProfile(request);
  if (!auth) {
    return jsonError("Unauthorized", 401);
  }

  const client = createBearerClient(auth.accessToken);
  return runWithSupabaseClient(client, () =>
    handler({ profile: auth.profile, accessToken: auth.accessToken })
  );
}
