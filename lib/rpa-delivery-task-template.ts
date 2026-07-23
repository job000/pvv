export type RpaDeliveryContext = {
  assessmentTitle: string;
  developerName: string | null;
  coDeveloperName: string | null;
  processSystems: string | null;
  processActors: string | null;
  processGoal: string | null;
  processDescription: string | null;
  intakeFormTitle: string | null;
  intakeSubmitter: string | null;
  intakeRosSummary: string | null;
  intakeRiskLines: string[];
  intakePersonData: boolean;
  intakePvvFlags: string[];
  rosTitle: string | null;
  rosStatus: string | null;
  pddExists: boolean;
  pddProcessTitle: string | null;
  applicationNames: string[];
};

function checkbox(done: boolean, text: string): string {
  return `- [${done ? "x" : " "}] ${text}`;
}

function section(title: string, body: string): string {
  return `### ${title}\n\n${body.trim()}\n`;
}

/** Bygg markdown-beskrivelse + sjekkliste for leveransekort. */
export function buildRpaDeliveryDescription(ctx: RpaDeliveryContext): string {
  const peopleLines = [
    ctx.developerName
      ? `- **Utvikler:** ${ctx.developerName}`
      : "- **Utvikler:** _(ikke tildelt — sett Utførende på prosessen)_",
    ctx.coDeveloperName
      ? `- **Coutvikler:** ${ctx.coDeveloperName}`
      : "- **Coutvikler:** _(valgfritt)_",
  ].join("\n");

  const contextBits: string[] = [];
  if (ctx.processGoal?.trim()) {
    contextBits.push(`**Mål:** ${ctx.processGoal.trim()}`);
  }
  if (ctx.processDescription?.trim()) {
    contextBits.push(`**Beskrivelse:** ${ctx.processDescription.trim()}`);
  }
  if (ctx.processActors?.trim()) {
    contextBits.push(`**Aktører:** ${ctx.processActors.trim()}`);
  }
  if (ctx.processSystems?.trim()) {
    contextBits.push(`**Systemer (fra vurdering):** ${ctx.processSystems.trim()}`);
  }
  if (ctx.applicationNames.length > 0) {
    contextBits.push(
      `**Applikasjoner (PDD/register):** ${ctx.applicationNames.join(", ")}`,
    );
  }

  const intakeBits: string[] = [];
  if (ctx.intakeFormTitle) {
    intakeBits.push(`Skjema: «${ctx.intakeFormTitle}»`);
    if (ctx.intakeSubmitter) {
      intakeBits.push(`Innsender: ${ctx.intakeSubmitter}`);
    }
    if (ctx.intakePersonData) {
      intakeBits.push("Personopplysninger signalisert i innsending.");
    }
    if (ctx.intakePvvFlags.length > 0) {
      intakeBits.push(`PVV-flagg: ${ctx.intakePvvFlags.join(", ")}`);
    }
    if (ctx.intakeRosSummary?.trim()) {
      intakeBits.push(`ROS-forslag: ${ctx.intakeRosSummary.trim()}`);
    }
    if (ctx.intakeRiskLines.length > 0) {
      intakeBits.push(
        "Foreslåtte risikoer:\n" +
          ctx.intakeRiskLines.map((r) => `  - ${r}`).join("\n"),
      );
    }
  } else {
    intakeBits.push("Ingen godkjent innsending koblet — fyll ROS/PDD manuelt.");
  }

  const rosLine = ctx.rosTitle
    ? `Eksisterende ROS: «${ctx.rosTitle}»${ctx.rosStatus ? ` (${ctx.rosStatus})` : ""}`
    : "Ingen ROS-analyse koblet ennå.";
  const pddLine = ctx.pddExists
    ? `PDD finnes${ctx.pddProcessTitle ? `: «${ctx.pddProcessTitle}»` : ""}.`
    : "PDD (prosessdesign) mangler — opprett As-Is / To-Be.";

  const accessItems =
    ctx.applicationNames.length > 0
      ? ctx.applicationNames
          .map((name) => checkbox(false, `Tilgang/testbruker for «${name}»`))
          .join("\n")
      : [
          checkbox(false, "Kartlegg systemer som roboten trenger"),
          checkbox(false, "Bestill/test tilganger (prod + testmiljø)"),
        ].join("\n");

  const checklist = [
    checkbox(Boolean(ctx.rosTitle), "ROS gjennomført og godkjent"),
    checkbox(ctx.pddExists, "PDD (As-Is / To-Be) ferdigstilt"),
    checkbox(false, "Tilganger til alle nødvendige applikasjoner på plass"),
    checkbox(false, "Utviklingsmiljø / orkestrator klart"),
    checkbox(false, "Utvikling av robot / automasjon"),
    checkbox(false, "Enhetstest / egenkontroll"),
    checkbox(false, "UAT med prosess-eier"),
    checkbox(false, "Prodsetting og overlevering til drift"),
    checkbox(false, "Dokumentasjon og kjøringsinstruks oppdatert"),
    checkbox(false, "Overvåkning / feilhåndtering avtalt"),
  ].join("\n");

  return [
    section(
      "Leveranse — auto-opprettet",
      `Vurderingen **${ctx.assessmentTitle}** er prioritert for leveranse. Start med ROS, PDD og tilganger før utvikling — dette kortet samler det som må på plass utenom ren koding.`,
    ),
    section("Team", peopleLines),
    contextBits.length > 0
      ? section("Fra vurdering", contextBits.join("\n\n"))
      : "",
    section("Fra innsendt skjema", intakeBits.join("\n")),
    section("ROS & PDD", `${rosLine}\n\n${pddLine}`),
    section("Tilganger", accessItems),
    section("Sjekkliste", checklist),
    section(
      "Fokus for utvikler",
      "Prioriter utvikling, testing, prodsetting og drift. Bruk delkortene under for ROS, PDD og tilganger — huk av sjekklisten etter hvert.",
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRpaDeliverySubtaskDescription(
  kind: "ros" | "pdd" | "tilganger" | "utvikling" | "prodsetting",
  ctx: RpaDeliveryContext,
): string {
  switch (kind) {
    case "ros":
      return [
        ctx.intakeRosSummary
          ? `**Fra skjema:** ${ctx.intakeRosSummary}`
          : "Ingen ROS-forslag fra skjema.",
        ctx.intakeRiskLines.length > 0
          ? "Risikoer:\n" +
            ctx.intakeRiskLines.map((r) => `- ${r}`).join("\n")
          : "",
        "",
        checkbox(Boolean(ctx.rosTitle), "ROS-analyse opprettet/koblet"),
        checkbox(false, "Risikoer vurdert før/etter tiltak"),
        checkbox(false, "ROS godkjent / markert ferdig"),
        ctx.intakePersonData
          ? checkbox(
              false,
              "Personvern (PVV) avklart — persondata i innsending",
            )
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    case "pdd":
      return [
        ctx.pddExists
          ? `PDD finnes${ctx.pddProcessTitle ? ` («${ctx.pddProcessTitle}»)` : ""}. Fullfør As-Is/To-Be.`
          : "Opprett prosessdesign (PDD) fra vurderingen.",
        "",
        checkbox(ctx.pddExists, "PDD-dokument opprettet"),
        checkbox(false, "As-Is beskrevet (tekst og/eller diagram)"),
        checkbox(false, "To-Be / ønsket flyt beskrevet"),
        checkbox(false, "Unntak, regler og applikasjoner dokumentert"),
      ].join("\n");
    case "tilganger":
      return [
        "Bestill og verifiser tilganger før utviklingsstart.",
        "",
        ctx.applicationNames.length > 0
          ? ctx.applicationNames
              .map((n) => checkbox(false, `«${n}» — tilgang + testkonto`))
              .join("\n")
          : checkbox(false, "List systemer og bestill tilganger"),
        checkbox(false, "VPN / orkestrator / filområder ved behov"),
        checkbox(false, "Bekreft at tilganger fungerer i test"),
      ].join("\n");
    case "utvikling":
      return [
        checkbox(false, "Robot/automatisering utviklet iht. PDD"),
        checkbox(false, "Logging og feilhåndtering"),
        checkbox(false, "Egen test gjennomført"),
        checkbox(false, "Kode/config i versjonskontroll"),
      ].join("\n");
    case "prodsetting":
      return [
        checkbox(false, "UAT godkjent av prosess-eier"),
        checkbox(false, "Produksjonssetting"),
        checkbox(false, "Driftsoverlevering / runbook"),
        checkbox(false, "Overvåkning og varsling aktiv"),
      ].join("\n");
  }
}
