import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  KIT_PART_TITLES,
  exportFileName,
  kitPartMarkdown,
  type KitPart,
} from "@/lib/exports/format";
import { renderDocx } from "@/lib/exports/docx";
import { renderPdf } from "@/lib/exports/pdf";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const KIT_PARTS: KitPart[] = ["cover", "bullets", "questions", "brief"];

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const part = url.searchParams.get("part") as KitPart | null;
  const type = url.searchParams.get("type") as "pdf" | "docx" | null;

  if (!part || !KIT_PARTS.includes(part)) {
    return jsonError("invalid part", 400);
  }
  if (!type || (type !== "pdf" && type !== "docx")) {
    return jsonError("invalid type", 400);
  }

  const db = await getDb();
  const job = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, Number(id)))
    .get();
  if (!job) return jsonError("job not found", 404);

  const kit = await db
    .select()
    .from(schema.kits)
    .where(eq(schema.kits.job_id, job.id))
    .orderBy(desc(schema.kits.created_at))
    .get();
  if (!kit) return jsonError("no kit generated yet", 404);

  const md = kitPartMarkdown(kit, part);
  if (!md.trim()) return jsonError(`${part} is empty`, 404);

  const headerTitle = `${KIT_PART_TITLES[part]} — ${job.title}`;
  const subtitle = job.company + (job.location ? ` · ${job.location}` : "");

  let buf: Buffer;
  let mime: string;
  try {
    if (type === "docx") {
      buf = await renderDocx({ title: headerTitle, subtitle, markdown: md });
      mime =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else {
      buf = await renderPdf({ title: headerTitle, subtitle, markdown: md });
      mime = "application/pdf";
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "render failed";
    return jsonError(msg, 500);
  }

  const fname = exportFileName({
    title: job.title,
    company: job.company,
    part,
    ext: type,
  });

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": mime,
      "content-disposition": `attachment; filename="${fname}"`,
      "cache-control": "no-store",
    },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
