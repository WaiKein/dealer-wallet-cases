import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CORRELATION_HEADER } from "@/lib/api/errors";
import { createCorrelationId } from "@/lib/observability/correlation";

export async function updateSession(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER)?.trim() || createCorrelationId();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_HEADER, correlationId);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll: ((cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        }) satisfies SetAllCookies,
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login");
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicRoute =
    isAuthRoute || pathname.startsWith("/auth") || isApiRoute;

  let activeUser = user;

  if (activeUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", activeUser.id)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      activeUser = null;

      if (!isPublicRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "session_expired");
        const redirectResponse = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        redirectResponse.headers.set(CORRELATION_HEADER, correlationId);
        return redirectResponse;
      }
    }
  }

  if (!activeUser && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    redirectResponse.headers.set(CORRELATION_HEADER, correlationId);
    return redirectResponse;
  }

  supabaseResponse.headers.set(CORRELATION_HEADER, correlationId);
  return supabaseResponse;
}
