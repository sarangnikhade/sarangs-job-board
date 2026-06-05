import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { JobStatus } from "@/db/schema";

export const runtime = "nodejs";

const STATUSES: JobStatus[] = [
  "wishlist",
  "applied",
  "interviewing",
  "offer",
  "rejected",
];

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const job = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, Number(id)))
    .get();
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Partial<{
    status: JobStatus;
    position: number;
    notes: string;
    title: string;
    company: string;
    location: string;
    resume_id: number | null;
  }>;

  const patch: Record<string, unknown> = { updated_at: Date.now() };
  if (body.status && STATUSES.includes(body.status)) patch.status = body.status;
  if (typeof body.position === "number") patch.position = body.position;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.title !== undefined) patch.title = body.title;
  if (body.company !== undefined) patch.company = body.company;
  if (body.location !== undefined) patch.location = body.location;
  if (body.resume_id !== undefined) patch.resume_id = body.resume_id;

  const db = await getDb();
  const updated = await db
    .update(schema.jobs)
    .set(patch)
    .where(eq(schema.jobs.id, Number(id)))
    .returning()
    .get();
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ job: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  await db.delete(schema.jobs).where(eq(schema.jobs.id, Number(id))).run();
  return NextResponse.json({ ok: true });
}
