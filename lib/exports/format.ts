/**
 * Per-kit-part formatting helpers shared by the PDF and DOCX exporters.
 */

import type { Kit } from "@/db/schema";

export type KitPart = "cover" | "bullets" | "questions" | "brief";

export const KIT_PART_TITLES: Record<KitPart, string> = {
  cover: "Cover Letter",
  bullets: "Resume Bullets",
  questions: "Interview Questions",
  brief: "Company Brief",
};

/**
 * Return the markdown body for a given kit part. Questions are stored as
 * JSON, so render them into the same numbered-list markdown shape the UI
 * shows.
 */
export function kitPartMarkdown(kit: Kit, part: KitPart): string {
  switch (part) {
    case "cover":
      return kit.cover_letter_md ?? "";
    case "bullets":
      return kit.resume_bullets_md ?? "";
    case "brief":
      return kit.company_brief_md ?? "";
    case "questions": {
      try {
        const arr = JSON.parse(kit.interview_questions_json ?? "[]") as {
          q: string;
          why_asked?: string;
        }[];
        if (!Array.isArray(arr) || arr.length === 0) return "";
        return arr
          .map(
            (it, i) =>
              `${i + 1}. ${it.q}${
                it.why_asked ? `\n\n   _Why asked: ${it.why_asked}_` : ""
              }`,
          )
          .join("\n\n");
      } catch {
        return kit.interview_questions_json ?? "";
      }
    }
  }
}

export function exportFileName(opts: {
  title: string;
  company: string;
  part: KitPart;
  ext: "pdf" | "docx";
}): string {
  const slug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 40);
  return `${slug(opts.company)}_${slug(opts.title)}_${opts.part}.${opts.ext}`;
}
