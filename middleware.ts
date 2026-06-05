import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

/**
 * Public routes (no auth required):
 *   - /               (landing)
 *   - /signin         (sign-in)
 *   - /api/auth/*     (NextAuth handler routes)
 *
 * Everything else requires a session. API routes return 401 JSON,
 * pages 302 to /signin with the originally-requested path in ?from.
 */
const PUBLIC = ["/", "/signin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.includes(pathname)) return NextResponse.next();
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
