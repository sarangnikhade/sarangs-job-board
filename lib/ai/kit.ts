import "server-only";
import { openrouterClient, MODEL } from "@/lib/openrouter";

export type InterviewQuestion = { q: string; why_asked: string };

export type GeneratedKit = {
  cover_letter_md: string;
  resume_bullets_md: string;
  interview_questions_json: string; // JSON-encoded InterviewQuestion[]
  company_brief_md: string;
};

type KitInputs = {
  title: string;
  company: string;
  description: string;
  resumeText: string; // may be empty
};

/**
 * Run all four kit prompts in parallel against OpenRouter
 * (anthropic/claude-sonnet-4). Each call has a tight max_tokens budget so
 * a single user with a small OpenRouter credit balance can still get a
 * full kit. If any sub-prompt errors, that field falls back to a clear
 * error marker so the user can regenerate that piece alone.
 */
export async function generateKit(input: KitInputs): Promise<GeneratedKit> {
  const client = await openrouterClient();
  const { title, company, description, resumeText } = input;

  const ctxJob = `JOB TITLE: ${title}\nCOMPANY: ${company}\n\n--- JOB DESCRIPTION ---\n${description.slice(0, 8000)}`;
  const ctxResume = resumeText
    ? `--- CANDIDATE RESUME ---\n${resumeText.slice(0, 6000)}`
    : "";

  async function run(opts: {
    system: string;
    user: string;
    max_tokens: number;
    label: string;
  }) {
    try {
      const res = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        max_tokens: opts.max_tokens,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      });
      const out = res.choices[0]?.message?.content?.trim() ?? "";
      return out || `_(empty response from ${opts.label})_`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      return `_(${opts.label} generation failed: ${msg})_`;
    }
  }

  const [cover, bullets, questionsRaw, brief] = await Promise.all([
    run({
      label: "cover letter",
      max_tokens: 700,
      system:
        "You are an experienced job-search coach. Write a tailored cover letter for the candidate based STRICTLY on their resume — do not invent experience, employers, dates, or skills they do not have. " +
        "Output: markdown only, no preamble. Greeting, three short paragraphs (hook + relevant experience + fit/CTA), then closing. " +
        "Target ~300 words. Voice: professional, confident, specific. No clichés ('hard-working team player').",
      user: `${ctxJob}\n\n${ctxResume || "(No resume on file — write a generic but role-appropriate letter that does not fabricate experience.)"}`,
    }),
    run({
      label: "resume bullets",
      max_tokens: 700,
      system:
        "Rewrite 5–8 bullets from the candidate's existing resume so they mirror the keywords and outcomes the job description asks for. " +
        "Use STAR shape implicitly (situation+action+measurable result), past tense, strong verbs, quantified where possible. " +
        "Do NOT invent metrics, employers, or skills not in the resume — rephrase what exists. " +
        "Output: a single markdown unordered list, no preamble, no headings.",
      user: `${ctxJob}\n\n${ctxResume || "(No resume on file — return ONE bullet noting that a resume must be uploaded in Settings before tailored bullets can be produced.)"}`,
    }),
    run({
      label: "interview questions",
      max_tokens: 600,
      system:
        "List exactly five likely interview questions for this role. " +
        "Output: ONE compact JSON array, no prose, no markdown fences. Shape: " +
        '[{"q":"…","why_asked":"…"}]. Each "why_asked" is one sentence explaining what the interviewer is probing for.',
      user: ctxJob,
    }),
    run({
      label: "company brief",
      max_tokens: 800,
      system:
        "Produce a one-page company brief for an interviewing candidate, derived STRICTLY from the job posting text (no external knowledge — you may be wrong about the company). " +
        "Begin with a one-line italic caveat: '_Based on this job posting only — verify before your interview._' " +
        "Then markdown sections: What they appear to do · Team / role context · Likely values & ways of working · Talking points / smart questions to ask. " +
        "Concise, scannable, no padding.",
      user: ctxJob,
    }),
  ]);

  return {
    cover_letter_md: cover,
    resume_bullets_md: bullets,
    interview_questions_json: normalizeQuestions(questionsRaw),
    company_brief_md: brief,
  };
}

/**
 * Coerce the questions output into a valid JSON-encoded array string.
 * If the model returned prose or bad JSON, wrap it as a single fallback
 * entry so the UI still renders.
 */
function normalizeQuestions(raw: string): string {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return JSON.stringify(parsed);
  } catch {
    // fall through
  }
  return JSON.stringify([{ q: cleaned, why_asked: "" }]);
}
