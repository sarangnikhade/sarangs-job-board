import { createClient } from "@libsql/client";

/**
 * Rebuild jobs + resumes tables so their user_id foreign key references
 * the renamed `user` table (the previous schema referenced `users`,
 * which no longer exists).
 *
 * SQLite cannot change a foreign-key constraint via ALTER — the
 * table must be recreated.  Safe steps:
 *   1. PRAGMA foreign_keys = OFF
 *   2. CREATE TABLE jobs_new with the correct FK
 *   3. Copy rows
 *   4. DROP TABLE jobs
 *   5. RENAME jobs_new -> jobs
 *   6. PRAGMA foreign_keys = ON
 *
 * Re-runnable: if the rename succeeds the script becomes a no-op on
 * next run because the freshly-rebuilt table already has the correct
 * REFERENCES clause.
 */
async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:db/data.sqlite";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });

  console.log("Connecting to:", url);

  // Inspect current FK refs.
  const before = await client.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('jobs','resumes')",
  );
  for (const r of before.rows) {
    console.log("  current DDL:", (r as Record<string, unknown>).sql);
  }

  await client.execute("PRAGMA foreign_keys = OFF");

  await rebuildJobs(client);
  await rebuildResumes(client);

  await client.execute("PRAGMA foreign_keys = ON");

  const after = await client.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('jobs','resumes')",
  );
  for (const r of after.rows) {
    console.log("  new DDL:", (r as Record<string, unknown>).sql);
  }
  console.log("Done.");
}

async function rebuildJobs(client: Awaited<ReturnType<typeof createClient>>) {
  console.log("Rebuilding jobs…");
  await client.execute("DROP TABLE IF EXISTS jobs_new");
  await client.execute(`
    CREATE TABLE jobs_new (
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
    )
  `);
  await client.execute(`
    INSERT INTO jobs_new
      (id, user_id, title, company, location, url, source_text,
       description, status, position, notes, resume_id,
       created_at, updated_at)
    SELECT
       id, user_id, title, company, location, url, source_text,
       description, status, position, notes, resume_id,
       created_at, updated_at
    FROM jobs
  `);
  await client.execute("DROP TABLE jobs");
  await client.execute("ALTER TABLE jobs_new RENAME TO jobs");
  await client.execute(
    "CREATE INDEX IF NOT EXISTS idx_jobs_status_position ON jobs(status, position)",
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)",
  );
}

async function rebuildResumes(client: Awaited<ReturnType<typeof createClient>>) {
  console.log("Rebuilding resumes…");
  await client.execute("DROP TABLE IF EXISTS resumes_new");
  await client.execute(`
    CREATE TABLE resumes_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      text TEXT,
      file_name TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  await client.execute(`
    INSERT INTO resumes_new
      (id, user_id, label, text, file_name, is_default, created_at, updated_at)
    SELECT
       id, user_id, label, text, file_name, is_default, created_at, updated_at
    FROM resumes
  `);
  await client.execute("DROP TABLE resumes");
  await client.execute("ALTER TABLE resumes_new RENAME TO resumes");
  await client.execute(
    "CREATE INDEX IF NOT EXISTS idx_resumes_is_default ON resumes(is_default)",
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
