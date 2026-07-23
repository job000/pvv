import type { AssessmentPayload } from "./assessment-types";
import type { ProcessDesignDocumentPayload } from "./process-design-doc-types";

function clamp(text: string | undefined | null, max: number): string | undefined {
  const t = text?.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

/** Lean PDD-start fra vurdering / inntak (server + tester — uten klient-autofill). */
export function buildSeedPddPayload(args: {
  assessmentTitle: string;
  payload?: AssessmentPayload | null;
  intakeRosSummary?: string | null;
  intakeSubmitter?: { name?: string; email?: string } | null;
  rosTitle?: string | null;
}): ProcessDesignDocumentPayload {
  const p = args.payload ?? undefined;
  const processTitle =
    clamp(p?.processName, 400) || clamp(args.assessmentTitle, 400) || "Prosess";

  const execParts: string[] = [
    `Prosess: ${processTitle}. Vurdering: ${args.assessmentTitle}.`,
  ];
  if (p?.processDescription?.trim()) {
    execParts.push(`Kontekst: ${p.processDescription.trim()}`);
  }
  if (p?.processGoal?.trim()) {
    execParts.push(`Forretningsmål: ${p.processGoal.trim()}`);
  }
  if (args.intakeRosSummary?.trim()) {
    execParts.push(`ROS-forslag fra inntak: ${args.intakeRosSummary.trim()}`);
  }

  const keyContacts: NonNullable<ProcessDesignDocumentPayload["keyContacts"]> =
    [];
  if (p?.rpaLifecycleContact?.trim()) {
    keyContacts.push({
      role: "Kontakt livssyklus / oppdrag",
      name: p.rpaLifecycleContact.trim().slice(0, 200),
      contact: "",
      notes: "Fra PVV-vurdering",
    });
  }
  if (p?.processActors?.trim()) {
    keyContacts.push({
      role: "Roller i prosessen",
      name: "Se beskrivelse",
      contact: "",
      notes: p.processActors.trim().slice(0, 2000),
    });
  }
  if (args.intakeSubmitter?.name?.trim()) {
    keyContacts.push({
      role: "Innsender av behov / skjema",
      name: args.intakeSubmitter.name.trim().slice(0, 200),
      contact: args.intakeSubmitter.email?.trim().slice(0, 400) ?? "",
      notes: "Fra inntak",
    });
  }

  const systems = (p?.processSystems ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

  const objectivesLines = [
    ...(p?.processGoal?.trim() ? [`• ${p.processGoal.trim()}`] : []),
    "• Redusere manuell behandlingstid og tastefeil",
    "• Tydelig logging og sporbarhet i driftsmiljø",
  ];

  return {
    processTitle,
    shortDescription: clamp(p?.processDescription, 2000),
    executiveSummary: clamp(execParts.join("\n\n"), 8000),
    purpose:
      "Dette dokumentet beskriver nåsituasjon (As-Is), målbilde etter automatisering (To-Be), " +
      "omfang, unntak og feilhåndtering for RPA-leveransen. Utfylles videre i PDD.",
    objectives: objectivesLines.join("\n"),
    keyContacts: keyContacts.length > 0 ? keyContacts : undefined,
    asIsProcessName: processTitle,
    asIsShortDescription: clamp(p?.processDescription, 4000),
    asIsRoles: clamp(p?.processActors, 4000),
    asIsApplications:
      systems.length > 0
        ? systems.map((name) => ({ name, comments: "Fra PVV-vurdering" }))
        : undefined,
    inScope: clamp(
      [
        p?.processDescription?.trim(),
        p?.processSystems?.trim()
          ? `Systemer: ${p.processSystems.trim()}`
          : null,
        args.rosTitle?.trim() ? `Koblet ROS: ${args.rosTitle.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
      8000,
    ),
    prerequisites: clamp(
      "Fullfør ROS og tilgangsarbeid før utvikling starter. Verifiser kontaktpersoner og systemtilgang.",
      2000,
    ),
  };
}
