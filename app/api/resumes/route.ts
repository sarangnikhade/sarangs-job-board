import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { parseResume } from "@/lib/parsers/resume";

export const runtime = "nodejs";

/**
 * GET — list all resumes with lightweight previews (no full text body).
 */
export async function GET() {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.resumes.id,
      label: schema.resumes.label,
      file_name: schema.resumes.file_name,
      is_default: schema.resumes.is_default,
      created_at: schema.resumes.created_at,
      updated_at: schema.resumes.updated_at,
      has_text: schema.resumes.text,
    })
    .from(schema.resumes)
    .orderBy(asc(schema.resumes.id))
    .all();

  const resumes = rows.map((r) => ({
    id: r.id,
    label: r.label,
    file_name: r.file_name ?? "",
    is_default: !!r.is_default,
    has_text: !!r.has_text,
    text_length: (r.has_text ?? "").length,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return NextResponse.json({ resumes });
}

/**
 * POST — create a new resume row.
 *
 * Multipart body: { label, file } — parse the file, store text + filename.
 * JSON body: { label } — empty resume, label-only (a slot for later upload).
 */
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  const db = await getDb();
  const now = Date.now();

  let label = "";
  let text: string | null = null;
  let fileName: string | null = null;

  if (ct.startsWith("multipart/")) {
    const form = await req.formData();
    label = String(form.get("label") ?? "").trim();
    const file = form.get("file");
    if (file instanceof File) {
      fileName = file.name || "resume";
      const buf = Buffer.from(await file.arrayBuffer());
      try {
        text = await parseResume(buf, fileName);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "parse failed";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
  } else {
    const body = (await req.json().catch(() => ({}))) as { label?: string };
    label = (body.label ?? "").trim();
  }

  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  // No default yet? Promote this row.
  const existingDefault = await db
    .select({ id: schema.resumes.id })
    .from(schema.resumes)
    .where(eq(schema.resumes.is_default, 1))
    .get();
  const hasDefault = !!existingDefault;

  const inserted = await db
    .insert(schema.resumes)
    .values({
      label,
      text,
      file_name: fileName,
      is_default: hasDefault ? 0 : 1,
      created_at: now,
      updated_at: now,
    })
    .returning()
    .get();

  return NextResponse.json({ resume: inserted });
}
