"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  clampProcessText,
  PROCESS_TEXT_FIELD_MAX,
} from "@/lib/assessment-process-profile";
import { OPERATIONS_SUPPORT_LEVEL_LABELS } from "@/lib/helsesector-labels";
import { cn } from "@/lib/utils";
import {
  Building2,
  Coins,
  HeartPulse,
  Info,
  LifeBuoy,
  Shield,
  Siren,
} from "lucide-react";

const BLOCKS: Array<{
  key: keyof Pick<
    AssessmentPayload,
    | "hfSecurityInformationNotes"
    | "hfOrganizationalBreadthNotes"
    | "hfEconomicRationaleNotes"
    | "hfCriticalManualGapNotes"
    | "hfOperationsSupportNotes"
  >;
  title: string;
  lead: string;
  hint: string;
  placeholder: string;
  icon: typeof Shield;
}> = [
  {
    key: "hfSecurityInformationNotes",
    title: "Sikkerhet og tilstrekkelig informasjon",
    lead:
      "Hvordan ivaretar dere krav til tilgang, logging, personvern og dokumentasjon?",
    hint:
      "Tenk på hvem som skal se hva, sporbarhet, avvik og avtaler — i ord alle forstår.",
    placeholder:
      "F.eks. «Kun autorisert helsepersonell. Innlogging mot felles katalog. Hendelser logges i … Ingen sensitiv e-post ut av institusjonen …»",
    icon: Shield,
  },
  {
    key: "hfOrganizationalBreadthNotes",
    title: "Bredde og samordning",
    lead:
      "Hvor strekker prosessen seg — helseforetak, avdelinger, eksterne, flere lokasjoner?",
    hint:
      "Jo tydeligere dere beskriver omfang og koordinering, jo lettere er det å planlegge ressurs og eierskap.",
    placeholder:
      "F.eks. «Berører to avdelinger og felles IKT. Avhengig av avtale med ekstern lab …»",
    icon: Building2,
  },
  {
    key: "hfEconomicRationaleNotes",
    title: "Besparelse og økonomisk gevinst",
    lead:
      "Hvorfor lønner det seg — tid, kvalitet, risiko, pasientsikkerhet eller økonomi?",
    hint:
      "Koble gjerne til tall fra steget «Tall og kost», men forklar også i ord hva som er viktigst for beslutning.",
    placeholder:
      "F.eks. «Mindre manuell omskriving gir færre feil og frigjør årsverk til annet arbeid. Kritisk ved saksbunker …»",
    icon: Coins,
  },
  {
    key: "hfCriticalManualGapNotes",
    title: "Kritisk: det som ikke gjøres i dag",
    lead:
      "Hva faller mellom stoler i dag — slik at automatisering blir nødvendig, ikke bare «nice to have»?",
    hint:
      "Beskriv gapet konkret: hvem rammes, hva skjer ved forsinkelse, og hvorfor må robot eller regler ta over.",
    placeholder:
      "F.eks. «Manuell overføring mellom system X og Y skjer ikke i helgene — pasientlister oppdateres sent …»",
    icon: Siren,
  },
  {
    key: "hfOperationsSupportNotes",
    title: "Utvikling og drift — hva kreves?",
    lead:
      "Forventning til vedlikehold, henvendelseslinje, avtaler (SLA), beredskap og samarbeid med IKT.",
    hint:
      "Velg tjenestenivå over — bruk feltet her til konkrete avklaringer (hvem kontaktes når, responstid, vinduer).",
    placeholder:
      "F.eks. «Feil i produksjon: henvendelse til IKT 1. linje innen arbeidstid. Endringer koordineres med …»",
    icon: LifeBuoy,
  },
];

export function HfRequirementsSection({
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
  const level = payload.hfOperationsSupportLevel ?? "unsure";

  return (
    <div className="space-y-5">
      <Alert className="border-emerald-500/25 bg-emerald-500/[0.06]">
        <HeartPulse className="size-4 text-emerald-700 dark:text-emerald-400" />
        <AlertTitle className="text-foreground">
          Krav og forventninger i helseforetak og tilsvarende virksomhet
        </AlertTitle>
        <AlertDescription className="space-y-2 text-pretty text-sm leading-relaxed">
          <p>
            Her dokumenterer dere det styrende dokumentasjon og god praksis
            forventer: <strong>sikkerhet</strong>, <strong>tydelig nok
            informasjon</strong>, <strong>organisasjonsbredde</strong>,{" "}
            <strong>økonomisk begrunnelse</strong>, og hva som er{" "}
            <strong>så kritisk at det ikke kan fortsette manuelt</strong>. Alt
            er <strong>tekst i vanlig språk</strong> — til arkiv, ROS/PDD og
            videre samtale med IKT og drift.
          </p>
          <p className="text-muted-foreground text-xs">
            Fyll ut det dere kan nå; uferdig er bedre enn ingenting. Felt påvirker
            ikke den automatiske poengsummen (Likert og KPI).
          </p>
        </AlertDescription>
      </Alert>

      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-card to-muted/30 p-5 shadow-sm">
        <div
          className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative space-y-3">
          <p className="text-emerald-800 dark:text-emerald-300 font-medium text-xs uppercase tracking-wide">
            Drift og videre utvikling
          </p>
          <h3 className="font-heading text-lg font-semibold tracking-tight">
            Tjenestenivå (1., 2. og 3. linje)
          </h3>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Velg det som best beskriver hvor henvendelser og feilretting forventes
            løst. Dette er et enkelt kart — ikke en formell SLA-erklæring.
          </p>
          <div className="space-y-2">
            <Label htmlFor="hf-ops-level" className="text-sm font-medium">
              Forventet nivå
            </Label>
            <select
              id="hf-ops-level"
              className="border-input bg-background flex h-10 w-full max-w-xl rounded-lg border px-3 text-sm shadow-xs"
              value={level}
              disabled={!canEdit}
              onChange={(e) =>
                update(
                  "hfOperationsSupportLevel",
                  e.target.value as AssessmentPayload["hfOperationsSupportLevel"],
                )
              }
            >
              {(Object.keys(OPERATIONS_SUPPORT_LEVEL_LABELS) as Array<
                keyof typeof OPERATIONS_SUPPORT_LEVEL_LABELS
              >).map((k) => (
                <option key={k} value={k}>
                  {OPERATIONS_SUPPORT_LEVEL_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <Alert className="mt-2 border-border/60 bg-muted/30">
            <Info className="size-4" />
            <AlertTitle className="text-foreground text-sm">
              Kort forklart
            </AlertTitle>
            <AlertDescription className="text-muted-foreground space-y-1.5 text-xs leading-relaxed">
              <p>
                <strong>1. linje</strong> er ofte første kontakt for brukere og
                enkle feil. <strong>2. linje</strong> tar mer komplekse saker internt.
                <strong> 3. linje</strong> er typisk leverandør eller dyp teknisk
                ekspertise.
              </p>
              <p>
                Mange løsninger trenger <strong>blandet</strong> nivå — f.eks. 1.
                linje for brukere og 3. linje for leverandør ved kodefeil.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {BLOCKS.map(
          ({ key, title, lead, hint, placeholder, icon: Icon }) => {
            const raw = (payload[key] as string | undefined) ?? "";
            const len = raw.length;
            const atMax = len >= PROCESS_TEXT_FIELD_MAX;
            const hintId = `hf-hint-${key}`;
            const countId = `hf-count-${key}`;

            return (
              <div
                key={key}
                className={cn(
                  "rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm transition-[box-shadow] hover:shadow-md",
                  key === "hfSecurityInformationNotes" && "md:col-span-2",
                  key === "hfCriticalManualGapNotes" && "md:col-span-2",
                )}
              >
                <div className="mb-3 flex flex-wrap items-start gap-2">
                  <span className="bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-sm font-semibold leading-snug">
                        {title}
                      </h3>
                      <Badge variant="outline" className="font-normal text-[10px]">
                        Valgfritt tekstfelt
                      </Badge>
                    </div>
                    <p className="text-foreground text-xs font-medium leading-snug">
                      {lead}
                    </p>
                    <p
                      id={hintId}
                      className="text-muted-foreground text-xs leading-relaxed"
                    >
                      {hint}
                    </p>
                  </div>
                </div>
                <Textarea
                  id={`hf-${key}`}
                  value={raw}
                  onChange={(e) => {
                    const next = clampProcessText(e.target.value);
                    update(key, next);
                  }}
                  disabled={!canEdit}
                  rows={key === "hfCriticalManualGapNotes" ? 5 : 4}
                  maxLength={PROCESS_TEXT_FIELD_MAX}
                  aria-describedby={`${hintId} ${countId}`}
                  className={cn(
                    "min-h-0 resize-y border-border/80 bg-background/80 text-sm",
                    atMax && "border-amber-500/50",
                  )}
                  placeholder={placeholder}
                />
                <p
                  id={countId}
                  className={cn(
                    "mt-1.5 text-right text-[11px] tabular-nums",
                    atMax
                      ? "font-medium text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground",
                  )}
                >
                  {len.toLocaleString("nb-NO")} /{" "}
                  {PROCESS_TEXT_FIELD_MAX.toLocaleString("nb-NO")} tegn
                </p>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
