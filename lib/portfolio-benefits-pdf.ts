import { jsPDF } from "jspdf";
import {
  applyCorporatePdfFooters,
  PDF_CORPORATE_THEME as T,
} from "@/lib/pdf-corporate";
import { REALIZATION_LABELS } from "@/lib/portfolio-benefit-copy";
import { PIPELINE_STATUS_LABELS, type PipelineStatus } from "@/lib/assessment-pipeline";

function moneyNb(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0 kr";
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(".", ",")} MNOK`;
  }
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

function hoursNb(n: number): string {
  return `${Math.round(n).toLocaleString("nb-NO")} t/år`;
}

export type PortfolioBenefitsPdfInput = {
  workspaceName: string;
  totals: {
    hoursSavedPerYear: number;
    currencySavedPerYear: number;
    fteFreed: number;
    netBenefitAnnual: number;
    buildCost: number;
    annualRunCost: number;
  };
  potential: { currencySavedPerYear: number; hoursSavedPerYear: number; fteFreed: number };
  inDelivery: { currencySavedPerYear: number; hoursSavedPerYear: number; fteFreed: number };
  realized: { currencySavedPerYear: number; hoursSavedPerYear: number; fteFreed: number };
  byPipeline: Array<{
    status: string;
    count: number;
    currencySavedPerYear: number;
    hoursSavedPerYear: number;
  }>;
  softGains: Array<{ label: string; count: number; soft: boolean }>;
  candidates: Array<{
    title: string;
    pipelineStatus: string;
    hoursSavedPerYear: number;
    currencySavedPerYear: number;
    fteFreed: number;
  }>;
};

/** Kompakt ledelses-PDF for gevinster — eksporter når du trenger hele bildet. */
export function downloadPortfolioBenefitsPdf(input: PortfolioBenefitsPdfInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 16;
  const pw = doc.internal.pageSize.getWidth();
  let y = 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
  doc.text("Gevinster og besparelser", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
  doc.text(`${input.workspaceName} · ${new Date().toLocaleDateString("nb-NO")}`, margin, y);
  y += 10;

  const kpis = [
    ["Timer / år", hoursNb(input.totals.hoursSavedPerYear)],
    ["Besparelse / år", moneyNb(input.totals.currencySavedPerYear)],
    ["FTE frigjort", input.totals.fteFreed.toLocaleString("nb-NO", { maximumFractionDigits: 2 })],
    ["Netto / år", moneyNb(input.totals.netBenefitAnnual)],
  ] as const;

  const colW = (pw - margin * 2) / 2;
  kpis.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * colW;
    const yy = y + row * 18;
    doc.setFillColor(T.surface[0], T.surface[1], T.surface[2]);
    doc.roundedRect(x, yy, colW - 4, 15, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
    doc.text(label, x + 3, yy + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    doc.text(value, x + 3, yy + 11);
    doc.setFont("helvetica", "normal");
  });
  y += 42;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Realisering", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const buckets = [
    [REALIZATION_LABELS.potential, input.potential],
    [REALIZATION_LABELS.in_delivery, input.inDelivery],
    [REALIZATION_LABELS.realized, input.realized],
  ] as const;
  for (const [label, t] of buckets) {
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    doc.text(
      `${label}: ${moneyNb(t.currencySavedPerYear)} · ${hoursNb(t.hoursSavedPerYear)} · ${t.fteFreed.toFixed(2)} FTE`,
      margin,
      y,
    );
    y += 5;
  }
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
  doc.text("Per fase", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const row of input.byPipeline.filter((r) => r.count > 0)) {
    const name =
      PIPELINE_STATUS_LABELS[row.status as PipelineStatus] ?? row.status;
    doc.text(
      `${name}: ${row.count} · ${moneyNb(row.currencySavedPerYear)} · ${hoursNb(row.hoursSavedPerYear)}`,
      margin,
      y,
    );
    y += 5;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  }

  y += 4;
  const soft = input.softGains.filter((g) => g.soft && g.count > 0);
  if (soft.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Kvalitet og sikkerhet (ikke tallfestet)", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const g of soft.slice(0, 8)) {
      doc.text(`${g.label}: ${g.count} vurderinger`, margin, y);
      y += 5;
    }
  }

  y += 4;
  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Kandidater", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const c of input.candidates.slice(0, 40)) {
    const phase =
      PIPELINE_STATUS_LABELS[c.pipelineStatus as PipelineStatus] ??
      c.pipelineStatus;
    const line = `${c.title.slice(0, 42)} · ${phase} · ${moneyNb(c.currencySavedPerYear)}`;
    doc.text(line, margin, y, { maxWidth: pw - margin * 2 });
    y += 4.5;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
  const note =
    "Tall er ca.-estimater fra PVV-modellen. Myke gevinster er bevisst uten kroneverdi. Erstatter ikke faglig vurdering.";
  doc.text(doc.splitTextToSize(note, pw - margin * 2), margin, y);

  applyCorporatePdfFooters(doc, margin, {
    shortTitle: input.workspaceName,
    docTypeLabel: "Gevinster",
  });

  const safe = input.workspaceName.replace(/[^\w\-]+/g, "_").slice(0, 40);
  doc.save(`Gevinster-${safe || "portefolje"}.pdf`);
}
