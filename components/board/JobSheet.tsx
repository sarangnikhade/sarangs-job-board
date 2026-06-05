"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { X, ChevronDown, ExternalLink, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { KitPanel } from "./KitPanel";
import type { Job, JobStatus } from "@/db/schema";

type ResumeRow = { id: number; label: string; is_default: boolean };

const STATUS_LABELS: Record<JobStatus, string> = {
  wishlist: "WISHLIST",
  applied: "APPLIED",
  interviewing: "INTERVIEWING",
  offer: "OFFER",
  rejected: "REJECTED",
};
const STATUSES = Object.keys(STATUS_LABELS) as JobStatus[];

export function JobSheet() {
  const openJobId = useApp((s) => s.openJobId);
  const closeJob = useApp((s) => s.closeJob);
  const bump = useApp((s) => s.bumpJobs);

  const [job, setJob] = useState<Job | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [resumes, setResumes] = useState<ResumeRow[]>([]);

  useEffect(() => {
    if (openJobId == null) {
      setJob(null);
      return;
    }
    let alive = true;
    Promise.all([
      fetch(`/api/jobs/${openJobId}`).then((r) => r.json()),
      fetch("/api/resumes").then((r) => r.json()),
    ]).then(([j, r]) => {
      if (!alive) return;
      setJob(j.job);
      setNotes(j.job.notes ?? "");
      setResumes(r.resumes);
    });
    return () => {
      alive = false;
    };
  }, [openJobId]);

  async function patch(body: Record<string, unknown>) {
    if (!job) return;
    setSaving(true);
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      const j = (await res.json()) as { job: Job };
      setJob(j.job);
      bump();
    }
  }

  async function destroy() {
    if (!job) return;
    if (!confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
    bump();
    closeJob();
  }

  return (
    <Dialog.Root
      open={openJobId != null}
      onOpenChange={(o) => !o && closeJob()}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.75)" }}
        />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 h-full w-full sm:w-[640px] md:w-[760px] lg:w-[860px] xl:w-[960px] outline-none overflow-y-auto"
          style={{
            background: "var(--color-canvas)",
            borderLeft: "1px solid var(--color-hairline)",
          }}
          aria-describedby={undefined}
        >
          {job && (
            <div className="p-10">
              {/* Header */}
              <div className="flex items-start justify-between gap-6 mb-8">
                <div className="min-w-0 flex-1">
                  <p className="caption-uppercase mb-2">{job.company}</p>
                  <Dialog.Title className="display-md break-words">
                    {job.title}
                  </Dialog.Title>
                  {job.location && (
                    <p
                      className="caption-uppercase mt-2"
                      style={{ color: "var(--color-muted-soft)" }}
                    >
                      {job.location}
                    </p>
                  )}
                </div>
                <Dialog.Close
                  className="btn-icon shrink-0"
                  aria-label="Close"
                >
                  <X size={16} strokeWidth={1.25} />
                </Dialog.Close>
              </div>

              {/* Action row */}
              <div className="flex items-center gap-3 mb-10 flex-wrap">
                <StatusPicker
                  value={job.status}
                  onChange={(s) => patch({ status: s })}
                />
                <ResumePicker
                  value={job.resume_id ?? null}
                  options={resumes}
                  onChange={(id) => patch({ resume_id: id })}
                />
                {job.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-icon"
                    aria-label="Open posting"
                  >
                    <ExternalLink size={16} strokeWidth={1.25} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={destroy}
                  className="btn-icon"
                  aria-label="Delete"
                >
                  <Trash2 size={16} strokeWidth={1.25} />
                </button>
                {saving && (
                  <span className="caption-uppercase ml-auto">SAVING…</span>
                )}
              </div>

              {/* Tabs */}
              <Tabs.Root defaultValue="overview">
                <Tabs.List
                  className="flex gap-8"
                  style={{ borderBottom: "1px solid var(--color-hairline)" }}
                >
                  <SheetTab value="overview">OVERVIEW</SheetTab>
                  <SheetTab value="kit">KIT</SheetTab>
                  <SheetTab value="notes">NOTES</SheetTab>
                </Tabs.List>

                <Tabs.Content value="overview" className="pt-10">
                  <pre
                    className="body-md whitespace-pre-wrap"
                    style={{ fontFamily: "var(--font-text)" }}
                  >
                    {job.description || job.source_text || "No description."}
                  </pre>
                </Tabs.Content>

                <Tabs.Content value="kit" className="pt-10">
                  <KitPanel jobId={job.id} />
                </Tabs.Content>

                <Tabs.Content value="notes" className="pt-10">
                  <label className="caption-uppercase block mb-2">NOTES</label>
                  <textarea
                    className="text-input"
                    rows={12}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => {
                      if ((job.notes ?? "") !== notes) patch({ notes });
                    }}
                    placeholder="Recruiter contacts, interview prep, links, anything."
                    style={{
                      height: "auto",
                      minHeight: 240,
                      paddingTop: 12,
                    }}
                  />
                </Tabs.Content>
              </Tabs.Root>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SheetTab({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Tabs.Trigger
      value={value}
      className="nav-link pb-3 data-[state=active]:border-b data-[state=active]:border-white"
    >
      {children}
    </Tabs.Trigger>
  );
}

function ResumePicker({
  value,
  options,
  onChange,
}: {
  value: number | null;
  options: ResumeRow[];
  onChange: (id: number | null) => void;
}) {
  const current = options.find((r) => r.id === value);
  const fallbackDefault = options.find((r) => r.is_default);
  const label = current
    ? current.label.toUpperCase()
    : fallbackDefault
      ? `${fallbackDefault.label.toUpperCase()} · DEFAULT`
      : "NO RESUME";

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          className="flex items-center gap-2 px-4"
          style={{
            border: "1px solid var(--color-on-dark)",
            borderRadius: 9999,
            minHeight: 40,
            background: "transparent",
            color: "var(--color-on-dark)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          RESUME: {label}
          <ChevronDown size={14} strokeWidth={1.25} />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="start"
          sideOffset={8}
          className="z-50 py-2"
          style={{
            background: "var(--color-canvas)",
            border: "1px solid var(--color-hairline)",
            minWidth: 220,
          }}
        >
          <Dropdown.Item
            onSelect={() => onChange(null)}
            className="nav-link px-4 py-2 cursor-pointer outline-none data-[highlighted]:bg-[var(--color-surface-card)]"
          >
            USE DEFAULT
          </Dropdown.Item>
          {options.map((r) => (
            <Dropdown.Item
              key={r.id}
              onSelect={() => onChange(r.id)}
              className="nav-link px-4 py-2 cursor-pointer outline-none data-[highlighted]:bg-[var(--color-surface-card)]"
            >
              {r.label.toUpperCase()}
              {r.is_default && (
                <span style={{ color: "var(--color-muted)" }}> · DEFAULT</span>
              )}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function StatusPicker({
  value,
  onChange,
}: {
  value: JobStatus;
  onChange: (s: JobStatus) => void;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          className="flex items-center gap-2 px-4"
          style={{
            border: "1px solid var(--color-on-dark)",
            borderRadius: 9999,
            minHeight: 40,
            background: "transparent",
            color: "var(--color-on-dark)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          {STATUS_LABELS[value]}
          <ChevronDown size={14} strokeWidth={1.25} />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="start"
          sideOffset={8}
          className="z-50 py-2"
          style={{
            background: "var(--color-canvas)",
            border: "1px solid var(--color-hairline)",
            minWidth: 180,
          }}
        >
          {STATUSES.map((s) => (
            <Dropdown.Item
              key={s}
              onSelect={() => onChange(s)}
              className="nav-link px-4 py-2 cursor-pointer outline-none data-[highlighted]:bg-[var(--color-surface-card)]"
            >
              {STATUS_LABELS[s]}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
