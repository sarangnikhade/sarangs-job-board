import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

/**
 * Gate the entire app behind sign-in.
 *
 * Allowed without auth:
 *   - /signin           (sign-in page)
 *   - /api/auth/*       (NextAuth handler routes)
 *   - /_next/*, /favicon.ico, /public assets
 *
 * Everything else 302-redirects unauthenticated requests to /signin.
 * API routes return 401 JSON instead of redirecting so the client can
 * surface a sensible error.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/signin")) return NextResponse.next();
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const session = await auth();
  if (session?.user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\..*).*)"],
};
