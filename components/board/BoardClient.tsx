"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useApp } from "@/lib/store";
import type { Job, JobStatus } from "@/db/schema";

const COLUMNS: { id: JobStatus; label: string }[] = [
  { id: "wishlist", label: "WISHLIST" },
  { id: "applied", label: "APPLIED" },
  { id: "interviewing", label: "INTERVIEWING" },
  { id: "offer", label: "OFFER" },
  { id: "rejected", label: "REJECTED" },
];

const cardId = (id: number) => `card-${id}`;
const colId = (s: JobStatus) => `col-${s}`;
const parseId = (s: string): { kind: "card" | "col"; raw: string } => ({
  kind: s.startsWith("card-") ? "card" : "col",
  raw: s.replace(/^(card-|col-)/, ""),
});

export function BoardClient() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const version = useApp((s) => s.jobsVersion);
  const bump = useApp((s) => s.bumpJobs);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((j: { jobs: Job[] }) => alive && setJobs(j.jobs))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [version]);

  const grouped = useMemo(() => {
    const g = Object.fromEntries(COLUMNS.map((c) => [c.id, [] as Job[]])) as Record<
      JobStatus,
      Job[]
    >;
    for (const j of jobs) g[j.status].push(j);
    for (const k of Object.keys(g) as JobStatus[]) {
      g[k].sort((a, b) => a.position - b.position || a.id - b.id);
    }
    return g;
  }, [jobs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeJob = activeId
    ? jobs.find((j) => cardId(j.id) === activeId) ?? null
    : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const a = parseId(String(active.id));
    const o = parseId(String(over.id));
    if (a.kind !== "card") return;

    const movedId = Number(a.raw);
    const moved = jobs.find((j) => j.id === movedId);
    if (!moved) return;

    // Resolve target column + insertion index.
    let targetCol: JobStatus;
    let targetIndex: number;

    if (o.kind === "col") {
      targetCol = o.raw as JobStatus;
      targetIndex = grouped[targetCol].filter((j) => j.id !== movedId).length;
    } else {
      const overJob = jobs.find((j) => j.id === Number(o.raw));
      if (!overJob) return;
      targetCol = overJob.status;
      const colJobs = grouped[targetCol].filter((j) => j.id !== movedId);
      const idx = colJobs.findIndex((j) => j.id === overJob.id);
      targetIndex = idx < 0 ? colJobs.length : idx;
    }

    // Compute new position as midpoint between neighbors (excluding the
    // moved card to handle within-column reorder cleanly).
    const colWithoutMoved = grouped[targetCol].filter((j) => j.id !== movedId);
    const prev = colWithoutMoved[targetIndex - 1];
    const next = colWithoutMoved[targetIndex];
    let newPos: number;
    if (!prev && !next) newPos = 0;
    else if (!prev) newPos = next.position - 1;
    else if (!next) newPos = prev.position + 1;
    else newPos = (prev.position + next.position) / 2;

    if (moved.status === targetCol && moved.position === newPos) return;

    // Optimistic update.
    setJobs((prevJobs) =>
      prevJobs.map((j) =>
        j.id === movedId ? { ...j, status: targetCol, position: newPos } : j,
      ),
    );

    // Persist + revalidate.
    const res = await fetch(`/api/jobs/${movedId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: targetCol, position: newPos }),
    });
    if (!res.ok) bump(); // refetch truth from server on failure
  }

  return (
    <div className="px-6 md:px-10 pb-[120px]">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div
          className="grid gap-10 overflow-x-auto"
          style={{ gridTemplateColumns: "repeat(5, minmax(240px, 1fr))" }}
        >
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              col={col}
              jobs={grouped[col.id]}
              loading={loading}
            />
          ))}
        </div>

        <DragOverlay>
          {activeJob ? <CardChrome job={activeJob} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  col,
  jobs,
  loading,
}: {
  col: { id: JobStatus; label: string };
  jobs: Job[];
  loading: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colId(col.id) });

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="display-sm">{col.label}</h2>
        <span className="caption-uppercase">{jobs.length}</span>
      </div>

      <SortableContext
        id={colId(col.id)}
        items={jobs.map((j) => cardId(j.id))}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="min-h-32"
          style={{
            background: jobs.length ? "var(--color-surface-card)" : "transparent",
            outline: isOver ? "1px solid var(--color-on-dark)" : "none",
          }}
        >
          {jobs.length === 0 ? (
            <div
              className="py-16 px-4 text-center"
              style={{ border: "1px dashed var(--color-hairline)" }}
            >
              <span className="caption-uppercase">
                {loading ? "LOADING…" : "DROP JOB HERE"}
              </span>
            </div>
          ) : (
            jobs.map((j, i) => (
              <SortableCard key={j.id} job={j} first={i === 0} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({ job, first }: { job: Job; first: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cardId(job.id) });
  const openJob = useApp((s) => s.openJob);
  const downRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // dnd-kit's PointerSensor calls preventDefault on pointerdown which
  // suppresses the synthesized click event. Detect a "click" manually:
  // if pointerup lands within 6px and 350ms of pointerdown, treat as click.
  const dndOnPointerDown = listeners?.onPointerDown;
  const dndOnKeyDown = listeners?.onKeyDown;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      {...attributes}
      role="button"
      tabIndex={0}
      onPointerDown={(e) => {
        downRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        dndOnPointerDown?.(e as unknown as PointerEvent);
      }}
      onPointerUp={(e) => {
        const d = downRef.current;
        downRef.current = null;
        if (!d || isDragging) return;
        const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
        if (dist < 6 && Date.now() - d.t < 350) {
          openJob(job.id);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          // Don't preempt dnd-kit keyboard sortable on Space alone — only
          // open on Enter; let Space go to dnd-kit for drag activation.
          if (e.key === "Enter") {
            e.preventDefault();
            openJob(job.id);
            return;
          }
        }
        dndOnKeyDown?.(e as unknown as KeyboardEvent);
      }}
    >
      <CardChrome job={job} first={first} />
    </div>
  );
}

function CardChrome({
  job,
  first,
  dragging,
}: {
  job: Job;
  first?: boolean;
  dragging?: boolean;
}) {
  const days = Math.floor((Date.now() - job.created_at) / 86_400_000);
  return (
    <article
      className="p-6 select-none"
      style={{
        borderTop: first ? "none" : "1px solid var(--color-hairline)",
        background: dragging ? "var(--color-surface-elevated)" : "transparent",
        cursor: "grab",
      }}
    >
      <h3 className="title-md mb-2 line-clamp-2">{job.title}</h3>
      <p className="caption-uppercase mb-1">{job.company}</p>
      {job.location && (
        <p
          className="caption-uppercase mb-1"
          style={{ color: "var(--color-muted-soft)" }}
        >
          {job.location}
        </p>
      )}
      <p
        className="caption-uppercase mt-3"
        style={{ color: "var(--color-muted-soft)" }}
      >
        {days === 0 ? "TODAY" : `${days}D AGO`}
      </p>
    </article>
  );
}
