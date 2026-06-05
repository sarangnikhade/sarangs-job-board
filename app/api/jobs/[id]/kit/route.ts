import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { generateKit } from "@/lib/ai/kit";
import { MODEL } from "@/lib/openrouter";

export const runtime = "nodejs";
// Kit generation runs four LLM calls in parallel — give it room.
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Return the most recent kit row for this job, if any. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const row = await db
    .select()
    .from(schema.kits)
    .where(eq(schema.kits.job_id, Number(id)))
    .orderBy(desc(schema.kits.created_at))
    .get();
  return NextResponse.json({ kit: row ?? null });
}

/**
 * Generate a fresh kit for this job. Replaces any existing kit row.
 * Body is empty — all inputs come from the persisted job + profile.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const jobId = Number(id);
  const db = await getDb();

  const job = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, jobId))
    .get();
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  // Resolve which resume to use: explicit job.resume_id, else default.
  let resumeText = "";
  if (job.resume_id != null) {
    const r = await db
      .select({ text: schema.resumes.text })
      .from(schema.resumes)
      .where(eq(schema.resumes.id, job.resume_id))
      .get();
    resumeText = r?.text ?? "";
  }
  if (!resumeText) {
    const def = await db
      .select({ text: schema.resumes.text })
      .from(schema.resumes)
      .where(eq(schema.resumes.is_default, 1))
      .get();
    resumeText = def?.text ?? "";
  }

  let kit;
  try {
    kit = await generateKit({
      title: job.title,
      company: job.company,
      description: job.description ?? job.source_text ?? "",
      resumeText,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "kit generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Replace any existing kit row for this job.
  await db.delete(schema.kits).where(eq(schema.kits.job_id, jobId)).run();
  const inserted = await db
    .insert(schema.kits)
    .values({
      job_id: jobId,
      cover_letter_md: kit.cover_letter_md,
      resume_bullets_md: kit.resume_bullets_md,
      interview_questions_json: kit.interview_questions_json,
      company_brief_md: kit.company_brief_md,
      model_used: MODEL,
      created_at: Date.now(),
    })
    .returning()
    .get();

  return NextResponse.json({ kit: inserted });
}
