import { payloadToSnapshot } from "./payloadSnapshot";
import { clampLikert5, computeAllResults } from "./rpaScoring";

export type PublicIntakeScreeningVerdict = "egnet" | "middels" | "lite_egnet";

export type PublicIntakeScreeningSummary = {
  /** Tydelig konklusjon for innsender (RPA-screening). */
  verdict: PublicIntakeScreeningVerdict;
  verdictTitle: string;
  verdictDescription: string;
  /** Kort, menneskelig: f.eks. «Ser lovende ut» */
  headline: string;
  /** 2–4 setninger, enkelt språk */
  body: string;
  /** Én linje om ca. timer / nytte */
  valueLine: string;
  priorityBand: "hoy" | "middels" | "lav";
  priorityScore: number;
  automationPercent: number;
  hoursSavedEstimate: number;
  feasible: boolean;
};

function readLikertFromPayload(
  payload: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = payload[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return clampLikert5(n);
}

/**
 * Grov RPA-screening ut fra forventet virkningsnytte, saksvariasjon og digital modenhet.
 * Bruker samme felt som skjemaet kartlegger (1–5).
 */
export function computeRpaScreeningVerdict(
  payload: Record<string, unknown>,
  options: { feasible: boolean },
): {
  verdict: PublicIntakeScreeningVerdict;
  verdictTitle: string;
  verdictDescription: string;
} {
  const businessImpact = readLikertFromPayload(
    payload,
    "criticalityBusinessImpact",
    3,
  );
  const variability = readLikertFromPayload(payload, "processVariability", 3);
  const digitization = readLikertFromPayload(payload, "digitization", 3);

  let verdict: PublicIntakeScreeningVerdict;

  const lowImpact = businessImpact <= 2;
  const lowRepeatability = variability <= 2;
  const lowDigital = digitization <= 2;
  const veryVariable = variability === 1;

  if (
    lowImpact ||
    veryVariable ||
    (lowRepeatability && lowDigital)
  ) {
    verdict = "lite_egnet";
  } else if (
    businessImpact >= 4 &&
    variability >= 3 &&
    digitization >= 3
  ) {
    verdict = "egnet";
  } else {
    verdict = "middels";
  }

  if (!options.feasible && verdict === "egnet") {
    verdict = "middels";
  }

  let verdictTitle: string;
  let verdictDescription: string;

  switch (verdict) {
    case "egnet":
      verdictTitle = "Foreløpig vurdering: Egnet som RPA-kandidat";
      verdictDescription =
        "Ut fra svarene på forventet nytte, hvor like tilfellene er, og hvor digitalt arbeidet er, " +
        "ser dette ut som en type oppgave som ofte kan passe for automatisering med digital medarbeider (robot). " +
        "Dette er et foreløpig signal, ikke en endelig beslutning.";
      break;
    case "middels":
      verdictTitle = "Foreløpig vurdering: Bør vurderes nærmere";
      verdictDescription = !options.feasible
        ? "Ut fra svarene virker rutiner eller systemer potensielt ustabile nok til at vi bør avklare mer før vi anbefaler robot. " +
          "Det betyr ikke at forslaget er avvist — bare at vi trenger mer innsikt."
        : "Svarene er ikke entydige: det kan være verdt å se nærmere på, eller vi trenger mer informasjon før vi kan si om dette er en god RPA-kandidat.";
      break;
    default:
      verdictTitle = "Foreløpig vurdering: Lite egnet akkurat nå";
      verdictDescription =
        "Ut fra det du har svart (begrenset forventet nytte for virksomheten, mye variasjon i sakene, og/eller lite digitalt grunnlag) " +
        "ligner dette mindre på den typen oppgave som vanligvis passer best for robot i skjermbilder. " +
        "Vi kan likevel ta kontakt — noen ganger er det mer å hente enn det grove bildet viser.";
  }

  return { verdict, verdictTitle, verdictDescription };
}

/**
 * Samme modell som PVV-vurdering (screening) — vises til innsender på bekreftelsessiden.
 */
export function buildPublicIntakeScreeningSummary(
  payload: Record<string, unknown>,
): PublicIntakeScreeningSummary {
  const snap = payloadToSnapshot(payload);
  const c = computeAllResults(snap);

  const { verdict, verdictTitle, verdictDescription } = computeRpaScreeningVerdict(
    payload,
    { feasible: c.feasible },
  );

  const band: PublicIntakeScreeningSummary["priorityBand"] =
    c.priorityScore >= 60 ? "hoy" : c.priorityScore >= 35 ? "middels" : "lav";

  const hours = Math.max(0, Math.round(c.benH));

  const headline = verdictTitle;
  let body = verdictDescription;

  if (c.feasible && verdict !== "lite_egnet") {
    if (band === "hoy") {
      body +=
        " I tillegg ligger forslaget høyt i vår enkle prioritering ut fra volum og gevinst.";
    } else if (band === "lav") {
      body +=
        " Samtidig ligger ikke forslaget øverst i vår interne prioriteringsliste foreløpig — vi tar likevel kontakt etter gjennomgang.";
    }
  }

  const valueLine =
    hours > 0
      ? `Et grovt anslag er at det kan ligge omtrent ${hours} timer manuelt arbeid per år bak dette (før eventuell automatisering).`
      : "Vi har ikke nok tall fra svarene til å anslå timer — det avklarer vi i gjennomgangen.";

  return {
    verdict,
    verdictTitle,
    verdictDescription,
    headline,
    body,
    valueLine,
    priorityBand: band,
    priorityScore: c.priorityScore,
    automationPercent: c.ap,
    hoursSavedEstimate: hours,
    feasible: c.feasible,
  };
}
