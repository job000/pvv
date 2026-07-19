/**
 * Ledelsesvennlig RPA-egnethet + alternativer.
 * Bygger på samme screening som inntak, pluss gjennomførbarhet, barrierer og myke gevinster.
 */

import { computeRpaScreeningVerdict } from "@/convex/lib/intakePublicScreening";
import type { ComputedSnapshot } from "@/convex/lib/rpaScoring";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  ASSESSMENT_VALUE_GAIN_OPTIONS,
  ASSESSMENT_VALUE_PAIN_OPTIONS,
  SOFT_VALUE_GAIN_IDS,
} from "@/lib/assessment-value-tags";
import {
  RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB,
  type RpaBarrierSelfAssessment,
} from "@/lib/rpa-portfolio-labels";

export type RpaSuitabilityVerdict = "egnet" | "middels" | "lite_egnet";

export type DeliveryPath =
  | "rpa"
  | "integration"
  | "low_code"
  | "process_redesign"
  | "manual_improve"
  | "defer";

export type SoftBenefit = {
  id: string;
  label: string;
  why: string;
};

export type DeliveryAlternative = {
  path: DeliveryPath;
  title: string;
  description: string;
  recommended: boolean;
};

export type RpaSuitabilityReport = {
  verdict: RpaSuitabilityVerdict;
  title: string;
  summary: string;
  /** Én linje for ledelse */
  leadershipLine: string;
  reasons: string[];
  softBenefits: SoftBenefit[];
  alternatives: DeliveryAlternative[];
  primaryPath: DeliveryPath;
  primaryPathLabel: string;
};

const PATH_LABEL: Record<DeliveryPath, string> = {
  rpa: "RPA (digital medarbeider)",
  integration: "Direkte systemintegrasjon",
  low_code: "Lavkode / arbeidsflytverktøy",
  process_redesign: "Prosessforenkling først",
  manual_improve: "Manuell forbedring",
  defer: "Utsett / avklar mer",
};

function gainLabel(id: string): string {
  return (
    ASSESSMENT_VALUE_GAIN_OPTIONS.find((g) => g.id === id)?.label ?? id
  );
}

function painLabel(id: string): string {
  return (
    ASSESSMENT_VALUE_PAIN_OPTIONS.find((p) => p.id === id)?.label ?? id
  );
}

/**
 * Bygger egnethetsrapport for Resultat-steget.
 * Justerer screening ved egenvurdert barriere, lav ease, OCR/tynn klient.
 */
export function buildRpaSuitabilityReport(
  payload: AssessmentPayload,
  computed: ComputedSnapshot,
): RpaSuitabilityReport {
  let { verdict, verdictDescription } = computeRpaScreeningVerdict(
    payload as unknown as Record<string, unknown>,
    { feasible: computed.feasible },
  );

  const barrier = payload.rpaBarrierSelfAssessment as
    | RpaBarrierSelfAssessment
    | undefined;
  const reasons: string[] = [];

  if (barrier === "not_rpa_suitable") {
    verdict = "lite_egnet";
    reasons.push(
      "Dere har selv markert at oppgaven ikke passer med robot i skjermbilder.",
    );
  } else if (barrier === "integration_preferred") {
    if (verdict === "egnet") verdict = "middels";
    reasons.push(
      "Direkte systemkobling er markert som foretrukket fremfor RPA.",
    );
  } else if (barrier === "low_payback") {
    if (verdict === "egnet") verdict = "middels";
    reasons.push("Egenvurdering: begrenset tid- eller pengegevinst.");
  } else if (barrier === "organizational_block") {
    if (verdict === "egnet") verdict = "middels";
    reasons.push("Organisatoriske hindringer er markert.");
  }

  if (!computed.feasible) {
    if (verdict === "egnet") verdict = "middels";
    reasons.push(
      "Prosess- eller systemstabilitet er under terskel for trygg automatisering.",
    );
  }

  if (computed.ease < 40 && verdict === "egnet") {
    verdict = "middels";
    reasons.push(
      `Gjennomføring ser krevende ut (ease ${computed.ease.toFixed(0)} %).`,
    );
  }

  if (payload.ocrRequired) {
    reasons.push("OCR er påkrevd — øker kompleksitet og feilrisiko.");
  }
  if ((payload.thinClientPercent ?? 0) >= 50) {
    reasons.push(
      "Høy andel tynnklient/Citrix — RPA blir typisk dyrere å drifte.",
    );
  }

  if (computed.ap >= 55 && verdict !== "lite_egnet") {
    reasons.push(
      `Automasjonspotensial ca. ${computed.ap.toFixed(0)} % av manuell tid.`,
    );
  }
  if (computed.priorityScore >= 60 && verdict === "egnet") {
    reasons.push("Høy porteføljeprioritet ut fra potensial og kritikalitet.");
  }

  if (reasons.length === 0) {
    reasons.push(verdictDescription);
  }

  const softBenefits = buildSoftBenefits(payload);
  const alternatives = buildAlternatives(verdict, barrier, computed, payload);
  const primary = alternatives.find((a) => a.recommended) ?? alternatives[0]!;

  const title =
    verdict === "egnet"
      ? "Egnet for RPA"
      : verdict === "middels"
        ? "Bør vurderes nærmere"
        : "Lite egnet for RPA nå";

  const summary =
    verdict === "egnet"
      ? "Svarene peker mot en oppgave som ofte passer digital medarbeider (RPA): tilstrekkelig struktur, gjentakelse og digitalt grunnlag."
      : verdict === "middels"
        ? "Bildet er blandet. Avklar stabilitet, volum og om integrasjon eller lavkode er bedre før dere investerer i RPA."
        : "Ut fra svarene er RPA sjelden beste førstevalg. Se alternativene under — andre kan likevel levere gevinsten.";

  const leadershipLine =
    verdict === "egnet"
      ? `Anbefaling: prioriter som RPA-kandidat · ${PATH_LABEL.rpa}`
      : verdict === "middels"
        ? `Anbefaling: avklar før beslutning · primært ${PATH_LABEL[primary.path]}`
        : `Anbefaling: ikke RPA først · vurder ${PATH_LABEL[primary.path]}`;

  return {
    verdict,
    title,
    summary:
      barrier && barrier !== "none" && barrier !== "unsure"
        ? `${summary} (${RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB[barrier]})`
        : summary,
    leadershipLine,
    reasons: reasons.slice(0, 5),
    softBenefits,
    alternatives,
    primaryPath: primary.path,
    primaryPathLabel: PATH_LABEL[primary.path],
  };
}

function buildSoftBenefits(payload: AssessmentPayload): SoftBenefit[] {
  const gains = new Set(payload.valueGainIds ?? []);
  const pains = new Set(payload.valuePainPointIds ?? []);
  const out: SoftBenefit[] = [];

  const push = (id: string, label: string, why: string) => {
    if (out.some((b) => b.id === id)) return;
    out.push({ id, label, why });
  };

  for (const id of gains) {
    if (!SOFT_VALUE_GAIN_IDS.has(id) && id !== "save_time" && id !== "lower_cost") {
      continue;
    }
    switch (id) {
      case "fewer_errors":
        push(id, gainLabel(id), "Mindre manuell feilrate — kvalitet uten å måtte telle hvert krone.");
        break;
      case "security_compliance":
        push(id, gainLabel(id), "Mer konsistent etterlevelse og mindre «glemt» steg.");
        break;
      case "reliable_completion":
        push(id, gainLabel(id), "Jobben kjøres når den skal — uavhengig av kapasitet den dagen.");
        break;
      case "better_overview":
        push(id, gainLabel(id), "Sporbarhet og logging som støtter revisjon og læring.");
        break;
      case "faster_flow":
        push(id, gainLabel(id), "Kortere ventetid for pasient, bruker eller intern kunde.");
        break;
      case "free_capacity":
        push(id, gainLabel(id), "Kapasitet tilbake til faglig arbeid — ofte viktigere enn ren kost.");
        break;
      default:
        break;
    }
  }

  if (pains.has("manual_errors") && !gains.has("fewer_errors")) {
    push(
      "fewer_errors",
      "Færre feil / bedre kvalitet",
      "Dere har markert manuelle feil som smertepunkt.",
    );
  }
  if (pains.has("compliance") && !gains.has("security_compliance")) {
    push(
      "security_compliance",
      "Sikkerhet og etterlevelse",
      "Usikkerhet rundt regler/dokumentasjon er markert.",
    );
  }
  if (pains.has("patient_citizen")) {
    push(
      "patient_experience",
      "Bedre opplevelse for pasient/bruker",
      painLabel("patient_citizen"),
    );
  }

  if (out.length === 0) {
    push(
      "quality_default",
      "Kvalitet og forutsigbarhet",
      "Automatisering kan redusere variasjon — selv når kroner er usikre.",
    );
    push(
      "completion_default",
      "At jobben faktisk blir gjort",
      "Gjentatte manuelle steg glipper oftere enn en styrt automatisering.",
    );
  }

  return out.slice(0, 6);
}

function buildAlternatives(
  verdict: RpaSuitabilityVerdict,
  barrier: RpaBarrierSelfAssessment | undefined,
  computed: ComputedSnapshot,
  payload: AssessmentPayload,
): DeliveryAlternative[] {
  const preferIntegration =
    barrier === "integration_preferred" ||
    ((payload.applicationCount ?? 3) <= 2 &&
      (payload.digitization ?? 3) >= 4 &&
      verdict !== "egnet");

  const highVariability = (payload.processVariability ?? 3) <= 2;
  const lowDigital = (payload.digitization ?? 3) <= 2;

  const alts: DeliveryAlternative[] = [
    {
      path: "rpa",
      title: "RPA — digital medarbeider",
      description:
        "Robot som jobber i eksisterende skjermbilder. Best ved stabile, gjentatte steg uten tung integrasjon.",
      recommended: verdict === "egnet" && barrier !== "integration_preferred",
    },
    {
      path: "integration",
      title: "Direkte systemintegrasjon",
      description:
        "API, meldingsutveksling eller felles tjeneste. Ofte mer robust enn RPA når systemene tillater det.",
      recommended:
        preferIntegration ||
        (verdict === "lite_egnet" && (payload.digitization ?? 3) >= 3),
    },
    {
      path: "low_code",
      title: "Lavkode / arbeidsflyt",
      description:
        "Power Automate, n8n, Camunda e.l. når stegene er digitale men ikke krever full RPA-plattform.",
      recommended:
        verdict === "middels" &&
        !preferIntegration &&
        barrier !== "not_rpa_suitable" &&
        computed.ease >= 35,
    },
    {
      path: "process_redesign",
      title: "Forenkle prosessen først",
      description:
        "Fjern unødvendige steg, standardiser regler, reduser systemhopp — så vurder automatisering på nytt.",
      recommended: highVariability || !computed.feasible,
    },
    {
      path: "manual_improve",
      title: "Manuell forbedring",
      description:
        "Sjekklister, maler, bedre opplæring eller delt tjeneste — når volum eller stabilitet ikke forsvarer robot.",
      recommended:
        verdict === "lite_egnet" &&
        (lowDigital || barrier === "low_payback" || barrier === "not_rpa_suitable"),
    },
    {
      path: "defer",
      title: "Utsett til mer er kjent",
      description:
        "Samle volumtall, stabiliser system/prosess, eller avklar eierskap før investeringsbeslutning.",
      recommended: barrier === "organizational_block" || barrier === "unsure",
    },
  ];

  // Sørg for nøyaktig én primær anbefaling
  const recommended = alts.filter((a) => a.recommended);
  if (recommended.length === 0) {
    alts[verdict === "egnet" ? 0 : verdict === "middels" ? 2 : 3]!.recommended =
      true;
  } else if (recommended.length > 1) {
    const keep = recommended[0]!.path;
    for (const a of alts) {
      a.recommended = a.path === keep;
    }
  }

  return alts;
}

export function workloadIsUserEntered(payload: AssessmentPayload): boolean {
  const hasCase =
    (payload.timePerCaseValue != null && payload.caseVolumeValue != null) ||
    (payload.minutesPerCase != null &&
      (payload.casesPerWeek != null || payload.casesPerMonth != null));
  const hasFte =
    payload.workloadInputMode === "fte" &&
    payload.manualFteEstimate != null &&
    payload.manualFteEstimate > 0;
  return hasCase || hasFte;
}

export function costsLookLikeDefaults(payload: AssessmentPayload): boolean {
  const build = payload.implementationBuildCost;
  const run = payload.annualRunCost;
  const hasCustomBuild = build != null && build !== 350000;
  const hasCustomRun = run != null && run !== 75000;
  const hasCustomHourly =
    typeof payload.hourlyLaborRate === "number" && payload.hourlyLaborRate > 0;
  const hasCustomBasis = payload.laborCostBasis === "external";
  return !hasCustomBuild && !hasCustomRun && !hasCustomHourly && !hasCustomBasis;
}
