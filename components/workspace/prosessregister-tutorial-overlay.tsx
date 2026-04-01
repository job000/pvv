/* eslint-disable react-hooks/set-state-in-effect -- DOM-rect for spotlight og tutorial-steg krever måling i effekt */
"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ListOrdered } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const EMPTY_SELECTORS: string[] = [];

export type TutorialStep = {
  /** Første treff brukes (f.eks. GitHub-blokk, ellers varsel, ellers reserve). */
  targetSelectors: string[];
  title: string;
  body: string;
  targetHint: string;
};

type Props = {
  open: boolean;
  steps: TutorialStep[];
  onClose: () => void;
  onDismissPermanent: () => void;
};

const PAD = 10;
const Z_BACKDROP = 99980;
const Z_CARD = 99990;

function findFirstElement(selectors: string[]): Element | null {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

function useRectForSelector(active: boolean, selectors: string[]) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const measure = useCallback(() => {
    if (!active || typeof document === "undefined" || selectors.length === 0) {
      setRect(null);
      return;
    }
    const el = findFirstElement(selectors);
    if (!el) {
      setRect(null);
      return;
    }
    setRect(el.getBoundingClientRect());
  }, [active, selectors]);

  useLayoutEffect(() => {
    measure();
    const id = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(id);
  }, [measure]);

  useEffect(() => {
    if (!active) return;
    measure();
    const onScrollOrResize = () => {
      requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    const ro = new ResizeObserver(onScrollOrResize);
    const el = findFirstElement(selectors);
    if (el) ro.observe(el);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [active, measure, selectors]);

  return rect;
}

function BackdropHole({ rect }: { rect: DOMRect | null }) {
  if (!rect) {
    return (
      <div
        className="fixed inset-0 bg-black/55"
        style={{ zIndex: Z_BACKDROP }}
        aria-hidden
      />
    );
  }
  const t = Math.max(0, rect.top - PAD);
  const l = Math.max(0, rect.left - PAD);
  const r = rect.right + PAD;
  const b = rect.bottom + PAD;

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: Z_BACKDROP }}
      aria-hidden
    >
      <div className="pointer-events-auto absolute left-0 right-0 top-0 bg-black/55" style={{ height: t }} />
      <div
        className="pointer-events-auto absolute bg-black/55"
        style={{ top: t, left: 0, width: l, height: b - t }}
      />
      <div
        className="pointer-events-auto absolute bg-black/55"
        style={{ top: t, left: r, right: 0, height: b - t }}
      />
      <div className="pointer-events-auto absolute bottom-0 left-0 right-0 bg-black/55" style={{ top: b }} />
      <div
        className="pointer-events-none absolute rounded-xl ring-2 ring-primary"
        style={{
          top: t,
          left: l,
          width: r - l,
          height: b - t,
        }}
      />
    </div>
  );
}

export function ProsessregisterTutorialOverlay({
  open,
  steps,
  onClose,
  onDismissPermanent,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setStepIndex(0));
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const last = Math.max(0, steps.length - 1);
  const safeIndex = Math.min(stepIndex, last);
  const step = steps[safeIndex];

  const rect = useRectForSelector(
    Boolean(open && step),
    step?.targetSelectors ?? EMPTY_SELECTORS,
  );

  useEffect(() => {
    if (!open || !step) return;
    const el = findFirstElement(step.targetSelectors);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
  }, [open, step, safeIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  const canPrev = safeIndex > 0;
  const canNext = safeIndex < last;

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(last, i + 1));
  }, [last]);

  if (typeof document === "undefined" || !open || !step) {
    return null;
  }

  return createPortal(
    <>
      <BackdropHole rect={rect} />
      {/*
        Fullskjerms-wrapper (overflow-hidden) + absolute panel: unngår horisontal overflow
        som ofte oppstår med fixed + w-full + left/right samtidig.
      */}
      <div
        className="fixed inset-0 overflow-x-hidden overflow-y-hidden pointer-events-none"
        style={{ zIndex: Z_CARD }}
      >
        <div
          className={[
            "border-border/60 bg-card/98 supports-[backdrop-filter]:bg-card/90 pointer-events-auto absolute box-border flex max-h-[min(78dvh,34rem)] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-2xl border-t shadow-[0_-8px_40px_-4px_rgba(0,0,0,0.2)] backdrop-blur-md",
            "bottom-0 max-w-none pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-4",
            "left-3 right-3 w-auto",
            "md:bottom-6 md:left-1/2 md:right-auto md:w-[min(28rem,calc(100%-1.5rem))] md:max-w-md md:-translate-x-1/2 md:rounded-2xl md:border md:px-5 md:pb-5 md:pt-5 md:shadow-xl",
          ].join(" ")}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-step-title"
          aria-describedby="tutorial-step-body"
        >
        <div className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
          <div className="bg-border/50 mx-auto mb-1 h-1 w-10 shrink-0 rounded-full md:hidden" aria-hidden />

          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <ListOrdered className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-primary text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] sm:text-[11px]">
                Steg {safeIndex + 1} av {steps.length}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {step.targetHint}
                </span>
              </p>
              <h2
                id="tutorial-step-title"
                className="text-foreground font-heading text-balance break-words text-lg font-semibold leading-snug tracking-tight sm:text-xl"
              >
                {step.title}
              </h2>
              <p
                id="tutorial-step-body"
                className="text-muted-foreground text-[15px] leading-relaxed sm:text-sm"
              >
                {step.body}
              </p>
            </div>
          </div>

          <div className="border-border/50 flex min-w-0 flex-col gap-3 border-t pt-4">
            <div className="grid min-w-0 grid-cols-2 gap-2 md:flex md:justify-end md:gap-2">
              <Button
                type="button"
                variant="secondary"
                className="touch-manipulation min-h-11 w-full min-w-0 gap-1.5 px-2 md:min-h-9 md:w-auto md:shrink-0"
                disabled={!canPrev}
                onClick={goPrev}
              >
                <ChevronLeft className="size-4 shrink-0" aria-hidden />
                <span className="truncate">Forrige</span>
              </Button>
              <Button
                type="button"
                className="touch-manipulation min-h-11 w-full min-w-0 gap-1.5 px-2 md:min-h-9 md:w-auto md:shrink-0"
                disabled={!canNext}
                onClick={goNext}
              >
                <span className="truncate">Neste</span>
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </Button>
            </div>

            <div className="flex min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground touch-manipulation min-h-11 w-full justify-center md:min-h-9 md:w-auto"
                onClick={onClose}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                variant="outline"
                className="touch-manipulation min-h-11 w-full md:min-h-9 md:w-auto"
                onClick={() => {
                  void onDismissPermanent();
                }}
              >
                Ikke vis mer
              </Button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export const PROSESSREGISTER_TUTORIAL_STEPS: TutorialStep[] = [
  {
    targetSelectors: ['[data-tutorial-anchor="prosess-oversikt-header"]'],
    title: "Prosessregister-kortet",
    targetHint: "Overskrift og beskrivelse",
    body: "Her står arbeidsområdets prosessregister forklart: hver rad er en forretningsprosess med en unik prosess-ID. ROS kan også startes uten prosess (meny «Risikoanalyse»). Registeret brukes når dere vil knytte PVV eller ROS til en prosess-ID.",
  },
  {
    targetSelectors: ['[data-tutorial-anchor="hub-registrering"]'],
    title: "Veiledning og nye prosesser",
    targetHint: "Veiledning og knapper",
    body: "Verktøylinjen har «Registrer ny prosess», «Vis veiledning» (denne turen) og «Hjelp» med full forklaring. «Innstillinger for veiledning» åpner brukerinnstillinger. Tom prosess-ID kan fylles automatisk ved registrering.",
  },
  {
    targetSelectors: ['[data-tutorial-anchor="pvv-ros"]'],
    title: "PVV og ROS per prosess",
    targetHint: "Kort og søk",
    body: "Her ser du dekning per prosess: PVV-vurderinger og ROS-analyser. «Start vurdering» oppretter eller åpner vurdering med riktig prosess-ID. Søkefeltet filtrerer på navn eller ID.",
  },
  {
    targetSelectors: [
      '[data-tutorial-anchor="github-prosess"]',
      '[data-tutorial-anchor="github-varsling"]',
      '[data-tutorial-anchor="github-tur"]',
    ],
    title: "GitHub (valgfritt)",
    targetHint: "Import eller oppsett",
    body: "Velg «Issue (lenke)» eller «Prosjektkolonne», lim inn URL eller velg kolonne, og trykk Hent. Oppsett under Innstillinger — gult varsel betyr at prosjekt-tavle mangler for kolonne-import.",
  },
  {
    targetSelectors: ['[data-tutorial-anchor="prosess-oversikt-liste"]'],
    title: "Tabellen «Prosessoversikt»",
    targetHint: "Alle registrerte ID-er",
    body: "Listen viser prosess-ID, navn og GitHub-status. Klikk en rad for å redigere. Uten rader ennå er listen tom — bruk «Registrer ny prosess» over når dere trenger prosess-ID i PVV.",
  },
];
