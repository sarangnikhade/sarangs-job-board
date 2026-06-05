import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

/**
 * Auth.js v5 (NextAuth) configuration.
 *
 * - Providers: Google + GitHub OAuth.
 * - Allow-list: ALLOWED_EMAILS env var (comma-separated). Anyone whose
 *   verified email isn't on the list is denied at signIn time.
 * - First entry of ALLOWED_EMAILS is treated as the OWNER — on their
 *   first sign-in, orphan rows (pre-auth single-user data) are claimed
 *   for their user_id and the three category resume labels are seeded.
 * - Sessions: JWT strategy (no extra sessions table). The signed-in
 *   user's id is shipped into the session token via the jwt + session
 *   callbacks.
 */

type AppSession = {
  user?: { id?: string; name?: string | null; email?: string | null; image?: string | null };
};

function parseAllowList(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = parseAllowList();
  if (list.length === 0) return false;
  return list.includes(email.toLowerCase());
}

function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = parseAllowList();
  return list.length > 0 && list[0] === email.toLowerCase();
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  // The adapter needs a live DB. We import lazily to avoid evaluating
  // the libsql module at top level when auth.ts is bundled into edge.
  const { getDb } = await import("@/lib/db");
  const db = await getDb();

  return {
    adapter: DrizzleAdapter(db),
    session: { strategy: "jwt" },
    providers: [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      }),
    ],
    pages: { signIn: "/signin" },
    callbacks: {
      async signIn({ user }) {
        if (!isAllowed(user?.email)) return "/signin?error=not_allowed";
        return true;
      },
      async jwt({ token, user }) {
        if (user?.id) token.userId = user.id;
        return token;
      },
      async session({ session, token }) {
        const s = session as AppSession;
        if (s.user && typeof token.userId === "string") {
          s.user.id = token.userId;
        }
        return session;
      },
    },
    events: {
      async signIn({ user }) {
        if (!user.id) return;
        if (isOwner(user.email)) {
          const { bootstrapForOwner } = await import("@/lib/db");
          await bootstrapForOwner(user.id);
        } else {
          // Non-owner allow-listed user: seed empty category labels so
          // their first job add has somewhere to land.
          const { bootstrapForOwner } = await import("@/lib/db");
          await bootstrapForOwner(user.id);
        }
      },
    },
  };
});
