"use client";

import { Button } from "@/components/ui/button";
import {
  PROSESSREGISTER_TUTORIAL_STEPS,
  ProsessregisterTutorialOverlay,
} from "@/components/workspace/prosessregister-tutorial-overlay";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, BookOpen, Plus, Workflow } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  canEdit: boolean;
  onRegisterClick: () => void;
  /** Antall registrerte prosesser (med P-ID). */
  candidatesCount: number;
  /** Antall innsendte/godkjente fra skjema (uten P-ID enda). */
  intakeCount: number;
};

export function ProsessregisterHubLead({
  canEdit,
  onRegisterClick,
  candidatesCount,
  intakeCount,
}: Props) {
  const settings = useQuery(api.workspaces.getMySettings);
  const dismissTutorial = useMutation(
    api.workspaces.dismissProsessregisterTutorial,
  );

  const [tutorialOpen, setTutorialOpen] = useState(false);

  const tutorialAllowed = settings?.prosessregisterTutorialEnabled !== false;

  const handleIkkeVisMer = useCallback(async () => {
    try {
      await dismissTutorial({});
    } catch {
      /* optional */
    }
    setTutorialOpen(false);
  }, [dismissTutorial]);

  const total = candidatesCount + intakeCount;
  const subtitle =
    total === 0
      ? canEdit
        ? "Registrer din første prosess for å komme i gang."
        : "Ingen prosesser registrert ennå."
      : candidatesCount > 0 && intakeCount > 0
        ? `${candidatesCount} med ID · ${intakeCount} fra skjema`
        : candidatesCount > 0
          ? `${candidatesCount} ${candidatesCount === 1 ? "prosess" : "prosesser"} med ID`
          : `${intakeCount} fra skjema (ingen P-ID ennå)`;

  return (
    <>
      <div
        data-tutorial-anchor="hub-registrering"
        className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-border/50 bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:p-6"
      >
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-border/60 sm:size-14"
          aria-hidden
        >
          <Workflow className="size-6 sm:size-7" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
            Prosesser
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canEdit ? (
            <Button
              type="button"
              size="default"
              className="gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
              onClick={onRegisterClick}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              Ny prosess
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          ) : null}
          {tutorialAllowed ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 text-xs font-medium text-muted-foreground backdrop-blur-sm hover:bg-card hover:text-foreground"
              onClick={() => setTutorialOpen(true)}
            >
              <BookOpen className="size-3.5" aria-hidden />
              Vis guide
            </Button>
          ) : null}
        </div>
      </div>

      <ProsessregisterTutorialOverlay
        open={tutorialOpen}
        steps={PROSESSREGISTER_TUTORIAL_STEPS}
        onClose={() => setTutorialOpen(false)}
        onDismissPermanent={handleIkkeVisMer}
      />
    </>
  );
}
