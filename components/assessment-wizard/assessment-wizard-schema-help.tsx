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
              Skjemaet følger vanlig RPA-praksis: forretningsverdi og volum,
              deretter prosess- og datakriterier (liknende dimensjoner som i f.eks.
              UiPath Automation Hub). Spørsmål om gevinst, risiko og portefølje (for
              bestillere) samles under «Resultat» — samme felt som i inntak, ikke
              gjentatt som eget hovedsteg. Til slutt valgfrie detaljer.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="bg-muted/30 flex gap-3 rounded-xl border p-3">
              <div className="bg-primary/12 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <ClipboardList className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  Kvalitative vurderinger (Likert og tekst)
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Under «Resultat» fyller dere inn beslutningsgrunnlag (Likert og
                  tekst) som også finnes i inntaksskjema — for å unngå dobbelt
                  arbeid. Volum og tid under «Kandidat og volum» styrker
                  modellens automatiseringsscore; porteføljefeltene støtter
                  prioritering og dialog.
                </p>
              </div>
            </div>
            <div className="bg-muted/30 flex gap-3 rounded-xl border p-3">
              <div className="bg-amber-500/15 text-amber-900 dark:text-amber-100 flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Calculator className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  Tallgrunnlag (timer, årsverk, kost)
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Under «Kandidat og volum» — brukes til timer per år, FTE og
                  besparelsesestimat. Uten realistiske anslag blir ikke
                  tids-/kronbesparelse i modellen meningsfull for RPA-beslutning.
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
