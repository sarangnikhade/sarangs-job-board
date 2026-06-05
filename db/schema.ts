import {
  sqliteTable,
  integer,
  real,
  text,
  primaryKey,
} from "drizzle-orm/sqlite-core";

/* ---------- NextAuth (Auth.js) tables ---------- */

export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ---------- App tables ---------- */

/**
 * Legacy profile table — kept for back-compat during the user-scoping
 * migration but no longer read in any code path. NextAuth's users table
 * now holds name/email.
 */
export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  resume_text: text("resume_text"),
  resume_file_name: text("resume_file_name"),
  openrouter_key_enc: text("openrouter_key_enc"),
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
});

export const resumes = sqliteTable("resumes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  text: text("text"),
  file_name: text("file_name"),
  is_default: integer("is_default").notNull().default(0),
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
});

export type JobStatus =
  | "wishlist"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected";

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  url: text("url"),
  source_text: text("source_text"),
  description: text("description"),
  status: text("status").$type<JobStatus>().notNull().default("wishlist"),
  position: real("position").notNull().default(0),
  notes: text("notes"),
  resume_id: integer("resume_id").references(() => resumes.id, {
    onDelete: "set null",
  }),
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
});

export const kits = sqliteTable("kits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  job_id: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  cover_letter_md: text("cover_letter_md"),
  resume_bullets_md: text("resume_bullets_md"),
  interview_questions_json: text("interview_questions_json"),
  company_brief_md: text("company_brief_md"),
  model_used: text("model_used"),
  created_at: integer("created_at").notNull(),
});

export type Profile = typeof profile.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Kit = typeof kits.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type User = typeof users.$inferSelect;
