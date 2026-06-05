import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

/**
 * Single DB driver shared by local dev (sqlite file via libSQL's `file:`
 * URL) and production (Turso libSQL over HTTPS).
 *
 * Required env vars in production (Netlify, etc):
 *   - TURSO_DATABASE_URL  e.g. libsql://your-db.turso.io
 *   - TURSO_AUTH_TOKEN
 *
 * Local fallback: file:db/data.sqlite (relative to repo root).
 */

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const LOCAL_URL = "file:db/data.sqlite";

let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;
let _initPromise: Promise<void> | null = null;

function makeClient(): Client {
  if (TURSO_URL) {
    return createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  }
  return createClient({ url: LOCAL_URL });
}

async function init(client: Client): Promise<void> {
  // executeMultiple is best for DDL — runs the whole batch in one round-trip.
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT,
      resume_text TEXT,
      resume_file_name TEXT,
      openrouter_key_enc TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      text TEXT,
      file_name TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      url TEXT,
      source_text TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'wishlist',
      position REAL NOT NULL DEFAULT 0,
      notes TEXT,
      resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      cover_letter_md TEXT,
      resume_bullets_md TEXT,
      interview_questions_json TEXT,
      company_brief_md TEXT,
      model_used TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status_position ON jobs(status, position);
    CREATE INDEX IF NOT EXISTS idx_kits_job_id ON kits(job_id);
    CREATE INDEX IF NOT EXISTS idx_resumes_is_default ON resumes(is_default);
  `);

  // For installs that pre-date the multi-resume feature: add jobs.resume_id
  // if missing. libSQL ALTER TABLE supports ADD COLUMN with REFERENCES when
  // the default is NULL.
  const jobsCols = await client.execute("PRAGMA table_info(jobs)");
  const hasResumeCol = jobsCols.rows.some(
    (r) => String((r as Record<string, unknown>).name) === "resume_id",
  );
  if (!hasResumeCol) {
    await client.execute(
      "ALTER TABLE jobs ADD COLUMN resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL",
    );
  }

  const now = Date.now();

  // Singleton profile row.
  await client.execute({
    sql: `INSERT OR IGNORE INTO profile (id, created_at, updated_at)
          VALUES (1, ?, ?)`,
    args: [now, now],
  });

  // Multi-resume bootstrap (runs once: when the resumes table is empty).
  const countRes = await client.execute("SELECT COUNT(*) AS n FROM resumes");
  const resumeCount = Number(countRes.rows[0]?.n ?? 0);

  if (resumeCount === 0) {
    const legacyRes = await client.execute(
      "SELECT resume_text, resume_file_name FROM profile WHERE id = 1",
    );
    const legacy = legacyRes.rows[0] as unknown as
      | { resume_text: string | null; resume_file_name: string | null }
      | undefined;

    if (legacy?.resume_text) {
      await client.execute({
        sql: `INSERT INTO resumes
                (label, text, file_name, is_default, created_at, updated_at)
              VALUES (?, ?, ?, 1, ?, ?)`,
        args: [
          "Default",
          legacy.resume_text,
          legacy.resume_file_name ?? null,
          now,
          now,
        ],
      });
      await client.execute({
        sql: `UPDATE profile
                 SET resume_text = NULL,
                     resume_file_name = NULL,
                     updated_at = ?
               WHERE id = 1`,
        args: [now],
      });
    } else {
      const seedSql = `INSERT INTO resumes
        (label, text, file_name, is_default, created_at, updated_at)
        VALUES (?, NULL, NULL, ?, ?, ?)`;
      await client.execute({ sql: seedSql, args: ["UX Designer", 1, now, now] });
      await client.execute({ sql: seedSql, args: ["Game Designer", 0, now, now] });
      await client.execute({ sql: seedSql, args: ["Retail", 0, now, now] });
    }
  }
}

/**
 * Returns the Drizzle handle, ensuring the schema + seeds have been
 * applied at least once for this process. All Drizzle query methods
 * (`.get()`, `.all()`, `.run()`) are ASYNC under the libSQL adapter —
 * call sites must `await` them.
 */
export async function getDb(): Promise<LibSQLDatabase<typeof schema>> {
  if (!_client) _client = makeClient();
  if (!_db) _db = drizzle(_client, { schema });
  if (!_initPromise) _initPromise = init(_client);
  await _initPromise;
  return _db;
}

export { schema };
