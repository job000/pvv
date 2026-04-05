/**
 * Felles sikkerhetsregler for offentlige inntakslenker (/f/[token]).
 * Token er hemmeligheten; Next tillater ruten uten innlogging, men Convex må
 * avvise ugyldig format, store nyttelaster og rask gjentakelse (rate limit).
 */

/** 24 byte fra crypto → 48 hex-tegn (samme som randomToken() i intakeLinks). */
export const PUBLIC_INTAKE_TOKEN_HEX_LENGTH = 48;

const TOKEN_HEX = /^[a-f0-9]+$/;

/** Maks innsendinger per lenke per minutt (mot spam/DoS). */
export const PUBLIC_INTAKE_SUBMITS_PER_LINK_PER_MINUTE = 30;

export const MAX_PUBLIC_INTAKE_ANSWERS = 120;
export const MAX_PUBLIC_TEXT_ANSWER_CHARS = 20_000;
export const MAX_PUBLIC_CHOICE_OPTION_ID_CHARS = 256;
export const MAX_PUBLIC_CHOICE_LABEL_CHARS = 2_000;
export const MAX_PUBLIC_SUBMITTER_NAME_CHARS = 200;
export const MAX_PUBLIC_SUBMITTER_EMAIL_CHARS = 320;
export const MAX_PUBLIC_QUESTION_ID_CHARS = 64;

/**
 * Returnerer normalisert token eller null hvis formatet ikke kan være gyldig.
 * Avviser feil lengde, ikke-hex og path traversal-forsøk uten å lekke detaljer.
 */
export function parsePublicIntakeToken(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (
    t.length !== PUBLIC_INTAKE_TOKEN_HEX_LENGTH ||
    !TOKEN_HEX.test(t)
  ) {
    return null;
  }
  return t;
}

type SubmitterMeta = { name?: string; email?: string };

/**
 * Validerer størrelsesgrenser på rå inndata før dyr logikk.
 * Kastes med generiske feilmeldinger (norsk).
 */
export function assertPublicIntakePayloadBounds(args: {
  submitterMeta: SubmitterMeta;
  answers: Array<{
    questionId: string;
    kind: string;
    value?: unknown;
    optionId?: string;
    label?: string;
  }>;
}): void {
  if (args.answers.length > MAX_PUBLIC_INTAKE_ANSWERS) {
    throw new Error("For mange felt i innsendingen.");
  }
  const name = args.submitterMeta.name?.trim();
  if (name !== undefined && name.length > MAX_PUBLIC_SUBMITTER_NAME_CHARS) {
    throw new Error("Navnet er for langt.");
  }
  const email = args.submitterMeta.email?.trim();
  if (email !== undefined && email.length > MAX_PUBLIC_SUBMITTER_EMAIL_CHARS) {
    throw new Error("E-postadressen er for lang.");
  }
  for (const a of args.answers) {
    if (a.questionId.length > MAX_PUBLIC_QUESTION_ID_CHARS) {
      throw new Error("Ugyldig feltreferanse.");
    }
    if (a.kind === "text" && typeof a.value === "string") {
      if (a.value.length > MAX_PUBLIC_TEXT_ANSWER_CHARS) {
        throw new Error("Et tekstsvar er for langt.");
      }
    }
    if (a.kind === "multiple_choice") {
      const oid = a.optionId ?? "";
      const lab = a.label ?? "";
      if (oid.length > MAX_PUBLIC_CHOICE_OPTION_ID_CHARS) {
        throw new Error("Ugyldig svaralternativ.");
      }
      if (lab.length > MAX_PUBLIC_CHOICE_LABEL_CHARS) {
        throw new Error("For lang etikett på svaralternativ.");
      }
    }
  }
}
