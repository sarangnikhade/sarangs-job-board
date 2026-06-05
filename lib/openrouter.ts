import "server-only";
import OpenAI from "openai";

export const MODEL = "anthropic/claude-sonnet-4";

/**
 * Shared, app-wide OpenRouter client. The OpenRouter API key is held in
 * the APP_OPENROUTER_KEY env var (or the legacy OPENROUTER_API_KEY name
 * as a fallback). Every user's LLM call hits the same key — owner pays.
 */
export async function openrouterClient(): Promise<OpenAI> {
  const apiKey =
    process.env.APP_OPENROUTER_KEY ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "APP_OPENROUTER_KEY env var not set on the server.",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://sarangjobboard.netlify.app",
      "X-Title": "Sarang's Job Board",
    },
  });
}
