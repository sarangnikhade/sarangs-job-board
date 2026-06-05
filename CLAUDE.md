# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working directory gotcha

The app lives at `sarangs-job-board/` inside a parent path with **spaces in every segment**
(`D:\Personal\Projects\Agentic\11. Master Class\1. Job Tracking App\sarangs-job-board`). The Bash
tool's cwd has been seen to drift between calls — always prefix every command with
`cd /d/Personal/Projects/Agentic/11.\ Master\ Class/1.\ Job\ Tracking\ App/sarangs-job-board &&`,
or you risk `npm install` populating a stray `package.json` in the parent dir.

`netlify deploy --build` from this path fails inside `@netlify/plugin-nextjs` (basename
of tempPublishDir collides with spaces). Production hosting is **Vercel**, not Netlify.

## Next.js 16 — read inline docs

This is Next.js 16 (Turbopack). Several conventions differ from training data — most
notably `middleware.ts` is deprecated in favor of `proxy.ts`, and route handlers use
the App Router file conventions. Before changing any framework-level file (layouts,
route handlers, middleware, font loaders), grep the docs at `node_modules/next/dist/docs/`
for the relevant section.

## Commands

```
npm run dev      # local dev (libsql opens db/data.sqlite by default)
npm run build    # production build — always passes before push
npm run lint     # ESLint via eslint-config-next
vercel --prod --yes   # ship; project is linked to sarangnikhades-projects/sarangs-job-board
```

No tests configured.

### One-off migrations

`scripts/*.ts` are runnable against any libsql URL via tsx. Always pass Turso creds in env:

```
TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npx tsx scripts/migrate.ts
```

- `migrate.ts` — add user_id columns (already applied to prod)
- `drop-auth-tables.ts` — drop legacy plural NextAuth tables (already applied)
- `fix-fk.ts` — rebuild jobs/resumes with FK pointing at singular `user(id)` (already applied)

## Architecture

### Stack
Next.js 16 App Router (Turbopack) + TS + Tailwind v4. **Drizzle ORM over libSQL** (`@libsql/client`)
talking to **Turso** in prod, vanilla SQLite file locally. **NextAuth v5 (Auth.js)** with Google + GitHub
OAuth and `@auth/drizzle-adapter`. LLM calls go through **OpenRouter** (OpenAI SDK with baseURL override),
default model `anthropic/claude-sonnet-4`.

### Single-tenant → multi-tenant evolution
The codebase started single-user with a singleton `profile` row holding everything (name, email,
encrypted OpenRouter key, single resume). It is now multi-tenant. The `profile` table is **legacy
and unused** but kept around so the boot sequence stays idempotent. Authoritative tables:

```
user                        ← NextAuth.js — note SINGULAR name
account, verificationToken  ← NextAuth.js  (also singular)
resumes  (user_id)          ← per-user; first user gets 3 seed rows: UX/Game/Retail
jobs     (user_id, resume_id)
kits     (job_id)
```

**Why singular auth table names matter:** `@auth/drizzle-adapter` generates SQL referencing
`"user"` / `"account"` / `"verificationToken"`. Drizzle TS exports are still plural
(`schema.users` / `schema.accounts`) — only the SQL `sqliteTable("user", …)` argument is
singular. Renaming breaks NextAuth instantly.

### DB driver is async — all query calls await

`getDb()` in `lib/db.ts` returns `LibSQLDatabase`. All Drizzle methods (`.get()`, `.all()`,
`.run()`, `.returning()`) are **Promises** under this adapter — every call site awaits. A
sync `db.select(...).get()` is a bug. The same pattern holds inside the NextAuth config
factory (`auth.ts`), which is `NextAuth(async () => …)` because the adapter init waits on
the DB.

Schema + indexes are created on first `getDb()` call via `client.executeMultiple`. Column
adds (e.g. `user_id`) are gated on `PRAGMA table_info` via the local `ensureColumn` helper,
keeping init idempotent. FK changes (e.g. `REFERENCES user(id)` after renaming `users`)
need a **table rebuild** — SQLite can't ALTER a constraint. That's what `scripts/fix-fk.ts`
did to prod; if the schema's user FK targets ever change, write a similar rebuild.

### Auth + isolation

`auth.ts` configures NextAuth v5 with JWT sessions (no sessions table). The `signIn` callback
checks `email` against the `ALLOWED_EMAILS` env var (comma-separated; first entry is OWNER).
On every successful sign-in, `bootstrapForOwner(userId)` (`lib/db.ts`):

1. Claims all rows with `user_id IS NULL` for the signing-in user (only meaningful once, for the OWNER).
2. Seeds three category labels (`UX Designer`, `Game Designer`, `Retail`) if the user has no resumes.

`middleware.ts` (will become `proxy.ts` per Next 16) whitelists `/`, `/signin`, `/api/auth/*` and
gates everything else. API routes get 401 JSON, pages 302 to `/signin?from=…`.

Every API route starts with `requireUser()` from `lib/session.ts` which either returns
`{ userId, email }` or a `NextResponse` 401 the handler must return directly. Every query
adds `eq(schema.X.user_id, session.userId)` — there is no data leakage path.

### LLM pipeline (OpenRouter)

`lib/openrouter.ts` builds an OpenAI-SDK client pointed at `https://openrouter.ai/api/v1`
using **`APP_OPENROUTER_KEY` from env** (shared across all users — owner pays). Token budgets
on every call are tight (`max_tokens` 400–800) so small OpenRouter balances still produce
full kits.

Two AI paths:
- `lib/ai/extract.ts` — runs on every job ingest. Returns strict JSON `{title, company, location, resume_label}`.
  `resume_label` is selected from the user's saved labels and validated server-side before mapping
  to `resume_id`. If the model picks nothing valid, falls back to the user's default resume.
- `lib/ai/kit.ts` — runs 4 prompts in parallel (`Promise.all`): cover letter, resume bullets,
  interview questions, company brief. Each sub-prompt is wrapped in try/catch so a single failure
  surfaces as `_(label generation failed: …)_` in the result instead of nuking the whole kit. Prompts
  carry explicit "do not fabricate" guardrails and the brief includes the required "_Based on this
  job posting only — verify before your interview._" caveat.

### Serverless module-load gotcha — lazy-import heavy deps

`jsdom`, `@mozilla/readability`, `pdf-parse` (via `pdfjs-dist`) crash at module evaluation in
Vercel/Netlify Lambdas:
- `jsdom` triggers a CJS/ESM mismatch in `html-encoding-sniffer → @exodus/bytes`.
- `pdfjs-dist` references browser globals (`DOMMatrix`, `ImageData`, `Path2D`) at module top.

`lib/parsers/url.ts` and `lib/parsers/resume.ts` **dynamic-import these inside the function body**,
not at top level. `parsePdfBuffer` also stubs `globalThis.DOMMatrix/ImageData/Path2D` to no-op
classes before the `await import("pdf-parse")` so the module can evaluate. If you ever add
another heavy bundle (canvas, sharp, puppeteer), use the same lazy-import + stub pattern, otherwise
every API route on that file path 500s at cold start.

### URL fetch fallback

`fetchAndExtract(url)` in `lib/parsers/url.ts` returns a discriminated union, never throws.
LinkedIn always returns 999, most aggregators throw 403. When fetch fails the jobs POST
route returns `{needsPaste: true, reason}` (status 200) so the AddJobDialog can swap to a
paste textarea. Do not change this contract.

### Design system

The whole app is a **strict implementation of the Bugatti design system**:
pure black canvas, three fonts (Saira Condensed display, Inter body, JetBrains Mono mono),
**weight 400 only** (no `font-bold` / `font-semibold` ever), zero accent color except the
ice-blue `#c3d9f3` on inline links, transparent pill CTAs with 1px white outline, 0px border
radius everywhere except buttons, 120px section rhythm.

Tokens live in `app/globals.css` under `@theme inline { … }` and as standalone utility classes:
`wordmark`, `display-xl/lg/md/sm`, `title-md/sm`, `caption-uppercase`, `nav-link`, `btn-label`,
`btn-primary`, `btn-icon`, `body-md/sm`, `text-input`, `hairline-x`. Prefer these over inline
styles, except inside `/signin` and `/board`'s title band where word-wrap bugs forced inline
styles (Tailwind utilities were getting purged or fighting the flex layout).

Fonts are wired through `next/font/google` in `app/layout.tsx` exposing CSS vars
`--font-saira`, `--font-body`, `--font-jetbrains` which globals.css aliases to
`--font-display`, `--font-text`, `--font-mono`. If you swap a font, update both files.

### Layout chrome is auth-gated

`app/layout.tsx` awaits `auth()` and conditionally renders `TopNav` / `AddJobLauncher` /
`JobSheet` only for signed-in users. The public landing `/` and `/signin` render bare. The
TopNav fetches `/api/profile` on mount to show the user initials avatar.

### Exports

`lib/exports/blocks.ts` is a tiny markdown tokenizer (headings, bullets, ordered lists,
emphasis, hr) shared by `lib/exports/pdf.tsx` (`@react-pdf/renderer`) and `lib/exports/docx.ts`
(`docx` lib). Both renderers use **neutral recruiter-friendly typography** (Helvetica display
+ Georgia/Times-Roman body) — explicitly NOT themed Bugatti, since the output goes to recruiter
inboxes where black-canvas + sans display looks wrong.

`/api/jobs/[id]/kit/export?part=cover|bullets|questions|brief&type=pdf|docx` returns the
binary with `Content-Disposition: attachment`. The questions JSON is rendered to numbered-list
markdown in `lib/exports/format.ts` before passing through the same renderer.

### Drag-and-drop on the board

`components/board/BoardClient.tsx` uses `@dnd-kit/core` + `@dnd-kit/sortable`. The dnd-kit
PointerSensor calls `event.preventDefault()` on `pointerdown` which **suppresses synthesized
click events** on the same node — opening the JobSheet on click uses a manual pointer-up
distance check (`<6px, <350ms`), not `onClick`. Don't switch back to `onClick`; clicks will
silently die. The keyboard sensor uses `Space` for drag activation, so card open on
Enter only (not Space).

Card positions are **floats**, computed as midpoint between neighbors on drop, so a single
PATCH per move suffices (no cascading renumber). `position` column is `REAL` in SQLite —
the migration is documented in `db/schema.ts`.

## Env vars (production = Vercel)

| Key | Notes |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | libsql connection — Turso in prod, omit both for local `file:` DB |
| `APP_SECRET` | Legacy AES-GCM key (still required for any encrypted-at-rest secrets) |
| `AUTH_SECRET` | NextAuth signing |
| `AUTH_URL` | `https://sarangs-job-board.vercel.app` (canonical for OAuth callbacks) |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | OAuth apps |
| `ALLOWED_EMAILS` | CSV — first entry is the OWNER who claims pre-auth orphan rows |
| `APP_OPENROUTER_KEY` | Shared OpenRouter key (legacy fallback name `OPENROUTER_API_KEY` also accepted) |

Local dev uses `.env.local` for `APP_SECRET` only by default; everything else stays unset and
the app degrades gracefully (no auth required, no LLM calls succeed until a key is set).
