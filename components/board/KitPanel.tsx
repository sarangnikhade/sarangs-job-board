"use client";

import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import ReactMarkdown from "react-markdown";
import { Copy, RefreshCw, FileText, FileType2 } from "lucide-react";
import type { Kit } from "@/db/schema";

type Props = {
  jobId: number;
};

type ExportPart = "cover" | "bullets" | "questions" | "brief";

function downloadUrl(jobId: number, part: ExportPart, type: "pdf" | "docx") {
  return `/api/jobs/${jobId}/kit/export?part=${part}&type=${type}`;
}

type QShape = { q: string; why_asked: string };

export function KitPanel({ jobId }: Props) {
  const [kit, setKit] = useState<Kit | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetch(`/api/jobs/${jobId}/kit`)
      .then((r) => r.json())
      .then((j: { kit: Kit | null }) => alive && setKit(j.kit))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [jobId]);

  async function generate() {
    setGenerating(true);
    setErr(null);
    const res = await fetch(`/api/jobs/${jobId}/kit`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) {
      setErr((j.error ?? "generation failed").toString().toUpperCase());
      return;
    }
    setKit(j.kit);
  }

  if (loading) {
    return (
      <p className="caption-uppercase" style={{ color: "var(--color-muted-soft)" }}>
        LOADING KIT…
      </p>
    );
  }

  if (!kit) {
    return (
      <div
        style={{
          border: "1px solid var(--color-hairline)",
          padding: "64px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 24,
        }}
      >
        <p className="caption-uppercase" style={{ margin: 0 }}>
          NO KIT YET
        </p>
        <p
          className="body-sm"
          style={{
            margin: 0,
            maxWidth: 460,
            color: "var(--color-muted)",
            lineHeight: 1.6,
          }}
        >
          Runs four prompts in parallel against Claude Sonnet 4: cover
          letter, rewritten resume bullets, five interview questions, and a
          one-page company brief.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={generate}
          disabled={generating}
          style={{ marginTop: 16 }}
        >
          {generating ? "GENERATING…" : "GENERATE KIT"}
        </button>
        {err && (
          <p
            className="caption-uppercase"
            style={{ margin: 0, color: "var(--color-warning)" }}
          >
            {err}
          </p>
        )}
      </div>
    );
  }

  let questions: QShape[] = [];
  try {
    questions = JSON.parse(kit.interview_questions_json ?? "[]");
  } catch {
    questions = [];
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p
          className="caption-uppercase"
          style={{ color: "var(--color-muted-soft)" }}
        >
          GENERATED {ageString(kit.created_at)} · {kit.model_used}
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="btn-icon"
          aria-label="Regenerate"
          title="Regenerate"
        >
          <RefreshCw size={16} strokeWidth={1.25} />
        </button>
      </div>

      {err && <p className="caption-uppercase mb-6">{err}</p>}

      <Tabs.Root defaultValue="cover">
        <Tabs.List
          className="flex gap-6 flex-wrap"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <KitTab value="cover">COVER</KitTab>
          <KitTab value="bullets">BULLETS</KitTab>
          <KitTab value="questions">QUESTIONS</KitTab>
          <KitTab value="brief">BRIEF</KitTab>
        </Tabs.List>

        <Tabs.Content value="cover" className="pt-8">
          <MarkdownBlock text={kit.cover_letter_md ?? ""} jobId={kit.job_id} part="cover" />
        </Tabs.Content>
        <Tabs.Content value="bullets" className="pt-8">
          <MarkdownBlock
            text={kit.resume_bullets_md ?? ""}
            jobId={kit.job_id}
            part="bullets"
          />
        </Tabs.Content>
        <Tabs.Content value="questions" className="pt-8">
          <Questions items={questions} jobId={kit.job_id} />
        </Tabs.Content>
        <Tabs.Content value="brief" className="pt-8">
          <MarkdownBlock
            text={kit.company_brief_md ?? ""}
            jobId={kit.job_id}
            part="brief"
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function KitTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className="nav-link pb-3 data-[state=active]:border-b data-[state=active]:border-white"
    >
      {children}
    </Tabs.Trigger>
  );
}

function MarkdownBlock({
  text,
  jobId,
  part,
}: {
  text: string;
  jobId: number;
  part: ExportPart;
}) {
  return (
    <div className="kit-md">
      <ExportRow
        text={text}
        downloadPdf={downloadUrl(jobId, part, "pdf")}
        downloadDocx={downloadUrl(jobId, part, "docx")}
      />
      <ReactMarkdown
        components={{
          h1: (p) => <h3 className="display-sm mt-6 mb-3" {...p} />,
          h2: (p) => <h4 className="title-md mt-6 mb-2" {...p} />,
          h3: (p) => <h5 className="title-sm mt-4 mb-2" {...p} />,
          p: (p) => (
            <p className="body-md mb-4" {...p} />
          ),
          ul: (p) => <ul className="body-md mb-4 list-disc pl-6 space-y-2" {...p} />,
          ol: (p) => <ol className="body-md mb-4 list-decimal pl-6 space-y-2" {...p} />,
          li: (p) => <li className="body-md" {...p} />,
          strong: (p) => (
            <strong style={{ color: "var(--color-on-dark)", fontWeight: 400 }} {...p} />
          ),
          em: (p) => <em {...p} />,
          a: (p) => <a className="text-link" target="_blank" rel="noreferrer" {...p} />,
          hr: () => (
            <hr
              style={{
                border: 0,
                borderTop: "1px solid var(--color-hairline)",
                margin: "24px 0",
              }}
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function Questions({ items, jobId }: { items: QShape[]; jobId: number }) {
  if (items.length === 0) {
    return (
      <p className="body-md" style={{ color: "var(--color-muted)" }}>
        No questions generated.
      </p>
    );
  }
  const fullText = items
    .map((q, i) => `${i + 1}. ${q.q}\n   Why asked: ${q.why_asked}`)
    .join("\n\n");

  return (
    <div>
      <ExportRow
        text={fullText}
        downloadPdf={downloadUrl(jobId, "questions", "pdf")}
        downloadDocx={downloadUrl(jobId, "questions", "docx")}
      />
      <ol className="space-y-8 list-decimal pl-6">
        {items.map((q, i) => (
          <li key={i}>
            <p className="body-md mb-2" style={{ color: "var(--color-on-dark)" }}>
              {q.q}
            </p>
            {q.why_asked && (
              <p
                className="body-sm"
                style={{ color: "var(--color-muted)", fontStyle: "italic" }}
              >
                {q.why_asked}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ExportRow({
  text,
  downloadPdf,
  downloadDocx,
}: {
  text: string;
  downloadPdf: string;
  downloadDocx: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(text)}
        className="btn-icon"
        aria-label="Copy"
        title="Copy"
      >
        <Copy size={16} strokeWidth={1.25} />
      </button>
      <a
        href={downloadPdf}
        className="btn-icon"
        aria-label="Download PDF"
        title="Download PDF"
      >
        <FileText size={16} strokeWidth={1.25} />
      </a>
      <a
        href={downloadDocx}
        className="btn-icon"
        aria-label="Download DOCX"
        title="Download DOCX"
      >
        <FileType2 size={16} strokeWidth={1.25} />
      </a>
    </div>
  );
}

function ageString(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  const days = Math.floor(hrs / 24);
  return `${days}D AGO`;
}
