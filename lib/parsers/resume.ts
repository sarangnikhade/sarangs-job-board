import "server-only";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

/**
 * Resume parsers: PDF + DOCX → plain text.
 * pdf-parse v2 exposes a PDFParse class; `getText()` returns a TextResult
 * whose `.text` is the concatenated document body.
 */
export async function parsePdfBuffer(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const out = await parser.getText();
    return cleanup(out.text);
  } finally {
    await parser.destroy();
  }
}

export async function parseDocxBuffer(buf: Buffer): Promise<string> {
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
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
