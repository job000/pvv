"use client";

import { HfRequirementsSection } from "@/components/assessment-wizard/hf-requirements-section";
import { ProcessProfileSection } from "@/components/assessment-wizard/process-profile-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { AssessmentPayload } from "@/lib/assessment-types";
import { cn } from "@/lib/utils";
import { Bot, Sparkles } from "lucide-react";
import { useStickyState } from "@/lib/use-sticky-state";

type Sub = "grunnlag" | "beskrivelse" | "krav";

const SUB_TABS: { id: Sub; label: string; hint: string }[] = [
  {
    id: "grunnlag",
    label: "Grunnlag",
    hint: "Navn, referanse, omfang",
  },
  {
    id: "beskrivelse",
    label: "Beskrivelse",
    hint: "Hva skjer i dag",
  },
  {
    id: "krav",
    label: "Krav",
    hint: "Helseforetak og drift",
  },
];

type Props = {
  payload: AssessmentPayload;
  canEdit: boolean;
  update: <K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) => void;
  candidates: Doc<"candidates">[] | undefined;
  candidatePickerKey: number;
  bumpCandidatePickerKey: () => void;
};

export function AssessmentProcessSlide({
  payload,
  canEdit,
  update,
  candidates,
  candidatePickerKey,
  bumpCandidatePickerKey,
}: Props) {
  const [sub, setSub] = useStickyState<Sub>("assessment-process:sub", "grunnlag");

  return (
    <div className="space-y-5">
      <details className="group border-border/60 bg-muted/20 hover:bg-muted/30 rounded-xl border px-3 py-2 transition-colors">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
          <Bot
            className="text-primary size-4 shrink-0"
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            RPA-vurdering: hva kartlegges (etter vanlig beste praksis — f.eks.
            UiPath)
          </span>
          <span className="text-muted-foreground group-open:hidden text-xs">
            Vis
          </span>
          <span className="text-muted-foreground hidden text-xs group-open:inline">
            Skjul
          </span>
        </summary>
        <div className="text-muted-foreground space-y-3 border-border/50 mt-3 border-t pt-3 text-sm leading-relaxed">
          <p className="text-foreground font-medium">
            Kjerne som typisk avgjør egnethet for automatisering:
          </p>
          <ul className="list-inside list-disc space-y-1.5 pl-0.5">
            <li>
              <strong className="text-foreground">Regelbasert og stabilt</strong>{" "}
              — få unntak, forutsigbare skjermbilder og rutiner
            </li>
            <li>
              <strong className="text-foreground">Volum og gjentakelse</strong>{" "}
              — nok transaksjoner til at gevinsten forsvinner kost
            </li>
            <li>
              <strong className="text-foreground">Data og systemer</strong> —{" "}
              strukturerte felt, få systemhopp, begrenset tynnklient/OCR-behov
            </li>
            <li>
              <strong className="text-foreground">Risiko og etterlevelse</strong>{" "}
              — personvern, dokumentasjon og konsekvens ved feil
            </li>
          </ul>
          <p>
            <Sparkles
              className="text-primary mr-1 inline size-3.5 align-text-bottom"
              aria-hidden
            />
            <strong className="text-foreground">I tillegg her:</strong> felter
            som ofte mangler i rene tekniske sjekklister — f.eks.{" "}
            <em>organisasjonsbredde</em>, <em>gap der manuelt arbeid skaper
            risiko</em>, forventning til <em>1./2./3. linje</em> og{" "}
            <em>økonomisk begrunnelse i språk alle forstår</em>. Det fyller du
            under fanen «Krav».
          </p>
        </div>
      </details>

      <div
        className="bg-muted/40 flex flex-wrap gap-1 rounded-xl p-1 ring-1 ring-border/60"
        role="tablist"
        aria-label="Del av prosess-steget"
      >
        {SUB_TABS.map((t) => {
          const active = sub === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`process-sub-${t.id}`}
              aria-controls={`process-panel-${t.id}`}
              onClick={() => setSub(t.id)}
              className={cn(
                "flex min-h-10 min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-lg px-2 py-1.5 text-center transition-all sm:flex-row sm:gap-2 sm:px-3",
                active
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-sm font-medium">{t.label}</span>
              <span
                className={cn(
                  "hidden text-[10px] leading-tight sm:inline",
                  active ? "text-muted-foreground" : "text-muted-foreground/80",
                )}
              >
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0">
        {sub === "grunnlag" ? (
          <div
            role="tabpanel"
            id="process-panel-grunnlag"
            aria-labelledby="process-sub-grunnlag"
          >
            <div className="rounded-xl border border-dashed border-primary/25 bg-muted/15 p-4 sm:p-5">
              <p className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-wide">
                Navn og referanse
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {candidates && candidates.length > 0 ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="pick-candidate">
                      Koble til prosess i registeret
                    </Label>
                    <select
                      key={candidatePickerKey}
                      id="pick-candidate"
                      className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm shadow-xs outline-none"
                      defaultValue=""
                      onChange={(e) => {
                        const id = e.target.value as Id<"candidates">;
                        if (!id) return;
                        const cand = candidates.find((x) => x._id === id);
                        if (cand) {
                          update("candidateId", cand.code);
                          update("processName", cand.name);
                          const owner = cand.linkHintBusinessOwner?.trim();
                          if (owner && !(payload.processActors ?? "").trim()) {
                            update("processActors", owner);
                          }
                          const sys = cand.linkHintSystems?.trim();
                          if (sys && !(payload.processSystems ?? "").trim()) {
                            update("processSystems", sys);
                          }
                          const comp = cand.linkHintComplianceNotes?.trim();
                          if (
                            comp &&
                            !(payload.hfSecurityInformationNotes ?? "").trim()
                          ) {
                            update("hfSecurityInformationNotes", comp);
                          }
                        }
                        bumpCandidatePickerKey();
                      }}
                      disabled={!canEdit}
                    >
                      <option value="">Velg fra arbeidsområdet …</option>
                      {candidates.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                    <p className="text-muted-foreground text-xs">
                      Valgfritt snarvei fra prosessregisteret — eller fyll inn
                      manuelt under.
                    </p>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="process-name">Prosessnavn</Label>
                  <Input
                    id="process-name"
                    name="processName"
                    autoComplete="off"
                    value={payload.processName}
                    onChange={(e) => update("processName", e.target.value)}
                    disabled={!canEdit}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="candidate-ref">Referanse / ID</Label>
                  <Input
                    id="candidate-ref"
                    value={payload.candidateId}
                    onChange={(e) => update("candidateId", e.target.value)}
                    disabled={!canEdit}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <Label>Hvor strekker prosessen seg?</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {(
                    [
                      ["single", "Én hovedenhet"],
                      ["multi", "Flere enheter / på tvers"],
                      ["unsure", "Ikke avklart"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={
                        (payload.processScope ?? "unsure") === value
                          ? "secondary"
                          : "outline"
                      }
                      size="sm"
                      className="h-auto min-h-10 justify-start whitespace-normal px-4 py-2.5 text-left"
                      disabled={!canEdit}
                      onClick={() => update("processScope", value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Styrer veiledning i neste steg — ikke i poengberegning.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {sub === "beskrivelse" ? (
          <div
            role="tabpanel"
            id="process-panel-beskrivelse"
            aria-labelledby="process-sub-beskrivelse"
          >
            <ProcessProfileSection
              payload={payload}
              canEdit={canEdit}
              update={update}
              compact
            />
          </div>
        ) : null}

        {sub === "krav" ? (
          <div
            role="tabpanel"
            id="process-panel-krav"
            aria-labelledby="process-sub-krav"
          >
            <HfRequirementsSection
              payload={payload}
              canEdit={canEdit}
              update={update}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
