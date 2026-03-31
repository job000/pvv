"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  value: string;
  title: string;
  lead: string;
  hint: string;
  placeholder: string;
  icon: typeof Shield;
}> = [
  {
    key: "hfSecurityInformationNotes",
    value: "security",
    title: "Sikkerhet og tilstrekkelig informasjon",
    lead:
      "Hvordan ivaretar dere krav til tilgang, logging, personvern og dokumentasjon?",
    hint:
      "Tenk på hvem som skal se hva, sporbarhet, avvik og avtaler — i ord alle forstår.",
    placeholder:
      "F.eks. «Kun autorisert helsepersonell. Innlogging mot felles katalog. Hendelser logges i …»",
    icon: Shield,
  },
  {
    key: "hfOrganizationalBreadthNotes",
    value: "breadth",
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
    value: "economy",
    title: "Besparelse og økonomisk gevinst",
    lead:
      "Hvorfor lønner det seg — tid, kvalitet, risiko, pasientsikkerhet eller økonomi?",
    hint:
      "Koble gjerne til tall fra steget «Tall og kost», men forklar også i ord hva som er viktigst for beslutning.",
    placeholder:
      "F.eks. «Mindre manuell omskriving gir færre feil og frigjør årsverk …»",
    icon: Coins,
  },
  {
    key: "hfCriticalManualGapNotes",
    value: "gap",
    title: "Kritisk: det som ikke gjøres i dag",
    lead:
      "Hva faller mellom stoler i dag — slik at automatisering blir nødvendig, ikke bare «nice to have»?",
    hint:
      "Beskriv gapet konkret: hvem rammes, hva skjer ved forsinkelse, og hvorfor må dette løses.",
    placeholder:
      "F.eks. «Manuell overføring mellom system X og Y skjer ikke i helgene …»",
    icon: Siren,
  },
  {
    key: "hfOperationsSupportNotes",
    value: "ops-notes",
    title: "Utvikling og drift — detaljer",
    lead:
      "Konkrete avklaringer om vedlikehold, henvendelseslinje, SLA-vinduer og hvem som kontaktes når.",
    hint:
      "Tillegg til tjenestenivå-valget over — fritekst til møtereferat og avtaler.",
    placeholder:
      "F.eks. «Feil i produksjon: henvendelse til IKT 1. linje innen arbeidstid …»",
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <HeartPulse
          className="text-emerald-700 dark:text-emerald-400 mt-0.5 size-4 shrink-0"
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-foreground text-sm font-medium leading-snug">
            Krav og kontekst (helseforetak / tilsvarende)
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Tekst til arkiv og ROS/PDD —{" "}
            <strong className="text-foreground">påvirker ikke</strong>{" "}
            automatisk poengsum. Åpne bare det dere trenger å fylle ut.
          </p>
        </div>
      </div>

      <Accordion
        multiple
        defaultValue={["ops"]}
        className="border-border/70 rounded-xl border bg-card/40"
      >
        <AccordionItem value="ops" className="border-border/60 not-last:border-b px-3">
          <AccordionTrigger className="text-foreground py-3 text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <LifeBuoy className="text-emerald-700 dark:text-emerald-400 size-4 shrink-0" />
              Drift og tjenestenivå (1. / 2. / 3. linje)
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Velg det som best beskriver hvor henvendelser og feilretting
                forventes løst — enkel kartlegging, ikke formell SLA.
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
                      e.target
                        .value as AssessmentPayload["hfOperationsSupportLevel"],
                    )
                  }
                >
                  {(
                    Object.keys(
                      OPERATIONS_SUPPORT_LEVEL_LABELS,
                    ) as Array<keyof typeof OPERATIONS_SUPPORT_LEVEL_LABELS>
                  ).map((k) => (
                    <option key={k} value={k}>
                      {OPERATIONS_SUPPORT_LEVEL_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                <strong className="text-foreground">1. linje</strong> er ofte
                første kontakt. <strong className="text-foreground">
                  2. linje
                </strong>{" "}
                tar mer komplekse saker.{" "}
                <strong className="text-foreground">3. linje</strong> er
                typisk leverandør eller dyp teknisk ekspertise. Mange løsninger
                er <strong>blandet</strong>.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {BLOCKS.map(
          ({ key, value, title, lead, hint, placeholder, icon: Icon }) => {
            const raw = (payload[key] as string | undefined) ?? "";
            const len = raw.length;
            const atMax = len >= PROCESS_TEXT_FIELD_MAX;
            const hintId = `hf-hint-${key}`;
            const countId = `hf-count-${key}`;
            const filled = len > 0;

            return (
              <AccordionItem
                key={key}
                value={value}
                className="border-border/60 not-last:border-b px-3"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <span className="flex min-w-0 flex-1 items-start gap-2 text-left">
                    <span className="bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 space-y-0.5">
                      <span className="text-foreground flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {title}
                        {filled ? (
                          <Badge
                            variant="secondary"
                            className="font-normal text-[10px]"
                          >
                            Har innhold
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground block text-xs font-normal leading-snug">
                        {lead}
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-2 pl-0 sm:pl-10">
                    <p
                      id={hintId}
                      className="text-muted-foreground text-xs leading-relaxed"
                    >
                      {hint}
                    </p>
                    <Textarea
                      id={`hf-${key}`}
                      value={raw}
                      onChange={(e) => {
                        const next = clampProcessText(e.target.value);
                        update(key, next);
                      }}
                      disabled={!canEdit}
                      rows={key === "hfCriticalManualGapNotes" ? 4 : 3}
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
                        "text-right text-[11px] tabular-nums",
                        atMax
                          ? "font-medium text-amber-700 dark:text-amber-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {len.toLocaleString("nb-NO")} /{" "}
                      {PROCESS_TEXT_FIELD_MAX.toLocaleString("nb-NO")} tegn
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          },
        )}
      </Accordion>
    </div>
  );
}
