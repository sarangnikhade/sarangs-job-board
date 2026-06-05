import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { generateKit } from "@/lib/ai/kit";
import { MODEL } from "@/lib/openrouter";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;
  const db = await getDb();
  // Verify ownership of the job before exposing its kit.
  const job = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.id, Number(id)),
        eq(schema.jobs.user_id, session.userId),
      ),
    )
    .get();
  if (!job) return NextResponse.json({ kit: null });

  const row = await db
    .select()
    .from(schema.kits)
    .where(eq(schema.kits.job_id, Number(id)))
    .orderBy(desc(schema.kits.created_at))
    .get();
  return NextResponse.json({ kit: row ?? null });
}

export async function POST(_req: Request, ctx: Ctx) {
  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;
  const jobId = Number(id);
  const db = await getDb();

  const job = await db
    .select()
    .from(schema.jobs)
    .where(
      and(eq(schema.jobs.id, jobId), eq(schema.jobs.user_id, session.userId)),
    )
    .get();
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  let resumeText = "";
  if (job.resume_id != null) {
    const r = await db
      .select({ text: schema.resumes.text })
      .from(schema.resumes)
      .where(
        and(
          eq(schema.resumes.id, job.resume_id),
          eq(schema.resumes.user_id, session.userId),
        ),
      )
      .get();
    resumeText = r?.text ?? "";
  }
  if (!resumeText) {
    const def = await db
      .select({ text: schema.resumes.text })
      .from(schema.resumes)
      .where(
        and(
          eq(schema.resumes.user_id, session.userId),
          eq(schema.resumes.is_default, 1),
        ),
      )
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
