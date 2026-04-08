"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  PROSESSREGISTER_TUTORIAL_STEPS,
  ProsessregisterTutorialOverlay,
} from "@/components/workspace/prosessregister-tutorial-overlay";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, CircleHelp, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

type Props = {
  canEdit: boolean;
  onRegisterClick: () => void;
};

export function ProsessregisterHubLead({ canEdit, onRegisterClick }: Props) {
  const settings = useQuery(api.workspaces.getMySettings);
  const dismissTutorial = useMutation(api.workspaces.dismissProsessregisterTutorial);

  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const tutorialAllowed =
    settings?.prosessregisterTutorialEnabled !== false;

  const handleIkkeVisMer = useCallback(async () => {
    try {
      await dismissTutorial({});
    } catch {
      /* optional */
    }
    setTutorialOpen(false);
  }, [dismissTutorial]);

  const openTutorial = useCallback(() => {
    setTutorialOpen(true);
  }, []);

  return (
    <>
      <div
        data-tutorial-anchor="hub-registrering"
        className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-card/40 px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {canEdit ? (
            <Button
              type="button"
              size="default"
              className="gap-2 rounded-xl shadow-none"
              onClick={onRegisterClick}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              Ny prosess
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              Lesetilgang — be om medlem-rolle for å registrere.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl border-border/50 shadow-none"
            onClick={openTutorial}
            disabled={!tutorialAllowed}
            title={
              !tutorialAllowed
                ? "Veiledning er slått av under Bruker → Innstillinger"
                : undefined
            }
          >
            <BookOpen className="size-3.5 shrink-0 opacity-80" aria-hidden />
            Veiledning
          </Button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1.5 rounded-xl text-muted-foreground",
            )}
          >
            <CircleHelp className="size-3.5 shrink-0 opacity-80" aria-hidden />
            Hjelp
          </button>
        </div>
        <Link
          href="/bruker/innstillinger#veiledning-prosessregister"
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline-offset-4 hover:underline sm:text-right"
        >
          Veiledningsinnstillinger
        </Link>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent size="lg" titleId="prosess-help-title" descriptionId="prosess-help-desc">
          <DialogHeader>
            <p
              id="prosess-help-title"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              Om prosessregisteret
            </p>
            <p
              id="prosess-help-desc"
              className="text-muted-foreground text-sm leading-relaxed"
            >
              Kort om ROS, PVV og når du trenger en prosess-ID.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-4 text-sm leading-relaxed">
            <p className="text-muted-foreground">
              <strong className="text-foreground">ROS</strong> kan opprettes uten
              prosess (meny «Risikoanalyse»), også frittstående.{" "}
              <strong className="text-foreground">Prosessregisteret</strong> bruker du
              når PVV-vurdering skal knyttes til en{" "}
              <strong className="text-foreground">prosess-ID</strong>, eller når dere
              vil se dekning (PVV/ROS) per prosess.
            </p>
            <ol className="text-muted-foreground list-decimal space-y-2 pl-5">
              <li>
                Legg inn prosess med navn og ID (eller hent fra GitHub lenger ned på
                siden).
              </li>
              <li>
                Start vurdering fra listen under — samme ID brukes i veiviseren (steg
                «Prosess»).
              </li>
              <li>
                ROS kan senere kobles til prosess eller vurdering om dere ønsker.
              </li>
            </ol>
            <p className="text-muted-foreground">
              Én prosess kan ha flere vurderinger; én vurdering peker på én prosess-ID
              i skjemaet. Valgfrie felt under hver prosess fylles inn i vurderingen
              første gang noen velger prosessen.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHelpOpen(false)}>
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProsessregisterTutorialOverlay
        open={tutorialOpen}
        steps={PROSESSREGISTER_TUTORIAL_STEPS}
        onClose={() => setTutorialOpen(false)}
        onDismissPermanent={handleIkkeVisMer}
      />
    </>
  );
}
