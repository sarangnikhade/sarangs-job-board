/**
 * Tiny markdown → block-list tokenizer.
 *
 * Designed for the constrained markdown our kit prompts produce —
 * headings, paragraphs, bulleted lists, numbered lists, hr, and inline
 * bold/italic. Anything more exotic (tables, code fences, links inside
 * lists) is folded into plain text rather than handled.
 */

export type InlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type Block =
  | { kind: "h1"; runs: InlineRun[] }
  | { kind: "h2"; runs: InlineRun[] }
  | { kind: "h3"; runs: InlineRun[] }
  | { kind: "p"; runs: InlineRun[] }
  | { kind: "li"; runs: InlineRun[]; ordered: boolean; index: number }
  | { kind: "hr" };

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let orderedCounter = 0;

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push({ kind: "p", runs: parseInline(para.join(" ").trim()) });
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushPara();
      orderedCounter = 0;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushPara();
      blocks.push({ kind: "hr" });
      orderedCounter = 0;
      continue;
    }

    // Headings (#, ##, ###)
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      const level = h[1].length as 1 | 2 | 3;
      blocks.push({
        kind: (`h${level}` as "h1" | "h2" | "h3"),
        runs: parseInline(h[2].trim()),
      });
      orderedCounter = 0;
      continue;
    }

    // Unordered list
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      blocks.push({
        kind: "li",
        runs: parseInline(ul[1].trim()),
        ordered: false,
        index: 0,
      });
      orderedCounter = 0;
      continue;
    }

    // Ordered list
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      orderedCounter += 1;
      blocks.push({
        kind: "li",
        runs: parseInline(ol[1].trim()),
        ordered: true,
        index: orderedCounter,
      });
      continue;
    }

    para.push(line);
  }

  flushPara();
  return blocks;
}

/**
 * Inline emphasis pass. Recognizes **bold** and *italic* / _italic_.
 * Strips backticks and links to their visible text. Keeps everything
 * else verbatim.
 */
export function parseInline(text: string): InlineRun[] {
  // Strip code spans and link syntax down to their text payloads.
  const flat = text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

  const runs: InlineRun[] = [];
  // Token regex: bold then italic, longest-match precedence on **.
  const re = /(\*\*|__)([^*_]+)\1|(\*|_)([^*_]+)\3/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat)) !== null) {
    if (m.index > cursor) {
      runs.push({ text: flat.slice(cursor, m.index) });
    }
    if (m[1]) runs.push({ text: m[2], bold: true });
    else if (m[3]) runs.push({ text: m[4], italic: true });
    cursor = m.index + m[0].length;
  }
  if (cursor < flat.length) runs.push({ text: flat.slice(cursor) });
  if (runs.length === 0) runs.push({ text: flat });
  return runs;
}
