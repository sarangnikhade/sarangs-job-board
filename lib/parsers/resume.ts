import "server-only";

/**
 * Resume parsers: PDF + DOCX → plain text.
 *
 * pdf-parse (via pdfjs-dist) and mammoth are dynamically imported here
 * (not at module top) because pdfjs-dist references browser globals
 * (DOMMatrix) at module-evaluation time, which crashes Node-based
 * serverless environments. Lazy import keeps the GET path on
 * /api/resumes from crashing when no resume parsing is required.
 */

export async function parsePdfBuffer(buf: Buffer): Promise<string> {
  // pdfjs-dist (transitive via pdf-parse) touches DOMMatrix at module
  // evaluation. Provide a no-op stub before the dynamic import so the
  // module can load on Netlify's Node runtime.
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = class {};
  if (typeof g.ImageData === "undefined") g.ImageData = class {};
  if (typeof g.Path2D === "undefined") g.Path2D = class {};

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const out = await parser.getText();
    return cleanup(out.text);
  } finally {
    await parser.destroy();
  }
}

export async function parseDocxBuffer(buf: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const out = await mammoth.extractRawText({ buffer: buf });
  return cleanup(out.value);
}

export async function parseResume(
  buf: Buffer,
  filename: string,
): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return parsePdfBuffer(buf);
  if (lower.endsWith(".docx")) return parseDocxBuffer(buf);
  if (lower.endsWith(".txt")) return cleanup(buf.toString("utf8"));
  throw new Error(`Unsupported resume format: ${filename}`);
}

function cleanup(t: string): string {
  return t
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
