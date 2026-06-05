import { createClient } from "@libsql/client";

/**
 * One-off migration script. Run against any libsql/Turso URL.
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npx tsx scripts/migrate.ts
 *
 * Idempotent: each ALTER is gated on PRAGMA table_info, so re-running is safe.
 */
async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:db/data.sqlite";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });

  console.log("Connecting to:", url);

  console.log("Creating NextAuth tables…");
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      emailVerified INTEGER,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

    CREATE TABLE IF NOT EXISTS verificationTokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires INTEGER NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status_position ON jobs(status, position);
    CREATE INDEX IF NOT EXISTS idx_kits_job_id ON kits(job_id);
    CREATE INDEX IF NOT EXISTS idx_resumes_is_default ON resumes(is_default);
  `);

  await ensureColumn(client, "jobs", "resume_id",
    "ALTER TABLE jobs ADD COLUMN resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL");
  await ensureColumn(client, "jobs", "user_id",
    "ALTER TABLE jobs ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE");
  await ensureColumn(client, "resumes", "user_id",
    "ALTER TABLE resumes ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE");

  // Index user_id columns for query speed.
  await client.executeMultiple(`
    CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
  `);

  // Confirm.
  for (const t of ["users", "jobs", "resumes", "kits"]) {
    const info = await client.execute(`PRAGMA table_info(${t})`);
    const cols = info.rows.map((r) => (r as Record<string, unknown>).name).join(", ");
    console.log(`  ${t}: ${cols}`);
  }
  console.log("Done.");
}

async function ensureColumn(
  client: Awaited<ReturnType<typeof createClient>>,
  table: string,
  column: string,
  alterSql: string,
): Promise<void> {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  const has = info.rows.some(
    (r) => String((r as Record<string, unknown>).name) === column,
  );
  if (has) {
    console.log(`  ${table}.${column} already exists, skip`);
    return;
  }
  console.log(`  adding ${table}.${column}…`);
  await client.execute(alterSql);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
