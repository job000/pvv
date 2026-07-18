import { jsPDF } from "jspdf";

import { PIPELINE_STATUS_LABELS, type PipelineStatus } from "@/lib/assessment-pipeline";
import { createPdfLayout, formatPdfTimestamp } from "@/lib/pdf-layout";
import { REALIZATION_LABELS } from "@/lib/portfolio-benefit-copy";

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

/** Ledelses-PDF for gevinster — moderne, lesbar for hvem som helst. */
export function downloadPortfolioBenefitsPdf(input: PortfolioBenefitsPdfInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = createPdfLayout(doc);
  const generatedAt = new Date();
  const isoDate = generatedAt.toISOString().slice(0, 10);
  const docRef = `GEV-${isoDate}`;
  const shortTitle = (input.workspaceName || "Portefølje").trim().slice(0, 60);

  doc.setProperties({
    title: `Gevinster: ${input.workspaceName}`,
    subject: "Porteføljegevinster og besparelser",
    keywords: "PVV, gevinster, besparelser, portefølje",
    creator: "PVV",
  });

  const toc = [
    "Dokumentkontroll",
    "Nøkkeltall",
    "Realisering",
    "Per fase",
    "Kvalitet og sikkerhet",
    "Kandidater",
  ] as const;

  L.drawFrontPage({
    docTypeLabel: "Gevinster og besparelser",
    eyebrow: "Porteføljeoversikt",
    title: "Gevinster og besparelser",
    subtitle: "Estimert verdi på tvers av vurderinger i arbeidsområdet.",
    lead: "Timer, kroner og FTE i porteføljen.",
    generatedLabel: formatPdfTimestamp(generatedAt),
    documentRef: docRef,
  });

  L.drawTocPage([...toc]);

  L.drawDocumentControlPage({
    organizationLine: input.workspaceName.trim() || undefined,
    metaRows: [
      { label: "Dokumentreferanse", value: docRef },
      {
        label: "Antall kandidater",
        value: String(input.candidates.length),
      },
    ],
  });

  L.addSection(toc[1], 12);
  L.addKpiTiles([
    { label: "Timer / år", value: hoursNb(input.totals.hoursSavedPerYear) },
    {
      label: "Besparelse / år",
      value: moneyNb(input.totals.currencySavedPerYear),
    },
    {
      label: "FTE frigjort",
      value: input.totals.fteFreed.toLocaleString("nb-NO", {
        maximumFractionDigits: 2,
      }),
    },
    { label: "Netto / år", value: moneyNb(input.totals.netBenefitAnnual) },
    { label: "Byggekostnad", value: moneyNb(input.totals.buildCost) },
    {
      label: "Driftskostnad / år",
      value: moneyNb(input.totals.annualRunCost),
    },
  ]);

  L.addSection(toc[2], 12);
  L.addPara(
    "Fordeling etter hvor langt gevinsten er kommet i leveranseløpet.",
    9,
  );
  const buckets = [
    [REALIZATION_LABELS.potential, input.potential],
    [REALIZATION_LABELS.in_delivery, input.inDelivery],
    [REALIZATION_LABELS.realized, input.realized],
  ] as const;
  for (const [label, t] of buckets) {
    L.addRow(
      label,
      `${moneyNb(t.currencySavedPerYear)}  ·  ${hoursNb(t.hoursSavedPerYear)}  ·  ${t.fteFreed.toFixed(2)} FTE`,
    );
  }

  L.addSection(toc[3], 12);
  const pipelineRows = input.byPipeline.filter((r) => r.count > 0);
  if (pipelineRows.length === 0) {
    L.addMutedNote("Ingen vurderinger med pipeline-status i uttrekket.");
  } else {
    for (const row of pipelineRows) {
      const name =
        PIPELINE_STATUS_LABELS[row.status as PipelineStatus] ?? row.status;
      L.addRow(
        name,
        `${row.count} stk  ·  ${moneyNb(row.currencySavedPerYear)}  ·  ${hoursNb(row.hoursSavedPerYear)}`,
      );
    }
  }

  const soft = input.softGains.filter((g) => g.soft && g.count > 0);
  L.addSection(toc[4], 12);
  if (soft.length === 0) {
    L.addMutedNote("Ingen myke gevinster registrert i uttrekket.");
  } else {
    L.addPara(
      "Disse gevinstene er bevisst uten kroneverdi — de dokumenterer kvalitets- og sikkerhetsgevinster.",
      9,
    );
    for (const g of soft.slice(0, 12)) {
      L.addRow(g.label, `${g.count} vurderinger`);
    }
  }

  L.addSection(toc[5], 12);
  if (input.candidates.length === 0) {
    L.addMutedNote("Ingen kandidater i uttrekket.");
  } else {
    L.addPara(
      `Viser opptil 40 av ${input.candidates.length} kandidater (sortert som i appen).`,
      9,
    );
    for (const c of input.candidates.slice(0, 40)) {
      const phase =
        PIPELINE_STATUS_LABELS[c.pipelineStatus as PipelineStatus] ??
        c.pipelineStatus;
      L.addRow(
        c.title.trim() || "Uten tittel",
        `${phase}  ·  ${moneyNb(c.currencySavedPerYear)}  ·  ${hoursNb(c.hoursSavedPerYear)}  ·  ${c.fteFreed.toFixed(2)} FTE`,
      );
    }
  }

  L.addSoftDivider();
  L.addMutedNote(
    "Tall er ca.-estimater fra PVV-modellen. Myke gevinster er bevisst uten kroneverdi. Rapporten erstatter ikke faglig eller økonomisk vurdering i egen organisasjon.",
  );

  L.finish({
    shortTitle,
    docTypeLabel: "Gevinster",
  });

  const safe = input.workspaceName.replace(/[^\w\-]+/g, "_").slice(0, 40);
  doc.save(`Gevinster-${safe || "portefolje"}.pdf`);
}
