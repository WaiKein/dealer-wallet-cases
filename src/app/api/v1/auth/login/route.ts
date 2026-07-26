import { createClient } from "@supabase/supabase-js";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  if (!body?.email || !body?.password) {
    return jsonError("Email and password are required.", 400);
  }

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await authClient.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error || !data.session || !data.user) {
    return jsonError(error?.message ?? "Authentication failed.", 401);
  }

  const { data: profile } = await authClient
    .from("profiles")
    .select("id, email, full_name, role, organization_id, created_at")
    .eq("id", data.user.id)
    .single();

  return jsonOk({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    profile,
  });
}
