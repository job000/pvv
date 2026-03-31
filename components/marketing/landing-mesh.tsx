"use client";

import { cn } from "@/lib/utils";

/** Fullbredde mesh til forsiden — gjenbruker samme animasjonskeyframes som innlogging. */
export function LandingMesh({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-b from-muted/80 via-background to-muted/30 dark:from-muted/20 dark:via-background dark:to-background" />
      <div
        className="absolute -left-[20%] top-[-30%] h-[65%] w-[100%] rounded-[50%] blur-[110px] motion-safe:animate-[tailark-auth-mesh_24s_ease-in-out_infinite] bg-gradient-to-br from-primary/20 via-sky-500/10 to-transparent dark:from-primary/15 dark:via-sky-400/8"
      />
      <div
        className="absolute -bottom-[25%] right-[-10%] h-[55%] w-[75%] rounded-[50%] blur-[100px] motion-safe:animate-[tailark-auth-mesh-2_30s_ease-in-out_infinite] bg-gradient-to-tl from-emerald-500/15 via-transparent to-primary/10 dark:from-emerald-400/10"
      />
      <div
        className="absolute inset-0 opacity-[0.3] dark:opacity-[0.18]"
        style={{
          backgroundImage: `linear-gradient(color-mix(in oklch, var(--border) 50%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--border) 50%, transparent) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay dark:opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
