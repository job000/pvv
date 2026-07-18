import { jsPDF } from "jspdf";

import {
  parseLegacyNoteToMatrixCellDetail,
  type RosCellRiskPointPdfRow,
  type RosIdentifiedRiskPdfRow,
  type RosPdfMatrixCellDetail,
} from "@/lib/ros-cell-items";
import { ROS_COMPLIANCE_PDF_DISCLAIMER_NB } from "@/lib/ros-compliance";
import { ROS_COMPLIANCE_SCOPE_TAGS } from "@/lib/ros-requirement-catalog";
import {
  bodyLineHeightMm,
  drawPdfTextLines,
  PDF_CORPORATE_THEME,
  sanitizePdfText,
  splitPdfText,
} from "@/lib/pdf-corporate";
import {
  createPdfLayout,
  formatPdfTimestamp,
  PDF_CONTENT_BOTTOM_INSET_MM,
  PDF_CONTINUATION_TOP_MM,
  PDF_MARGIN_MM,
} from "@/lib/pdf-layout";
import { legendItems, pdfRiskLevelStyle } from "@/lib/ros-risk-colors";

const PDF_THEME = PDF_CORPORATE_THEME;

export type RosPdfJournalLine = {
  body: string;
  authorName: string;
  createdAt: number;
  linkedRow?: number;
  linkedCol?: number;
  /** Mangler = før tiltak (eldre logg) */
  matrixPhase?: "before" | "after";
};

export type RosPdfPvvLinkDetail = {
  title: string;
  pddLabel: string;
  /** Lenke til PDD-dokument fra vurderingen */
  pddUrl?: string;
  linkNote?: string;
  pvvLinkNote?: string;
  flagsText?: string;
  highlightForPvv: boolean;
  /** Strukturerte kravhenvisninger på koblingen */
  requirementRefLines?: string[];
};

export type RosPdfTaskLine = {
  line: string;
  /** Kort status, f.eks. «Åpen» / «Fullført» */
  statusLabel: string;
  description?: string;
  assigneeName?: string | null;
  linkedRiskSummary?: string | null;
  /** Lesbar behandlingstype */
  riskTreatmentLabel?: string;
};

export type RosPdfMetadata = {
  revision?: number;
  createdAtMs?: number;
  updatedAtMs?: number;
  templateName?: string | null;
};

export type RosPdfVersionSnapshot = {
  version: number;
  note?: string;
  createdAt: number;
};

export type RosPdfInput = {
  title: string;
  workspaceName: string | null;
  candidateName: string | null;
  candidateCode: string | null;
  rowAxisTitle: string;
  colAxisTitle: string;
  rowLabels: string[];
  colLabels: string[];
  /** Før tiltak */
  matrixValues: number[][];
  cellNotes: string[][];
  /**
   * Strukturert celleinnhold (risiko + tiltak/følg) for før-matrisen.
   * Hvis mangler, utledes fra `cellNotes`.
   */
  matrixCellDetails?: RosPdfMatrixCellDetail[][];
  /** Etter tiltak (rest) */
  matrixValuesAfter: number[][];
  cellNotesAfter: string[][];
  /** Strukturert celleinnhold for etter-matrisen (valgfritt). */
  matrixCellDetailsAfter?: RosPdfMatrixCellDetail[][];
  /** Akser for etter-matrise (kopier fra før hvis ikke eget rutenett) */
  afterRowLabels: string[];
  afterColLabels: string[];
  afterRowAxisTitle: string;
  afterColAxisTitle: string;
  afterSeparateLayout: boolean;
  analysisNotes: string | null;
  /** Automatisk oppsummering (før/etter tiltak) + valgfrie flagglinjer */
  summaryLines?: string[];
  /** Livssyklus / ISO — valgfritt */
  methodologyStatement?: string | null;
  contextSummary?: string | null;
  scopeAndCriteria?: string | null;
  riskCriteriaVersion?: string | null;
  axisScaleNotes?: string | null;
  complianceScopeTagIds?: string[];
  requirementRefLines?: string[];
  /** Neste revisjon og rutine (fanen Innstillinger) */
  reviewSchedule?: {
    nextReview?: string;
    routine?: string;
  };
  /** Alle oppgaver med status — foretrekkes fremfor kun åpne */
  taskLinesAll?: RosPdfTaskLine[];
  /** Åpne oppfølgingsoppgaver (én linje per oppgave) — brukes hvis taskLinesAll ikke er satt */
  openTaskLines?: string[];
  /** Alle risiko-punkter fra matrisen med full tekst og tiltak/følg (egen seksjon i PDF) */
  identifiedRisks?: RosIdentifiedRiskPdfRow[];
  /**
   * Alle registrerte punkter per celle (før og etter) — komplett liste utover
   * «Identifiserte risikoer» som følger flytting før→etter.
   */
  cellRiskPointsComplete?: RosCellRiskPointPdfRow[];
  /** Lesbar sektor-pakke ved opprettelse */
  sectorPackLabel?: string | null;
  /** Kortlager (ikke plassert i matrise) — én linje per kort */
  riskPoolBeforeLines?: string[];
  riskPoolAfterLines?: string[];
  linkedPvvTitles: string[];
  /** Full tekst per PVV-kobling (fanen PVV-koblinger) */
  pvvLinksDetailed?: RosPdfPvvLinkDetail[];
  journalEntries: RosPdfJournalLine[];
  generatedAt: Date;
  /** Revisjon, mal, tidsstempler */
  metadata?: RosPdfMetadata;
  /** Lagrede øyeblikksbilder (fanen Versjoner) */
  versionSnapshots?: RosPdfVersionSnapshot[];
};

function formatTs(ms: number) {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return String(ms);
  }
}

/** Én lesbar linje per strukturert kravhenvisning (ROS / PVV-kobling). */
export function formatRosRequirementRefLine(r: {
  source: string;
  article?: string;
  note?: string;
  documentationUrl?: string;
}): string {
  const src =
    r.source === "gdpr"
      ? "GDPR"
      : r.source === "nis2"
        ? "NIS2"
        : r.source === "iso31000"
          ? "ISO 31000"
          : r.source === "iso27005"
            ? "ISO/IEC 27005"
            : r.source === "norwegian_law"
              ? "Norsk lov"
              : r.source === "internal"
                ? "Internt"
                : r.source;
  return [src, r.article, r.note, r.documentationUrl]
    .filter((x) => Boolean(x && String(x).trim()))
    .join(" · ");
}

const JOURNAL_PDF_MAX = 100;

/** Bygger A4-PDF med ROS-analyse (tekst + matrise + logg). */
export function buildRosAnalysisPdfDocument(data: RosPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = createPdfLayout(doc);
  const margin = PDF_MARGIN_MM;
  let y = margin;

  const pageW = () => doc.internal.pageSize.getWidth();
  const pageH = () => doc.internal.pageSize.getHeight();
  const contentW = () => pageW() - margin * 2;
  /** Brødtekst: aldri bredere enn stående A4. */
  const textContentW = () => Math.min(contentW(), 210 - margin * 2);
  const shortTitle = (data.title || "ROS-analyse").trim().slice(0, 60);

  doc.setProperties({
    title: data.title,
    subject: "ROS-analyse (risiko og sårbarhet)",
    keywords: "ROS, risiko, PVV, personvern",
    creator: "PVV",
  });

  const legend = legendItems();
  const levelLabel = (n: number) =>
    legend.find((x) => x.level === n)?.label ?? String(n);

  /** Footer-aware sideskift (synkronisert med felles layout). */
  const ensureSpace = (needMm: number) => {
    if (y + needMm <= pageH() - PDF_CONTENT_BOTTOM_INSET_MM) return;
    // Eksplisitt stående — ellers arves landskap etter matrise-sider.
    doc.addPage("a4", "portrait");
    y = PDF_CONTINUATION_TOP_MM;
  };

  const addHeading = (
    text: string,
    size = 14,
    opts?: { rule?: boolean; bar?: boolean },
  ) => {
    const rule = opts?.rule !== false && size >= 11;
    const bar = opts?.bar !== false && size >= 11;
    ensureSpace(16);
    const barW = 2.8;
    if (bar) {
      doc.setFillColor(
        PDF_THEME.brand[0],
        PDF_THEME.brand[1],
        PDF_THEME.brand[2],
      );
      doc.rect(margin, y - size * 0.36, barW, size * 0.72, "F");
    }
    const textX = margin + (bar ? barW + 3.5 : 0);
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(
      PDF_THEME.slate900[0],
      PDF_THEME.slate900[1],
      PDF_THEME.slate900[2],
    );
    doc.text(text, textX, y);
    y += size * 0.55 + (rule ? 2 : 4);
    if (rule) {
      doc.setDrawColor(
        PDF_THEME.slate200[0],
        PDF_THEME.slate200[1],
        PDF_THEME.slate200[2],
      );
      doc.setLineWidth(0.35);
      doc.line(textX, y, pageW() - margin, y);
      y += 4;
    } else {
      y += 1;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0);
  };

  const addPara = (text: string, size = 10) => {
    doc.setFontSize(size);
    const lh = bodyLineHeightMm(size);
    const lines = splitPdfText(doc, text, textContentW());
    ensureSpace(lines.length * lh + 5);
    doc.setTextColor(
      PDF_THEME.slate800[0],
      PDF_THEME.slate800[1],
      PDF_THEME.slate800[2],
    );
    y = drawPdfTextLines(doc, lines, margin, y, lh) + 3.5;
    doc.setTextColor(0);
  };

  const addRow = (label: string, value: string) => {
    const size = 10;
    const lh = bodyLineHeightMm(size);
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(
      PDF_THEME.slate700[0],
      PDF_THEME.slate700[1],
      PDF_THEME.slate700[2],
    );
    const labelLines = splitPdfText(doc, label, 42);
    const vlines = splitPdfText(doc, value, textContentW() - 48);
    const labelH = labelLines.length * lh;
    const valueH = vlines.length * lh;
    const block = Math.max(labelH, valueH) + 4;
    ensureSpace(block);
    let ly = y;
    for (const ll of labelLines) {
      doc.text(ll, margin, ly);
      ly += lh;
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(
      PDF_THEME.slate800[0],
      PDF_THEME.slate800[1],
      PDF_THEME.slate800[2],
    );
    let vy = y;
    for (const vl of vlines) {
      doc.text(vl, margin + 48, vy);
      vy += lh;
    }
    y += Math.max(labelH, valueH) + 5;
    doc.setTextColor(0);
  };

  /** Visuell pause mellom større blokker (f.eks. oppgaver / risikoer). */
  const addSoftDivider = () => {
    ensureSpace(6);
    doc.setDrawColor(
      PDF_THEME.slate200[0],
      PDF_THEME.slate200[1],
      PDF_THEME.slate200[2],
    );
    doc.setLineWidth(0.2);
    doc.line(margin + 10, y, pageW() - margin - 10, y);
    y += 5;
  };

  const isoDate = data.generatedAt.toISOString().slice(0, 10);
  const docRefLabel = `ROS-${isoDate}${data.metadata?.revision != null ? ` · Rev. ${data.metadata.revision}` : ""}`;

  const controlRows: Array<{ label: string; value: string }> = [];
  if (data.candidateName?.trim()) {
    const code = data.candidateCode?.trim();
    controlRows.push({
      label: "Prosess / enhet",
      value: code
        ? `${data.candidateName.trim()} (${code})`
        : data.candidateName.trim(),
    });
  }
  controlRows.push({
    label: "Risikoakser (matrise)",
    value: `${data.rowAxisTitle} × ${data.colAxisTitle}`,
  });
  const meta = data.metadata;
  if (meta?.revision != null) {
    controlRows.push({ label: "Revisjon", value: String(meta.revision) });
  }
  if (meta?.templateName?.trim()) {
    controlRows.push({ label: "Mal", value: meta.templateName.trim() });
  }
  if (meta?.createdAtMs) {
    controlRows.push({ label: "Opprettet", value: formatTs(meta.createdAtMs) });
  }
  if (meta?.updatedAtMs) {
    controlRows.push({
      label: "Sist oppdatert",
      value: formatTs(meta.updatedAtMs),
    });
  }
  if (data.linkedPvvTitles.length > 0) {
    let pvvText = data.linkedPvvTitles.join("; ");
    if (pvvText.length > 280) {
      pvvText = `${pvvText.slice(0, 277)}…`;
    }
    controlRows.push({ label: "Koblede PVV-vurderinger", value: pvvText });
  }

  const toc = [
    "Dokumentkontroll",
    "Formål og anvendelse",
    "Oppsummering og analyse-notat",
    "Risikomatrise før tiltak",
    "Risikomatrise etter tiltak",
    "PVV-koblinger, rammer og krav",
    "Oppgaver, risikoer og punktliste",
    "Kortlager, logg og merknad",
  ] as const;

  L.drawFrontPage({
    docTypeLabel: "ROS-analyse",
    eyebrow: "Risiko- og sårbarhetsanalyse",
    title: data.title.trim() || "ROS-analyse",
    subtitle: "Intern styring, dokumentasjon og etterprøving.",
    lead: "Risiko før og etter tiltak.",
    generatedLabel: formatPdfTimestamp(data.generatedAt),
    documentRef: docRefLabel,
  });
  y = L.getY();

  L.drawTocPage([...toc]);
  y = L.getY();

  L.drawDocumentControlPage({
    organizationLine: data.workspaceName?.trim() || undefined,
    metaRows: controlRows,
  });
  y = L.getY();

  L.markToc(toc[1]);
  addHeading("Formål og anvendelse", 12);
  addPara(
    "Rapporten dokumenterer risikovurderingen slik den foreligger i PVV på eksporttidspunktet. Den kan deles med ledelse, revisjon, DPO eller leverandører etter interne retningslinjer for informasjonsklassifisering. Matriser vises i breddeformat; sidetall og tittel gjentas i bunntekst.",
    9.5,
  );

  L.markToc(toc[2]);
  if (data.summaryLines && data.summaryLines.length > 0) {
    y += 4;
    addHeading("Oppsummering (før/etter tiltak)", 12);
    addPara(
      "Automatisk utdrag fra matrisene (samme innhold som i appens oppsummering). Egnet som innledning for ledelse eller revisjon.",
      8.5,
    );
    const sPad = 5;
    const sFs = 9.5;
    const sLh = bodyLineHeightMm(sFs);
    let sInner = sPad * 2 + 5;
    doc.setFontSize(sFs);
    for (const line of data.summaryLines) {
      const wrapped = splitPdfText(doc, 
        `• ${line}`,
        contentW() - sPad * 2 - 4,
      );
      sInner += wrapped.length * sLh + 1;
    }
    sInner += 4;
    ensureSpace(sInner + 6);
    const sTop = y;
    doc.setFillColor(
      PDF_THEME.calloutBg[0],
      PDF_THEME.calloutBg[1],
      PDF_THEME.calloutBg[2],
    );
    doc.setDrawColor(
      PDF_THEME.calloutBorder[0],
      PDF_THEME.calloutBorder[1],
      PDF_THEME.calloutBorder[2],
    );
    doc.setLineWidth(0.25);
    doc.rect(margin, sTop, contentW(), sInner, "FD");
    let sY = sTop + sPad + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(
      PDF_THEME.slate700[0],
      PDF_THEME.slate700[1],
      PDF_THEME.slate700[2],
    );
    doc.text("HOVEDPOINTER", margin + sPad, sY);
    sY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(sFs);
    doc.setTextColor(
      PDF_THEME.slate800[0],
      PDF_THEME.slate800[1],
      PDF_THEME.slate800[2],
    );
    for (const line of data.summaryLines) {
      const wrapped = splitPdfText(
        doc,
        `• ${line}`,
        contentW() - sPad * 2 - 4,
      );
      sY = drawPdfTextLines(doc, wrapped, margin + sPad, sY, sLh) + 1;
    }
    y = sTop + sInner + 6;
    doc.setTextColor(0);
  }

  y += 2;
  addHeading("Notat (analyse)", 12);
  L.setY(y);
  L.addFieldCard("Analyse-notat", data.analysisNotes?.trim() ?? "", {
    showEmpty: true,
  });
  y = L.getY();

  /** Maks tekstlinjer for risiko-punkter per celle («…» ved avkorting). */
  const ROS_PDF_MATRIX_CELL_RISK_MAX_LINES = 10;

  const resolveMatrixCellDetail = (
    details: RosPdfMatrixCellDetail[][] | undefined,
    notes: string[][],
    row: number,
    col: number,
  ): RosPdfMatrixCellDetail => {
    const structured = details?.[row]?.[col];
    if (structured) return structured;
    return parseLegacyNoteToMatrixCellDetail(notes[row]?.[col] ?? "");
  };

  /** To matriser i landskap: før tiltak og etter tiltak (rest) — plassert tidlig for full ROS-oversikt */
  const matrixPhasesEarly: Array<{
    heading: string;
    sub: string;
    mv: number[][];
    cn: string[][];
    details?: RosPdfMatrixCellDetail[][];
    rowLabels: string[];
    colLabels: string[];
    rowAxisTitle: string;
    colAxisTitle: string;
  }> = [
    {
      heading: "Risikomatrise — før tiltak (utgangspunkt)",
      sub: `${data.rowAxisTitle} (rader) × ${data.colAxisTitle} (kolonner). Farge og tall = risikonivå. Under vises risiko-beskrivelse og merker for tiltak / følg med.`,
      mv: data.matrixValues,
      cn: data.cellNotes,
      details: data.matrixCellDetails,
      rowLabels: data.rowLabels,
      colLabels: data.colLabels,
      rowAxisTitle: data.rowAxisTitle,
      colAxisTitle: data.colAxisTitle,
    },
    {
      heading: "Risikomatrise — etter tiltak (rest)",
      sub: data.afterSeparateLayout
        ? `${data.afterRowAxisTitle} (rader) × ${data.afterColAxisTitle} (kolonner). Restrisiko etter tiltak — samme lesemønster: nivå, risiko, tiltak/følg.`
        : `${data.rowAxisTitle} (rader) × ${data.colAxisTitle} (kolonner). Restrisiko etter tiltak — nivå, risiko-tekst og tiltak/følg i hver celle.`,
      mv: data.matrixValuesAfter,
      cn: data.cellNotesAfter,
      details: data.matrixCellDetailsAfter,
      rowLabels: data.afterRowLabels,
      colLabels: data.afterColLabels,
      rowAxisTitle: data.afterRowAxisTitle,
      colAxisTitle: data.afterColAxisTitle,
    },
  ];

  const LAND_HDR_H = 12.5;

  for (let pi = 0; pi < matrixPhasesEarly.length; pi++) {
    const phase = matrixPhasesEarly[pi]!;
    const phaseRibbon =
      pi === 0 ? "Matrise — før tiltak" : "Matrise — etter tiltak";
    doc.addPage("a4", "landscape");
    L.markToc(pi === 0 ? toc[3] : toc[4]);
    const lw = pageW();
    const lh = pageH();

    const drawLandscapeChrome = (isContinuation: boolean) => {
      doc.setFillColor(
        PDF_THEME.surface[0],
        PDF_THEME.surface[1],
        PDF_THEME.surface[2],
      );
      doc.setDrawColor(
        PDF_THEME.slate200[0],
        PDF_THEME.slate200[1],
        PDF_THEME.slate200[2],
      );
      doc.rect(0, 0, lw, LAND_HDR_H, "FD");
      doc.setLineWidth(0.25);
      doc.line(0, LAND_HDR_H, lw, LAND_HDR_H);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(
        PDF_THEME.slate700[0],
        PDF_THEME.slate700[1],
        PDF_THEME.slate700[2],
      );
      doc.text("PVV · ROS-analyse", margin, 5.2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(
        PDF_THEME.slate500[0],
        PDF_THEME.slate500[1],
        PDF_THEME.slate500[2],
      );
      doc.text(shortTitle.slice(0, 78), margin, 9);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(
        PDF_THEME.slate900[0],
        PDF_THEME.slate900[1],
        PDF_THEME.slate900[2],
      );
      doc.text(phaseRibbon, lw - margin, 5.5, { align: "right" });
      if (isContinuation) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(
          PDF_THEME.slate500[0],
          PDF_THEME.slate500[1],
          PDF_THEME.slate500[2],
        );
        doc.text("Fortsettelse", lw - margin, 9.2, { align: "right" });
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
    };

    drawLandscapeChrome(false);
    let my = LAND_HDR_H + 4;
    const rows = phase.rowLabels.length;
    const cols = phase.colLabels.length;
    const labelColW = Math.min(46, Math.max(34, lw * 0.14));
    const tableW = lw - margin * 2 - labelColW;
    const colW = cols > 0 ? tableW / cols : 10;
    const x0 = margin + labelColW;

    const HEADER_BG: [number, number, number] = [252, 252, 253];
    const HEADER_STROKE: [number, number, number] = [203, 213, 225];
    const LABEL_COL_BG: [number, number, number] = [249, 250, 251];

    const drawCellRect = (
      x: number,
      yy: number,
      w: number,
      h: number,
      fill: [number, number, number],
      stroke: [number, number, number],
    ) => {
      doc.setLineWidth(0.12);
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
      doc.rect(x, yy, w, h, "FD");
    };

    const measureCellContentHeight = (
      detail: RosPdfMatrixCellDetail,
      cellW: number,
    ) => {
      const maxW = cellW - 3.2;
      let h = 7.2; // nivå + etikett
      if (detail.points.length === 0) return h + 3.5;
      h += 2.8; // «Risiko»-label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      let linesUsed = 0;
      let truncated = false;
      for (const pt of detail.points) {
        const parts = splitPdfText(doc, `• ${pt.text}`, maxW);
        for (const _p of parts) {
          if (linesUsed >= ROS_PDF_MATRIX_CELL_RISK_MAX_LINES) {
            truncated = true;
            break;
          }
          h += 2.55;
          linesUsed += 1;
        }
        if (truncated) break;
        if (pt.hasTiltak || pt.hasFolg) {
          if (linesUsed >= ROS_PDF_MATRIX_CELL_RISK_MAX_LINES) {
            truncated = true;
            break;
          }
          h += 2.35;
          linesUsed += 1;
        }
      }
      if (truncated) h += 2.4;
      return h + 2.2;
    };

    const drawMatrixCellContent = (
      detail: RosPdfMatrixCellDetail,
      level: number,
      cellX: number,
      cellTop: number,
      cellW: number,
      cellH: number,
      style: ReturnType<typeof pdfRiskLevelStyle>,
    ) => {
      const padX = 1.6;
      const maxW = cellW - padX * 2;
      let yy = cellTop + 3.4;
      doc.setTextColor(style.text[0], style.text[1], style.text[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(String(level), cellX + padX, yy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.4);
      doc.text(levelLabel(level), cellX + padX + 5.8, yy);
      yy += 3.6;

      if (detail.points.length === 0) {
        doc.setFontSize(6);
        doc.setTextColor(
          Math.min(120, style.text[0] + 30),
          Math.min(120, style.text[1] + 30),
          Math.min(140, style.text[2] + 30),
        );
        doc.text("Ingen risiko registrert", cellX + padX, yy);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        return;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.4);
      doc.setTextColor(style.text[0], style.text[1], style.text[2]);
      doc.text("RISIKO", cellX + padX, yy);
      yy += 2.7;

      let linesUsed = 0;
      let stop = false;
      for (const pt of detail.points) {
        if (stop || yy > cellTop + cellH - 2.5) break;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.8);
        doc.setTextColor(style.text[0], style.text[1], style.text[2]);
        const parts = splitPdfText(doc, `• ${pt.text}`, maxW);
        for (const part of parts) {
          if (
            linesUsed >= ROS_PDF_MATRIX_CELL_RISK_MAX_LINES ||
            yy > cellTop + cellH - 2.5
          ) {
            doc.text("…", cellX + padX, yy);
            stop = true;
            break;
          }
          doc.text(part, cellX + padX, yy);
          yy += 2.55;
          linesUsed += 1;
        }
        if (stop) break;
        if (pt.hasTiltak || pt.hasFolg) {
          if (
            linesUsed >= ROS_PDF_MATRIX_CELL_RISK_MAX_LINES ||
            yy > cellTop + cellH - 2.5
          ) {
            doc.text("…", cellX + padX, yy);
            break;
          }
          const tags = [
            pt.hasTiltak ? "Tiltak" : null,
            pt.hasFolg ? "Følg med" : null,
          ]
            .filter((t): t is string => Boolean(t))
            .join(" · ");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.2);
          doc.text(tags, cellX + padX + 1.2, yy);
          yy += 2.35;
          linesUsed += 1;
        }
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
    };

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(
      PDF_THEME.slate700[0],
      PDF_THEME.slate700[1],
      PDF_THEME.slate700[2],
    );
    const subLines = splitPdfText(doc, phase.sub, lw - margin * 2);
    doc.text(subLines, margin, my);
    my += subLines.length * 3.6 + 4;
    doc.setTextColor(0);

    const legendBoxY = my;
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Nivå (0–5):", margin, legendBoxY + 2.4);
    let legX = margin + 22;
    for (let lev = 0; lev <= 5; lev++) {
      const s = pdfRiskLevelStyle(lev);
      drawCellRect(legX, legendBoxY, 6, 4.2, s.fill, s.stroke);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(s.text[0], s.text[1], s.text[2]);
      doc.text(String(lev), legX + 3, legendBoxY + 3.1, { align: "center" });
      legX += 7.5;
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(6.8);
    const legRest = [
      ...legend.map((x) => `${x.level}=${x.label}`),
      "Tiltak = må håndteres",
      "Følg med = overvåk",
    ].join("  ·  ");
    const legLines = splitPdfText(doc, legRest, lw - margin * 2);
    doc.text(legLines, margin, legendBoxY + 7.5);
    doc.setTextColor(0);
    my = legendBoxY + 7.5 + legLines.length * 3.3 + 2.5;

    doc.setFontSize(7.2);
    doc.setFont("helvetica", "bold");
    let headerLabelMaxLines = 1;
    const colHeaderLines: string[][] = [];
    for (let j = 0; j < cols; j++) {
      doc.setFontSize(7.2);
      const lines = splitPdfText(doc, phase.colLabels[j] ?? "", colW - 2.5);
      colHeaderLines.push(lines);
      headerLabelMaxLines = Math.max(headerLabelMaxLines, lines.length);
    }
    doc.setFontSize(6.4);
    const cornerLines = [
      "v Rader",
      ...splitPdfText(doc, phase.rowAxisTitle, labelColW - 3),
      "> Kolonner",
      ...splitPdfText(doc, phase.colAxisTitle, labelColW - 3),
    ];
    headerLabelMaxLines = Math.max(headerLabelMaxLines, cornerLines.length);
    const headerRowH = Math.max(16, headerLabelMaxLines * 3.1 + 5);

    const footerReserve = 22;
    let continuation = false;

    const drawMatrixHeaderRow = (atY: number) => {
      drawCellRect(margin, atY, labelColW, headerRowH, HEADER_BG, HEADER_STROKE);
      doc.setFontSize(6.2);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      let hy = atY + 3.2;
      for (const line of cornerLines) {
        const isHint = line.startsWith("v ") || line.startsWith("> ");
        doc.setFont("helvetica", isHint ? "bold" : "normal");
        doc.setFontSize(isHint ? 5.8 : 6.4);
        doc.setTextColor(isHint ? 100 : 51, isHint ? 116 : 65, isHint ? 139 : 85);
        doc.text(sanitizePdfText(line), margin + 1.8, hy);
        hy += 3.05;
      }
      doc.setFont("helvetica", "normal");
      for (let j = 0; j < cols; j++) {
        drawCellRect(
          x0 + j * colW,
          atY,
          colW,
          headerRowH,
          HEADER_BG,
          HEADER_STROKE,
        );
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(51, 65, 85);
        const lines = colHeaderLines[j] ?? [];
        const blockH = lines.length * 3.1;
        let cy = atY + (headerRowH - blockH) / 2 + 2.3;
        for (const line of lines) {
          doc.text(line, x0 + j * colW + 1.4, cy);
          cy += 3.1;
        }
      }
      doc.setTextColor(0);
    };

    const measureDataRowHeight = (i: number) => {
      doc.setFontSize(7);
      const rl = splitPdfText(doc, 
        phase.rowLabels[i] ?? "",
        labelColW - 3,
      );
      const rowLabelH = Math.max(rl.length * 3.4, 9);
      let maxInner = 12;
      for (let j = 0; j < cols; j++) {
        const detail = resolveMatrixCellDetail(
          phase.details,
          phase.cn,
          i,
          j,
        );
        maxInner = Math.max(maxInner, measureCellContentHeight(detail, colW));
      }
      return Math.max(rowLabelH + 2, maxInner);
    };

    drawMatrixHeaderRow(my);
    my += headerRowH;

    for (let i = 0; i < rows; i++) {
      const rowH = measureDataRowHeight(i);
      if (my + rowH > lh - margin - footerReserve) {
        doc.addPage("a4", "landscape");
        drawLandscapeChrome(true);
        my = LAND_HDR_H + 4;
        continuation = true;
        drawMatrixHeaderRow(my);
        my += headerRowH;
      }

      drawCellRect(margin, my, labelColW, rowH, LABEL_COL_BG, HEADER_STROKE);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      const rl = splitPdfText(doc, phase.rowLabels[i] ?? "", labelColW - 3);
      const rlBlock = rl.length * 3.4;
      let rly = my + (rowH - rlBlock) / 2 + 2.6;
      for (const line of rl) {
        doc.text(line, margin + 1.5, rly);
        rly += 3.4;
      }
      doc.setFont("helvetica", "normal");

      for (let j = 0; j < cols; j++) {
        const v = phase.mv[i]?.[j] ?? 0;
        const detail = resolveMatrixCellDetail(
          phase.details,
          phase.cn,
          i,
          j,
        );
        const style = pdfRiskLevelStyle(v);
        drawCellRect(x0 + j * colW, my, colW, rowH, style.fill, style.stroke);
        drawMatrixCellContent(
          detail,
          v,
          x0 + j * colW,
          my,
          colW,
          rowH,
          style,
        );
      }
      my += rowH;
    }

    if (continuation) {
      my += 2;
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const contLines = splitPdfText(doc, 
        "Tabellen fortsetter på neste side. Kolonneoverskriftene er gjentatt øverst slik at du slipper å bla tilbake.",
        lw - margin * 2,
      );
      doc.text(contLines, margin, my);
      my += contLines.length * 3.8 + 4;
      doc.setTextColor(0);
    }
  }

  doc.addPage("a4", "portrait");
  y = margin;

  if (data.pvvLinksDetailed && data.pvvLinksDetailed.length > 0) {
    y += 4;
    L.markToc(toc[5]);
    addHeading("PVV-koblinger (detaljer)", 12);
    addPara(
      "Hver kobling er en egen blokk med tydelige felt (PDD-status, notater, krav). Tomme felt er utelatt.",
      9,
    );
    let pvvi = 0;
    for (const p of data.pvvLinksDetailed) {
      pvvi += 1;
      if (pvvi > 1) addSoftDivider();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      ensureSpace(8);
      doc.text(p.title, margin, y);
      y += 5.5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      addRow("PDD-status (PVV)", p.pddLabel);
      if (p.pddUrl?.trim()) {
        addRow("PDD-lenke", p.pddUrl.trim());
      }
      if (p.highlightForPvv) {
        addRow("Merkes for PVV", "Ja");
      }
      if (p.flagsText?.trim()) {
        addRow("Flagg", p.flagsText.trim());
      }
      if (p.requirementRefLines && p.requirementRefLines.length > 0) {
        addRow(
          "Krav på kobling",
          p.requirementRefLines.join("\n\n"),
        );
      }
      if (p.linkNote?.trim()) {
        addRow("Notat (kobling)", p.linkNote.trim());
      }
      if (p.pvvLinkNote?.trim()) {
        addRow("PVV-notat", p.pvvLinkNote.trim());
      }
      y += 2;
    }
  }

  const scopeLabels =
    data.complianceScopeTagIds?.length && data.complianceScopeTagIds.length > 0
      ? data.complianceScopeTagIds
          .map(
            (id) =>
              ROS_COMPLIANCE_SCOPE_TAGS.find((t) => t.id === id)?.label ?? id,
          )
          .join("; ")
      : "";

  const hasLifecycle =
    (data.methodologyStatement?.trim() ?? "") !== "" ||
    (data.contextSummary?.trim() ?? "") !== "" ||
    (data.scopeAndCriteria?.trim() ?? "") !== "" ||
    (data.riskCriteriaVersion?.trim() ?? "") !== "" ||
    (data.axisScaleNotes?.trim() ?? "") !== "" ||
    scopeLabels !== "" ||
    (data.requirementRefLines?.length ?? 0) > 0;

  if (hasLifecycle) {
    y += 4;
    L.markToc(toc[5]);
    addHeading("Livssyklus, rammer og krav (tilsynspakke)", 12);
    if (data.methodologyStatement?.trim()) {
      addRow("Metodikk", data.methodologyStatement.trim());
    }
    if (data.contextSummary?.trim()) {
      addRow("Kontekst", data.contextSummary.trim());
    }
    if (data.scopeAndCriteria?.trim()) {
      addRow("Omfang og kriterier", data.scopeAndCriteria.trim());
    }
    if (data.riskCriteriaVersion?.trim()) {
      addRow("Versjon av kriterier/skala", data.riskCriteriaVersion.trim());
    }
    if (data.axisScaleNotes?.trim()) {
      y += 2;
      addHeading("Definisjon av nivåer (0–5)", 11, { bar: false });
      addPara(data.axisScaleNotes.trim());
    }
    if (scopeLabels) {
      addRow("Valgte rammer", scopeLabels);
    }
    if (data.requirementRefLines && data.requirementRefLines.length > 0) {
      y += 2;
      addHeading("Krav- og kildehenvisninger", 11, { bar: false });
      for (const line of data.requirementRefLines) {
        addPara(`• ${line}`, 9);
      }
    }
  }

  const reviewSched = data.reviewSchedule;
  if (
    reviewSched &&
    ((reviewSched.nextReview?.trim() ?? "") !== "" ||
      (reviewSched.routine?.trim() ?? "") !== "")
  ) {
    y += 4;
    addHeading("Revisjon og rutine", 12);
    if (reviewSched.nextReview?.trim()) {
      addRow("Neste revisjon", reviewSched.nextReview.trim());
    }
    if (reviewSched.routine?.trim()) {
      addRow("Rutine", reviewSched.routine.trim());
    }
  }

  const taskLinesResolved: RosPdfTaskLine[] =
    data.taskLinesAll ??
    (data.openTaskLines?.map((line) => ({
      line,
      statusLabel: "Åpen",
    })) ??
      []);

  y += 4;
  L.markToc(toc[6]);
  addHeading("Oppfølgingsoppgaver (tiltak)", 12);
  if (taskLinesResolved.length === 0) {
    addPara(
      "Ingen oppgaver er registrert for denne analysen under fanen Oppgaver. Oppgaver dokumenterer planlagte eller pågående tiltak og kan kobles til risiko i matrisen.",
      9,
    );
  } else {
    addPara(
      data.taskLinesAll
        ? "Listen under viser alle oppgaver fra fanen Oppgaver. Status står i hakeparentes. Beskrivelse, ansvarlig, koblet risiko og type tiltak følger bare når det er registrert."
        : "Listen viser åpne oppgaver.",
      9,
    );
    let ti = 0;
    for (const t of taskLinesResolved) {
      ti += 1;
      if (ti > 1) addSoftDivider();
      ensureSpace(22);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(
        PDF_THEME.slate900[0],
        PDF_THEME.slate900[1],
        PDF_THEME.slate900[2],
      );
      doc.text(`Oppgave ${ti} av ${taskLinesResolved.length}`, margin, y);
      y += 5.5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      addRow("Status og tittel", `[${t.statusLabel}] ${t.line}`);
      if (t.description?.trim()) {
        addRow("Beskrivelse", t.description.trim());
      }
      if (t.assigneeName?.trim()) {
        addRow("Ansvarlig", t.assigneeName.trim());
      }
      if (t.linkedRiskSummary?.trim()) {
        addRow("Koblet risiko", t.linkedRiskSummary.trim());
      }
      if (t.riskTreatmentLabel?.trim()) {
        addRow("Type tiltak (behandling)", t.riskTreatmentLabel.trim());
      }
      y += 1;
    }
  }

  if (data.versionSnapshots && data.versionSnapshots.length > 0) {
    y += 4;
    addHeading("Lagrede versjoner (øyeblikksbilder)", 12);
    addPara(
      "Historikk fra fanen Versjoner — hvert lagret øyeblikksbilde med notat.",
      8,
    );
    const sorted = [...data.versionSnapshots].sort((a, b) => b.version - a.version);
    for (const v of sorted) {
      const head = `v${v.version} · ${formatTs(v.createdAt)}`;
      const note = v.note?.trim();
      addPara(note ? `${head}\n${note}` : head, 9);
      y += 1;
    }
  }

  if (data.identifiedRisks && data.identifiedRisks.length > 0) {
    y += 4;
    addHeading("Identifiserte risikoer (beskrivelse og plassering)", 12);
    addPara(
      "Hver rad under er én risiko. Feltet «Risiko» er beskrivelsen; «Tiltak / følg» viser om punktet må håndteres eller overvåkes. Plassering før/etter matcher matrisene.",
      9,
    );
    const totalR = data.identifiedRisks.length;
    let ri = 0;
    for (const r of data.identifiedRisks) {
      ri += 1;
      if (ri > 1) addSoftDivider();
      ensureSpace(28);
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(
        PDF_THEME.slate900[0],
        PDF_THEME.slate900[1],
        PDF_THEME.slate900[2],
      );
      doc.text(`Risiko ${ri} av ${totalR}`, margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      addRow(
        "Risiko",
        r.text.trim()
          ? r.text.trim()
          : "(Ingen fritekst — se tiltak/følg og matrise.)",
      );
      const marks: string[] = [];
      if (r.hasTiltak) marks.push("Tiltak (må håndteres)");
      if (r.hasFølg) marks.push("Følg med");
      addRow(
        "Tiltak / følg",
        marks.length > 0 ? marks.join(" · ") : "Ingen merking",
      );
      addRow(
        "Før tiltak",
        `${r.beforeRowLabel} × ${r.beforeColLabel} — nivå ${r.beforeLevel} (${levelLabel(r.beforeLevel)})`,
      );
      addRow(
        "Etter tiltak",
        `${r.afterRowLabel} × ${r.afterColLabel} — nivå ${r.afterLevel} (${levelLabel(r.afterLevel)})`,
      );
      const note = r.afterChangeNote?.trim();
      if (note) {
        addRow("Begrunnelse for endring", note);
      }
      y += 2;
    }
  }

  if (data.cellRiskPointsComplete && data.cellRiskPointsComplete.length > 0) {
    y += 4;
    addHeading("Alle registrerte punkt i matrisen (komplett liste)", 12);
    addPara(
      "Full liste punkt for punkt. Matrisen gir oversikt; her ser du risiko-tekst og tiltak/følg for hvert enkelt punkt.",
      9,
    );
    const flagNb = (flags: string[]) => {
      const out: string[] = [];
      if (flags.includes("requires_action")) out.push("Tiltak (må håndteres)");
      if (flags.includes("watch")) out.push("Følg med");
      return out.length ? out.join(" · ") : "Ingen merking";
    };
    const totalP = data.cellRiskPointsComplete.length;
    let pi = 0;
    for (const p of data.cellRiskPointsComplete) {
      pi += 1;
      if (pi > 1) addSoftDivider();
      const phaseNb = p.phase === "before" ? "Før tiltak" : "Etter tiltak";
      const flagStr = flagNb(p.flags);
      ensureSpace(20);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(
        PDF_THEME.slate900[0],
        PDF_THEME.slate900[1],
        PDF_THEME.slate900[2],
      );
      doc.text(`Punkt ${pi} av ${totalP}`, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      addRow("Matrise", phaseNb);
      addRow(
        "Celle og nivå",
        `${p.rowLabel} × ${p.colLabel} — nivå ${p.level} (${levelLabel(p.level)})`,
      );
      addRow(
        "Risiko",
        p.text?.trim() ? p.text.trim() : "(Ingen fritekst)",
      );
      addRow("Tiltak / følg", flagStr);
      if (p.afterChangeNote?.trim()) {
        addRow("Notat om endring", p.afterChangeNote.trim());
      }
      y += 1;
    }
  }

  if (data.sectorPackLabel?.trim()) {
    y += 4;
    addHeading("Sektor ved opprettelse", 11, { bar: false });
    addPara(data.sectorPackLabel.trim(), 9);
  }

  const addPoolHeading = (heading: string, lines: string[] | undefined) => {
    if (!lines || lines.length === 0) return;
    y += 4;
    addHeading(heading, 12);
    addPara(
      "Risikokort i kortlager (kø, på vent, ikke relevant) som ikke er plassert i matrisen.",
      8,
    );
    for (const line of lines) {
      addPara(`• ${line}`, 9);
      y += 0.5;
    }
  };
  L.markToc(toc[7]);
  addPoolHeading("Kortlager — før tiltak", data.riskPoolBeforeLines);
  addPoolHeading("Kortlager — etter tiltak", data.riskPoolAfterLines);

  /** Risikologg: siste N hendelser, kronologisk (eldste først i utdraget). */
  const journalSorted = [...data.journalEntries].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const journal =
    journalSorted.length <= JOURNAL_PDF_MAX
      ? journalSorted
      : journalSorted.slice(-JOURNAL_PDF_MAX);
  if (journal.length > 0) {
    y += 4;
    L.markToc(toc[7]);
    addHeading("Risikologg (utdrag)", 12);
    addPara(
      "Eldste hendelser først i utdraget. Tidspunkt og forfatter vises øverst; innholdet under er selve loggteksten.",
      8.5,
    );
    let ji = 0;
    for (const e of journal) {
      ji += 1;
      if (ji > 1) addSoftDivider();
      const link =
        e.linkedRow !== undefined && e.linkedCol !== undefined
          ? `Rad ${e.linkedRow + 1}, kolonne ${e.linkedCol + 1}`
          : "";
      const phaseTag =
        e.matrixPhase === "after"
          ? "Etter tiltak"
          : e.matrixPhase === "before"
            ? "Før tiltak"
            : "";
      ensureSpace(14);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      const headBits = [
        formatTs(e.createdAt),
        e.authorName,
        phaseTag,
        link,
      ].filter(Boolean);
      doc.text(headBits.join(" · "), margin, y);
      y += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      const bodyLines = splitPdfText(doc, e.body, contentW());
      const blh = bodyLineHeightMm(8.5);
      ensureSpace(bodyLines.length * blh + 3);
      doc.setFontSize(8.5);
      doc.text(bodyLines, margin, y);
      y += bodyLines.length * blh + 4;
    }
    doc.setFontSize(10);
    if (data.journalEntries.length > JOURNAL_PDF_MAX) {
      addPara(
        `… og ${data.journalEntries.length - JOURNAL_PDF_MAX} eldre innlegg er ikke med i PDF-en. Se full logg i appen.`,
        8,
      );
    }
  }

  const legendExplain =
    "Forklaring av nivåer: 0 = ikke vurdert; 1-5 = lav -> kritisk. " +
    legend.map((x) => `${x.level} = ${x.label}`).join("; ") +
    ".";
  L.setY(y);
  L.addNoteBox("Nivåskala og merknad", [
    legendExplain,
    ROS_COMPLIANCE_PDF_DISCLAIMER_NB,
  ]);
  y = L.getY();

  L.finish({
    shortTitle,
    docTypeLabel: "ROS-analyse",
  });

  return doc;
}

export function buildRosAnalysisPdfBlob(data: RosPdfInput): Blob {
  return buildRosAnalysisPdfDocument(data).output("blob");
}

/** Laster ned A4-PDF med ROS-analyse (tekst + matrise + logg). */
export function downloadRosAnalysisPdf(data: RosPdfInput): void {
  const doc = buildRosAnalysisPdfDocument(data);
  const safe = data.title
    .replace(/[^\wæøåÆØÅ\- ]/gi, "")
    .trim()
    .slice(0, 40)
    .replace(/\s+/g, "-");
  doc.save(`ROS-${safe || "analyse"}.pdf`);
}
