import { jsPDF } from "jspdf";

import { OPERATIONS_SUPPORT_LEVEL_LABELS } from "@/lib/helsesector-labels";
import {
  createPdfLayout,
  formatPdfTimestamp,
} from "@/lib/pdf-layout";
import {
  RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB,
  RPA_SIMILAR_AUTOMATION_LABELS_NB,
} from "@/lib/rpa-portfolio-labels";

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

/** A4-PDF med moderne, lesbar bedriftslayout. */
export function buildAssessmentPdfDocument(data: AssessmentPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = createPdfLayout(doc);
  const shortTitle = (data.title || "Vurdering").trim().slice(0, 60);
  const isoDate = data.generatedAt.toISOString().slice(0, 10);
  const docRef = `PVV-VURD-${isoDate}`;

  doc.setProperties({
    title: data.title,
    subject: "PVV-vurdering (RPA / prosess)",
    keywords: "PVV, vurdering, RPA, prosess, portefølje",
    creator: "PVV",
  });

  const toc = [
    "Dokumentkontroll",
    "Formål og anvendelse",
    "Kandidat og volum",
    "Prosess og systemer",
    "Verdi og effekt",
    "Resultat (nøkkeltall)",
    "Oppfølging",
  ] as const;

  L.drawFrontPage({
    docTypeLabel: "PVV-vurdering",
    eyebrow: "5-stegs vurdering · RPA / prosess",
    title: data.title || "Vurdering",
    subtitle: "Arkiv, porteføljestyring, revisjon og beslutningsmøter.",
    lead: "Automatiseringspotensial, prioritet og oppfølging.",
    generatedLabel: formatPdfTimestamp(data.generatedAt),
    documentRef: docRef,
  });

  L.drawTocPage([...toc]);

  L.drawDocumentControlPage({
    organizationLine: data.workspaceName?.trim() || undefined,
    metaRows: [
      {
        label: "Prosessnavn",
        value: data.processName.trim() || "—",
      },
      {
        label: "Referanse / ID",
        value: data.candidateId.trim() || "—",
      },
      { label: "Pipelinestatus", value: data.pipelineLabel },
      { label: "Risiko (ROS)", value: data.rosLabel },
      { label: "Personvern (PDD)", value: data.pddLabel },
    ],
  });

  L.addSection(toc[1], 11);
  L.addPara(
    "Dokumentet er et strukturert uttrekk fra PVV på eksporttidspunktet. Tall og poeng er veiledende og erstatter ikke faglig eller juridisk vurdering i egen organisasjon. Distribueres etter interne retningslinjer for informasjon og personvern.",
    9.5,
  );

  const field = (label: string, body?: string) =>
    L.addFieldCard(label, body, { showEmpty: true });

  L.addSection(toc[2], 12);
  field("Prosessbeskrivelse", data.processDescription);
  field("Volum og mønster", data.processVolumeNotes);

  L.addSection(toc[3], 12);
  field("Flyt og hovedtrinn", data.processFlowSummary);
  field("Roller og ansvar", data.processActors);
  field("Systemer og data", data.processSystems);

  L.addSection(toc[4], 12);
  field("Mål og verdi", data.processGoal);
  field("Begrensninger og risiko", data.processConstraints);
  field("Sikkerhet og informasjon", data.hfSecurityInformationNotes);
  field(
    "Organisasjonsbredde og samordning",
    data.hfOrganizationalBreadthNotes,
  );
  field(
    "Besparelse og økonomisk gevinst (tekst)",
    data.hfEconomicRationaleNotes,
  );
  field("Kritisk gap (ikke gjøres i dag)", data.hfCriticalManualGapNotes);
  field(
    "Krav til utvikling og drift (tekst)",
    data.hfOperationsSupportNotes,
  );

  if (data.rpaExpectedBenefitVsEffort !== undefined) {
    L.addRow(
      "Gevinst vs. innsats (1–5)",
      String(data.rpaExpectedBenefitVsEffort),
    );
  }
  if (data.rpaQuickWinPotential !== undefined) {
    L.addRow("Rask effekt (1–5)", String(data.rpaQuickWinPotential));
  }
  if (data.rpaProcessSpecificity !== undefined) {
    L.addRow(
      "Spesifikk vs. lignende mange steder (1–5)",
      String(data.rpaProcessSpecificity),
    );
  }
  if (data.rpaSimilarAutomationExists) {
    L.addRow(
      "Lignende automatisering fra før",
      RPA_SIMILAR_AUTOMATION_LABELS_NB[data.rpaSimilarAutomationExists],
    );
  }
  if (data.rpaImplementationDifficulty !== undefined) {
    L.addRow(
      "Vanskelig å få i drift (1–5)",
      String(data.rpaImplementationDifficulty),
    );
  }
  if (
    data.rpaBarrierSelfAssessment &&
    data.rpaBarrierSelfAssessment !== "none"
  ) {
    L.addRow(
      "Hindring eller annen løsning",
      RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB[data.rpaBarrierSelfAssessment],
    );
  }
  field("Forklaring (hindring)", data.rpaBarrierNotes);

  L.addSection(toc[5], 12);
  L.addKpiTiles([
    {
      label: "Automatiseringspotensial",
      value: `${data.computed.ap.toFixed(1)} %`,
    },
    {
      label: "Porteføljeprioritet",
      value: `${data.computed.priorityScore.toFixed(1)} / 100`,
    },
    {
      label: "Stabil nok for robot",
      value: data.computed.feasible ? "Ja" : "Nei — avklar først",
    },
    {
      label: "Gjennomførbarhet",
      value: `${data.computed.ease.toFixed(1)} % (${data.computed.easeLabel})`,
    },
    {
      label: "Netto gevinst / år",
      value: `${Math.round(data.computed.netBenefitAnnual).toLocaleString("nb-NO")} kr`,
    },
    {
      label: "Tilbakebetaling",
      value:
        data.computed.paybackMonths === null
          ? "Ikke beregnet"
          : `${data.computed.paybackMonths.toFixed(1)} mnd`,
    },
  ]);

  L.addRow(
    "Viktighet og konsekvens",
    `${data.computed.criticality.toFixed(1)} %`,
  );
  L.addRow(
    "Leveransetillit",
    `${data.computed.deliveryConfidence.toFixed(1)} / 100`,
  );
  L.addRow(
    "Økonomisk case",
    `${data.computed.economicCaseScore.toFixed(1)} / 100`,
  );
  L.addRow("Readiness", `${data.computed.readinessScore.toFixed(1)} / 100`);
  L.addRow(
    "Timer spart / år (est.)",
    data.computed.benH.toFixed(0),
  );
  L.addRow(
    "Besparelse / år (est.)",
    `${Math.round(data.computed.benC).toLocaleString("nb-NO")} kr`,
  );
  L.addRow(
    "Driftskostnad / år (est.)",
    `${Math.round(data.computed.annualRunCost).toLocaleString("nb-NO")} kr`,
  );
  L.addRow(
    "Årsverk frigitt (est.)",
    data.computed.benFte.toFixed(2),
  );

  const lvl = data.hfOperationsSupportLevel;
  if (lvl && lvl !== "unsure") {
    L.addRow(
      "Tjenestenivå drift og utvikling",
      OPERATIONS_SUPPORT_LEVEL_LABELS[lvl],
    );
  }

  L.addSection(toc[6], 12);
  field("Videre og oppfølging", data.processFollowUp);
  field(
    "Gevinst, tid, ventetid, robot vs. manuelt",
    data.rpaBenefitKindsAndOperationsNotes,
  );
  field("Kontaktperson til produksjon", data.rpaLifecycleContact);
  field("Manuell reserve ved robotfeil", data.rpaManualFallbackWhenRobotFails);

  L.addSoftDivider();
  L.addMutedNote(
    "Juridisk merknad: Dette dokumentet er et forenklet uttrekk fra PVV. Tall og poengsummer er veiledende og bygger på oppgitte data i veiviseren; de erstatter ikke egen faglig vurdering, intern godkjenning eller kontraktsmessige forpliktelser.",
  );

  L.finish({ shortTitle, docTypeLabel: "PVV-vurdering" });
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
