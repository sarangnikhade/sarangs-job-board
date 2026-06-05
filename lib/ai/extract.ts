import "server-only";
import { openrouterClient, MODEL } from "@/lib/openrouter";

export type ExtractedJob = {
  title: string;
  company: string;
  location: string;
  description: string;
  /** Best-matching label from `availableLabels`, or "" if no good match. */
  resume_label: string;
};

/**
 * Pass raw job-posting text (from URL fetch or paste) through Claude
 * to extract the canonical fields plus the best-matching resume label
 * from the user's saved resumes.
 *
 * description is kept verbatim from the input (trimmed) so kit prompts
 * see the real posting, not a model paraphrase.
 */
export async function extractJob(
  rawText: string,
  availableLabels: string[] = [],
): Promise<ExtractedJob> {
  const client = await openrouterClient();
  const trimmed = rawText.slice(0, 18000); // keep prompt cheap

  const labelsClause =
    availableLabels.length > 0
      ? ` Also choose the single best-matching resume label from this list: [${availableLabels
          .map((l) => `"${l}"`)
          .join(", ")}]. If none is a good match return "". Include the chosen value as "resume_label".`
      : "";

  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 400,
    messages: [
      {
        role: "system",
        content:
          "You extract structured fields from a job posting. " +
          'Reply with ONE compact JSON object: {"title":"…","company":"…","location":"…","resume_label":"…"}. ' +
          "No prose, no markdown fences. If a field is unknown, use an empty string. " +
          "Location should be the work location as-stated (city, country, or 'Remote'). " +
          "Title is the role title only — never include the company or seniority noise like '(m/w/d)'." +
          labelsClause,
      },
      { role: "user", content: trimmed },
    ],
  });

  const raw = res.choices[0]?.message?.content?.trim() ?? "{}";
  const json = stripFences(raw);
  let parsed: Partial<ExtractedJob>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Model returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const pickedLabel = (parsed.resume_label ?? "").trim();
  const safeLabel = availableLabels.includes(pickedLabel) ? pickedLabel : "";

  return {
    title: (parsed.title ?? "").trim() || "Untitled role",
    company: (parsed.company ?? "").trim() || "Unknown company",
    location: (parsed.location ?? "").trim(),
    description: trimmed.trim(),
    resume_label: safeLabel,
  };
}

function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}
