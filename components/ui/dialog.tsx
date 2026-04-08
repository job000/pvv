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
}: {
  className?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
  titleId?: string;
  descriptionId?: string;
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
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Lukk"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "border-border/80 bg-background relative z-10 flex max-h-[min(92vh,56rem)] w-full flex-col overflow-hidden rounded-2xl border shadow-2xl sm:rounded-3xl",
          maxW,
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
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 sm:py-6", className)}>
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
        "border-border/60 bg-muted/10 flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-5 py-3 sm:px-8 sm:py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
