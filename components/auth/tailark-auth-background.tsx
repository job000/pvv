"use client";

import { cn } from "@/lib/utils";

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
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/60 via-background to-background dark:from-muted/20 dark:via-background" />

      {/* Primary orb — slow drift */}
      <div
        className={cn(
          "absolute -left-[15%] top-[-22%] h-[55%] w-[85%] rounded-[50%] blur-[120px] motion-safe:animate-[tailark-auth-mesh_22s_ease-in-out_infinite]",
          "bg-gradient-to-br from-primary/30 via-primary/10 to-transparent",
          "dark:from-primary/20 dark:via-primary/8",
          isSignUp &&
            "from-emerald-500/25 via-primary/15 to-transparent dark:from-emerald-400/18",
        )}
      />

      {/* Secondary orb — counter-phase */}
      <div
        className={cn(
          "absolute -bottom-[18%] -right-[10%] h-[48%] w-[70%] rounded-[50%] blur-[100px] motion-safe:animate-[tailark-auth-mesh-2_28s_ease-in-out_infinite]",
          "bg-gradient-to-tl from-sky-500/15 via-primary/8 to-transparent",
          "dark:from-sky-400/12 dark:via-primary/6",
          isSignUp &&
            "from-teal-500/18 via-emerald-500/10 to-transparent dark:from-teal-400/12",
        )}
      />

      {/* Tertiary accent orb — subtle float */}
      <div
        className={cn(
          "absolute left-[55%] top-[15%] h-[30%] w-[40%] rounded-[50%] blur-[90px] motion-safe:animate-[tailark-auth-mesh_30s_ease-in-out_infinite_reverse]",
          "bg-gradient-to-bl from-violet-500/10 to-transparent",
          "dark:from-violet-400/8",
          isSignUp && "from-cyan-500/10 dark:from-cyan-400/8",
        )}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.2]"
        style={{
          backgroundImage: `radial-gradient(color-mix(in oklch, var(--border) 65%, transparent) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Fractal noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay dark:opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Radial spotlight on form area */}
      <div className="absolute left-1/2 top-[40%] h-[50%] w-[60%] -translate-x-1/2 rounded-full bg-background/40 blur-[80px] dark:bg-background/30" />

      {/* Bottom vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
    </div>
  );
}
