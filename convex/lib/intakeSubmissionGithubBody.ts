import type { IntakeAnswer } from "../schema";

type SubmitterMeta = { name?: string; email?: string };

function formatAnswerMarkdown(answer: IntakeAnswer | undefined): string {
  if (!answer) {
    return "_Ikke besvart_";
  }
  switch (answer.kind) {
    case "text":
      return answer.value.trim() || "_Tomt svar_";
    case "number":
      return String(answer.value);
    case "multiple_choice":
      return answer.label.trim() || answer.optionId;
    case "scale":
      return String(answer.value);
    case "yes_no":
      return answer.value ? "Ja" : "Nei";
  }
}

export function defaultIntakeSubmissionIssueTitle(
  formTitle: string,
  submitterMeta: SubmitterMeta,
  /** Tittel fra innsendt skjema (auto-generert vurderingsutkast) — brukes i GitHub-issue når den finnes */
  submissionDraftTitle?: string,
): string {
  const who =
    submitterMeta.name?.trim() ||
    submitterMeta.email?.trim() ||
    "Ukjent innsender";
  const draft = submissionDraftTitle?.trim();
  if (draft && draft.length > 0) {
    return `[Skjemaforslag] ${draft} — ${who}`.slice(0, 256);
  }
  const title = `[Skjemaforslag] ${formTitle.trim() || "Skjema"} — ${who}`;
  return title.slice(0, 256);
}

export function buildIntakeSubmissionIssueBodyMarkdown(args: {
  workspaceId: string;
  formTitle: string;
  submittedAt: number;
  submitterMeta: SubmitterMeta;
  questions: Array<{ _id: string; label: string }>;
  answers: IntakeAnswer[];
  draftTitle: string;
  draftProcessName: string;
  draftProcessDescription: string;
  draftProcessGoal: string;
}): string {
  const lines: string[] = [];
  const submitted = new Date(args.submittedAt).toISOString();
  lines.push("## Oppsummering");
  lines.push("");
  lines.push(`- **Skjema:** ${args.formTitle.trim() || "Skjema"}`);
  lines.push(`- **Innsendt (UTC):** ${submitted}`);
  lines.push(`- **PVV-arbeidsområde-ID:** \`${args.workspaceId}\``);
  lines.push("");
  lines.push("## Innsender");
  lines.push("");
  const name = args.submitterMeta.name?.trim();
  const email = args.submitterMeta.email?.trim();
  if (name) {
    lines.push(`- **Navn:** ${name}`);
  }
  if (email) {
    lines.push(`- **E-post:** ${email}`);
  }
  if (!name && !email) {
    lines.push("_Ingen navn eller e-post oppgitt (anonym eller valgfritt felt)._");
  }
  lines.push("");
  lines.push("## Svar fra skjemaet");
  lines.push("");
  const answerByQ = new Map(args.answers.map((a) => [a.questionId, a]));
  for (const q of args.questions) {
    const label = q.label.trim() || "Spørsmål";
    lines.push(`### ${label}`);
    lines.push("");
    lines.push(formatAnswerMarkdown(answerByQ.get(q._id)));
    lines.push("");
  }
  lines.push("## Auto-generert vurderingsutkast (fra PVV)");
  lines.push("");
  lines.push(`**Tittel:** ${args.draftTitle.trim() || "—"}`);
  lines.push("");
  lines.push("**Prosessnavn:**");
  lines.push(args.draftProcessName.trim() || "_—_");
  lines.push("");
  lines.push("**Beskrivelse:**");
  lines.push(args.draftProcessDescription.trim() || "_—_");
  lines.push("");
  lines.push("**Mål / automatisering:**");
  lines.push(args.draftProcessGoal.trim() || "_—_");
  lines.push("");
  lines.push(
    "_Issue opprettet manuelt fra skjemagjennomgang i PVV — ikke automatisk._",
  );
  return lines.join("\n");
}
