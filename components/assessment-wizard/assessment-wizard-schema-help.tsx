"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Calculator, ClipboardList, HelpCircle } from "lucide-react";
import { useState } from "react";

/**
 * Kompakt hjelp — erstatter stor «faglig / merkantilt»-banner øverst i veiviseren.
 */
export function AssessmentWizardSchemaHelp() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground h-8 shrink-0 gap-1.5 px-2 text-xs font-medium"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <HelpCircle className="size-3.5 opacity-80" aria-hidden />
        Om skjemaet
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="lg"
          titleId="schema-help-title"
          descriptionId="schema-help-desc"
        >
          <DialogHeader>
            <p
              id="schema-help-title"
              className="font-heading text-lg font-semibold"
            >
              Hvordan PVV-skjemaet er bygget opp
            </p>
            <p
              id="schema-help-desc"
              className="text-muted-foreground text-sm leading-relaxed"
            >
              Kort oversikt for dokumentasjon og etterlevelse: hva som er
              faglig/kvalitativt, og hva som er tall for kost/nytte.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="bg-muted/30 flex gap-3 rounded-xl border p-3">
              <div className="bg-primary/12 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <ClipboardList className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  Faglig innhold (kan fylles ut uten økonomitall)
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Prosessbeskrivelse, organisasjon, ROS/PDD, Likert-vurderinger
                  (1–5) og tekstfelt om krav og sikkerhet. Gir grunnlag for
                  vurdering og prioritering uten at dere trenger fullt
                  merkantilt datagrunnlag.
                </p>
              </div>
            </div>
            <div className="bg-muted/30 flex gap-3 rounded-xl border p-3">
              <div className="bg-amber-500/15 text-amber-900 dark:text-amber-100 flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Calculator className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  Tall og kost (merkantile nøkkeltall)
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Steget «Tall og kost» — timer, årsverk, kostnad per årsverk
                  osv. Uten realistiske anslag her blir ikke tids- og
                  kronbesparelse i modellen meningsfull for beslutninger om
                  automatisering.
                </p>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
