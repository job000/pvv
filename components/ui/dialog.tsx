"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type DialogCtx = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogCtx | null>(null);

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogContent({
  className,
  children,
  /** max width: sm … 7xl — bruk 5xl–7xl for brede redigeringsvinduer på skjerm. */
  size = "lg",
  titleId,
  descriptionId,
  /** Legg f.eks. `z-[210]` når dialogen skal over en annen modal (bekreftelse). */
  portalClassName,
  /**
   * Fyll hele visningsporten (100dvh × 100%), uten ytre padding og uten klikk-til-lukk-backdrop.
   * Passer diagram-/editor-fullskjerm (draw.io-lignende). Lukk med Esc eller eksplisitt knapp.
   */
  fillViewport = false,
}: {
  className?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
  titleId?: string;
  descriptionId?: string;
  portalClassName?: string;
  fillViewport?: boolean;
}) {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error("DialogContent must be used inside Dialog");
  }
  const { open, onOpenChange } = ctx;
  /** Må følge fullskjerm — portaler til `body` havner under nettleserens fullskjerm-topplag. */
  const [portalRoot, setPortalRoot] = React.useState<Element | null>(null);

  React.useLayoutEffect(() => {
    const sync = () => {
      setPortalRoot(document.fullscreenElement ?? document.body);
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);

    const fs = document.fullscreenElement;
    if (fs instanceof HTMLElement) {
      const prevFs = fs.style.overflow;
      fs.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        fs.style.overflow = prevFs;
      };
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open || portalRoot == null) {
    return null;
  }

  const maxW = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
  }[size];

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[200] flex",
        fillViewport
          ? "items-stretch justify-stretch p-0"
          : [
              "items-end justify-center sm:items-center",
              // Safe area + padding — dialog max-height må trekke fra dette
              "px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6",
            ].join(" "),
        portalClassName,
      )}
    >
      {!fillViewport ? (
        <button
          type="button"
          aria-label="Lukk"
          className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "bg-background relative z-10 flex w-full min-h-0 flex-col overflow-hidden border shadow-2xl",
          fillViewport
            ? "h-dvh max-h-dvh max-w-none rounded-none border-border/60 shadow-none sm:rounded-none"
            : cn(
                // 100dvh minus overlay-padding + safe areas — unngår at toppen klippes på mobil
                "border-border/80 max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] rounded-t-2xl rounded-b-2xl sm:max-h-[min(92vh,56rem)] sm:rounded-3xl",
                maxW,
              ),
          className,
        )}
      >
        {children}
      </div>
    </div>,
    portalRoot,
  );
}

export function DialogHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border/60 bg-muted/15 shrink-0 border-b px-5 py-4 sm:px-8 sm:py-5",
        // Hold header kompakt på mobil så body/footer får plass
        "max-sm:px-4 max-sm:py-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DialogBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-8 sm:py-6",
        "max-sm:px-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DialogFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border/60 bg-muted/10 flex shrink-0 flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:px-8 sm:py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
