"use client";

import { LikertField } from "@/components/rpa-assessment/likert-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AssessmentPayload } from "@/lib/assessment-types";
import { clampLikert5, type Likert5 } from "@/lib/rpa-assessment/scoring";

/** UI: 1 = mye skjønn → modell: lang/kompleks flyt (høy processLength). 5 = lite skjønn → lav processLength. */
function judgmentUiFromProcessLength(pl: number): Likert5 {
  return clampLikert5(6 - clampLikert5(pl));
}

export function AssessmentProcessSimpleStep({
  payload,
  canEdit,
  readOnly,
  update,
  updateMany,
}: {
  payload: AssessmentPayload;
  canEdit: boolean;
  readOnly: boolean;
  update: <K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) => void;
  updateMany: (patch: Partial<AssessmentPayload>) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
          Prosess og systemer
        </h2>
        <p className="text-muted-foreground text-sm">
          Vanlige RPA-spørsmål — i vanlig språk. Bare velg det som passer best.
        </p>
      </div>

      <LikertField
        id="simple-same-way"
        label="Gjøres jobben stort sett på samme måte hver gang?"
        hint="Robot trenger forutsigbare steg."
        value={clampLikert5(payload.processVariability)}
        onChange={(v) => update("processVariability", v)}
        left="Svært ulikt"
        right="Nesten alltid likt"
        scaleLabels={[
          "Ofte ulikt",
          "Ganske ulikt",
          "Varierer",
          "Ganske likt",
          "Nesten likt",
        ]}
        disabled={readOnly}
      />

      <LikertField
        id="simple-judgment"
        label="Hvor mye skjønn og vurdering trengs underveis?"
        hint="Mye skjønn gjør det ofte vanskeligere å automatisere."
        value={judgmentUiFromProcessLength(payload.processLength)}
        onChange={(v) => update("processLength", clampLikert5(6 - v))}
        left="Mye skjønn"
        right="Lite skjønn"
        scaleLabels={[
          "Svært mye",
          "Ganske mye",
          "Noe",
          "Lite",
          "Nesten ikke",
        ]}
        disabled={readOnly}
      />

      <LikertField
        id="simple-fields"
        label="Ligger opplysningene klart i skjema og felt — eller mye fritekst og frie notater?"
        hint="Faste felt og lister er enklere å automatisere enn lange frie tekster."
        value={clampLikert5(payload.structuredInput)}
        onChange={(v) => update("structuredInput", v)}
        left="Mye fritekst"
        right="Mye i felt"
        scaleLabels={[
          "Mye fritekst",
          "Mest fritekst",
          "Blanding",
          "Mest felt",
          "Nesten bare felt",
        ]}
        disabled={readOnly}
      />

      <LikertField
        id="simple-stability"
        label="Hvor stabile er rutiner og systembilder — endrer de seg ofte?"
        hint="Hyppige endringer gjør vedlikehold tyngre."
        value={clampLikert5(
          Math.round((payload.processStability + payload.applicationStability) / 2),
        )}
        onChange={(v) =>
          updateMany({
            processStability: v,
            applicationStability: v,
          })
        }
        left="Endrer seg ofte"
        right="Ganske stabilt"
        scaleLabels={[
          "Ofte endring",
          "Noe ustabilt",
          "Middels",
          "Ganske stabilt",
          "Svært stabilt",
        ]}
        disabled={readOnly}
      />

      <LikertField
        id="simple-digital"
        label="Er arbeidet mest digitalt — eller papir og skanning?"
        hint="Helt digital flyt er enklere."
        value={clampLikert5(payload.digitization)}
        onChange={(v) => update("digitization", v)}
        left="Mye papir"
        right="Helt digitalt"
        scaleLabels={[
          "Mye papir",
          "Mest papir",
          "Blanding",
          "Mest digitalt",
          "Helt digitalt",
        ]}
        disabled={readOnly}
      />

      <LikertField
        id="simple-app-count"
        label="Hvor mange ulike systemer må dere vanligvis inn i for én runde?"
        hint="Færre systemer gir ofte enklere automatisering."
        value={clampLikert5(payload.applicationCount)}
        onChange={(v) => update("applicationCount", v)}
        left="Ett system"
        right="Mange systemer"
        scaleLabels={["Ett", "To", "3–4", "5–6", "7 eller flere"]}
        disabled={readOnly}
      />

      <div className="rounded-2xl bg-muted/10 p-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="flex items-start gap-3">
          <Checkbox
            id="simple-ocr"
            checked={payload.ocrRequired}
            onCheckedChange={(c) => canEdit && update("ocrRequired", c === true)}
            disabled={!canEdit}
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="simple-ocr" className="text-sm font-medium">
              Må tekst ofte leses ut av skannede dokumenter eller bilder?
            </Label>
            <p className="text-muted-foreground mt-1 text-xs">
              Ja = ofte mer krevende enn ren tekst i systemet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
