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
export const PDF_CONTINUATION_TOP_MM = 18;
export const PDF_MARGIN_MM = 18;

export type PdfMetaRow = { label: string; value: string };

/** Ren forside — minimal. Arbeidsområde/dokumentkontroll tegnes etter TOC. */
export type PdfFrontPageOptions = {
  /** Kort dokumenttype, f.eks. «PVV-vurdering» / «ROS-analyse». */
  docTypeLabel: string;
  /** Valgfri overlinje over tittel, f.eks. «5-stegs vurdering». */
  eyebrow?: string;
  title: string;
  /** Én linje under tittel. */
  subtitle?: string;
  /** Formatert dato/tid. */
  generatedLabel: string;
  /** Dokumentreferanse, f.eks. ROS-2026-07-18. */
  documentRef: string;
  /** @deprecated Flyttet til drawDocumentControlPage */
  lead?: string;
  /** @deprecated Flyttet til drawDocumentControlPage */
  organizationLine?: string;
  /** @deprecated Flyttet til drawDocumentControlPage */
  metaRows?: PdfMetaRow[];
};

export type PdfDocumentControlOptions = {
  organizationLine?: string;
  metaRows?: PdfMetaRow[];
};

/** @deprecated Bruk PdfFrontPageOptions via drawFrontPage */
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
  /**
   * Ren forside, deretter blank side.
   * Deretter forventes drawTocPage → drawDocumentControlPage.
   */
  drawFrontPage: (opts: PdfFrontPageOptions) => void;
  /**
   * Innholdsside med prikket leder og sidetall (fylles i finish).
   * Går deretter til ny side.
   */
  drawTocPage: (entries: string[]) => void;
  /**
   * Arbeidsområde + dokumentkontroll — egen side etter TOC.
   * Innhold kan fortsette på samme side under.
   */
  drawDocumentControlPage: (opts: PdfDocumentControlOptions) => void;
  /** Registrer sidetall for TOC-oppføring (tittel må matche). */
  markToc: (title: string) => void;
  /** Overskrift som også registrerer TOC-sidetall ved treff. */
  addSection: (title: string, size?: number) => void;
  /** @deprecated Bruk drawFrontPage */
  drawCover: (opts: PdfCoverOptions) => void;
  /** @deprecated Meta ligger på forsiden via drawFrontPage */
  drawMetaPanel: (title: string, rows: PdfMetaRow[]) => void;
  /** @deprecated Bruk drawTocPage */
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

type TocEntryState = { title: string; page: number | null };

/**
 * Delt, moderne layout for alle dokument-PDF-er (ROS, PVV, PDD, gevinster).
 * Forside → innholdsfortegnelse → innhold, med footer-luft.
 */
export function createPdfLayout(doc: jsPDF): PdfLayout {
  const margin = PDF_MARGIN_MM;
  let y = margin;

  const tocState: {
    pageNumber: number | null;
    entries: TocEntryState[];
  } = {
    pageNumber: null,
    entries: [],
  };

  const pageW = () => doc.internal.pageSize.getWidth();
  const pageH = () => doc.internal.pageSize.getHeight();
  const contentW = () => pageW() - margin * 2;
  const contentBottom = () => pageH() - PDF_CONTENT_BOTTOM_INSET_MM;

  const ensureSpace = (needMm: number) => {
    if (y + needMm <= contentBottom()) return;
    doc.addPage();
    y = PDF_CONTINUATION_TOP_MM;
  };

  const currentPage = () => doc.getCurrentPageInfo().pageNumber;

  const drawMetaRowsInBox = (
    boxTop: number,
    boxW: number,
    title: string,
    rows: PdfMetaRow[],
  ): number => {
    const pad = 5.5;
    const labelW = 46;
    const fs = 9;
    const lh = bodyLineHeightMm(fs);
    const valueMaxW = boxW - pad * 2 - labelW - 2;

    let bodyH = lh + 4;
    for (const row of rows) {
      doc.setFontSize(fs);
      const ll = doc.splitTextToSize(row.label, labelW - 1);
      const vl = doc.splitTextToSize(row.value || "—", valueMaxW);
      bodyH += Math.max(ll.length, vl.length) * lh + 2.8;
    }
    const boxH = pad * 2 + bodyH;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, boxTop, boxW, boxH, 2, 2, "FD");
    doc.setFillColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
    doc.rect(margin, boxTop, 1.6, boxH, "F");

    let cy = boxTop + pad + 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
    doc.text(title.toUpperCase(), margin + pad + 2, cy);
    cy += lh + 3;

    for (const row of rows) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fs);
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
      cy = Math.max(lyy, vyy) + 2.8;
    }
    return boxH;
  };

  const drawFrontPage = (opts: PdfFrontPageOptions) => {
    const pw = pageW();
    const ph = pageH();

    // Clean white cover
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, ph, "F");

    // Slim left rail only
    doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
    doc.rect(0, 0, 5, ph, "F");
    doc.setFillColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
    doc.rect(5, 0, 1, ph, "F");

    const cx = margin + 6;

    // Document type only (brand lives in footer / running chrome, not cover chrome)
    const typeLabel = (opts.docTypeLabel.trim() || "Dokument").toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
    doc.text(typeLabel, cx, 28);

    // Thin rule
    doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
    doc.setLineWidth(0.35);
    doc.line(cx, 36, pw - margin, 36);

    // Vertically centered title block
    const titleMaxW = contentW() - 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const eyebrow = opts.eyebrow?.trim().toUpperCase() ?? "";
    doc.setFontSize(26);
    const titleLines = doc.splitTextToSize(
      opts.title.trim() || "Uten tittel",
      titleMaxW,
    );
    const shownTitle = titleLines.slice(0, 3);
    doc.setFontSize(12);
    const subLines = opts.subtitle?.trim()
      ? doc.splitTextToSize(opts.subtitle.trim(), titleMaxW).slice(0, 2)
      : [];

    const blockH =
      (eyebrow ? 8 : 0) +
      shownTitle.length * 11 +
      (subLines.length ? 6 + subLines.length * 6 : 0);
    let ty = Math.max(72, (ph - 40) / 2 - blockH / 2);

    if (eyebrow) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
      doc.text(eyebrow, cx, ty);
      ty += 10;
    }

    doc.setFillColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
    doc.rect(cx, ty - 1, 2.8, shownTitle.length * 11 + 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    let titleY = ty + 8;
    for (const line of shownTitle) {
      doc.text(line, cx + 8, titleY);
      titleY += 11;
    }
    ty = titleY + 4;

    if (subLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
      for (const line of subLines) {
        doc.text(line, cx + 8, ty);
        ty += 6;
      }
    }

    // Minimal bottom: date · ref
    doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
    doc.setLineWidth(0.3);
    doc.line(cx, ph - 22, pw - margin, ph - 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
    doc.text(opts.generatedLabel, cx, ph - 14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    doc.text(opts.documentRef || "—", pw - margin, ph - 14, {
      align: "right",
    });

    doc.setTextColor(0);

    // Blank page after cover (intentional empty verso)
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, ph, "F");

    doc.addPage();
    y = PDF_CONTINUATION_TOP_MM;
  };

  const drawDocumentControlPage = (opts: PdfDocumentControlOptions) => {
    const org = opts.organizationLine?.trim();
    const rows = (opts.metaRows ?? []).filter((r) => r.value.trim());
    if (!org && rows.length === 0) return;

    markToc("Dokumentkontroll");
    addHeading("Dokumentkontroll", 13);

    if (org) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
      ensureSpace(14);
      doc.text("ARBEIDSOMRÅDE", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
      const orgLines = doc.splitTextToSize(org, contentW());
      ensureSpace(orgLines.length * 5.5 + 8);
      doc.text(orgLines, margin, y);
      y += orgLines.length * 5.5 + 8;
    }

    if (rows.length > 0) {
      const cols = 2;
      const gap = 3.5;
      const tileW = (contentW() - gap) / cols;
      const tileH = 16;
      const tileRows = Math.ceil(rows.length / cols);
      ensureSpace(tileRows * (tileH + gap) + 6);

      rows.forEach((row, i) => {
        const col = i % cols;
        const r = Math.floor(i / cols);
        const x = margin + col * (tileW + gap);
        const yy = y + r * (tileH + gap);
        doc.setFillColor(T.surface[0], T.surface[1], T.surface[2]);
        doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, yy, tileW, tileH, 1.8, 1.8, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
        doc.text(row.label, x + 3.5, yy + 5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
        const val = doc.splitTextToSize(row.value, tileW - 7);
        doc.text(val[0] ?? "—", x + 3.5, yy + 11);
      });
      y += tileRows * (tileH + gap) + 6;
    }

    addSoftDivider();
    doc.setTextColor(0);
  };

  const paintTocPage = (entries: TocEntryState[]) => {
    const pw = pageW();
    // Header band
    doc.setFillColor(T.surface[0], T.surface[1], T.surface[2]);
    doc.rect(0, 0, pw, 28, "F");
    doc.setFillColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
    doc.rect(0, 28, pw, 1.1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
    doc.text("PVV", margin, 12);
    doc.setFontSize(16);
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    doc.text("Innholdsfortegnelse", margin, 22);

    let ty = 42;
    const rowH = 9;
    const numW = 10;
    const pageColW = 12;
    const titleMaxW = contentW() - numW - pageColW - 8;

    entries.forEach((entry, i) => {
      if (ty > contentBottom() - 8) return;
      const n = String(i + 1).padStart(2, "0");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
      doc.text(n, margin, ty);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
      const titleLines = doc.splitTextToSize(entry.title, titleMaxW);
      const title = titleLines[0] ?? entry.title;
      doc.text(title, margin + numW, ty);

      const titleW = doc.getTextWidth(title);
      const dotsStart = margin + numW + titleW + 2;
      const dotsEnd = pw - margin - pageColW - 2;
      if (dotsEnd > dotsStart + 4) {
        doc.setFontSize(8);
        doc.setTextColor(T.slate200[0], T.slate200[1], T.slate200[2]);
        let dx = dotsStart;
        while (dx < dotsEnd) {
          doc.text("·", dx, ty);
          dx += 2.2;
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
      const pageLabel =
        entry.page != null && entry.page > 0 ? String(entry.page) : "—";
      doc.text(pageLabel, pw - margin, ty, { align: "right" });

      // subtle separator
      doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
      doc.setLineWidth(0.15);
      doc.line(margin + numW, ty + 3.2, pw - margin, ty + 3.2);

      ty += rowH + (titleLines.length > 1 ? 2 : 0);
    });

    doc.setTextColor(0);
  };

  const drawTocPage = (titles: string[]) => {
    tocState.entries = titles
      .map((t) => t.trim())
      .filter(Boolean)
      .map((title) => ({ title, page: null }));
    tocState.pageNumber = currentPage();
    paintTocPage(tocState.entries);
    doc.addPage();
    y = PDF_CONTINUATION_TOP_MM;
  };

  const markToc = (title: string) => {
    const needle = title.trim();
    if (!needle || tocState.entries.length === 0) return;
    const page = currentPage();
    const exact = tocState.entries.find(
      (e) => e.page == null && e.title === needle,
    );
    if (exact) {
      exact.page = page;
      return;
    }
    // Fuzzy: TOC title contained in heading or vice versa
    const fuzzy = tocState.entries.find(
      (e) =>
        e.page == null &&
        (needle.includes(e.title) || e.title.includes(needle)),
    );
    if (fuzzy) fuzzy.page = page;
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

  const addSection = (title: string, size = 12) => {
    markToc(title);
    addHeading(title, size);
  };

  /** Legacy thin cover — maps to front page without dedicated TOC. */
  const drawCover = (opts: PdfCoverOptions) => {
    drawFrontPage({
      docTypeLabel: opts.eyebrow.split("·")[0]?.trim() || "Dokument",
      eyebrow: opts.eyebrow,
      title: opts.title,
      subtitle: opts.subtitle,
      lead: opts.lead,
      generatedLabel: opts.metaLine,
      documentRef: "",
      metaRows: [],
    });
  };

  const drawMetaPanel = (_title: string, rows: PdfMetaRow[]) => {
    if (rows.length === 0) return;
    const boxH = drawMetaRowsInBox(y, contentW(), _title, rows);
    y += boxH + 8;
    doc.setTextColor(0);
  };

  const drawToc = (items: string[]) => {
    drawTocPage(items);
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
    const valueLines = doc.splitTextToSize(
      value || "—",
      contentW() - labelW - 2,
    );
    const blockH = Math.max(labelLines.length, valueLines.length) * lh + 3;
    ensureSpace(blockH + 2);

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
      doc.setDrawColor(
        T.calloutBorder[0],
        T.calloutBorder[1],
        T.calloutBorder[2],
      );
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
    // Backfill TOC page numbers
    if (tocState.pageNumber != null && tocState.entries.length > 0) {
      const returnPage = currentPage();
      doc.setPage(tocState.pageNumber);
      // Clear content area and repaint
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageW(), pageH(), "F");
      paintTocPage(tocState.entries);
      doc.setPage(returnPage);
    }

    // Side 1 cover + side 2 blank uten løpende footer; header fra innhold (side 4+)
    applyCorporatePdfFooters(doc, margin, {
      ...footer,
      skipFirstPages: 2,
      headerFromPage: 4,
    });
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
    drawFrontPage,
    drawTocPage,
    drawDocumentControlPage,
    markToc,
    addSection,
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
