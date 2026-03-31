import { jsPDF } from "jspdf";

import { legendItems, pdfRiskLevelStyle } from "@/lib/ros-risk-colors";

export type RosPdfJournalLine = {
  body: string;
  authorName: string;
  createdAt: number;
  linkedRow?: number;
  linkedCol?: number;
  /** Mangler = før tiltak (eldre logg) */
  matrixPhase?: "before" | "after";
};

export type RosPdfInput = {
  title: string;
  workspaceName: string | null;
  candidateName: string;
  candidateCode: string;
  rowAxisTitle: string;
  colAxisTitle: string;
  rowLabels: string[];
  colLabels: string[];
  /** Før tiltak */
  matrixValues: number[][];
  cellNotes: string[][];
  /** Etter tiltak (rest) */
  matrixValuesAfter: number[][];
  cellNotesAfter: string[][];
  /** Akser for etter-matrise (kopier fra før hvis ikke eget rutenett) */
  afterRowLabels: string[];
  afterColLabels: string[];
  afterRowAxisTitle: string;
  afterColAxisTitle: string;
  afterSeparateLayout: boolean;
  analysisNotes: string | null;
  linkedPvvTitles: string[];
  journalEntries: RosPdfJournalLine[];
  generatedAt: Date;
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

/** Laster ned A4-PDF med ROS-analyse (tekst + matrise + logg). */
export function downloadRosAnalysisPdf(data: RosPdfInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;

  const pageW = () => doc.internal.pageSize.getWidth();
  const pageH = () => doc.internal.pageSize.getHeight();

  const legend = legendItems();
  const levelLabel = (n: number) =>
    legend.find((x) => x.level === n)?.label ?? String(n);

  const ensureSpace = (needMm: number) => {
    if (y + needMm > pageH() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addHeading = (text: string, size = 14) => {
    ensureSpace(12);
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(text, margin, y);
    y += size * 0.55 + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  const addPara = (text: string, size = 10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, pageW() - margin * 2);
    ensureSpace(lines.length * size * 0.45 + 4);
    doc.text(lines, margin, y);
    y += lines.length * size * 0.45 + 3;
  };

  const addRow = (label: string, value: string) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    const vlines = doc.splitTextToSize(value, pageW() - margin * 2 - 48);
    ensureSpace(Math.max(vlines.length * 4.5, 7));
    doc.text(vlines, margin + 46, y);
    y += Math.max(vlines.length * 4.5, 6);
  };

  addHeading("ROS-analyse (risiko og sårbarhet)", 18);
  doc.setFontSize(9);
  doc.setTextColor(90);
  addPara(
    `Generert ${data.generatedAt.toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short" })}`,
    9,
  );
  doc.setTextColor(0);

  y += 2;
  addPara(data.title, 13);
  doc.setFontSize(10);
  if (data.workspaceName) {
    addRow("Arbeidsområde", data.workspaceName);
  }
  addRow("Kandidat (prosess)", `${data.candidateName} (${data.candidateCode})`);
  addRow("Akser", `${data.rowAxisTitle} × ${data.colAxisTitle}`);

  if (data.linkedPvvTitles.length > 0) {
    ensureSpace(8);
    addRow("Koblede PVV-vurderinger", data.linkedPvvTitles.join("; "));
  }

  if (data.analysisNotes?.trim()) {
    y += 4;
    addHeading("Notat (analyse)", 12);
    addPara(data.analysisNotes.trim());
  }

  /** Risikologg: siste 40 hendelser, kronologisk (eldste først i utdraget). */
  const journalSorted = [...data.journalEntries].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const journal =
    journalSorted.length <= 40
      ? journalSorted
      : journalSorted.slice(-40);
  if (journal.length > 0) {
    y += 4;
    addHeading("Risikologg (utdrag)", 12);
    for (const e of journal) {
      const link =
        e.linkedRow !== undefined && e.linkedCol !== undefined
          ? ` [Celle rad ${e.linkedRow + 1}, kol ${e.linkedCol + 1}]`
          : "";
      const phaseTag =
        e.matrixPhase === "after"
          ? "[Etter tiltak] "
          : e.matrixPhase === "before"
            ? "[Før tiltak] "
            : "";
      const line = `${phaseTag}${formatTs(e.createdAt)} · ${e.authorName}${link}\n${e.body}`;
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(line, pageW() - margin * 2);
      ensureSpace(lines.length * 3.6 + 4);
      doc.text(lines, margin, y);
      y += lines.length * 3.6 + 3;
    }
    doc.setFontSize(10);
    if (data.journalEntries.length > 40) {
      addPara(
        `… og ${data.journalEntries.length - 40} eldre innlegg er ikke med i PDF-en. Se full logg i appen.`,
        8,
      );
    }
  }

  /** To matriser i landskap: før tiltak og etter tiltak (rest) */
  const matrixPhases: Array<{
    heading: string;
    sub: string;
    mv: number[][];
    cn: string[][];
    rowLabels: string[];
    colLabels: string[];
    rowAxisTitle: string;
    colAxisTitle: string;
  }> = [
    {
      heading: "Risikomatrise — før tiltak (utgangspunkt)",
      sub: `${data.rowAxisTitle} (rader) × ${data.colAxisTitle} (kolonner). Utgangspunkt før planlagte eller gjennomførte tiltak. Cellefarge = nivå 0–5.`,
      mv: data.matrixValues,
      cn: data.cellNotes,
      rowLabels: data.rowLabels,
      colLabels: data.colLabels,
      rowAxisTitle: data.rowAxisTitle,
      colAxisTitle: data.colAxisTitle,
    },
    {
      heading: "Risikomatrise — etter tiltak (rest)",
      sub: data.afterSeparateLayout
        ? `${data.afterRowAxisTitle} (rader) × ${data.afterColAxisTitle} (kolonner). Eget rutenett for restrisiko. Cellefarge = nivå 0–5.`
        : `${data.rowAxisTitle} (rader) × ${data.colAxisTitle} (kolonner). Samme akser som før; restrisiko etter tiltak.`,
      mv: data.matrixValuesAfter,
      cn: data.cellNotesAfter,
      rowLabels: data.afterRowLabels,
      colLabels: data.afterColLabels,
      rowAxisTitle: data.afterRowAxisTitle,
      colAxisTitle: data.afterColAxisTitle,
    },
  ];

  for (let pi = 0; pi < matrixPhases.length; pi++) {
    const phase = matrixPhases[pi]!;
    doc.addPage("a4", "landscape");
    y = margin;
    const lw = pageW();
    const lh = pageH();
    const rows = phase.rowLabels.length;
    const cols = phase.colLabels.length;
    const labelColW = Math.min(46, Math.max(34, lw * 0.14));
    const tableW = lw - margin * 2 - labelColW;
    const colW = cols > 0 ? tableW / cols : 10;
    const x0 = margin + labelColW;

    const HEADER_BG: [number, number, number] = [248, 250, 252];
    const HEADER_STROKE: [number, number, number] = [100, 116, 139];
    const LABEL_COL_BG: [number, number, number] = [249, 250, 251];

    const drawCellRect = (
      x: number,
      yy: number,
      w: number,
      h: number,
      fill: [number, number, number],
      stroke: [number, number, number],
    ) => {
      doc.setLineWidth(0.18);
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
      doc.rect(x, yy, w, h, "FD");
    };

    const drawCenteredInCell = (
      lines: { text: string; size: number; bold: boolean }[],
      cx: number,
      top: number,
      cellH: number,
      maxW: number,
    ) => {
      const flat: { text: string; size: number; bold: boolean }[] = [];
      for (const ln of lines) {
        doc.setFontSize(ln.size);
        doc.setFont("helvetica", ln.bold ? "bold" : "normal");
        const parts = doc.splitTextToSize(ln.text, maxW);
        for (const p of parts) {
          flat.push({ text: p, size: ln.size, bold: ln.bold });
        }
      }
      if (flat.length === 0) return;
      let totalH = 0;
      for (const f of flat) {
        totalH += f.size * 0.42 + 0.5;
      }
      let yy = top + (cellH - totalH) / 2 + flat[0]!.size * 0.35;
      for (const f of flat) {
        doc.setFontSize(f.size);
        doc.setFont("helvetica", f.bold ? "bold" : "normal");
        doc.text(f.text, cx, yy, { align: "center", maxWidth: maxW });
        yy += f.size * 0.42 + 0.5;
      }
      doc.setFont("helvetica", "normal");
    };

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(phase.heading, margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(phase.sub, margin, y);
    y += 5;
    doc.setTextColor(0);

    const legendBoxY = y;
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Nivå:", margin, legendBoxY + 2.2);
    let legX = margin + 12;
    for (let lev = 0; lev <= 5; lev++) {
      const s = pdfRiskLevelStyle(lev);
      drawCellRect(legX, legendBoxY, 5.5, 4, s.fill, s.stroke);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(s.text[0], s.text[1], s.text[2]);
      doc.text(String(lev), legX + 2.75, legendBoxY + 2.9, { align: "center" });
      legX += 7;
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(6);
    const legRest = legend.map((x) => `${x.level}=${x.label}`).join(" · ");
    const legLines = doc.splitTextToSize(legRest, lw - margin * 2);
    doc.text(legLines, margin, legendBoxY + 6.8);
    doc.setTextColor(0);
    y = legendBoxY + 6.8 + legLines.length * 3 + 3;

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    let headerLabelMaxLines = 1;
    const colHeaderLines: string[][] = [];
    for (let j = 0; j < cols; j++) {
      const lines = doc.splitTextToSize(phase.colLabels[j] ?? "", colW - 2);
      colHeaderLines.push(lines);
      headerLabelMaxLines = Math.max(headerLabelMaxLines, lines.length);
    }
    const cornerLines = [
      ...doc.splitTextToSize(phase.rowAxisTitle, labelColW - 3),
      ...doc.splitTextToSize(phase.colAxisTitle, labelColW - 3),
    ];
    headerLabelMaxLines = Math.max(headerLabelMaxLines, cornerLines.length);
    const headerRowH = Math.max(14, headerLabelMaxLines * 3.2 + 5);

    const footerReserve = 22;
    let continuation = false;

    const drawMatrixHeaderRow = (atY: number) => {
      drawCellRect(margin, atY, labelColW, headerRowH, HEADER_BG, HEADER_STROKE);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      let hy = atY + 3.5;
      for (const line of cornerLines) {
        doc.text(line, margin + labelColW / 2, hy, {
          align: "center",
          maxWidth: labelColW - 3,
        });
        hy += 3;
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
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(51, 65, 85);
        const lines = colHeaderLines[j] ?? [];
        const blockH = lines.length * 3;
        let cy = atY + (headerRowH - blockH) / 2 + 2.2;
        for (const line of lines) {
          doc.text(line, x0 + j * colW + colW / 2, cy, {
            align: "center",
            maxWidth: colW - 2,
          });
          cy += 3;
        }
      }
      doc.setTextColor(0);
    };

    const measureDataRowHeight = (i: number) => {
      doc.setFontSize(6.5);
      const rl = doc.splitTextToSize(
        phase.rowLabels[i] ?? "",
        labelColW - 3,
      );
      const rowLabelH = Math.max(rl.length * 3.2, 8);
      let maxInner = 10;
      for (let j = 0; j < cols; j++) {
        const note = (phase.cn[i]?.[j] ?? "").trim();
        const noteLines = note
          ? doc.splitTextToSize(note.slice(0, 140), colW - 2.4).slice(0, 4)
          : [];
        const inner =
          5 +
          3.5 +
          noteLines.length * 2.6 +
          (noteLines.length > 0 ? 1 : 0);
        maxInner = Math.max(maxInner, inner);
      }
      return Math.max(rowLabelH + 2, maxInner + 3);
    };

    drawMatrixHeaderRow(y);
    y += headerRowH;

    for (let i = 0; i < rows; i++) {
      const rowH = measureDataRowHeight(i);
      if (y + rowH > lh - margin - footerReserve) {
        doc.addPage("a4", "landscape");
        y = margin;
        continuation = true;
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 116, 139);
        doc.text("Matrise (fortsettelse)", margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        drawMatrixHeaderRow(y);
        y += headerRowH;
      }

      drawCellRect(margin, y, labelColW, rowH, LABEL_COL_BG, HEADER_STROKE);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      const rl = doc.splitTextToSize(phase.rowLabels[i] ?? "", labelColW - 3);
      const rlBlock = rl.length * 3.2;
      let rly = y + (rowH - rlBlock) / 2 + 2.5;
      for (const line of rl) {
        doc.text(line, margin + 1.5, rly, { maxWidth: labelColW - 3 });
        rly += 3.2;
      }
      doc.setFont("helvetica", "normal");

      for (let j = 0; j < cols; j++) {
        const v = phase.mv[i]?.[j] ?? 0;
        const note = (phase.cn[i]?.[j] ?? "").trim();
        const style = pdfRiskLevelStyle(v);
        const cx = x0 + j * colW + colW / 2;
        drawCellRect(x0 + j * colW, y, colW, rowH, style.fill, style.stroke);
        doc.setTextColor(style.text[0], style.text[1], style.text[2]);
        const lines: { text: string; size: number; bold: boolean }[] = [
          { text: String(v), size: 11, bold: true },
          { text: levelLabel(v), size: 6.2, bold: false },
        ];
        if (note) {
          const noteLines = doc
            .splitTextToSize(note.slice(0, 160), colW - 2.4)
            .slice(0, 4);
          for (const nl of noteLines) {
            lines.push({ text: nl, size: 5.2, bold: false });
          }
        }
        drawCenteredInCell(lines, cx, y, rowH, colW - 2.4);
        doc.setTextColor(0);
      }
      y += rowH;
    }

    if (continuation) {
      y += 2;
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      const contLines = doc.splitTextToSize(
        "Matrisen er delt over flere sider; kolonneoverskrifter er gjentatt øverst på hver ny side.",
        lw - margin * 2,
      );
      doc.text(contLines, margin, y);
      y += contLines.length * 3.5 + 4;
      doc.setTextColor(0);
    }
  }

  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(100);
  addPara(
    "Nivå: 0 = ikke vurdert; 1–5 = lav → kritisk. " +
      legend.map((x) => `${x.level}=${x.label}`).join("; ") +
      ".",
    7,
  );

  const safe = data.title
    .replace(/[^\wæøåÆØÅ\- ]/gi, "")
    .trim()
    .slice(0, 40)
    .replace(/\s+/g, "-");
  doc.save(`ROS-${safe || "analyse"}.pdf`);
}
