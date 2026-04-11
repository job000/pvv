"use client";

import { LikertField } from "@/components/rpa-assessment/likert-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB,
  RPA_SIMILAR_AUTOMATION_LABELS_NB,
  type RpaBarrierSelfAssessment,
  type RpaSimilarAutomation,
} from "@/lib/rpa-portfolio-labels";
import { clampLikert5 } from "@/lib/rpa-assessment/scoring";
import { cn } from "@/lib/utils";

type Props = {
  payload: AssessmentPayload;
  canEdit: boolean;
  readOnly: boolean;
  update: <K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) => void;
  /** Når true: hopp over gevinst/feil-likert (allerede i steg «Verdi og effekt»). */
  omitCoreValueLikerts?: boolean;
};

/**
 * Grunnleggende beslutningsspørsmål (gevinst, risiko, portefølje) som også brukes i inntak.
 */
export function AssessmentPortfolioSummarySection({
  payload,
  canEdit,
  readOnly,
  update,
  omitCoreValueLikerts = false,
}: Props) {
  return (
    <div className="space-y-8 rounded-2xl bg-muted/10 p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <div className="space-y-1">
        <h3 className="text-foreground text-base font-semibold">
          Beslutningsgrunnlag (samme som i inntaksskjema)
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Kort vurdering av gevinst, risiko og portefølje — typisk før dere går videre med
          bestillere. Dette endrer ikke modellens automasjonsscore direkte; det støtter
          prioritering og dialog.
        </p>
      </div>

      {omitCoreValueLikerts ? (
        <p className="text-muted-foreground text-xs">
          Forventet gevinst og konsekvens av feil fylte du ut under «Verdi og effekt».
        </p>
      ) : null}

      {!omitCoreValueLikerts ? (
      <LikertField
        id="summary-importance-business"
        label="Hvor stor er den forventede økonomiske og operative gevinsten?"
        hint="Dere trenger ikke eksakte kroner — skalaen er en grov prioritering. Tenk likevel som til økonomi eller ledelse: sparte timer (× timelønn), færre feil som koster penger eller omdømme, raskere gjennomløp som gir bedre inntekt eller lavere lager, eller frigjort kapasitet som ellers må kjøpes inn. Ikke «hvor viktig faget er», men om nettopp denne automatiseringen gir tydelig nytte i kroner, tid eller kapasitet."
        value={clampLikert5(payload.criticalityBusinessImpact)}
        onChange={(v) => update("criticalityBusinessImpact", v)}
        left="Lite å spare / frigjøre"
        right="Mye å spare / frigjøre"
        scaleLabels={[
          "Ingen tydelig nytte",
          "Liten besparelse",
          "Merkbar årlig effekt",
          "Stor forventet gevinst",
          "Topp økonomisk gevinst",
        ]}
        manualInputLabel="Tast verdi (1–5)"
        disabled={readOnly}
      />
      ) : null}
      {!omitCoreValueLikerts ? (
      <LikertField
        id="summary-importance-regulatory"
        label="Hvor kritiske er feil eller manglende sporbarhet i denne prosessen?"
        hint="Compliance og kontroll: journal, avvik, HR, økonomi. Høy verdi der feil har alvorlige konsekvenser — typisk RPA-vurderingspunkt."
        value={clampLikert5(payload.criticalityRegulatoryRisk)}
        onChange={(v) => update("criticalityRegulatoryRisk", v)}
        left="Lite kritisk"
        right="Svært kritisk"
        scaleLabels={["Lite", "Noe", "Middels", "Høyt", "Svært høyt"]}
        disabled={readOnly}
      />
      ) : null}
      <LikertField
        id="summary-process-specificity"
        label="Hvor spesifikk er prosessen for dere — eller finnes lignende mange steder?"
        hint="1 = lignende prosess finnes mange steder, 5 = svært spesifikk eller unik for oss."
        value={clampLikert5(payload.rpaProcessSpecificity ?? 3)}
        onChange={(v) => update("rpaProcessSpecificity", v)}
        left="Mange steder"
        right="Svært spesifikk"
        scaleLabels={["Mange steder", "Ganske vanlig", "Middels", "Ganske unik", "Svært spesifikk"]}
        disabled={readOnly}
      />

      <div className="space-y-3">
        <div>
          <p className="text-foreground text-sm font-medium">
            Har dere fra før noe som ligner — med robot eller annen automatisering?
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Hjelper å vite om dere bygger videre på noe kjent, eller starter helt nytt.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {(
            Object.keys(
              RPA_SIMILAR_AUTOMATION_LABELS_NB,
            ) as RpaSimilarAutomation[]
          ).map((value) => {
            const selected =
              (payload.rpaSimilarAutomationExists ?? "unsure") === value;
            return (
              <Button
                key={value}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                aria-pressed={selected}
                className={cn(
                  "h-auto min-h-10 justify-start whitespace-normal rounded-xl px-4 py-2.5 text-left transition-colors",
                  selected && "shadow-md ring-0",
                )}
                disabled={!canEdit}
                onClick={() => update("rpaSimilarAutomationExists", value)}
              >
                {RPA_SIMILAR_AUTOMATION_LABELS_NB[value]}
              </Button>
            );
          })}
        </div>
      </div>

      <LikertField
        id="summary-benefit-effort"
        label="Blir gevinsten større enn jobben med å få det på plass?"
        hint="Altså om nytte (tid spart, færre feil, lavere kost, bedre kvalitet …) blir større enn innsatsen. Ikke fasit — dere vurderer som fagfolk."
        value={clampLikert5(payload.rpaExpectedBenefitVsEffort ?? 3)}
        onChange={(v) => update("rpaExpectedBenefitVsEffort", v)}
        left="Ikke verdt det"
        right="Klart verdt det"
        scaleLabels={["Svært lite", "Lite", "Middels", "Mye", "Svært mye"]}
        disabled={readOnly}
      />
      <LikertField
        id="summary-quick-win"
        label="Hvor raskt kan dere få effekt — uten et stort prosjekt først?"
        hint="Høy verdi = dere tror effekten kan komme ganske raskt."
        value={clampLikert5(payload.rpaQuickWinPotential ?? 3)}
        onChange={(v) => update("rpaQuickWinPotential", v)}
        left="Lang vei"
        right="Rask effekt"
        scaleLabels={[
          "Lang vei",
          "Noe venting",
          "Middels",
          "Ganske raskt",
          "Rask effekt",
        ]}
        disabled={readOnly}
      />
      <LikertField
        id="summary-implementation-difficulty"
        label="Hvor krevende tror dere det er å få dette trygt i drift?"
        hint="Ikke en teknisk test — bare deres erfaring: enkelt prosjekt eller tungt?"
        value={clampLikert5(payload.rpaImplementationDifficulty ?? 3)}
        onChange={(v) => update("rpaImplementationDifficulty", v)}
        left="Enkelt"
        right="Svært krevende"
        scaleLabels={[
          "Enkelt",
          "Ganske lett",
          "Middels",
          "Krevende",
          "Svært krevende",
        ]}
        disabled={readOnly}
      />

      <div className="space-y-3">
        <div>
          <p className="text-foreground text-sm font-medium">
            Er det noe som gjør at robot i skjermbilder ikke passer — eller at en annen løsning er
            bedre?
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Valgfritt. Velg det som ligner mest.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {(
            Object.keys(
              RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB,
            ) as RpaBarrierSelfAssessment[]
          ).map((value) => {
            const selected = (payload.rpaBarrierSelfAssessment ?? "none") === value;
            return (
              <Button
                key={value}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                aria-pressed={selected}
                className={cn(
                  "h-auto min-h-10 justify-start whitespace-normal rounded-xl px-4 py-2.5 text-left transition-colors",
                  selected && "shadow-md ring-0",
                )}
                disabled={!canEdit}
                onClick={() => update("rpaBarrierSelfAssessment", value)}
              >
                {RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB[value]}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary-barrier-notes">Kort forklaring på forrige valg (valgfritt)</Label>
        <Textarea
          id="summary-barrier-notes"
          value={payload.rpaBarrierNotes ?? ""}
          onChange={(e) => canEdit && update("rpaBarrierNotes", e.target.value)}
          disabled={!canEdit}
          placeholder="Ett kort avsnitt holder."
          className="min-h-[88px] rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="summary-benefit-ops-notes">
          Hvilken gevinst håper dere på — og hva gjør dere i dag kontra hva roboten skal gjøre?
        </Label>
        <Textarea
          id="summary-benefit-ops-notes"
          value={payload.rpaBenefitKindsAndOperationsNotes ?? ""}
          onChange={(e) =>
            canEdit && update("rpaBenefitKindsAndOperationsNotes", e.target.value)
          }
          disabled={!canEdit}
          placeholder="F.eks. manuell tid i dag vs. tid med robot, ventetid (ting som sjeldent gjøres nå men bør gjøres med en gang), at oppgaver ikke blir liggende eller glemt."
          className="min-h-[120px] rounded-xl"
        />
        <p className="text-muted-foreground text-xs">
          Samme type informasjon som kan brukes i ROS og økonomivurdering — skriv som til
          kolleger, ikke IT-manual.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="summary-build-cost">Antatt byggekostnad (engang)</Label>
          <Input
            id="summary-build-cost"
            type="number"
            min={0}
            value={payload.implementationBuildCost ?? 0}
            onChange={(e) =>
              canEdit && update("implementationBuildCost", Number(e.target.value) || 0)
            }
            disabled={!canEdit}
            placeholder="F.eks. 350000"
            className="h-10 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Bruk et grovt anslag for etablering, utvikling og innføring.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="summary-run-cost">Antatt årlig driftskostnad</Label>
          <Input
            id="summary-run-cost"
            type="number"
            min={0}
            value={payload.annualRunCost ?? 0}
            onChange={(e) => canEdit && update("annualRunCost", Number(e.target.value) || 0)}
            disabled={!canEdit}
            placeholder="F.eks. 75000"
            className="h-10 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Lisens, drift, overvåking og mindre forvaltning per år.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-1">
        <div className="space-y-2">
          <Label htmlFor="summary-lifecycle-contact">
            Kontaktperson som følger saken til løsningen er i vanlig bruk
          </Label>
          <Input
            id="summary-lifecycle-contact"
            value={payload.rpaLifecycleContact ?? ""}
            onChange={(e) => canEdit && update("rpaLifecycleContact", e.target.value)}
            disabled={!canEdit}
            placeholder="Navn og rolle"
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="summary-fallback">
            Hvis roboten stopper eller feiler: hvem tar manuelt over?
          </Label>
          <Textarea
            id="summary-fallback"
            value={payload.rpaManualFallbackWhenRobotFails ?? ""}
            onChange={(e) =>
              canEdit && update("rpaManualFallbackWhenRobotFails", e.target.value)
            }
            disabled={!canEdit}
            placeholder="Hvem, hvordan når dere dem, eventuelt vakt eller avdeling."
            className="min-h-[88px] rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}
