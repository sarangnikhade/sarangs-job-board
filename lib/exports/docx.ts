import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { parseMarkdown, type Block, type InlineRun } from "./blocks";

/**
 * Render markdown to a DOCX file as a Buffer.
 *
 * Visual treatment is intentionally neutral, recruiter-friendly: Times-style
 * serif body, sans display headings, generous line spacing. This file is
 * intended to be sent verbatim — no Bugatti black-canvas theming here.
 */
export async function renderDocx(opts: {
  title: string;
  subtitle?: string;
  markdown: string;
}): Promise<Buffer> {
  const body: Paragraph[] = [];

  // Header block
  body.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: opts.title,
          font: "Helvetica",
          size: 36,
          bold: false,
        }),
      ],
    }),
  );
  if (opts.subtitle) {
    body.push(
      new Paragraph({
        spacing: { after: 360 },
        children: [
          new TextRun({
            text: opts.subtitle,
            font: "Helvetica",
            size: 18,
            color: "666666",
          }),
        ],
      }),
    );
  }

  const blocks = parseMarkdown(opts.markdown);
  for (const block of blocks) {
    body.push(...renderBlock(block));
  }

  const doc = new Document({
    creator: "Sarang's Job Board",
    styles: {
      default: {
        document: {
          run: { font: "Georgia", size: 22 }, // 11pt
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 },
          },
        },
        children: body,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

function renderBlock(block: Block): Paragraph[] {
  switch (block.kind) {
    case "h1":
      return [headingPara(block.runs, 28, 240)];
    case "h2":
      return [headingPara(block.runs, 24, 200)];
    case "h3":
      return [headingPara(block.runs, 22, 160)];
    case "p":
      return [
        new Paragraph({
          spacing: { after: 160, line: 300 },
          children: runs(block.runs),
        }),
      ];
    case "li":
      return [
        new Paragraph({
          spacing: { after: 100, line: 280 },
          indent: { left: 360 },
          children: [
            new TextRun({
              text: block.ordered ? `${block.index}. ` : "• ",
              font: "Georgia",
              size: 22,
            }),
            ...runs(block.runs),
          ],
        }),
      ];
    case "hr":
      return [
        new Paragraph({
          spacing: { before: 200, after: 200 },
          border: {
            bottom: { style: "single", size: 6, color: "CCCCCC", space: 1 },
          },
          children: [new TextRun("")],
        }),
      ];
  }
}

function headingPara(rs: InlineRun[], size: number, after: number): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after },
    children: rs.map(
      (r) =>
        new TextRun({
          text: r.text,
          font: "Helvetica",
          size,
          bold: false,
          italics: r.italic,
        }),
    ),
  });
}

function runs(rs: InlineRun[]): TextRun[] {
  return rs.map(
    (r) =>
      new TextRun({
        text: r.text,
        font: "Georgia",
        size: 22,
        bold: r.bold,
        italics: r.italic,
      }),
  );
}
