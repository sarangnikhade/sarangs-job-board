import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Returns the signed-in user's profile (name/email come from the
 * NextAuth users row). OpenRouter key is an app-level secret now and
 * is not exposed.
 */
export async function GET() {
  const session = await requireUser();
  if (session instanceof NextResponse) return session;

  const db = await getDb();
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .get();

  return NextResponse.json({
    name: user?.name ?? "",
    email: user?.email ?? "",
    image: user?.image ?? "",
  });
}

/** PATCH allows the user to update their display name. */
export async function PATCH(req: Request) {
  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const body = (await req.json()) as { name?: string };
  if (body.name === undefined) return NextResponse.json({ ok: true });

  const db = await getDb();
  await db
    .update(schema.users)
    .set({ name: body.name })
    .where(eq(schema.users.id, session.userId))
    .run();
  return NextResponse.json({ ok: true });
}
