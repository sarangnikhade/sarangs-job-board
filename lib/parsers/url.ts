import "server-only";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type FetchResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/**
 * Fetch a URL with a browser UA, 8s timeout, then run Mozilla Readability
 * over the resulting HTML to extract the main article text.
 *
 * On any failure (network, non-200, captcha, empty body, blocked) the
 * caller falls back to the paste textarea — never throws.
 */
export async function fetchAndExtract(url: string): Promise<FetchResult> {
  let html: string;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8_000);
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      signal: ctl.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { ok: false, reason: msg };
  }

  if (!html || html.length < 200) {
    return { ok: false, reason: "empty response" };
  }

  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const text = (article?.textContent ?? "").trim();
    if (text.length < 200) {
      return { ok: false, reason: "could not extract article body" };
    }
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parse failed";
    return { ok: false, reason: msg };
  }
}
