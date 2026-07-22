"use client";

import {
  ProsessregisterTutorialOverlay,
  type TutorialStep,
} from "@/components/workspace/prosessregister-tutorial-overlay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  ListOrdered,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

const TUTORIAL_DISMISS_KEY = "pvv:pdd-tutorial-dismissed";
const GUIDE_COLLAPSE_KEY = "pvv:pdd-guide-collapsed";

export const PDD_TUTORIAL_STEPS: TutorialStep[] = [
  {
    targetSelectors: ['[data-tutorial-anchor="pdd-guide"]'],
    title: "Slik kommer du i gang",
    targetHint: "Kom i gang",
    body: "Start her. Vi foreslår neste uferdige seksjon, og du kan fylle tomme felter fra vurdering, prosessregister og ROS med ett klikk.",
  },
  {
    targetSelectors: ['[data-tutorial-anchor="pdd-toolbar"]'],
    title: "Lagre og flere handlinger",
    targetHint: "Verktøylinje",
    body: "Lagre når du er ferdig med en bit. Under «Flere» finner du Fyll fra kilder, versjonshistorikk og PDF. På mobil ligger Lagre også nederst.",
  },
  {
    targetSelectors: ['[data-tutorial-anchor="pdd-sections"]'],
    title: "Hopp mellom seksjoner",
    targetHint: "Seksjonsnav",
    body: "Oversikt → As-Is → To-Be → HUKI → Risiko → Tillegg. Grønn prikk betyr at seksjonen har innhold. Filtrer på «Mangler» for å se det som gjenstår.",
  },
  {
    targetSelectors: ['[data-tutorial-anchor="pdd-section-overview"]'],
    title: "Start med prosesstittel",
    targetHint: "Prosessoversikt",
    body: "Gi prosessen et tydelig navn og en kort beskrivelse. Det gjør resten av dokumentet lettere å fylle og lese for andre.",
  },
  {
    targetSelectors: ['[data-tutorial-anchor="pdd-section-asis"]'],
    title: "Tegn og beskriv As-Is",
    targetHint: "As-Is",
    body: "Beskriv dagens prosess med tekst, eller bytt til Diagram for freehand / bokser (Apple Pencil støttes). Fullskjerm gir best plass på iPad.",
  },
];

export function usePddTutorialDismissed() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(TUTORIAL_DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismissPermanent = () => {
    try {
      localStorage.setItem(TUTORIAL_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const resetDismiss = () => {
    try {
      localStorage.removeItem(TUTORIAL_DISMISS_KEY);
    } catch {
      /* ignore */
    }
    setDismissed(false);
  };

  return { dismissed, dismissPermanent, resetDismiss };
}

export function usePddGuideCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(GUIDE_COLLAPSE_KEY) === "1");
    } catch {
      setCollapsed(false);
    }
  }, []);

  const setCollapsedPersistent = (next: boolean) => {
    try {
      localStorage.setItem(GUIDE_COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    setCollapsed(next);
  };

  return [collapsed, setCollapsedPersistent] as const;
}

export function PddGettingStartedCard({
  completedCount,
  totalCount,
  nextSectionLabel,
  hasDiagram,
  onGoToNext,
  onOpenDiagram,
  onAutofill,
  onOpenTutorial,
  canAutofill,
  canEdit,
}: {
  completedCount: number;
  totalCount: number;
  nextSectionLabel: string | null;
  hasDiagram: boolean;
  onGoToNext: () => void;
  onOpenDiagram: () => void;
  onAutofill: () => void;
  onOpenTutorial: () => void;
  canAutofill: boolean;
  canEdit: boolean;
}) {
  const [collapsed, setCollapsed] = usePddGuideCollapsed();
  const sectionsDone = completedCount >= totalCount;
  const guideDone = sectionsDone && hasDiagram;
  const writeTitle = nextSectionLabel
    ? `Skriv i «${nextSectionLabel}»`
    : "Skriv i seksjonene";
  const primaryAction = nextSectionLabel
    ? { label: `Fortsett: ${nextSectionLabel}`, onClick: onGoToNext }
    : !hasDiagram
      ? { label: "Tegn flyt i Diagram", onClick: onOpenDiagram }
      : null;

  return (
    <section
      data-tutorial-anchor="pdd-guide"
      className="rounded-xl border border-border/50 bg-muted/20"
    >
      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <ListOrdered className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Kom i gang</h2>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "Vis" : "Skjul"}
            </button>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {guideDone
              ? "Seksjoner og diagram er på plass. Finpuss og lagre PDF når du er klar."
              : sectionsDone
                ? "Seksjonene har innhold. Neste steg er å tegne flyten i Diagram."
                : `Fyll én seksjon om gangen. ${completedCount} av ${totalCount} har innhold.`}
          </p>
        </div>
      </div>

      {!collapsed ? (
        <div className="space-y-4 border-t border-border/40 px-4 py-4 sm:px-5">
          <ol className="space-y-2.5">
            <GuideStep
              done={completedCount > 0}
              title="Fyll fra kilder (valgfritt)"
              body="Henter forslag fra vurdering, register og ROS inn i tomme felt."
            />
            <GuideStep
              done={sectionsDone}
              title={writeTitle}
              body="Start med tittel og kort beskrivelse, deretter As-Is og To-Be."
            />
            <GuideStep
              done={hasDiagram}
              title="Tegn flyt i Diagram"
              body="Bruk Blyant for freehand, Pil for koblinger mellom bokser. Fullskjerm på iPad."
            />
          </ol>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {primaryAction ? (
              <Button
                type="button"
                className="h-10 rounded-lg"
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-1.5 rounded-lg"
                onClick={onAutofill}
                disabled={!canAutofill}
              >
                <Sparkles className="size-3.5" aria-hidden />
                Fyll fra kilder
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="h-10 gap-1.5 rounded-lg"
              onClick={onOpenTutorial}
            >
              <BookOpen className="size-3.5" aria-hidden />
              Vis veiledning
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function GuideStep({
  done,
  title,
  body,
}: {
  done: boolean;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-2.5">
      {done ? (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
      ) : (
        <Circle
          className="mt-0.5 size-4 shrink-0 text-muted-foreground/50"
          aria-hidden
        />
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            done ? "text-muted-foreground line-through decoration-border" : "text-foreground",
          )}
        >
          {title}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

export function PddTutorialOverlay({
  open,
  onClose,
  onDismissPermanent,
}: {
  open: boolean;
  onClose: () => void;
  onDismissPermanent: () => void;
}) {
  return (
    <ProsessregisterTutorialOverlay
      open={open}
      steps={PDD_TUTORIAL_STEPS}
      onClose={onClose}
      onDismissPermanent={onDismissPermanent}
    />
  );
}
