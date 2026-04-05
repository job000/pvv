import { payloadToSnapshot } from "./payloadSnapshot";
import { computeAllResults } from "./rpaScoring";

export type PublicIntakeScreeningSummary = {
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

/**
 * Samme modell som PVV-vurdering (screening) — vises til innsender på bekreftelsessiden.
 */
export function buildPublicIntakeScreeningSummary(
  payload: Record<string, unknown>,
): PublicIntakeScreeningSummary {
  const snap = payloadToSnapshot(payload);
  const c = computeAllResults(snap);

  const band: PublicIntakeScreeningSummary["priorityBand"] =
    c.priorityScore >= 60 ? "hoy" : c.priorityScore >= 35 ? "middels" : "lav";

  const hours = Math.max(0, Math.round(c.benH));

  let headline: string;
  let body: string;

  if (!c.feasible) {
    headline = "Trenger nærmere avklaring";
    body =
      "Ut fra svarene virker rutiner eller systemer ustabile nok til at vi bør se nærmere på det før vi anbefaler robot. " +
      "Det betyr ikke at forslaget er avvist — bare at vi vil vurdere det manuelt.";
  } else if (band === "hoy") {
    headline = "Ser ut som et sterkt forslag";
    body =
      "Basert på det du har beskrevet, ligger forslaget høyt i vår enkle prioritering: " +
      "det er ofte mye å hente når mye gjøres likt og ofte. Vi vil likevel gå gjennom alt manuelt før vi konkluderer.";
  } else if (band === "middels") {
    headline = "Kan være aktuelt";
    body =
      "Svarene peker på at forslaget kan være verdt å se nærmere på. " +
      "Den endelige vurderingen gjør vi når vi har lest gjennom hele saken.";
  } else {
    headline = "Ikke øverst på lista foreløpig";
    body =
      "Ut fra det du har oppgitt, ligger andre typer saker ofte foran i køen hos oss. " +
      "Vi tar likevel kontakt etter gjennomgang — noen ganger er det mer å hente enn tallene viser.";
  }

  const valueLine =
    hours > 0
      ? `Et grovt anslag er at det kan ligge omtrent ${hours} timer manuelt arbeid per år bak dette (før eventuell automatisering).`
      : "Vi har ikke nok tall fra svarene til å anslå timer — det avklarer vi i gjennomgangen.";

  return {
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
