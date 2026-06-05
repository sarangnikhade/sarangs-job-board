import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Returns the signed-in user's id, or a 401 response that the caller
 * should return directly.
 *
 *   const session = await requireUser();
 *   if (session instanceof NextResponse) return session;
 *   const userId = session.userId;
 */
export async function requireUser(): Promise<
  { userId: string; email: string | null | undefined } | NextResponse
> {
  const session = await auth();
  const userId =
    typeof (session?.user as { id?: string } | undefined)?.id === "string"
      ? (session!.user as { id: string }).id
      : null;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return { userId, email: session?.user?.email };
}
