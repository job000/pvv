"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  PROSESSREGISTER_TUTORIAL_STEPS,
  ProsessregisterTutorialOverlay,
} from "@/components/workspace/prosessregister-tutorial-overlay";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  canEdit: boolean;
  onRegisterClick: () => void;
};

export function ProsessregisterHubLead({ canEdit, onRegisterClick }: Props) {
  const settings = useQuery(api.workspaces.getMySettings);
  const dismissTutorial = useMutation(api.workspaces.dismissProsessregisterTutorial);

  const [tutorialOpen, setTutorialOpen] = useState(false);
  const didAutoOpen = useRef(false);

  const tutorialAllowed =
    settings?.prosessregisterTutorialEnabled !== false;
  const tutorialDismissed =
    settings?.prosessregisterTutorialDismissed === true;

  /** Én auto-popup per mount. Avbryt lukker bare overlay — ved ny navigasjon til siden kjører ny mount og veiledning kan vises igjen. */
  useEffect(() => {
    if (settings === undefined || didAutoOpen.current) return;
    if (tutorialAllowed && !tutorialDismissed) {
      didAutoOpen.current = true;
      const id = requestAnimationFrame(() => {
        setTutorialOpen(true);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [settings, tutorialAllowed, tutorialDismissed]);

  const handleLukk = useCallback(() => {
    setTutorialOpen(false);
  }, []);

  const handleIkkeVisMer = useCallback(async () => {
    try {
      await dismissTutorial({});
    } catch {
      /* toast optional */
    }
    setTutorialOpen(false);
  }, [dismissTutorial]);

  const openTutorial = useCallback(() => {
    setTutorialOpen(true);
  }, []);

  return (
    <>
      <section
        data-tutorial-anchor="hub-registrering"
        className="border-border/60 from-emerald-500/[0.06] via-card to-card relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm ring-1 ring-emerald-500/15 sm:p-6"
        aria-labelledby="prosess-hub-lead-heading"
      >
        <div
          className="pointer-events-none absolute -right-12 -top-8 h-36 w-48 rounded-full bg-emerald-500/[0.12] blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                <Sparkles className="text-emerald-600 dark:text-emerald-400 size-3.5" aria-hidden />
                Start her
              </span>
            </div>
            <h2
              id="prosess-hub-lead-heading"
              className="font-heading text-foreground text-lg font-semibold tracking-tight sm:text-xl"
            >
              Registrer prosesser først
            </h2>
            <ol className="text-muted-foreground max-w-prose space-y-2 text-sm leading-relaxed">
              <li className="flex gap-2">
                <span
                  className="bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                  aria-hidden
                >
                  1
                </span>
                <span>
                  <strong className="text-foreground">Legg inn prosess</strong> med
                  navn og prosess-ID i registeret (eller hent fra GitHub under).
                </span>
              </li>
              <li className="flex gap-2">
                <span
                  className="bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                  aria-hidden
                >
                  2
                </span>
                <span>
                  <strong className="text-foreground">Start vurdering</strong> fra
                  listen under — samme ID brukes i veiviseren steg «Prosess».
                </span>
              </li>
              <li className="flex gap-2">
                <span
                  className="bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                  aria-hidden
                >
                  3
                </span>
                <span>
                  <strong className="text-foreground">ROS</strong> kan kobles til
                  prosess eller vurdering når dere er klare — valgfritt.
                </span>
              </li>
            </ol>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:flex-col lg:items-stretch">
            {canEdit ? (
              <Button
                type="button"
                size="lg"
                className="h-12 min-h-[48px] w-full gap-2 text-[15px] font-semibold shadow-md sm:w-auto"
                onClick={onRegisterClick}
              >
                <Plus className="size-5 shrink-0" aria-hidden />
                Registrer ny prosess
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">
                Du har lesetilgang — be om medlem-rolle for å registrere nye
                prosesser.
              </p>
            )}
            <button
              type="button"
              onClick={openTutorial}
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "h-11 min-h-[44px] w-full gap-2 border-emerald-500/25 bg-background/80 text-[13px] font-medium sm:h-10 sm:min-h-0 sm:w-auto",
              )}
            >
              <BookOpen className="size-4 shrink-0" aria-hidden />
              Vis veiledning
            </button>
            <Link
              href="/bruker/innstillinger#veiledning-prosessregister"
              className="text-muted-foreground hover:text-foreground text-center text-xs underline-offset-4 hover:underline sm:text-left lg:text-center"
            >
              Innstillinger for veiledning
            </Link>
          </div>
        </div>
      </section>

      <ProsessregisterTutorialOverlay
        open={tutorialOpen}
        steps={PROSESSREGISTER_TUTORIAL_STEPS}
        onClose={handleLukk}
        onDismissPermanent={handleIkkeVisMer}
      />
    </>
  );
}
