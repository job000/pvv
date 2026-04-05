"use client";

import { LikertField } from "@/components/rpa-assessment/likert-field";
import { Button } from "@/components/ui/button";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  ASSESSMENT_VALUE_GAIN_OPTIONS,
  ASSESSMENT_VALUE_PAIN_OPTIONS,
} from "@/lib/assessment-value-tags";
import { clampLikert5 } from "@/lib/rpa-assessment/scoring";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

function toggleId(list: string[] | undefined, id: string): string[] {
  const cur = list ?? [];
  return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
}

export function AssessmentValueImpactStep({
  payload,
  canEdit,
  readOnly,
  update,
}: {
  payload: AssessmentPayload;
  canEdit: boolean;
  readOnly: boolean;
  update: <K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) => void;
}) {
  const pains = payload.valuePainPointIds ?? [];
  const gains = payload.valueGainIds ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
          Verdi og effekt
        </h2>
        <p className="text-muted-foreground text-sm">
          Tre minutter her hjelper dere å forklare hvorfor saken betyr noe — uten økonomijargon.
        </p>
        <p className="text-muted-foreground text-xs">
          Valgene under påvirker også prioriteringsscoren moderat (sammen med skalaene).
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-foreground text-sm font-medium">
          Hva er problemene i dag? <span className="text-muted-foreground font-normal">(velg gjerne flere)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {ASSESSMENT_VALUE_PAIN_OPTIONS.map((o) => {
            const on = pains.includes(o.id);
            return (
              <Button
                key={o.id}
                type="button"
                variant={on ? "default" : "outline"}
                size="sm"
                disabled={!canEdit}
                className={cn(
                  "h-auto min-h-11 rounded-xl px-3 py-2 text-left text-sm font-normal",
                  on && "shadow-sm",
                )}
                onClick={() =>
                  canEdit &&
                  update("valuePainPointIds", toggleId(pains, o.id))
                }
              >
                {on ? <Check className="mr-1.5 inline size-3.5" aria-hidden /> : null}
                {o.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-foreground text-sm font-medium">
          Hva blir bedre med automatisering? <span className="text-muted-foreground font-normal">(velg flere)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {ASSESSMENT_VALUE_GAIN_OPTIONS.map((o) => {
            const on = gains.includes(o.id);
            return (
              <Button
                key={o.id}
                type="button"
                variant={on ? "default" : "outline"}
                size="sm"
                disabled={!canEdit}
                className={cn(
                  "h-auto min-h-11 rounded-xl px-3 py-2 text-left text-sm font-normal",
                  on && "shadow-sm",
                )}
                onClick={() =>
                  canEdit && update("valueGainIds", toggleId(gains, o.id))
                }
              >
                {on ? <Check className="mr-1.5 inline size-3.5" aria-hidden /> : null}
                {o.label}
              </Button>
            );
          })}
        </div>
      </div>

      <LikertField
        id="value-expected-benefit"
        label="Hvor stor er den forventede gevinsten for dere?"
        hint="Tenk tid, kost eller kvalitet — grovt anslag holder."
        value={clampLikert5(payload.criticalityBusinessImpact)}
        onChange={(v) => update("criticalityBusinessImpact", v)}
        left="Liten"
        right="Svært stor"
        scaleLabels={[
          "Liten",
          "Noe",
          "Middels",
          "Stor",
          "Svært stor",
        ]}
        manualInputLabel="Tast 1–5"
        disabled={readOnly}
      />

      <LikertField
        id="value-error-consequence"
        label="Hvor alvorlig er det om noe går galt i denne jobben i dag?"
        hint="F.eks. feil i journal, feil beløp, pasientsikkerhet — ikke tekniske detaljer."
        value={clampLikert5(payload.criticalityRegulatoryRisk)}
        onChange={(v) => update("criticalityRegulatoryRisk", v)}
        left="Lite alvorlig"
        right="Svært alvorlig"
        scaleLabels={[
          "Lite",
          "Noe",
          "Middels",
          "Alvorlig",
          "Svært alvorlig",
        ]}
        manualInputLabel="Tast 1–5"
        disabled={readOnly}
      />
    </div>
  );
}
