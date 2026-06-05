"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

type Mode = "url" | "paste";

export function AddJobDialog({ open, onOpenChange, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setUrl("");
    setText("");
    setErr(null);
    setMode("url");
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    const payload: Record<string, string> =
      mode === "url" ? { url } : { text };
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr((j.error ?? "request failed").toString().toUpperCase());
      return;
    }
    if (j.needsPaste) {
      setErr(
        `COULD NOT FETCH (${j.reason ?? "unknown"}). PASTE THE POSTING BELOW.`,
      );
      setMode("paste");
      return;
    }
    reset();
    onOpenChange(false);
    onCreated?.();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.85)" }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[560px] p-10 outline-none"
          style={{
            background: "var(--color-canvas)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          <div className="flex items-center justify-between mb-8">
            <Dialog.Title className="display-sm">ADD JOB</Dialog.Title>
            <Dialog.Close className="btn-icon" aria-label="Close">
              <X size={16} strokeWidth={1.25} />
            </Dialog.Close>
          </div>

          <Tabs.Root
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            className="mb-8"
          >
            <Tabs.List className="flex gap-8 border-b border-[var(--color-hairline)]">
              <Tabs.Trigger
                value="url"
                className="nav-link pb-3 data-[state=active]:border-b data-[state=active]:border-white"
              >
                URL
              </Tabs.Trigger>
              <Tabs.Trigger
                value="paste"
                className="nav-link pb-3 data-[state=active]:border-b data-[state=active]:border-white"
              >
                PASTE TEXT
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="url" className="pt-8">
              <label className="caption-uppercase block mb-2">
                JOB POSTING URL
              </label>
              <input
                className="text-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                type="url"
                autoFocus
              />
            </Tabs.Content>

            <Tabs.Content value="paste" className="pt-8">
              <label className="caption-uppercase block mb-2">
                JOB POSTING TEXT
              </label>
              <textarea
                className="text-input"
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the full job description here…"
                style={{ height: "auto", minHeight: 200, paddingTop: 12 }}
              />
            </Tabs.Content>
          </Tabs.Root>

          {err && <p className="caption-uppercase mb-6">{err}</p>}

          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={submit}
              disabled={busy || (mode === "url" ? !url : text.length < 50)}
            >
              {busy ? "WORKING…" : "SUBMIT"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
