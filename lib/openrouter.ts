import "server-only";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

export const MODEL = "anthropic/claude-sonnet-4";

/**
 * Fetch the OpenRouter API key from the singleton profile row and
 * return a configured OpenAI-SDK client pointed at OpenRouter.
 * Throws if the key has not been saved yet.
 */
export async function openrouterClient(): Promise<OpenAI> {
  const db = await getDb();
  const row = await db
    .select({ enc: schema.profile.openrouter_key_enc })
    .from(schema.profile)
    .where(eq(schema.profile.id, 1))
    .get();
  if (!row?.enc) {
    throw new Error("OpenRouter API key not set — visit /settings first");
  }
  const apiKey = decryptSecret(row.enc);
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Sarang's Job Board",
    },
  });
}
