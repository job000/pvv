"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  clampProcessText,
  PROCESS_TEXT_FIELD_MAX,
} from "@/lib/assessment-process-profile";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRightCircle,
  BarChart3,
  FileText,
  Info,
  Network,
  Target,
  Users,
  Workflow,
} from "lucide-react";

const SECTIONS: Array<{
  key: keyof Pick<
    AssessmentPayload,
    | "processDescription"
    | "processGoal"
    | "processFlowSummary"
    | "processActors"
    | "processSystems"
    | "processVolumeNotes"
    | "processConstraints"
    | "processFollowUp"
  >;
  title: string;
  /** Hva feltet er ment til (én setning) */
  what: string;
  /** Veiledning til utfylling */
  hint: string;
  /** Eksempel i plassholder — viser at tekst (og tall i tekst) er OK */
  placeholder: string;
  icon: typeof FileText;
  rows: number;
  wide?: boolean;
  /** Ekstra tydeliggjøring der brukere ofte tror det er «tallfelt» */
  numberClarification?: string;
}> = [
  {
    key: "processDescription",
    title: "Helhetlig beskrivelse",
    what: "Samlet fortelling om dagens prosess og problemet dere vil løse.",
    hint: "Skriv fritt. Her bygger du historien som andre kan lese senere.",
    placeholder:
      "F.eks. «Saksbehandler henter journalnotat fra A og registrerer i B manuelt. Tar 20–40 min per sak, avhengig av kompleksitet …»",
    icon: FileText,
    rows: 5,
    wide: true,
  },
  {
    key: "processGoal",
    title: "Mål og verdi",
    what: "Hvorfor automatisere — effekt, risiko eller kvalitet.",
    hint: "Ord og korte setninger. Ikke poeng eller prosenter her; det kommer i andre steg.",
    placeholder:
      "F.eks. «Redusere feilregistrering», «Frigjøre tid til pasientnær tid» …",
    icon: Target,
    rows: 3,
  },
  {
    key: "processFlowSummary",
    title: "Flyt og hovedtrinn",
    what: "Rekkefølgen ting skjer i — ikke detaljert BPMN, men nok til oversikt.",
    hint: "Liste eller korte avsnitt. Du kan bruke tall for rekkefølge (1. 2. 3.).",
    placeholder:
      "1) Hendelse / trigger\n2) Hvem gjør hva\n3) Avsluttende steg / arkiv …",
    icon: Workflow,
    rows: 4,
  },
  {
    key: "processActors",
    title: "Roller og ansvar",
    what: "Mennesker og roller — ikke systemkontoer.",
    hint: "Navn på rolle er nok (f.eks. «saksbehandler», «leder»).",
    placeholder:
      "F.eks. «Utfører: saksbehandler. Godkjenner: seksjonsleder. Ekstern: leverandør X ved avvik …»",
    icon: Users,
    rows: 3,
  },
  {
    key: "processSystems",
    title: "Systemer og data",
    what: "Hvilke verktøy og dataflyt som er involvert.",
    hint: "Fritekst. Ingen teknisk validering her — beskriv som til et møtereferat.",
    placeholder:
      "F.eks. «EPJ, Outlook, Excel på filserver, integrasjon mot register Z …»",
    icon: Network,
    rows: 3,
  },
  {
    key: "processVolumeNotes",
    title: "Volum og mønster",
    what: "Omtrentlig omfang — beskrevet i ord (tall kan stå i teksten).",
    hint: "Dette er ikke et regnefelt. Skriv f.eks. «ca. 200 saker/måned», «topp i januar».",
    placeholder:
      "F.eks. «Omtrent 150–200 saker per måned, økning i Q4. Typisk 2–5 dager saksbehandling …»",
    icon: BarChart3,
    rows: 3,
    numberClarification:
      "Her skriver du tall som del av en setning (beskrivende tekst), ikke i et eget «bare tall»-felt. Timer, kostnader og ansatte som styrer beregning fyller du i steget «KPI» senere.",
  },
  {
    key: "processConstraints",
    title: "Begrensninger og risiko",
    what: "Det som kan stoppe eller forsinke automatisering.",
    hint: "Lov, avtaler, teknisk gjeld, politikk — fritekst.",
    placeholder:
      "F.eks. «Må vente på avklaring fra X», «Krever manuell signatur per lov …»",
    icon: AlertTriangle,
    rows: 3,
  },
  {
    key: "processFollowUp",
    title: "Videre og oppfølging",
    what: "Notat til neste møte, pilot eller revisjon av vurderingen.",
    hint: "Hva skjer etter denne gjennomgangen? Hvem følger opp?",
    placeholder:
      "F.eks. «Avklare integrasjon mot … i workshop uke 12. Re-evaluere etter pilot …»",
    icon: ArrowRightCircle,
    rows: 3,
  },
];

export function ProcessProfileSection({
  payload,
  canEdit,
  update,
}: {
  payload: AssessmentPayload;
  canEdit: boolean;
  update: <K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <Alert className="border-primary/25 bg-primary/[0.06]">
        <Info className="size-4 text-primary" aria-hidden />
        <AlertTitle className="text-foreground">
          Alle felt under er <strong>tekst</strong> — ikke egne tallfelt
        </AlertTitle>
        <AlertDescription className="space-y-2 text-pretty">
          <p>
            Her dokumenterer du prosessen i <strong>egne ord</strong>. Der det
            passer, kan du <strong>skrive tall inne i teksten</strong> (som «ca.
            200 i måneden») — feltet godtar ikke et eget «bare tall»-format fordi
            vi vil ha <strong>kontekst</strong>, ikke bare tall uten enhet.
          </p>
          <p>
            De <strong>strukturerte tallene</strong> (timer, kostnader, ansatte
            m.m.) og <strong>Likert-vurderingene</strong> (1–5) fyller du på de
            andre stegene i veiviseren — derfra kommer poengberegning og KPI.
          </p>
          <p className="text-muted-foreground text-xs">
            Maks {PROCESS_TEXT_FIELD_MAX.toLocaleString("nb-NO")} tegn per felt.
            Innholdet valideres og klippes ved lagring om du skulle lime inn for
            mye.
          </p>
        </AlertDescription>
      </Alert>

      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-muted/40 p-5 shadow-sm">
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <p className="text-primary font-medium text-xs uppercase tracking-wide">
            Prosessprofil
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold tracking-tight">
            Dokumentasjon — ikke scoring
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Hvert kort har en kort forklaring på <strong>hva</strong> feltet er,
            og <strong>hvordan</strong> du kan fylle det ut. Alt lagres som
            tekst og påvirker ikke den automatiske poengsummen.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map(
          ({
            key,
            title,
            what,
            hint,
            placeholder,
            icon: Icon,
            rows,
            wide,
            numberClarification,
          }) => {
            const raw = (payload[key] as string | undefined) ?? "";
            const value = raw;
            const len = value.length;
            const atMax = len >= PROCESS_TEXT_FIELD_MAX;
            const hintId = `hint-${String(key)}`;
            const countId = `count-${String(key)}`;

            return (
              <div
                key={key}
                className={cn(
                  "group rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm transition-[box-shadow] duration-200 hover:shadow-md",
                  wide && "md:col-span-2",
                )}
              >
                <div className="mb-3 flex flex-wrap items-start gap-2">
                  <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-sm font-semibold leading-snug">
                        {title}
                      </h3>
                      <Badge variant="secondary" className="font-normal text-[10px]">
                        Tekstfelt
                      </Badge>
                    </div>
                    <p className="text-foreground text-xs font-medium leading-snug">
                      {what}
                    </p>
                    <p
                      id={hintId}
                      className="text-muted-foreground text-xs leading-relaxed"
                    >
                      {hint}
                    </p>
                    {numberClarification ? (
                      <p className="text-muted-foreground border-border/60 mt-2 rounded-lg border border-dashed bg-muted/30 px-2.5 py-2 text-xs leading-relaxed">
                        {numberClarification}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Textarea
                  id={`process-${String(key)}`}
                  value={value}
                  onChange={(e) => {
                    const next = clampProcessText(e.target.value);
                    update(key, next);
                  }}
                  disabled={!canEdit}
                  rows={rows}
                  maxLength={PROCESS_TEXT_FIELD_MAX}
                  aria-describedby={`${hintId} ${countId}`}
                  className={cn(
                    "min-h-0 resize-y border-border/80 bg-background/80 text-sm transition-colors focus-visible:border-primary/40",
                    atMax && "border-amber-500/50",
                  )}
                  placeholder={placeholder}
                />
                <p
                  id={countId}
                  className={cn(
                    "mt-1.5 text-right text-[11px] tabular-nums",
                    atMax ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground",
                  )}
                  aria-live="polite"
                >
                  {len.toLocaleString("nb-NO")} /{" "}
                  {PROCESS_TEXT_FIELD_MAX.toLocaleString("nb-NO")} tegn
                  {atMax ? " (maks nådd)" : ""}
                </p>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
