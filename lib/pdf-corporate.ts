import type { jsPDF } from "jspdf";

/**
 * Helvetica (standard i jsPDF) mangler flere Unicode-glyffer.
 * Uten erstatning kan splitTextToSize undervurdere bredde → tekst stikker utenfor arket.
 */
export function sanitizePdfText(text: string): string {
  return String(text ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/\u2018|\u2019|\u201A|\u2032/g, "'")
    .replace(/\u201C|\u201D|\u201E|\u2033/g, '"')
    .replace(/\u2013|\u2014|\u2212/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2192|\u21D2|\u279C|\u2794/g, "->")
    .replace(/\u2190|\u21D0/g, "<-")
    .replace(/\u2191/g, "^")
    .replace(/\u2193/g, "v")
    .replace(/\u00D7|\u2715|\u2716/g, "x")
    .replace(/\u2022/g, "-")
    .replace(/[^\S\r\n]+/g, " ");
}

/** Split tekst til linjer som faktisk får plass innen `maxWidthMm` (Helvetica-sikker). */
export function splitPdfText(
  doc: jsPDF,
  text: string,
  maxWidthMm: number,
): string[] {
  const safe = sanitizePdfText(text);
  const w = Math.max(8, maxWidthMm);
  if (!safe) return [];
  return doc.splitTextToSize(safe, w) as string[];
}

/**
 * Tegn allerede wrappede linjer uten maxWidth (unngår jsPDF letter-spacing-strekk).
 * Returnerer Y etter siste linje.
 */
export function drawPdfTextLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  lineHeightMm: number,
): number {
  let yy = y;
  for (const line of lines) {
    doc.text(line, x, yy);
    yy += lineHeightMm;
  }
  return yy;
}

/** Profesjonelt, trykk- og arkiv-vennlig palett (nøytral blå / skifer). */
export const PDF_CORPORATE_THEME = {
  brand: [23, 37, 84] as [number, number, number],
  brandAccent: [37, 99, 235] as [number, number, number],
  slate900: [15, 23, 42] as [number, number, number],
  slate800: [30, 41, 59] as [number, number, number],
  slate700: [51, 65, 85] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  surface: [248, 250, 252] as [number, number, number],
  calloutBg: [239, 246, 255] as [number, number, number],
  calloutBorder: [191, 219, 254] as [number, number, number],
  mutedBg: [241, 245, 249] as [number, number, number],
  mutedBorder: [226, 232, 240] as [number, number, number],
};

export function bodyLineHeightMm(fontSizePt: number): number {
  return fontSizePt * 0.52;
}

export type CorporatePdfFooterOptions = {
  shortTitle: string;
  /** Vises i bunntekst og topplinje, f.eks. «ROS-analyse» eller «PVV-vurdering». */
  docTypeLabel: string;
  /** Hopp over forside (egen cover-footer tegnes der). */
  skipFirstPage?: boolean;
  /**
   * Antall første sider uten bunntekst (cover + blank = 2).
   * Overstyrer skipFirstPage når satt.
   */
  skipFirstPages?: number;
  /**
   * Løpende topptekst fra denne siden (1-basert).
   * Standard: etter cover, blank og TOC (side 4).
   */
  headerFromPage?: number;
};

export function applyCorporatePdfFooters(
  doc: jsPDF,
  margin: number,
  opts: CorporatePdfFooterOptions,
): void {
  const pageCount = doc.getNumberOfPages();
  const safe = opts.shortTitle.slice(0, 56) || "Uten tittel";
  const T = PDF_CORPORATE_THEME;
  const [s2, s3, s7] = [T.slate200, T.slate500, T.slate700];
  const skipPages =
    opts.skipFirstPages ?? (opts.skipFirstPage ? 1 : 0);
  const startPage = skipPages + 1;
  const headerFrom =
    opts.headerFromPage ?? (skipPages >= 2 ? 4 : skipPages === 1 ? 3 : 2);
  for (let i = startPage; i <= pageCount; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const landscape = pw > ph;
    const footLineY = ph - 11;
    const footBaseY = ph - 5;

    doc.setDrawColor(s2[0], s2[1], s2[2]);
    doc.setLineWidth(0.25);
    doc.line(margin, footLineY, pw - margin, footLineY);

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(s7[0], s7[1], s7[2]);
    doc.text("PVV", margin, footBaseY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(s3[0], s3[1], s3[2]);
    const midMax = Math.max(24, pw - margin * 2 - 48);
    const midLine =
      splitPdfText(doc, `${opts.docTypeLabel} | ${safe}`, midMax)[0] ?? "";
    doc.text(midLine, margin + 10, footBaseY);
    doc.text(`Side ${i} av ${pageCount}`, pw - margin, footBaseY, {
      align: "right",
    });

    if (!landscape && i >= headerFrom) {
      doc.setDrawColor(s2[0], s2[1], s2[2]);
      doc.line(margin, 11, pw - margin, 11);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(s3[0], s3[1], s3[2]);
      doc.text(opts.docTypeLabel, margin, 8);
      doc.setFont("helvetica", "normal");
      const titleMax = Math.max(24, pw - margin * 2 - 40);
      const titleLine = splitPdfText(doc, safe, titleMax)[0] ?? "";
      doc.text(titleLine, pw - margin, 8, { align: "right" });
    }

    doc.setTextColor(0);
  }
}
