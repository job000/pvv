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
  const shellRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const pointerDownRef = React.useRef(false);

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

    if (!fillViewport) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }

    /* Hard scroll-lås — overflow:hidden alene stopper ikke iOS rubber-band under tegning. */
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [fillViewport, open, onOpenChange]);

  /* Lås fillViewport til visualViewport i piksler — 100dvh kollapser/hopper på iOS midt i streken. */
  React.useLayoutEffect(() => {
    if (!open || !fillViewport) return;
    const shell = shellRef.current;
    const panel = panelRef.current;
    if (!shell || !panel) return;

    const apply = () => {
      if (pointerDownRef.current) return;
      const vv = window.visualViewport;
      const width = Math.round(vv?.width ?? window.innerWidth);
      const height = Math.round(vv?.height ?? window.innerHeight);
      const top = Math.round(vv?.offsetTop ?? 0);
      const left = Math.round(vv?.offsetLeft ?? 0);
      if (width < 8 || height < 8) return;

      shell.style.top = `${top}px`;
      shell.style.left = `${left}px`;
      shell.style.width = `${width}px`;
      shell.style.height = `${height}px`;
      shell.style.right = "auto";
      shell.style.bottom = "auto";

      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
      panel.style.maxHeight = `${height}px`;
    };

    const onPointerDown = () => {
      pointerDownRef.current = true;
    };
    const onPointerUp = () => {
      pointerDownRef.current = false;
      apply();
    };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);

    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
      shell.style.top = "";
      shell.style.left = "";
      shell.style.width = "";
      shell.style.height = "";
      shell.style.right = "";
      shell.style.bottom = "";
      panel.style.width = "";
      panel.style.height = "";
      panel.style.maxHeight = "";
    };
  }, [fillViewport, open]);

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
      ref={shellRef}
      className={cn(
        "fixed z-[200] flex",
        fillViewport
          ? "touch-none items-stretch justify-stretch overscroll-none p-0"
          : [
              "inset-0 items-end justify-center sm:items-center",
              // Safe area + padding — dialog max-height må trekke fra dette
              "px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6",
            ].join(" "),
        portalClassName,
      )}
      style={
        fillViewport
          ? { top: 0, left: 0, width: "100%", height: "100%" }
          : undefined
      }
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "bg-background relative z-10 flex w-full min-h-0 flex-col overflow-hidden border shadow-2xl",
          fillViewport
            ? "h-full max-h-none w-full max-w-none rounded-none border-border/60 shadow-none sm:rounded-none"
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
        "max-sm:px-4 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
