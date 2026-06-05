import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { parseResume } from "@/lib/parsers/resume";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  const name = file.name || "resume";
  const buf = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    text = await parseResume(buf, name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parse failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const db = await getDb();
  await db
    .update(schema.profile)
    .set({
      resume_text: text,
      resume_file_name: name,
      updated_at: Date.now(),
    })
    .where(eq(schema.profile.id, 1))
    .run();

  return NextResponse.json({
    ok: true,
    file_name: name,
    text_length: text.length,
    preview: text.slice(0, 600),
  });
}
