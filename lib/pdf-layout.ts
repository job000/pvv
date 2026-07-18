import type { jsPDF } from "jspdf";

import {
  applyCorporatePdfFooters,
  bodyLineHeightMm,
  PDF_CORPORATE_THEME,
  type CorporatePdfFooterOptions,
} from "@/lib/pdf-corporate";

const T = PDF_CORPORATE_THEME;

/** Avstand fra sidens bunn der innhold må slutte (footer + luft). */
export const PDF_CONTENT_BOTTOM_INSET_MM = 18;
/** Topp for innhold på side 2+ (under løpende topptekst). */
export const PDF_CONTINUATION_TOP_MM = 16;
export const PDF_MARGIN_MM = 16;

export type PdfMetaRow = { label: string; value: string };

export type PdfCoverOptions = {
  eyebrow: string;
  metaLine: string;
  subtitle: string;
  title: string;
  lead?: string;
};

export type PdfLayout = {
  margin: number;
  getY: () => number;
  setY: (n: number) => void;
  pageW: () => number;
  pageH: () => number;
  contentW: () => number;
  ensureSpace: (needMm: number) => void;
  drawCover: (opts: PdfCoverOptions) => void;
  drawMetaPanel: (title: string, rows: PdfMetaRow[]) => void;
  drawToc: (items: string[]) => void;
  addHeading: (text: string, size?: number) => void;
  addPara: (text: string, size?: number) => void;
  addMutedNote: (text: string) => void;
  addRow: (label: string, value: string) => void;
  addFieldCard: (
    label: string,
    body: string | undefined | null,
    opts?: { showEmpty?: boolean; emptyLabel?: string },
  ) => void;
  addKpiTiles: (tiles: Array<{ label: string; value: string }>) => void;
  addSoftDivider: () => void;
  finish: (footer: CorporatePdfFooterOptions) => void;
};

/**
 * Delt, moderne layout for alle dokument-PDF-er (ROS, PVV, PDD, gevinster).
 * Sikrer footer-luft, ensartet forside, meta-panel og feltkort.
 */
export function createPdfLayout(doc: jsPDF): PdfLayout {
  const margin = PDF_MARGIN_MM;
  let y = margin;

  const pageW = () => doc.internal.pageSize.getWidth();
  const pageH = () => doc.internal.pageSize.getHeight();
  const contentW = () => pageW() - margin * 2;
  const contentBottom = () => pageH() - PDF_CONTENT_BOTTOM_INSET_MM;

  const ensureSpace = (needMm: number) => {
    if (y + needMm <= contentBottom()) return;
    doc.addPage();
    y = PDF_CONTINUATION_TOP_MM;
  };

  const drawCover = (opts: PdfCoverOptions) => {
    doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
    doc.rect(0, 0, pageW(), 34, "F");
    doc.setFillColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
    doc.rect(0, 34, pageW(), 1.1, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(opts.eyebrow, margin, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(opts.metaLine, margin, 17.5);
    const subLines = doc.splitTextToSize(opts.subtitle, contentW());
    doc.text(subLines, margin, 24);
    doc.setTextColor(0);
    y = 42;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    const titleLines = doc.splitTextToSize(opts.title.trim() || "Uten tittel", contentW());
    const titleLh = 7.2;
    ensureSpace(titleLines.length * titleLh + 10);
    doc.text(titleLines, margin, y);
    y += titleLines.length * titleLh + 4;
    doc.setFont("helvetica", "normal");

    if (opts.lead?.trim()) {
      doc.setFontSize(9.5);
      doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
      const leadLines = doc.splitTextToSize(opts.lead.trim(), contentW());
      const lh = bodyLineHeightMm(9.5);
      ensureSpace(leadLines.length * lh + 6);
      doc.text(leadLines, margin, y);
      y += leadLines.length * lh + 6;
      doc.setTextColor(0);
    }
  };

  const drawMetaPanel = (title: string, rows: PdfMetaRow[]) => {
    if (rows.length === 0) return;
    const pad = 5;
    const labelW = 48;
    const fs = 9;
    const lh = bodyLineHeightMm(fs);
    const valueMaxW = contentW() - pad * 2 - labelW - 2;

    let bodyH = lh + 5;
    for (const row of rows) {
      doc.setFontSize(fs);
      const ll = doc.splitTextToSize(row.label, labelW - 1);
      const vl = doc.splitTextToSize(row.value || "—", valueMaxW);
      bodyH += Math.max(ll.length, vl.length) * lh + 3.2;
    }
    const boxH = pad * 2 + bodyH + 1;
    ensureSpace(boxH + 8);

    const boxTop = y;
    doc.setFillColor(T.surface[0], T.surface[1], T.surface[2]);
    doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, boxTop, contentW(), boxH, 1.5, 1.5, "FD");

    // Accent strip
    doc.setFillColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
    doc.rect(margin, boxTop, 1.4, boxH, "F");

    let cy = boxTop + pad + 3.2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fs);
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    doc.text(title, margin + pad + 2, cy);
    cy += lh + 3.5;

    for (const row of rows) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
      const ll = doc.splitTextToSize(row.label, labelW - 1);
      const vl = doc.splitTextToSize(row.value || "—", valueMaxW);
      let lyy = cy;
      for (const line of ll) {
        doc.text(line, margin + pad + 2, lyy);
        lyy += lh;
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
      let vyy = cy;
      for (const line of vl) {
        doc.text(line, margin + pad + labelW + 2, vyy);
        vyy += lh;
      }
      cy = Math.max(lyy, vyy) + 3.2;
    }
    y = boxTop + boxH + 7;
    doc.setTextColor(0);
  };

  const drawToc = (items: string[]) => {
    if (items.length === 0) return;
    ensureSpace(12 + items.length * 5);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    doc.text("Innhold", margin, y);
    y += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    let n = 0;
    for (const item of items) {
      n += 1;
      const line = `${n}.  ${item}`;
      const lines = doc.splitTextToSize(line, contentW());
      ensureSpace(lines.length * bodyLineHeightMm(9) + 1.5);
      doc.text(lines, margin, y);
      y += lines.length * bodyLineHeightMm(9) + 1.5;
    }
    y += 4;
    doc.setTextColor(0);
  };

  const addHeading = (text: string, size = 12) => {
    ensureSpace(16);
    y += 2;
    const barW = 2.6;
    doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
    doc.rect(margin, y - size * 0.34, barW, size * 0.7, "F");
    const textX = margin + barW + 3.2;
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    doc.text(text, textX, y);
    y += size * 0.52 + 2;
    doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
    doc.setLineWidth(0.3);
    doc.line(textX, y, pageW() - margin, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0);
  };

  const addPara = (text: string, size = 10) => {
    const t = text.trim();
    if (!t) return;
    doc.setFontSize(size);
    const lh = bodyLineHeightMm(size);
    const lines = doc.splitTextToSize(t, contentW());
    ensureSpace(lines.length * lh + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
    doc.text(lines, margin, y);
    y += lines.length * lh + 3.5;
    doc.setTextColor(0);
  };

  const addMutedNote = (text: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
    addPara(text, 9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
  };

  const addRow = (label: string, value: string) => {
    const size = 9.5;
    const lh = bodyLineHeightMm(size);
    const labelW = 52;
    doc.setFontSize(size);
    const labelLines = doc.splitTextToSize(label, labelW - 1);
    const valueLines = doc.splitTextToSize(value || "—", contentW() - labelW - 2);
    const blockH = Math.max(labelLines.length, valueLines.length) * lh + 3;
    ensureSpace(blockH + 2);

    // Subtle zebra row background
    doc.setFillColor(T.mutedBg[0], T.mutedBg[1], T.mutedBg[2]);
    doc.roundedRect(margin, y - 3.2, contentW(), blockH + 1.5, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    let ly = y;
    for (const line of labelLines) {
      doc.text(line, margin + 2, ly);
      ly += lh;
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
    let vy = y;
    for (const line of valueLines) {
      doc.text(line, margin + labelW, vy);
      vy += lh;
    }
    y += blockH + 2.5;
    doc.setTextColor(0);
  };

  const addFieldCard = (
    label: string,
    body: string | undefined | null,
    opts?: { showEmpty?: boolean; emptyLabel?: string },
  ) => {
    const showEmpty = opts?.showEmpty !== false;
    const trimmed = (body ?? "").trim();
    if (!trimmed && !showEmpty) return;

    const emptyLabel = opts?.emptyLabel ?? "Ikke utfylt";
    const content = trimmed || emptyLabel;
    const isEmpty = !trimmed;
    const pad = 4;
    const labelFs = 8.5;
    const bodyFs = 9.5;
    const bodyLh = bodyLineHeightMm(bodyFs);

    doc.setFontSize(bodyFs);
    const bodyLines = doc.splitTextToSize(content, contentW() - pad * 2);
    const boxH = pad + 4.5 + bodyLines.length * bodyLh + pad + 1;
    ensureSpace(boxH + 4);

    const top = y;
    doc.setFillColor(
      isEmpty ? T.mutedBg[0] : T.surface[0],
      isEmpty ? T.mutedBg[1] : T.surface[1],
      isEmpty ? T.mutedBg[2] : T.surface[2],
    );
    doc.setDrawColor(T.mutedBorder[0], T.mutedBorder[1], T.mutedBorder[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, top, contentW(), boxH, 1.2, 1.2, "FD");

    doc.setFontSize(labelFs);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    doc.text(label, margin + pad, top + pad + 2.5);

    doc.setFont("helvetica", isEmpty ? "italic" : "normal");
    doc.setFontSize(bodyFs);
    doc.setTextColor(
      isEmpty ? T.slate500[0] : T.slate800[0],
      isEmpty ? T.slate500[1] : T.slate800[1],
      isEmpty ? T.slate500[2] : T.slate800[2],
    );
    doc.text(bodyLines, margin + pad, top + pad + 7.5);
    y = top + boxH + 3.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
  };

  const addKpiTiles = (tiles: Array<{ label: string; value: string }>) => {
    if (tiles.length === 0) return;
    const cols = Math.min(2, tiles.length);
    const gap = 3;
    const tileW = (contentW() - gap * (cols - 1)) / cols;
    const tileH = 16;
    const rows = Math.ceil(tiles.length / cols);
    ensureSpace(rows * (tileH + gap) + 4);

    tiles.forEach((tile, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (tileW + gap);
      const yy = y + row * (tileH + gap);
      doc.setFillColor(T.calloutBg[0], T.calloutBg[1], T.calloutBg[2]);
      doc.setDrawColor(T.calloutBorder[0], T.calloutBorder[1], T.calloutBorder[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, yy, tileW, tileH, 1.5, 1.5, "FD");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
      doc.text(tile.label, x + 3, yy + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
      const valLines = doc.splitTextToSize(tile.value, tileW - 6);
      doc.text(valLines[0] ?? "—", x + 3, yy + 11.5);
    });
    y += rows * (tileH + gap) + 4;
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
  };

  const addSoftDivider = () => {
    ensureSpace(6);
    doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
    doc.setLineWidth(0.2);
    doc.line(margin + 8, y, pageW() - margin - 8, y);
    y += 5;
  };

  const finish = (footer: CorporatePdfFooterOptions) => {
    applyCorporatePdfFooters(doc, margin, footer);
  };

  return {
    margin,
    getY: () => y,
    setY: (n: number) => {
      y = n;
    },
    pageW,
    pageH,
    contentW,
    ensureSpace,
    drawCover,
    drawMetaPanel,
    drawToc,
    addHeading,
    addPara,
    addMutedNote,
    addRow,
    addFieldCard,
    addKpiTiles,
    addSoftDivider,
    finish,
  };
}

export function formatPdfTimestamp(d: Date): string {
  try {
    return d.toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short" });
  } catch {
    return d.toISOString();
  }
}
