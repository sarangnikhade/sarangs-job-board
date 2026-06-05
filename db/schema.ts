import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";

/**
 * Singleton profile row (id=1 always).
 * openrouter_key_enc holds AES-GCM ciphertext as base64.
 */
export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  // Legacy single-resume columns. Kept for back-compat during the
  // multi-resume migration; not referenced by new code paths.
  resume_text: text("resume_text"),
  resume_file_name: text("resume_file_name"),
  openrouter_key_enc: text("openrouter_key_enc"),
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
});

/**
 * Multi-resume support: one row per sector / role-family. One row is
 * flagged is_default = 1 at any given time.
 */
export const resumes = sqliteTable("resumes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
