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

type Props = {
  payload: AssessmentPayload;
  canEdit: boolean;
  readOnly: boolean;
  update: <K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) => void;
};

/**
 * Grunnleggende beslutningsspørsmål (gevinst, risiko, portefølje) som også brukes i inntak.
 * Vises kun her i vurderingsveiviseren — ikke som eget hovedsteg — for å unngå gjentakelse.
 */
export function AssessmentPortfolioSummarySection({
  payload,
  canEdit,
  readOnly,
  update,
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

      <LikertField
        id="summary-importance-business"
        label="Hvor stor er forventet gevinst av å automatisere denne prosessen?"
        hint="Tenk tid, kvalitet, kostnad eller pasientsikkerhet — ikke «hvor viktig faget er generelt», men om nettopp denne automatiseringen gir nok nytte (forretningsdriver i RPA-vurdering)."
        value={clampLikert5(payload.criticalityBusinessImpact)}
        onChange={(v) => update("criticalityBusinessImpact", v)}
        left="Liten gevinst"
        right="Stor gevinst"
        scaleLabels={["Liten", "Noe", "Middels", "Stor", "Svært stor"]}
        disabled={readOnly}
      />
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
          ).map((value) => (
            <Button
              key={value}
              type="button"
              variant={
                (payload.rpaSimilarAutomationExists ?? "unsure") === value
                  ? "secondary"
                  : "outline"
              }
              size="sm"
              className="h-auto min-h-10 justify-start whitespace-normal rounded-xl px-4 py-2.5 text-left"
              disabled={!canEdit}
              onClick={() => update("rpaSimilarAutomationExists", value)}
            >
              {RPA_SIMILAR_AUTOMATION_LABELS_NB[value]}
            </Button>
          ))}
        </div>
      </div>

      <LikertField
        id="summary-benefit-effort"
        label="Tror dere det blir nok igjen å hente — sammenlignet med jobben med å få det på plass?"
        hint="Tenk tid, kvalitet, færre feil eller penger. Ikke «riktig svar» — dere vurderer som fagfolk."
        value={clampLikert5(payload.rpaExpectedBenefitVsEffort ?? 3)}
        onChange={(v) => update("rpaExpectedBenefitVsEffort", v)}
        left="Lite å hente"
        right="Mye å hente"
        scaleLabels={["Lite", "Noe", "Middels", "Mye", "Svært mye"]}
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
          ).map((value) => (
            <Button
              key={value}
              type="button"
              variant={
                (payload.rpaBarrierSelfAssessment ?? "none") === value
                  ? "secondary"
                  : "outline"
              }
              size="sm"
              className="h-auto min-h-10 justify-start whitespace-normal rounded-xl px-4 py-2.5 text-left"
              disabled={!canEdit}
              onClick={() => update("rpaBarrierSelfAssessment", value)}
            >
              {RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB[value]}
            </Button>
          ))}
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
