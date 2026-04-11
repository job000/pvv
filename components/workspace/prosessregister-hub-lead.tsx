"use client";

import { Button } from "@/components/ui/button";
import {
  PROSESSREGISTER_TUTORIAL_STEPS,
  ProsessregisterTutorialOverlay,
} from "@/components/workspace/prosessregister-tutorial-overlay";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  canEdit: boolean;
  onRegisterClick: () => void;
};

export function ProsessregisterHubLead({ canEdit, onRegisterClick }: Props) {
  const settings = useQuery(api.workspaces.getMySettings);
  const dismissTutorial = useMutation(api.workspaces.dismissProsessregisterTutorial);

  const [tutorialOpen, setTutorialOpen] = useState(false);

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

  return (
    <>
      <div
        data-tutorial-anchor="hub-registrering"
        className="flex flex-wrap items-center gap-3"
      >
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
        {tutorialAllowed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl text-muted-foreground"
            onClick={() => setTutorialOpen(true)}
          >
            Vis guide
          </Button>
        ) : null}
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
