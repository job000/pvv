import type { jsPDF } from "jspdf";

import {
  applyCorporatePdfFooters,
  bodyLineHeightMm,
  PDF_CORPORATE_THEME,
  type CorporatePdfFooterOptions,
} from "@/lib/pdf-corporate";
import { resolvePdfCoverBackgroundDataUrl } from "@/lib/pdf-cover-background";

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
  /**
   * Valgfritt eget forsidebilde (data-URL).
   * Uten bilde brukes generert standardbakgrunn.
   */
  coverImageDataUrl?: string | null;
  /** Kort én-linjes beskrivelse under tittelblokken (ikke disclaimer). */
  lead?: string;
  /** @deprecated Flyttet til drawDocumentControlPage */
  organizationLine?: string;
  /** @deprecated Flyttet til drawDocumentControlPage */
  metaRows?: PdfMetaRow[];
};

export type PdfHukiRow = {
  activity: string;
  h?: string;
  u?: string;
  k?: string;
  i?: string;
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
  /** HUKI som lesbar matrise (Aktivitet × H/U/K/I). */
  addHukiMatrix: (rows: PdfHukiRow[]) => void;
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

  /**
   * Profesjonell rapportforside — editorial layout:
   * hvit flate, rolig toppstripe, klar tittel, strukturert metadata.
   */
  const drawFrontPage = (opts: PdfFrontPageOptions) => {
    const pw = pageW();
    const ph = pageH();
    const cx = margin;
    const textMaxW = contentW();

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, ph, "F");

    // Optional custom image as restrained top banner
    const customBg = resolvePdfCoverBackgroundDataUrl(opts.coverImageDataUrl);
    let contentStartY = 28;
    if (customBg) {
      try {
        const format = customBg.includes("image/png") ? "PNG" : "JPEG";
        const bannerH = 42;
        doc.addImage(customBg, format, 0, 0, pw, bannerH, undefined, "FAST");
        doc.setFillColor(255, 255, 255);
        doc.rect(0, bannerH, pw, ph - bannerH, "F");
        doc.setFillColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
        doc.rect(0, bannerH, pw, 1, "F");
        contentStartY = bannerH + 16;
      } catch {
        /* fall through to standard header */
      }
    }

    if (!customBg) {
      // Slim institutional top rule (single, not stacked bars)
      doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
      doc.rect(0, 0, pw, 2.4, "F");
      contentStartY = 22;
    }

    // Classification row
    const typeLabel = opts.docTypeLabel.trim() || "Dokument";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(T.brand[0], T.brand[1], T.brand[2]);
    doc.text(typeLabel.toUpperCase(), cx, contentStartY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
    doc.text("Intern bruk", pw - margin, contentStartY, { align: "right" });

    // Classification rule stays near top; title block sits lower on the page
    let ty = contentStartY + 5;
    doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
    doc.setLineWidth(0.4);
    doc.line(cx, ty, pw - margin, ty);

    // Start title content further down (above the meta band)
    const bandH = 38;
    const titleBlockStart = Math.max(ty + 28, ph * 0.38);
    ty = titleBlockStart;

    if (opts.eyebrow?.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
      doc.text(opts.eyebrow.trim(), cx, ty);
      ty += 9;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    const titleLines = doc.splitTextToSize(
      opts.title.trim() || "Uten tittel",
      textMaxW,
    );
    const shownTitle = titleLines.slice(0, 4);
    const titleLh = 9.2;
    for (const line of shownTitle) {
      doc.text(line, cx, ty);
      ty += titleLh;
    }
    ty += 7;

    if (opts.subtitle?.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
      const subLines = doc.splitTextToSize(opts.subtitle.trim(), textMaxW);
      for (const line of subLines.slice(0, 3)) {
        doc.text(line, cx, ty);
        ty += 5.6;
      }
      ty += 6;
    }

    doc.setFillColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
    doc.rect(cx, ty, 18, 1.1, "F");
    ty += 12;

    if (opts.lead?.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
      const leadLines = doc.splitTextToSize(opts.lead.trim(), textMaxW);
      for (const line of leadLines.slice(0, 2)) {
        doc.text(line, cx, ty);
        ty += 5.2;
      }
    }

    // Footer band — full-bleed, calm, table-like meta
    const bandY = ph - bandH;
    doc.setFillColor(T.surface[0], T.surface[1], T.surface[2]);
    doc.rect(0, bandY, pw, bandH, "F");
    doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
    doc.rect(0, bandY, pw, 1, "F");

    const cols = [
      { label: "Dato", value: opts.generatedLabel },
      { label: "Dokumentreferanse", value: opts.documentRef || "—" },
      { label: "Dokumenttype", value: typeLabel },
    ];
    const colW = contentW() / cols.length;
    cols.forEach((col, i) => {
      const x = cx + i * colW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
      doc.text(col.label, x, bandY + 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
      const lines = doc.splitTextToSize(col.value, colW - 4);
      doc.text(lines[0] ?? "—", x, bandY + 21);
    });

    doc.setTextColor(0);

    // Blank side etter cover
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

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, pageH(), "F");
    doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
    doc.rect(0, 0, pw, 2.4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(T.brand[0], T.brand[1], T.brand[2]);
    doc.text("INNHOLD", margin, 18);
    doc.setFontSize(18);
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    doc.text("Innholdsfortegnelse", margin, 28);
    doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
    doc.setLineWidth(0.35);
    doc.line(margin, 33, pw - margin, 33);

    let ty = 46;
    const rowH = 10;
    const numW = 12;
    const pageColW = 12;
    const titleMaxW = contentW() - numW - pageColW - 8;

    entries.forEach((entry, i) => {
      if (ty > contentBottom() - 8) return;
      const n = `${i + 1}.`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
      doc.text(n, margin, ty);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
      const titleLines = doc.splitTextToSize(entry.title, titleMaxW);
      const title = titleLines[0] ?? entry.title;
      doc.text(title, margin + numW, ty);

      const titleW = doc.getTextWidth(title);
      const dotsStart = margin + numW + titleW + 2.5;
      const dotsEnd = pw - margin - pageColW - 2;
      if (dotsEnd > dotsStart + 4) {
        doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
        doc.setLineWidth(0.2);
        // dotted leader via short dashes
        for (let dx = dotsStart; dx < dotsEnd; dx += 2.4) {
          doc.line(dx, ty - 0.8, Math.min(dx + 0.7, dotsEnd), ty - 0.8);
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
      const pageLabel =
        entry.page != null && entry.page > 0 ? String(entry.page) : "—";
      doc.text(pageLabel, pw - margin, ty, { align: "right" });

      ty += rowH;
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

  const addHukiMatrix = (rows: PdfHukiRow[]) => {
    if (rows.length === 0) {
      addMutedNote("HUKI: ingen oppføringer.");
      return;
    }

    // Legend chips
    const legend: Array<{ code: string; label: string }> = [
      { code: "H", label: "Høres" },
      { code: "U", label: "Utfører" },
      { code: "K", label: "Kontrollerer" },
      { code: "I", label: "Informeres" },
    ];
    ensureSpace(16);
    let lx = margin;
    for (const item of legend) {
      const chipW = 28 + doc.getTextWidth(item.label);
      doc.setFillColor(T.calloutBg[0], T.calloutBg[1], T.calloutBg[2]);
      doc.setDrawColor(T.calloutBorder[0], T.calloutBorder[1], T.calloutBorder[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(lx, y - 3.5, chipW, 8, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
      doc.text(item.code, lx + 3, y + 1.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
      doc.text(item.label, lx + 10, y + 1.5);
      lx += chipW + 3;
    }
    y += 10;

    const roleCols = ["H", "U", "K", "I"] as const;
    const roleW = 22;
    const actW = contentW() - roleW * 4;
    const headerH = 12;
    const minRowH = 10;
    const cellPad = 2.5;

    const drawHeader = () => {
      ensureSpace(headerH + 4);
      doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
      doc.roundedRect(margin, y, contentW(), headerH, 1.2, 1.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("Aktivitet", margin + cellPad, y + 7.5);
      roleCols.forEach((code, i) => {
        const x = margin + actW + i * roleW + roleW / 2;
        doc.text(code, x, y + 5.2, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(191, 219, 254);
        const short =
          code === "H"
            ? "Høres"
            : code === "U"
              ? "Utfører"
              : code === "K"
                ? "Kontroll."
                : "Inform.";
        doc.text(short, x, y + 9.2, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
      });
      y += headerH;
    };

    drawHeader();

    rows.forEach((row, idx) => {
      const activity = row.activity?.trim() || "Aktivitet";
      doc.setFontSize(9);
      const actLines = doc.splitTextToSize(activity, actW - cellPad * 2);
      const values = [row.h, row.u, row.k, row.i].map((v) => {
        const t = (v ?? "").trim();
        return t || "—";
      });
      let maxValLines = 1;
      for (const v of values) {
        doc.setFontSize(8);
        const vl = doc.splitTextToSize(v, roleW - 3);
        maxValLines = Math.max(maxValLines, vl.length);
      }
      const rowH = Math.max(
        minRowH,
        actLines.length * bodyLineHeightMm(9) + 4,
        maxValLines * bodyLineHeightMm(8) + 4,
      );

      if (y + rowH > contentBottom()) {
        doc.addPage();
        y = PDF_CONTINUATION_TOP_MM;
        drawHeader();
      }

      const zebra = idx % 2 === 0;
      doc.setFillColor(
        zebra ? T.surface[0] : 255,
        zebra ? T.surface[1] : 255,
        zebra ? T.surface[2] : 255,
      );
      doc.rect(margin, y, contentW(), rowH, "F");
      doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
      doc.setLineWidth(0.2);
      doc.rect(margin, y, contentW(), rowH, "S");

      // Vertical grid for role columns
      for (let i = 0; i <= 4; i++) {
        const gx = margin + actW + i * roleW;
        doc.line(gx, y, gx, y + rowH);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
      doc.text(actLines, margin + cellPad, y + 5.5);

      values.forEach((val, i) => {
        const empty = val === "—";
        const x = margin + actW + i * roleW + roleW / 2;
        doc.setFont("helvetica", empty ? "italic" : "normal");
        doc.setFontSize(8);
        doc.setTextColor(
          empty ? T.slate500[0] : T.slate800[0],
          empty ? T.slate500[1] : T.slate800[1],
          empty ? T.slate500[2] : T.slate800[2],
        );
        const vl = doc.splitTextToSize(val, roleW - 3);
        const textH = vl.length * bodyLineHeightMm(8);
        doc.text(vl, x, y + (rowH - textH) / 2 + 3.2, { align: "center" });
      });

      y += rowH;
    });

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
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
    addHukiMatrix,
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
