import "server-only";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";
import { parseMarkdown, type InlineRun } from "./blocks";

// React-PDF uses Helvetica + Times-Roman built in. No font registration
// required, which keeps cold-start fast.
const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Times-Roman",
    fontSize: 11,
    lineHeight: 1.5,
    color: "#111",
  },
  title: {
    fontFamily: "Helvetica",
    fontSize: 18,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#666",
    marginBottom: 24,
  },
  h1: { fontFamily: "Helvetica", fontSize: 15, marginTop: 12, marginBottom: 6 },
  h2: { fontFamily: "Helvetica", fontSize: 13, marginTop: 12, marginBottom: 6 },
  h3: { fontFamily: "Helvetica", fontSize: 12, marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 8 },
  liRow: { flexDirection: "row", marginBottom: 4 },
  liMarker: { width: 18 },
  liBody: { flex: 1 },
  hr: {
    marginVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  bold: { fontFamily: "Times-Bold" },
  italic: { fontFamily: "Times-Italic" },
});

function renderRuns(rs: InlineRun[]): React.ReactNode[] {
  return rs.map((r, i) => {
    const style = r.bold
      ? styles.bold
      : r.italic
        ? styles.italic
        : undefined;
    return (
      <Text key={i} style={style}>
        {r.text}
      </Text>
    );
  });
}

export async function renderPdf(opts: {
  title: string;
  subtitle?: string;
  markdown: string;
}): Promise<Buffer> {
  const blocks = parseMarkdown(opts.markdown);

  const Doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{opts.title}</Text>
        {opts.subtitle && <Text style={styles.subtitle}>{opts.subtitle}</Text>}

        {blocks.map((b, i) => {
          switch (b.kind) {
            case "h1":
              return (
                <Text key={i} style={styles.h1}>
                  {renderRuns(b.runs)}
                </Text>
              );
            case "h2":
              return (
                <Text key={i} style={styles.h2}>
                  {renderRuns(b.runs)}
                </Text>
              );
            case "h3":
              return (
                <Text key={i} style={styles.h3}>
                  {renderRuns(b.runs)}
                </Text>
              );
            case "p":
              return (
                <Text key={i} style={styles.p}>
                  {renderRuns(b.runs)}
                </Text>
              );
            case "li":
              return (
                <View key={i} style={styles.liRow}>
                  <Text style={styles.liMarker}>
                    {b.ordered ? `${b.index}.` : "•"}
                  </Text>
                  <Text style={styles.liBody}>{renderRuns(b.runs)}</Text>
                </View>
              );
            case "hr":
              return <View key={i} style={styles.hr} />;
          }
        })}
      </Page>
    </Document>
  );

  const blob = await renderToBuffer(Doc);
  return blob as Buffer;
}

// Avoid unused-import warning when only used at runtime.
void Font;
