import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { encryptSecret, maskKey, decryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";

export async function GET() {
  const db = await getDb();
  const row = await db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.id, 1))
    .get();
  if (!row) return NextResponse.json({ error: "no profile" }, { status: 500 });

  let keyMask = "";
  if (row.openrouter_key_enc) {
    try {
      keyMask = maskKey(decryptSecret(row.openrouter_key_enc));
    } catch {
      keyMask = "•••• (unreadable — APP_SECRET changed?)";
    }
  }

  return NextResponse.json({
    name: row.name ?? "",
    email: row.email ?? "",
    resume_file_name: row.resume_file_name ?? "",
    resume_text: row.resume_text ?? "",
    has_openrouter_key: Boolean(row.openrouter_key_enc),
    openrouter_key_mask: keyMask,
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    openrouter_key?: string;
    clear_resume?: boolean;
  };
  const db = await getDb();
  const now = Date.now();

  const patch: Record<string, unknown> = { updated_at: now };
  if (body.name !== undefined) patch.name = body.name;
  if (body.email !== undefined) patch.email = body.email;
  if (body.openrouter_key !== undefined && body.openrouter_key !== "") {
    patch.openrouter_key_enc = encryptSecret(body.openrouter_key);
  }
  if (body.clear_resume) {
    patch.resume_text = null;
    patch.resume_file_name = null;
  }

  await db.update(schema.profile).set(patch).where(eq(schema.profile.id, 1)).run();
  return NextResponse.json({ ok: true });
}
