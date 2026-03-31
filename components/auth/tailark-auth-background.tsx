"use client";

import { cn } from "@/lib/utils";

/**
 * Tailark-inspirert dynamisk bakgrunn: gradient-mesh, subtilt rutenett og støy.
 * Ulike fargeaksenter for innlogging vs. registrering.
 */
export function TailarkAuthBackground({
  variant,
  className,
}: {
  variant: "signIn" | "signUp";
  className?: string;
}) {
  const isSignUp = variant === "signUp";

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      {/* Mist-basert vertikal gradient (jf. Tailark Mist-kit) */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/70 via-background to-background dark:from-muted/25 dark:via-background" />

      {/* Primær blob — langsom bevegelse */}
      <div
        className={cn(
          "absolute -left-[18%] top-[-28%] h-[58%] w-[95%] rounded-[50%] blur-[100px] motion-safe:animate-[tailark-auth-mesh_22s_ease-in-out_infinite]",
          "bg-gradient-to-br from-primary/25 via-primary/8 to-transparent",
          "dark:from-primary/18 dark:via-primary/6",
          isSignUp &&
            "from-emerald-500/20 via-primary/12 to-transparent dark:from-emerald-400/14",
        )}
      />

      {/* Sekundær blob — motsatt fase */}
      <div
        className={cn(
          "absolute -bottom-[22%] left-[0%] h-[52%] w-[78%] rounded-[50%] blur-[92px] motion-safe:animate-[tailark-auth-mesh-2_28s_ease-in-out_infinite]",
          "bg-gradient-to-tr from-primary/12 to-transparent dark:from-primary/10",
          isSignUp &&
            "from-teal-500/14 via-emerald-500/8 to-primary/10 dark:from-teal-400/10",
        )}
      />

      {/* Diskret rutenett (bruker theme border-token) */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.22]"
        style={{
          backgroundImage: `linear-gradient(color-mix(in oklch, var(--border) 55%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--border) 55%, transparent) 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
        }}
      />

      {/* Fraktal støy (SVG) — dybde uten tunge assets */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay dark:opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Nedre vignett for lesbarhet mot innhold */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent dark:from-background/60" />
    </div>
  );
}
