import { NextResponse } from "next/server";
import { eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { parseResume } from "@/lib/parsers/resume";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET — full row including text body. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const row = await db
    .select()
    .from(schema.resumes)
    .where(eq(schema.resumes.id, Number(id)))
    .get();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ resume: row });
}

/**
 * PATCH — rename, set as default, replace file, or clear text.
 *
 * - JSON body: { label?, is_default?, clear?: true }
 * - Multipart body: { file } — replace the resume file + text.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const resumeId = Number(id);
  const db = await getDb();
  const now = Date.now();
  const ct = req.headers.get("content-type") ?? "";

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
    await db
      .update(schema.resumes)
      .set({ is_default: 0, updated_at: now })
      .where(ne(schema.resumes.id, resumeId))
      .run();
    patch.is_default = 1;
  }

  const updated = await db
    .update(schema.resumes)
    .set(patch)
    .where(eq(schema.resumes.id, resumeId))
    .returning()
    .get();
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ resume: updated });
}

/**
 * DELETE — remove a resume. If it was the default, promote the
 * oldest remaining resume to default.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const resumeId = Number(id);
  const db = await getDb();
  const now = Date.now();

  const row = await db
    .select()
    .from(schema.resumes)
    .where(eq(schema.resumes.id, resumeId))
    .get();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.delete(schema.resumes).where(eq(schema.resumes.id, resumeId)).run();

  if (row.is_default) {
    const fallback = await db.select().from(schema.resumes).get();
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
