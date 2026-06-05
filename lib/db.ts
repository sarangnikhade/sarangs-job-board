import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

/**
 * Single DB driver shared by local dev (sqlite file via libSQL's `file:`
 * URL) and production (Turso libSQL over HTTPS).
 *
 * Required env vars in production:
 *   - TURSO_DATABASE_URL
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

    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      emailVerified INTEGER,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS account (
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerAccountId TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      PRIMARY KEY (provider, providerAccountId)
    );

    CREATE TABLE IF NOT EXISTS verificationToken (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires INTEGER NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      text TEXT,
      file_name TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_kits_job_id ON kits(job_id);
    CREATE INDEX IF NOT EXISTS idx_resumes_is_default ON resumes(is_default);
    CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
  `);

  // Backfills for installs that pre-date the multi-resume / multi-user features.
  await ensureColumn(client, "jobs", "resume_id",
    "ALTER TABLE jobs ADD COLUMN resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL");
  await ensureColumn(client, "jobs", "user_id",
    "ALTER TABLE jobs ADD COLUMN user_id TEXT REFERENCES user(id) ON DELETE CASCADE");
  await ensureColumn(client, "resumes", "user_id",
    "ALTER TABLE resumes ADD COLUMN user_id TEXT REFERENCES user(id) ON DELETE CASCADE");

  const now = Date.now();

  // Singleton profile row (legacy, kept for back-compat).
  await client.execute({
    sql: `INSERT OR IGNORE INTO profile (id, created_at, updated_at)
          VALUES (1, ?, ?)`,
    args: [now, now],
  });
}

async function ensureColumn(
  client: Client,
  table: string,
  column: string,
  alterSql: string,
): Promise<void> {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  const has = info.rows.some(
    (r) => String((r as Record<string, unknown>).name) === column,
  );
  if (!has) await client.execute(alterSql);
}

export async function getDb(): Promise<LibSQLDatabase<typeof schema>> {
  if (!_client) _client = makeClient();
  if (!_db) _db = drizzle(_client, { schema });
  if (!_initPromise) _initPromise = init(_client);
  await _initPromise;
  return _db;
}

/**
 * One-time backfill: when the OWNER signs in for the first time we claim
 * any orphan rows (user_id IS NULL) for them. Idempotent. Also seeds the
 * three category labels (UX / Game / Retail) if the user has no resumes.
 */
export async function bootstrapForOwner(userId: string): Promise<void> {
  const db = await getDb();
  const client = _client!;
  const now = Date.now();

  // Claim orphan rows (left behind by the pre-auth single-user world).
  await client.execute({
    sql: "UPDATE resumes SET user_id = ? WHERE user_id IS NULL",
    args: [userId],
  });
  await client.execute({
    sql: "UPDATE jobs SET user_id = ? WHERE user_id IS NULL",
    args: [userId],
  });

  // Seed the three category labels if this user has none.
  const countRes = await client.execute({
    sql: "SELECT COUNT(*) AS n FROM resumes WHERE user_id = ?",
    args: [userId],
  });
  const count = Number(
    (countRes.rows[0] as { n?: number | bigint })?.n ?? 0,
  );
  if (count === 0) {
    const seedSql = `INSERT INTO resumes
      (user_id, label, text, file_name, is_default, created_at, updated_at)
      VALUES (?, ?, NULL, NULL, ?, ?, ?)`;
    await client.execute({
      sql: seedSql,
      args: [userId, "UX Designer", 1, now, now],
    });
    await client.execute({
      sql: seedSql,
      args: [userId, "Game Designer", 0, now, now],
    });
    await client.execute({
      sql: seedSql,
      args: [userId, "Retail", 0, now, now],
    });
  }
  // Silence drizzle unused warning.
  void db;
}

export { schema };
