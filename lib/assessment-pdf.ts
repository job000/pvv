import { jsPDF } from "jspdf";

import { ASSESSMENT_WIZARD_STEP_LABELS } from "@/lib/assessment-wizard-steps";
import {
  applyCorporatePdfFooters,
  bodyLineHeightMm,
  PDF_CORPORATE_THEME,
} from "@/lib/pdf-corporate";
import { OPERATIONS_SUPPORT_LEVEL_LABELS } from "@/lib/helsesector-labels";
import {
  RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB,
  RPA_SIMILAR_AUTOMATION_LABELS_NB,
} from "@/lib/rpa-portfolio-labels";

const T = PDF_CORPORATE_THEME;

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
  rpaExpectedBenefitVsEffort?: number;
  rpaQuickWinPotential?: number;
  rpaProcessSpecificity?: number;
  rpaBarrierSelfAssessment?:
    | "none"
    | "low_payback"
    | "not_rpa_suitable"
    | "integration_preferred"
    | "organizational_block"
    | "unsure";
  rpaBarrierNotes?: string;
  rpaSimilarAutomationExists?:
    | "unsure"
    | "yes_here"
    | "yes_elsewhere_or_similar"
    | "no";
  rpaImplementationDifficulty?: number;
  rpaLifecycleContact?: string;
  rpaManualFallbackWhenRobotFails?: string;
  implementationBuildCost?: number;
  annualRunCost?: number;
  rpaBenefitKindsAndOperationsNotes?: string;
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
    deliveryConfidence: number;
    economicCaseScore: number;
    readinessScore: number;
    benH: number;
    benC: number;
    benFte: number;
    annualRunCost: number;
    buildCost: number;
    netBenefitAnnual: number;
    paybackMonths: number | null;
  };
  generatedAt: Date;
};

function formatTs(d: Date) {
  try {
    return d.toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short" });
  } catch {
    return d.toISOString();
  }
}

/** A4-PDF med samme bedriftslayout som ROS-eksport. */
export function buildAssessmentPdfDocument(data: AssessmentPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 16;
  let y = margin;
  const pageW = () => doc.internal.pageSize.getWidth();
  const pageH = () => doc.internal.pageSize.getHeight();
  const contentW = () => pageW() - margin * 2;
  const shortTitle = (data.title || "Vurdering").trim().slice(0, 60);

  doc.setProperties({
    title: data.title,
    subject: "PVV-vurdering (RPA / prosess)",
    keywords: "PVV, vurdering, RPA, prosess, portefølje",
    creator: "PVV",
  });

  const ensureSpace = (needMm: number) => {
    if (y + needMm > pageH() - margin) {
      doc.addPage();
      y = margin;
    }
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
      doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
      doc.rect(margin, y - size * 0.36, barW, size * 0.72, "F");
    }
    const textX = margin + (bar ? barW + 3.5 : 0);
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    doc.text(text, textX, y);
    y += size * 0.55 + (rule ? 2 : 4);
    if (rule) {
      doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
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
    const lines = doc.splitTextToSize(text, contentW());
    ensureSpace(lines.length * lh + 5);
    doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
    doc.text(lines, margin, y);
    y += lines.length * lh + 3.5;
    doc.setTextColor(0);
  };

  const addRow = (label: string, value: string) => {
    const size = 10;
    const lh = bodyLineHeightMm(size);
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    const labelLines = doc.splitTextToSize(label, 44);
    const vlines = doc.splitTextToSize(value, contentW() - 50);
    const labelH = labelLines.length * lh;
    const valueH = vlines.length * lh;
    ensureSpace(Math.max(labelH, valueH) + 5);
    let ly = y;
    for (const ll of labelLines) {
      doc.text(ll, margin, ly);
      ly += lh;
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
    let vy = y;
    for (const vl of vlines) {
      doc.text(vl, margin + 50, vy);
      vy += lh;
    }
    y += Math.max(labelH, valueH) + 5;
    doc.setTextColor(0);
  };

  const addFieldBlock = (fieldLabel: string, body: string) => {
    const t = body.trim();
    if (!t) return;
    ensureSpace(12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    doc.text(fieldLabel, margin, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    addPara(t);
    y += 1;
  };

  const isoDate = data.generatedAt.toISOString().slice(0, 10);
  const docRef = `PVV-VURD-${isoDate}`;

  doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
  doc.rect(0, 0, pageW(), 31, "F");
  doc.setFillColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
  doc.rect(0, 31, pageW(), 0.9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PVV · VURDERING · 5 STEG", margin, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`${formatTs(data.generatedAt)}  ·  ${docRef}`, margin, 16);
  doc.text(
    "Til arkiv, porteføljestyring, revisjon og beslutningsmøter — full tekst fra veiviseren der den er utfylt.",
    margin,
    22,
    { maxWidth: pageW() - margin * 2 },
  );
  doc.setTextColor(0);
  y = 38;

  doc.setFontSize(19);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
  const titleLines = doc.splitTextToSize(data.title, contentW());
  const titleLh = 7;
  ensureSpace(titleLines.length * titleLh + 8);
  doc.text(titleLines, margin, y);
  y += titleLines.length * titleLh + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
  addPara(
    "Rapporten følger samme rekkefølge som i appen: kandidat og volum, prosess og systemer, verdi og effekt, resultat (beregninger og status), deretter valgfrie tilleggsfelt.",
    9.5,
  );
  doc.setTextColor(0);

  type ControlRow = { label: string; value: string };
  const controlRows: ControlRow[] = [];
  if (data.workspaceName?.trim()) {
    controlRows.push({ label: "Arbeidsområde", value: data.workspaceName.trim() });
  }
  controlRows.push({
    label: "Prosessnavn (kandidat)",
    value: data.processName.trim() || "—",
  });
  controlRows.push({
    label: "Referanse / ID",
    value: data.candidateId.trim() || "—",
  });
  controlRows.push({ label: "Pipelinestatus", value: data.pipelineLabel });
  controlRows.push({ label: "Risiko (ROS)", value: data.rosLabel });
  controlRows.push({ label: "Personvern (PDD)", value: data.pddLabel });

  const cPad = 5;
  const cLabelW = 48;
  const cInnerW = contentW() - cPad * 2;
  const cValueX = margin + cPad + cLabelW;
  const cValueMaxW = cInnerW - cLabelW - 2;
  const cFs = 9;
  const cLh = bodyLineHeightMm(cFs);
  let cBodyH = cLh + 5;
  for (const row of controlRows) {
    doc.setFontSize(cFs);
    const ll = doc.splitTextToSize(row.label, cLabelW - 1);
    const vl = doc.splitTextToSize(row.value, cValueMaxW);
    cBodyH += Math.max(ll.length, vl.length) * cLh + 3.5;
  }
  const cBoxH = cPad * 2 + cBodyH + 2;
  ensureSpace(cBoxH + 10);
  const cBoxTop = y;
  doc.setFillColor(T.surface[0], T.surface[1], T.surface[2]);
  doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
  doc.setLineWidth(0.35);
  doc.rect(margin, cBoxTop, contentW(), cBoxH, "FD");
  let cY = cBoxTop + cPad + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(cFs);
  doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
  doc.text("Dokumentkontroll", margin + cPad, cY);
  cY += cLh + 4;
  for (const row of controlRows) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    const ll = doc.splitTextToSize(row.label, cLabelW - 1);
    const vl = doc.splitTextToSize(row.value, cValueMaxW);
    let lyy = cY;
    for (const l of ll) {
      doc.text(l, margin + cPad, lyy);
      lyy += cLh;
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
    let vyy = cY;
    for (const v of vl) {
      doc.text(v, cValueX, vyy);
      vyy += cLh;
    }
    cY = Math.max(lyy, vyy) + 3.5;
  }
  y = cBoxTop + cBoxH + 8;
  doc.setTextColor(0);

  y += 2;
  addHeading("Formål og anvendelse", 12);
  addPara(
    "Dokumentet er et strukturert uttrekk fra PVV på eksporttidspunktet. Tall og poeng er veiledende og erstatter ikke faglig eller juridisk vurdering i egen organisasjon. Distribueres etter interne retningslinjer for informasjon og personvern.",
    9.5,
  );

  const stepLabel = (i: number) =>
    `${i + 1}. ${ASSESSMENT_WIZARD_STEP_LABELS[i] ?? `Steg ${i + 1}`}`;

  const addWizardStepHeading = (stepIndex: number) => {
    y += 5;
    addHeading(stepLabel(stepIndex), 12);
  };

  const stepHasContent = (checks: Array<string | undefined | null>) =>
    checks.some((s) => (s?.trim() ?? "").length > 0);

  const addEmptyStepNote = () => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
    addPara("Ingen utfylling registrert i dette steget i eksportøyeblikket.", 9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
  };

  addWizardStepHeading(0);
  if (
    stepHasContent([data.processDescription, data.processVolumeNotes])
  ) {
    addFieldBlock("Prosessbeskrivelse", data.processDescription ?? "");
    addFieldBlock("Volum og mønster", data.processVolumeNotes ?? "");
  } else {
    addEmptyStepNote();
  }

  addWizardStepHeading(1);
  if (
    stepHasContent([
      data.processFlowSummary,
      data.processActors,
      data.processSystems,
    ])
  ) {
    addFieldBlock("Flyt og hovedtrinn", data.processFlowSummary ?? "");
    addFieldBlock("Roller og ansvar", data.processActors ?? "");
    addFieldBlock("Systemer og data", data.processSystems ?? "");
  } else {
    addEmptyStepNote();
  }

  const step3Texts = [
    data.processGoal,
    data.processConstraints,
    data.hfSecurityInformationNotes,
    data.hfOrganizationalBreadthNotes,
    data.hfEconomicRationaleNotes,
    data.hfCriticalManualGapNotes,
    data.hfOperationsSupportNotes,
    data.rpaBarrierNotes,
  ];
  const step3Numbers =
    data.rpaExpectedBenefitVsEffort !== undefined ||
    data.rpaQuickWinPotential !== undefined ||
    data.rpaProcessSpecificity !== undefined ||
    data.rpaSimilarAutomationExists !== undefined ||
    data.rpaImplementationDifficulty !== undefined ||
    (data.rpaBarrierSelfAssessment !== undefined &&
      data.rpaBarrierSelfAssessment !== "none");

  addWizardStepHeading(2);
  if (stepHasContent(step3Texts) || step3Numbers) {
    addFieldBlock("Mål og verdi", data.processGoal ?? "");
    addFieldBlock("Begrensninger og risiko", data.processConstraints ?? "");
    addFieldBlock(
      "Sikkerhet og informasjon",
      data.hfSecurityInformationNotes ?? "",
    );
    addFieldBlock(
      "Organisasjonsbredde og samordning",
      data.hfOrganizationalBreadthNotes ?? "",
    );
    addFieldBlock(
      "Besparelse og økonomisk gevinst (tekst)",
      data.hfEconomicRationaleNotes ?? "",
    );
    addFieldBlock(
      "Kritisk gap (ikke gjøres i dag)",
      data.hfCriticalManualGapNotes ?? "",
    );
    addFieldBlock(
      "Krav til utvikling og drift (tekst)",
      data.hfOperationsSupportNotes ?? "",
    );
    if (data.rpaExpectedBenefitVsEffort !== undefined) {
      addRow(
        "Beslutningsgrunnlag: gevinst vs. innsats (1–5)",
        String(data.rpaExpectedBenefitVsEffort),
      );
    }
    if (data.rpaQuickWinPotential !== undefined) {
      addRow(
        "Beslutningsgrunnlag: rask effekt (1–5)",
        String(data.rpaQuickWinPotential),
      );
    }
    if (data.rpaProcessSpecificity !== undefined) {
      addRow(
        "Beslutningsgrunnlag: spesifikk vs. lignende mange steder (1–5)",
        String(data.rpaProcessSpecificity),
      );
    }
    if (data.rpaSimilarAutomationExists) {
      addRow(
        "Lignende automatisering fra før",
        RPA_SIMILAR_AUTOMATION_LABELS_NB[data.rpaSimilarAutomationExists],
      );
    }
    if (data.rpaImplementationDifficulty !== undefined) {
      addRow(
        "Anslått vanskelig å få i drift (1–5)",
        String(data.rpaImplementationDifficulty),
      );
    }
    if (
      data.rpaBarrierSelfAssessment &&
      data.rpaBarrierSelfAssessment !== "none"
    ) {
      addRow(
        "Hindring eller annen løsning",
        RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB[data.rpaBarrierSelfAssessment],
      );
    }
    addFieldBlock(
      "Beslutningsgrunnlag — forklaring (hindring)",
      data.rpaBarrierNotes ?? "",
    );
  } else {
    addEmptyStepNote();
  }

  addWizardStepHeading(3);
  const sPad = 5;
  const sFs = 9.5;
  const sLh = bodyLineHeightMm(sFs);
  const metricLines: string[] = [
    `Automatiseringspotensial: ${data.computed.ap.toFixed(1)} %`,
    `Viktighet og konsekvens: ${data.computed.criticality.toFixed(1)} %`,
    `Porteføljeprioritet: ${data.computed.priorityScore.toFixed(1)} / 100`,
    `Stabil nok for robot: ${data.computed.feasible ? "Ja" : "Nei — ustabil, avklar før oppstart"}`,
    `Gjennomførbarhet: ${data.computed.ease.toFixed(1)} % (${data.computed.easeLabel})`,
    `Leveransetillit: ${data.computed.deliveryConfidence.toFixed(1)} / 100`,
    `Økonomisk case: ${data.computed.economicCaseScore.toFixed(1)} / 100`,
    `Readiness: ${data.computed.readinessScore.toFixed(1)} / 100`,
    `Timer spart /år (est.): ${data.computed.benH.toFixed(0)}`,
    `Besparelse /år (est.): ${Math.round(data.computed.benC).toLocaleString("nb-NO")} kr`,
    `Driftskostnad /år (est.): ${Math.round(data.computed.annualRunCost).toLocaleString("nb-NO")} kr`,
    `Netto gevinst /år (est.): ${Math.round(data.computed.netBenefitAnnual).toLocaleString("nb-NO")} kr`,
    `Tilbakebetalingstid: ${data.computed.paybackMonths === null ? "Ikke beregnet" : `${data.computed.paybackMonths.toFixed(1)} mnd`}`,
    `Årsverk frigitt (est.): ${data.computed.benFte.toFixed(2)}`,
  ];
  let sInner = sPad * 2 + 5;
  doc.setFontSize(sFs);
  for (const line of metricLines) {
    const wrapped = doc.splitTextToSize(`• ${line}`, contentW() - sPad * 2 - 4);
    sInner += wrapped.length * sLh + 1;
  }
  sInner += 4;
  ensureSpace(sInner + 8);
  const sTop = y;
  doc.setFillColor(T.calloutBg[0], T.calloutBg[1], T.calloutBg[2]);
  doc.setDrawColor(T.calloutBorder[0], T.calloutBorder[1], T.calloutBorder[2]);
  doc.setLineWidth(0.25);
  doc.rect(margin, sTop, contentW(), sInner, "FD");
  let sY = sTop + sPad + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
  doc.text("NØKKELTALL (RESULTAT)", margin + sPad, sY);
  sY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(sFs);
  doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
  for (const line of metricLines) {
    const wrapped = doc.splitTextToSize(
      `• ${line}`,
      contentW() - sPad * 2 - 4,
    );
    doc.text(wrapped, margin + sPad, sY);
    sY += wrapped.length * sLh + 1;
  }
  y = sTop + sInner + 6;
  doc.setTextColor(0);

  const lvl = data.hfOperationsSupportLevel;
  if (lvl && lvl !== "unsure") {
    addRow(
      "Tjenestenivå drift og utvikling (helseforetak / virksomhet)",
      OPERATIONS_SUPPORT_LEVEL_LABELS[lvl],
    );
  }

  addWizardStepHeading(4);
  if (
    stepHasContent([
      data.processFollowUp,
      data.rpaBenefitKindsAndOperationsNotes,
      data.rpaLifecycleContact,
      data.rpaManualFallbackWhenRobotFails,
    ])
  ) {
    addFieldBlock("Videre og oppfølging", data.processFollowUp ?? "");
    addFieldBlock(
      "Gevinst, tid, ventetid, robot vs. manuelt",
      data.rpaBenefitKindsAndOperationsNotes ?? "",
    );
    addFieldBlock(
      "Kontaktperson til produksjon",
      data.rpaLifecycleContact ?? "",
    );
    addFieldBlock(
      "Manuell reserve ved robotfeil",
      data.rpaManualFallbackWhenRobotFails ?? "",
    );
  } else {
    addEmptyStepNote();
  }

  const legendExplain =
    "Merknad: Dette dokumentet er et forenklet uttrekk fra PVV. Tall og poengsummer er veiledende og bygger på oppgitte data i veiviseren; de erstatter ikke egen faglig vurdering, intern godkjenning eller kontraktsmessige forpliktelser.";
  const dFs = 6.8;
  const dLh = bodyLineHeightMm(dFs);
  doc.setFontSize(dFs);
  const discLines = doc.splitTextToSize(legendExplain, contentW() - 10);
  const footBoxH = 8 + discLines.length * dLh + 8;
  ensureSpace(footBoxH + 10);
  const footTop = y + 4;
  doc.setFillColor(T.mutedBg[0], T.mutedBg[1], T.mutedBg[2]);
  doc.setDrawColor(T.mutedBorder[0], T.mutedBorder[1], T.mutedBorder[2]);
  doc.setLineWidth(0.25);
  doc.rect(margin, footTop, contentW(), footBoxH, "FD");
  let fy = footTop + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
  doc.text("Juridisk og metodemessig merknad", margin + 5, fy);
  fy += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(dFs);
  doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
  doc.text(discLines, margin + 5, fy);
  y = footTop + footBoxH + 6;
  doc.setTextColor(0);

  applyCorporatePdfFooters(doc, margin, {
    shortTitle,
    docTypeLabel: "PVV-vurdering",
  });

  return doc;
}

export function buildAssessmentPdfBlob(data: AssessmentPdfInput): Blob {
  return buildAssessmentPdfDocument(data).output("blob");
}

export function downloadAssessmentPdf(data: AssessmentPdfInput): void {
  const doc = buildAssessmentPdfDocument(data);
  const safe = data.title
    .replace(/[^\wæøåÆØÅ\- ]/gi, "")
    .trim()
    .slice(0, 40)
    .replace(/\s+/g, "-");
  doc.save(`PVV-${safe || "vurdering"}.pdf`);
}
