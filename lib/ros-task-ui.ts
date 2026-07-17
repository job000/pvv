/**
 * Hjelpefunksjoner for ROS-oppgaver: kobling til risiko-/tiltakspunkt og risikohåndtering.
 */

import type { RosCellItemMatrix } from "@/lib/ros-cell-items";

export type RosRiskTreatmentKind =
  | "mitigate"
  | "accept"
  | "transfer"
  | "avoid";

/**
 * Fire strategier etter ISO 31000 / NS 5814 (risk treatment):
 * mitigate · accept · transfer · avoid.
 * Hver oppføring i listen er en beslutning + handlingsplan (ikke bare en etikett).
 */
export const ROS_RISK_TREATMENT_OPTIONS: {
  value: "" | RosRiskTreatmentKind;
  label: string;
  description: string;
  planMeaning: string;
  accountabilityHint: string;
  /** Feltetikett for person — tilpasset strategien */
  personLabel: string;
  /** Feltetikett for dato — tilpasset strategien */
  dateLabel: string;
  /** Om person+dato anbefales sterkt (vises som anbefalt) */
  followUpRecommended: boolean;
  titlePlaceholder: string;
  saveLabel: string;
  formTitle: string;
  formHint: string;
}[] = [
  {
    value: "",
    label: "Ikke angitt",
    description: "Velg hvordan risikoen skal håndteres.",
    planMeaning:
      "Først velger dere strategi. Deretter dokumenterer dere planen og eventuelt oppfølging.",
    accountabilityHint:
      "Hvem og når avhenger av strategien — se feltetikettene når du har valgt.",
    personLabel: "Ansvarlig",
    dateLabel: "Dato",
    followUpRecommended: false,
    titlePlaceholder: "Beskriv behandlingen …",
    saveLabel: "Lagre",
    formTitle: "Behandle risiko",
    formHint:
      "Velg strategi, knytt til risikoen, og fyll det som er relevant for akkurat den strategien.",
  },
  {
    value: "mitigate",
    label: "Reduser",
    description:
      "Senke risikoen ved å redusere sannsynlighet og/eller konsekvens.",
    planMeaning:
      "Planen er konkrete tiltak som skal iverksettes. Etterpå vurderes restrisiko på nytt.",
    accountabilityHint:
      "Her trengs den som skal gjøre jobben, og en ferdigdato — ellers blir tiltaket sjelden gjennomført.",
    personLabel: "Utfører",
    dateLabel: "Ferdig innen",
    followUpRecommended: true,
    titlePlaceholder: "F.eks. «Kryptere personopplysninger ved overføring»",
    saveLabel: "Lagre tiltak",
    formTitle: "Reduser risikoen",
    formHint:
      "Beskriv tiltaket, knytt til risikoen, og sett utfører + ferdigdato.",
  },
  {
    value: "accept",
    label: "Akseptere",
    description:
      "Bevisst beholde restrisikoen — med dokumentert godkjenning.",
    planMeaning:
      "Ikke «gjør et tiltak», men en beslutning: restrisikoen er innenfor akseptkriteriene. Dere trenger godkjenner (risikoier/leder), ikke en «utfører». Datoen er neste gjennomgang — ikke en byggfrist.",
    accountabilityHint:
      "Anbefalt: hvem godkjenner aksepten, og når skal den vurderes på nytt. Uten det er aksept lett å misforstå som «glemt».",
    personLabel: "Godkjenner",
    dateLabel: "Neste gjennomgang",
    followUpRecommended: true,
    titlePlaceholder: "F.eks. «Aksepterer restrisiko etter eksisterende kontroller»",
    saveLabel: "Registrer aksept",
    formTitle: "Aksepter risikoen",
    formHint:
      "Dokumenter hvorfor, sett godkjenner, og når aksepten skal vurderes på nytt.",
  },
  {
    value: "transfer",
    label: "Overføre",
    description:
      "Flytte (deler av) risikoen til en annen part — ikke bli kvitt ansvaret helt.",
    planMeaning:
      "Planen er at forsikring, leverandør eller annen enhet overtar (deler av) risikoen. Noen hos dere må sikre at avtalen faktisk er på plass.",
    accountabilityHint:
      "Utfører = den som ordner kontrakt/forsikring/SLA. Ferdigdato = når overføringen skal være aktiv.",
    personLabel: "Utfører (internt)",
    dateLabel: "Skal være aktiv innen",
    followUpRecommended: true,
    titlePlaceholder: "F.eks. «Datatap dekkes av forsikring / leverandør-SLA»",
    saveLabel: "Registrer overføring",
    formTitle: "Overfør risikoen",
    formHint:
      "Beskriv hvem som overtar hva, og sett intern utfører + når det skal være aktivt.",
  },
  {
    value: "avoid",
    label: "Unngå",
    description:
      "Fjerne kilden til risikoen — stoppe, ikke starte, eller endre aktiviteten.",
    planMeaning:
      "Planen er avvikling eller endring. Noen må faktisk stoppe/endre — ellers fortsetter risikoen.",
    accountabilityHint:
      "Utfører = den som stopper eller endrer aktiviteten. Ferdigdato = når det skal være gjennomført.",
    personLabel: "Utfører",
    dateLabel: "Stoppet/endret innen",
    followUpRecommended: true,
    titlePlaceholder: "F.eks. «Stopper manuell eksport til usikkert system»",
    saveLabel: "Registrer unngåelse",
    formTitle: "Unngå risikoen",
    formHint:
      "Beskriv hva som avvikles, og sett utfører + når det skal være gjort.",
  },
];

export function riskTreatmentMeta(
  kind: "" | RosRiskTreatmentKind | undefined,
) {
  return (
    ROS_RISK_TREATMENT_OPTIONS.find((o) => o.value === (kind ?? "")) ??
    ROS_RISK_TREATMENT_OPTIONS[0]!
  );
}

function truncateLabel(s: string, max: number): string {
  const t = s.trim();
  if (!t) return "(tomt punkt)";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export type RosTaskRiskLinkOption = {
  value: string;
  label: string;
  /** Tom = «ingen kobling». Ellers gruppe i UI (optgroup). */
  group?: "before" | "after";
};

/**
 * Dropdown for tiltak: alle RosCellItem i før- og etter-matrise.
 *
 * Vi grupperer på fase (før / etter tiltak) i stedet for å prefiksere hver
 * etikett, slik at brukeren ser tydelig at «Før» = iboende risiko og
 * «Etter» = restrisiko etter planlagte/gjennomførte tiltak.
 */
export function buildRosTaskRiskLinkOptions(args: {
  cellItemsMatrix: RosCellItemMatrix;
  cellItemsAfterMatrix: RosCellItemMatrix;
  rowLabels: string[];
  colLabels: string[];
  afterRowLabels: string[];
  afterColLabels: string[];
}): RosTaskRiskLinkOption[] {
  const before: RosTaskRiskLinkOption[] = [];
  const after: RosTaskRiskLinkOption[] = [];
  for (let r = 0; r < args.cellItemsMatrix.length; r++) {
    const row = args.cellItemsMatrix[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      for (const it of cell) {
        const rl = args.rowLabels[r] ?? `R${r + 1}`;
        const cl = args.colLabels[c] ?? `K${c + 1}`;
        before.push({
          value: `before:${it.id}`,
          label: `${rl} × ${cl} — ${truncateLabel(it.text, 72)}`,
          group: "before",
        });
      }
    }
  }
  for (let r = 0; r < args.cellItemsAfterMatrix.length; r++) {
    const row = args.cellItemsAfterMatrix[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      for (const it of cell) {
        const rl = args.afterRowLabels[r] ?? `R${r + 1}`;
        const cl = args.afterColLabels[c] ?? `K${c + 1}`;
        after.push({
          value: `after:${it.id}`,
          label: `${rl} × ${cl} — ${truncateLabel(it.text, 72)}`,
          group: "after",
        });
      }
    }
  }
  before.sort((a, b) => a.label.localeCompare(b.label, "nb"));
  after.sort((a, b) => a.label.localeCompare(b.label, "nb"));
  return [
    { value: "", label: "— Ingen kobling (anbefales ikke) —" },
    ...before,
    ...after,
  ];
}

/** Norsk overskrift for hver fase i risikokoblings-dropdown. */
export const ROS_TASK_RISK_LINK_GROUP_LABELS: Record<
  "before" | "after",
  string
> = {
  before: "Risiko før tiltak (iboende)",
  after: "Restrisiko etter tiltak",
};

export function parseRosTaskRiskLink(value: string): {
  linkedCellItemId: string;
  linkedCellItemPhase: "before" | "after";
} | null {
  if (!value.trim()) return null;
  const beforePrefix = "before:";
  if (value.startsWith(beforePrefix)) {
    const id = value.slice(beforePrefix.length).trim();
    if (!id) return null;
    return { linkedCellItemId: id, linkedCellItemPhase: "before" };
  }
  const afterPrefix = "after:";
  if (value.startsWith(afterPrefix)) {
    const id = value.slice(afterPrefix.length).trim();
    if (!id) return null;
    return { linkedCellItemId: id, linkedCellItemPhase: "after" };
  }
  return null;
}

/**
 * Bygger «select»-verdien som matcher options fra `buildRosTaskRiskLinkOptions`
 * for et eksisterende koblingspar. Tom streng = ingen kobling.
 */
export function rosTaskRiskLinkValue(
  linkedCellItemId: string | undefined | null,
  linkedCellItemPhase: "before" | "after" | undefined | null,
): string {
  if (!linkedCellItemId || !linkedCellItemPhase) return "";
  return `${linkedCellItemPhase}:${linkedCellItemId}`;
}

export function riskTreatmentLabel(
  kind: RosRiskTreatmentKind | undefined,
): string | null {
  if (!kind) return null;
  const row = ROS_RISK_TREATMENT_OPTIONS.find((o) => o.value === kind);
  return row?.label ?? kind;
}
