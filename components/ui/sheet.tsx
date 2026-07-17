"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type SheetCtx = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetCtx | null>(null);

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetContent({
  side = "left",
  className,
  children,
  /** Når true, vises panelet også på md+ (standard er kun mobil). */
  showOnDesktop = false,
}: {
  side?: "left" | "right" | "bottom";
  className?: string;
  children: React.ReactNode;
  showOnDesktop?: boolean;
}) {
  const ctx = React.useContext(SheetContext);
  if (!ctx) {
    throw new Error("SheetContent must be used inside Sheet");
  }
  const { open, onOpenChange } = ctx;
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) {
    return null;
  }

  const isBottom = side === "bottom";

  return createPortal(
    <div
      className={cn("fixed inset-0 z-50", !showOnDesktop && "md:hidden")}
    >
      <button
        type="button"
        aria-label="Lukk"
        className={cn(
          "absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute flex flex-col bg-background shadow-2xl",
          "transition-transform duration-200 ease-out will-change-transform",
          isBottom
            ? cn(
                "inset-x-0 bottom-0 max-h-[min(85dvh,36rem)] rounded-t-3xl border-t border-border/50",
                "pb-[env(safe-area-inset-bottom)]",
                visible ? "translate-y-0" : "translate-y-full",
              )
            : cn(
                "inset-y-0 w-[min(20rem,92vw)]",
                "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
                side === "left"
                  ? cn(
                      "left-0 rounded-r-2xl border-r border-border/50",
                      visible ? "translate-x-0" : "-translate-x-full",
                    )
                  : cn(
                      "right-0 rounded-l-2xl border-l border-border/50",
                      visible ? "translate-x-0" : "translate-x-full",
                    ),
              ),
          className,
        )}
      >
        {isBottom ? (
          <div className="flex justify-center pt-2.5 pb-1" aria-hidden>
            <span className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
