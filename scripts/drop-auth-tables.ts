import { createClient } from "@libsql/client";

/**
 * One-off: drop the plural NextAuth tables left over from the first
 * attempt. They were empty (no successful sign-ins yet) so this is safe.
 * The app's getDb init will recreate them with the singular names the
 * @auth/drizzle-adapter expects.
 */
async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:db/data.sqlite";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });

  console.log("Connecting to:", url);
  for (const t of ["users", "accounts", "verificationTokens"]) {
    console.log(`  dropping ${t} if it exists…`);
    await client.execute(`DROP TABLE IF EXISTS ${t}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
