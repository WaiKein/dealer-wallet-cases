import { type NextRequest, NextResponse } from "next/server";
import { isTestControlEnabled } from "@/lib/clock";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    process.env.NODE_ENV === "production" &&
    !isTestControlEnabled() &&
    (path.startsWith("/api/test-control") || path.startsWith("/api/simulator"))
  ) {
    return NextResponse.redirect(new URL("/api/health/live", request.url));
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
