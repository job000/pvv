import { jsPDF } from "jspdf";

import { OPERATIONS_SUPPORT_LEVEL_LABELS } from "@/lib/helsesector-labels";

export type AssessmentPdfInput = {
  title: string;
  workspaceName: string | null;
  processName: string;
  candidateId: string;
  processDescription?: string;
  processGoal?: string;
  processActors?: string;
  processSystems?: string;
  processFlowSummary?: string;
  processVolumeNotes?: string;
  processConstraints?: string;
  processFollowUp?: string;
  hfOperationsSupportLevel?: "unsure" | "l1" | "l2" | "l3" | "mixed";
  hfSecurityInformationNotes?: string;
  hfOrganizationalBreadthNotes?: string;
  hfEconomicRationaleNotes?: string;
  hfCriticalManualGapNotes?: string;
  hfOperationsSupportNotes?: string;
  pipelineLabel: string;
  rosLabel: string;
  pddLabel: string;
  computed: {
    ap: number;
    criticality: number;
    priorityScore: number;
    feasible: boolean;
    ease: number;
    easeLabel: string;
    benH: number;
    benC: number;
  };
  generatedAt: Date;
};

/** Lager en lesbar A4-PDF i nettleseren (lastes ned). */
export function downloadAssessmentPdf(data: AssessmentPdfInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;

  const addHeading = (text: string) => {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(text, margin, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  const addPara = (text: string, size = 10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * (size * 0.45) + 3;
  };

  const addRow = (label: string, value: string) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    const vlines = doc.splitTextToSize(value, pageW - margin * 2 - 55);
    doc.text(vlines, margin + 52, y);
    y += Math.max(vlines.length * 4.5, 6);
  };

  addHeading("RPA-vurdering (PVV)");
  doc.setFontSize(9);
  doc.setTextColor(100);
  addPara(
    `Generert ${data.generatedAt.toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short" })} · Kun sammendrag`,
  );
  doc.setTextColor(0);

  y += 4;
  addPara(data.title, 14);
  doc.setFontSize(10);
  if (data.workspaceName) {
    addRow("Arbeidsområde", data.workspaceName);
  }
  addRow("Prosessnavn", data.processName || "—");
  addRow("Referanse", data.candidateId || "—");
  addRow("Pipelinestatus", data.pipelineLabel);
  addRow("Risiko (ROS)", data.rosLabel);
  addRow("Personvern (PDD)", data.pddLabel);

  y += 4;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Nøkkeltall", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  addRow("Automatiseringspotensial", `${data.computed.ap.toFixed(1)} %`);
  addRow("Kritikalitet", `${data.computed.criticality.toFixed(1)} %`);
  addRow("Foreslått prioritet", data.computed.priorityScore.toFixed(1));
  addRow(
    "Stabile prosess og systemer",
    data.computed.feasible ? "Ja" : "Trenger avklaring",
  );
  addRow(
    "Enkelhet å bygge",
    `${data.computed.ease.toFixed(1)} % (${data.computed.easeLabel})`,
  );
  addRow("Timer spart /år (est.)", data.computed.benH.toFixed(1));
  addRow(
    "NOK /år (est.)",
    Math.round(data.computed.benC).toLocaleString("nb-NO"),
  );

  const lvl = data.hfOperationsSupportLevel;
  if (lvl && lvl !== "unsure") {
    y += 4;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Krav (helseforetak / virksomhet)", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    addRow(
      "Tjenestenivå drift og utvikling",
      OPERATIONS_SUPPORT_LEVEL_LABELS[lvl],
    );
  }

  const processSections: Array<[string, string | undefined]> = [
    ["Prosessbeskrivelse", data.processDescription],
    ["Mål og verdi", data.processGoal],
    ["Flyt og hovedtrinn", data.processFlowSummary],
    ["Roller og ansvar", data.processActors],
    ["Systemer og data", data.processSystems],
    ["Volum og mønster", data.processVolumeNotes],
    ["Begrensninger og risiko", data.processConstraints],
    ["Videre og oppfølging", data.processFollowUp],
    ["Sikkerhet og informasjon", data.hfSecurityInformationNotes],
    ["Organisasjonsbredde og samordning", data.hfOrganizationalBreadthNotes],
    ["Besparelse og økonomisk gevinst", data.hfEconomicRationaleNotes],
    ["Kritisk gap (ikke gjøres i dag)", data.hfCriticalManualGapNotes],
    ["Krav til utvikling og drift", data.hfOperationsSupportNotes],
  ];
  for (const [heading, text] of processSections) {
    const t = text?.trim();
    if (!t) continue;
    y += 6;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(heading, margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    addPara(t);
  }

  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(120);
  addPara(
    "Dette dokumentet er et forenklet uttrekk fra PVV. Tall er veiledende og erstatter ikke faglig vurdering.",
    8,
  );

  const safe = data.title
    .replace(/[^\wæøåÆØÅ\- ]/gi, "")
    .trim()
    .slice(0, 40)
    .replace(/\s+/g, "-");
  doc.save(`PVV-${safe || "vurdering"}.pdf`);
}
