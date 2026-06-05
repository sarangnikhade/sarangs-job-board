import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { parseResume } from "@/lib/parsers/resume";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;
  const db = await getDb();
  const row = await db
    .select()
    .from(schema.resumes)
    .where(
      and(
        eq(schema.resumes.id, Number(id)),
        eq(schema.resumes.user_id, session.userId),
      ),
    )
    .get();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ resume: row });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;
  const resumeId = Number(id);
  const db = await getDb();
  const now = Date.now();
  const ct = req.headers.get("content-type") ?? "";

  // Verify the row belongs to this user before mutating.
  const owned = await db
    .select({ id: schema.resumes.id })
    .from(schema.resumes)
    .where(
      and(
        eq(schema.resumes.id, resumeId),
        eq(schema.resumes.user_id, session.userId),
      ),
    )
    .get();
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: now };
  let promoteDefault = false;

  if (ct.startsWith("multipart/")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing file" }, { status: 400 });
    }
    const fileName = file.name || "resume";
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      patch.text = await parseResume(buf, fileName);
      patch.file_name = fileName;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "parse failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const labelOverride = String(form.get("label") ?? "").trim();
    if (labelOverride) patch.label = labelOverride;
  } else {
    const body = (await req.json().catch(() => ({}))) as {
      label?: string;
      is_default?: boolean;
      clear?: boolean;
    };
    if (body.label !== undefined) patch.label = body.label.trim();
    if (body.clear) {
      patch.text = null;
      patch.file_name = null;
    }
    if (body.is_default) promoteDefault = true;
  }

  if (promoteDefault) {
    // Clear default on the user's other resumes.
    await db
      .update(schema.resumes)
      .set({ is_default: 0, updated_at: now })
      .where(
        and(
          ne(schema.resumes.id, resumeId),
          eq(schema.resumes.user_id, session.userId),
        ),
      )
      .run();
    patch.is_default = 1;
  }

  const updated = await db
    .update(schema.resumes)
    .set(patch)
    .where(eq(schema.resumes.id, resumeId))
    .returning()
    .get();
  return NextResponse.json({ resume: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;
  const resumeId = Number(id);
  const db = await getDb();
  const now = Date.now();

  const row = await db
    .select()
    .from(schema.resumes)
    .where(
      and(
        eq(schema.resumes.id, resumeId),
        eq(schema.resumes.user_id, session.userId),
      ),
    )
    .get();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.delete(schema.resumes).where(eq(schema.resumes.id, resumeId)).run();

  if (row.is_default) {
    const fallback = await db
      .select()
      .from(schema.resumes)
      .where(eq(schema.resumes.user_id, session.userId))
      .get();
    if (fallback) {
      await db
        .update(schema.resumes)
        .set({ is_default: 1, updated_at: now })
        .where(eq(schema.resumes.id, fallback.id))
        .run();
    }
  }

  return NextResponse.json({ ok: true });
}
