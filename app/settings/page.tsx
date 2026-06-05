"use client";

import { useEffect, useRef, useState } from "react";

type ProfileShape = {
  name: string;
  email: string;
  image: string;
};

type ResumeShape = {
  id: number;
  label: string;
  file_name: string;
  is_default: boolean;
  has_text: boolean;
  text_length: number;
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileShape | null>(null);
  const [resumes, setResumes] = useState<ResumeShape[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const [p, r] = await Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/resumes").then((r) => r.json()),
    ]);
    setProfile(p);
    setName(p.name);
    setResumes(r.resumes);
  }

  async function saveProfile() {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) return setFlash("SAVE FAILED");
    setFlash("SAVED");
    refresh();
  }

  return (
    <div className="px-6 md:px-10 pt-[120px] pb-[120px] max-w-3xl mx-auto">
      <p className="caption-uppercase mb-6">SETTINGS / PROFILE</p>
      <h1 className="display-lg">SETTINGS</h1>

      {flash && (
        <p
          className="caption-uppercase mt-6"
          style={{ color: "var(--color-on-dark)" }}
        >
          {flash}
        </p>
      )}

      {/* Profile */}
      <section className="mt-[120px]">
        <h2 className="display-sm mb-10">PROFILE</h2>
        <p
          className="body-md mb-8"
          style={{ color: "var(--color-muted)" }}
        >
          Signed in as{" "}
          <span style={{ color: "var(--color-on-dark)" }}>
            {profile?.email || "…"}
          </span>
        </p>
        <label className="caption-uppercase block mb-2">DISPLAY NAME</label>
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <div className="mt-10">
          <button
            className="btn-primary"
            onClick={saveProfile}
            disabled={saving}
          >
            {saving ? "SAVING…" : "SAVE PROFILE"}
          </button>
        </div>
      </section>

      <div className="hairline-x mt-[120px]" />

      {/* Resumes */}
      <section className="mt-[120px]">
        <h2 className="display-sm mb-4">RESUMES</h2>
        <p
          className="body-md mb-10"
          style={{ color: "var(--color-muted)" }}
        >
          One resume per sector. When you add a job, the system picks the
          best match automatically — you can override per card.
        </p>

        <div>
          {resumes.length === 0 && (
            <p
              className="caption-uppercase py-10 text-center"
              style={{
                border: "1px dashed var(--color-hairline)",
                color: "var(--color-muted)",
              }}
            >
              NO RESUMES YET
            </p>
          )}
          {resumes.map((r) => (
            <ResumeRow key={r.id} resume={r} onChange={refresh} setFlash={setFlash} />
          ))}
        </div>

        <div className="mt-10 flex items-end gap-4">
          <div className="flex-1">
            <label className="caption-uppercase block mb-2">
              NEW RESUME LABEL
            </label>
            <input
              className="text-input"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Product Manager"
            />
          </div>
          <button
            className="btn-primary"
            disabled={!newLabel.trim()}
            onClick={async () => {
              const res = await fetch("/api/resumes", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ label: newLabel.trim() }),
              });
              if (!res.ok) return setFlash("ADD FAILED");
              setNewLabel("");
              setFlash("ADDED");
              refresh();
            }}
          >
            ADD
          </button>
        </div>
      </section>
    </div>
  );
}

function ResumeRow({
  resume,
  onChange,
  setFlash,
}: {
  resume: ResumeShape;
  onChange: () => void;
  setFlash: (s: string | null) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(resume.label);
  const fileRef = useRef<HTMLInputElement>(null);

  async function setDefault() {
    await fetch(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    setFlash("DEFAULT UPDATED");
    onChange();
  }

  async function destroy() {
    if (!confirm(`Delete "${resume.label}"?`)) return;
    await fetch(`/api/resumes/${resume.id}`, { method: "DELETE" });
    setFlash("REMOVED");
    onChange();
  }

  async function rename() {
    if (!label.trim() || label === resume.label) {
      setRenaming(false);
      setLabel(resume.label);
      return;
    }
    await fetch(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
    });
    setRenaming(false);
    setFlash("RENAMED");
    onChange();
  }

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      body: fd,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setFlash(`UPLOAD FAILED — ${j.error ?? ""}`);
    setFlash("FILE UPLOADED");
    onChange();
  }

  async function clearFile() {
    if (!confirm(`Remove file from "${resume.label}"?`)) return;
    await fetch(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
    setFlash("FILE REMOVED");
    onChange();
  }

  return (
    <div
      className="py-6"
      style={{ borderTop: "1px solid var(--color-hairline)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              className="text-input"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={rename}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename();
                if (e.key === "Escape") {
                  setRenaming(false);
                  setLabel(resume.label);
                }
              }}
            />
          ) : (
            <button
              onClick={() => setRenaming(true)}
              className="title-md text-left"
              type="button"
            >
              {resume.label}
              {resume.is_default && (
                <span
                  className="caption-uppercase ml-3"
                  style={{ color: "var(--color-muted)" }}
                >
                  · DEFAULT
                </span>
              )}
            </button>
          )}
          <p
            className="caption-uppercase mt-2"
            style={{ color: "var(--color-muted-soft)" }}
          >
            {resume.has_text
              ? `${resume.file_name || "TEXT ONLY"} · ${resume.text_length} CHARS`
              : "NO FILE YET — UPLOAD A PDF / DOCX / TXT"}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="caption-uppercase"
          >
            {resume.has_text ? "REPLACE" : "UPLOAD"}
          </button>
          {!resume.is_default && (
            <button
              type="button"
              onClick={setDefault}
              className="caption-uppercase"
            >
              SET DEFAULT
            </button>
          )}
          {resume.has_text && (
            <button
              type="button"
              onClick={clearFile}
              className="caption-uppercase"
              style={{ color: "var(--color-muted)" }}
            >
              CLEAR
            </button>
          )}
          <button
            type="button"
            onClick={destroy}
            className="caption-uppercase"
            style={{ color: "var(--color-muted)" }}
          >
            DELETE
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
