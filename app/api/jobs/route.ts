import { NextResponse } from "next/server";
import { asc, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { fetchAndExtract } from "@/lib/parsers/url";
import { extractJob } from "@/lib/ai/extract";

export const runtime = "nodejs";

/**
 * GET — list every job, grouped client-side by status.
 * Ordered: status then position then id.
 */
export async function GET() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.jobs)
    .orderBy(asc(schema.jobs.status), asc(schema.jobs.position), asc(schema.jobs.id))
    .all();
  return NextResponse.json({ jobs: rows });
}

/**
 * POST — create a new job from { url } or { text }.
 *
 * URL flow: fetch → Readability → LLM extract. If fetch fails the
 * response carries { needsPaste: true, reason } so the UI can swap
 * to a paste textarea.
 *
 * Text flow: LLM extract directly.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    text?: string;
  };

  let sourceText = "";
  let sourceUrl: string | null = null;

  if (body.url && body.url.trim()) {
    sourceUrl = body.url.trim();
    const result = await fetchAndExtract(sourceUrl);
    if (!result.ok) {
      return NextResponse.json(
        { needsPaste: true, reason: result.reason },
        { status: 200 },
      );
    }
    sourceText = result.text;
  } else if (body.text && body.text.trim().length > 50) {
    sourceText = body.text.trim();
  } else {
    return NextResponse.json(
      { error: "Provide a url or pasted text (min 50 chars)" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const now = Date.now();

  // Hand the LLM the list of saved resume labels so it can auto-tag.
  const resumeRows = await db
    .select({
      id: schema.resumes.id,
      label: schema.resumes.label,
      is_default: schema.resumes.is_default,
    })
    .from(schema.resumes)
    .all();
  const labels = resumeRows.map((r) => r.label);

  let extracted;
  try {
    extracted = await extractJob(sourceText, labels);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "extract failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Resolve resume_id: pick the LLM's chosen label, fall back to default.
  let resumeId: number | null = null;
  if (extracted.resume_label) {
    resumeId =
      resumeRows.find((r) => r.label === extracted.resume_label)?.id ?? null;
  }
  if (resumeId == null) {
    resumeId = resumeRows.find((r) => r.is_default)?.id ?? null;
  }

  // Insert at the top of Wishlist (position = min - 1).
  const posRow = await db
    .select({ p: sql<number>`COALESCE(MIN(${schema.jobs.position}), 0) - 1` })
    .from(schema.jobs)
    .where(sql`${schema.jobs.status} = 'wishlist'`)
    .get();
  const nextPos = posRow?.p ?? -1;

  const inserted = await db
    .insert(schema.jobs)
    .values({
      title: extracted.title,
      company: extracted.company,
      location: extracted.location || null,
      url: sourceUrl,
      source_text: sourceText,
      description: extracted.description,
      status: "wishlist",
      position: nextPos,
      resume_id: resumeId,
      created_at: now,
      updated_at: now,
    })
    .returning()
    .get();

  return NextResponse.json({ job: inserted });
}
