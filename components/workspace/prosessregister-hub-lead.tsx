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
  candidatesCount: number;
  intakeCount: number;
  withoutRosCount?: number;
  withoutPvvCount?: number;
};

/**
 * Tesla-stil hero for Prosesser:
 * én primærhandling, flat metrics-stripe, null dekorasjon.
 */
export function ProsessregisterHubLead({
  canEdit,
  onRegisterClick,
  candidatesCount,
  intakeCount,
  withoutRosCount = 0,
  withoutPvvCount = 0,
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
  const showGaps = candidatesCount >= 2;

  return (
    <>
      <div
        data-tutorial-anchor="hub-registrering"
        className="space-y-7"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {total === 0
                ? "Registrer prosesser som skal vurderes og sikres."
                : "Åpne en rad for å redigere eller koble videre."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {tutorialAllowed ? (
              <button
                type="button"
                className="px-2 py-2.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                onClick={() => setTutorialOpen(true)}
              >
                Guide
              </button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                className="h-12 min-h-12 gap-2.5 rounded-2xl bg-foreground px-7 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                onClick={onRegisterClick}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                Ny prosess
              </Button>
            ) : null}
          </div>
        </div>

        <dl className="flex flex-wrap gap-3">
          <div className="inline-flex items-baseline gap-2.5 rounded-2xl bg-muted/50 px-4 py-2.5 text-sm">
            <dt className="text-muted-foreground">Totalt</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {total}
            </dd>
          </div>
          {candidatesCount > 0 ? (
            <div className="inline-flex items-baseline gap-2.5 rounded-2xl bg-muted/50 px-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">Med ID</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {candidatesCount}
              </dd>
            </div>
          ) : null}
          {intakeCount > 0 ? (
            <div className="inline-flex items-baseline gap-2.5 rounded-2xl bg-muted/50 px-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">Fra skjema</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {intakeCount}
              </dd>
            </div>
          ) : null}
          {showGaps && withoutRosCount > 0 ? (
            <div className="inline-flex items-baseline gap-2.5 rounded-2xl bg-muted/50 px-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">Uten ROS</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {withoutRosCount}
              </dd>
            </div>
          ) : null}
          {showGaps && withoutPvvCount > 0 ? (
            <div className="inline-flex items-baseline gap-2.5 rounded-2xl bg-muted/50 px-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">Uten PVV</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {withoutPvvCount}
              </dd>
            </div>
          ) : null}
        </dl>
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
