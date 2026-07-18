"use client";

import { cn } from "@/lib/utils";

/**
 * Levende innloggings-/registreringsbakgrunn: aurora, drifting mesh, grid.
 * Light mode har høyere kontrast enn dark — ellers forsvinner bevegelsen.
 * Respekterer prefers-reduced-motion.
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
      {/* Tinted base — light mode needs a cool canvas so orbs read clearly */}
      <div
        className={cn(
          "absolute inset-0",
          "bg-[#e8f1f8] dark:bg-background",
          isSignUp && "bg-[#e6f4f1] dark:bg-background",
        )}
      />
      <div
        className={cn(
          "absolute inset-0",
          "bg-gradient-to-b from-sky-200/80 via-[#eef4fa] to-slate-200/90",
          "dark:from-sky-950/55 dark:via-background dark:to-background",
          isSignUp &&
            "from-teal-200/75 via-[#eaf6f3] to-slate-200/90 dark:from-teal-950/40 dark:via-background",
        )}
      />

      {/* Primary aurora orb — stronger in light */}
      <div
        className={cn(
          "absolute -left-[20%] top-[-28%] h-[62%] w-[95%] rounded-[50%] blur-[90px] will-change-transform",
          "motion-safe:animate-[tailark-auth-mesh_18s_ease-in-out_infinite]",
          "bg-gradient-to-br from-sky-500/55 via-cyan-400/35 to-transparent",
          "dark:from-sky-400/35 dark:via-cyan-400/18",
          isSignUp &&
            "from-teal-500/50 via-emerald-400/32 to-transparent dark:from-teal-400/30 dark:via-emerald-400/16",
        )}
      />

      {/* Secondary counter-orb */}
      <div
        className={cn(
          "absolute -bottom-[22%] -right-[14%] h-[55%] w-[78%] rounded-[50%] blur-[80px] will-change-transform",
          "motion-safe:animate-[tailark-auth-mesh-2_22s_ease-in-out_infinite]",
          "bg-gradient-to-tl from-cyan-500/45 via-sky-400/25 to-transparent",
          "dark:from-cyan-400/25 dark:via-sky-400/10",
          isSignUp &&
            "from-emerald-500/42 via-teal-400/22 to-transparent dark:from-emerald-400/22",
        )}
      />

      {/* Sweeping aurora band */}
      <div
        className={cn(
          "absolute left-[-10%] top-[20%] h-[40%] w-[120%] rounded-[100%] blur-[60px] will-change-transform",
          "motion-safe:animate-[auth-aurora-sweep_16s_ease-in-out_infinite]",
          "bg-gradient-to-r from-transparent via-sky-500/40 to-transparent",
          "dark:via-cyan-300/20",
          isSignUp && "via-teal-500/38 dark:via-emerald-300/18",
        )}
      />

      {/* Soft beam */}
      <div
        className={cn(
          "absolute left-[40%] top-[-10%] h-[80%] w-[18%] -rotate-12 rounded-full blur-[50px] will-change-transform",
          "motion-safe:animate-[auth-beam-pulse_10s_ease-in-out_infinite]",
          "bg-gradient-to-b from-sky-400/45 via-cyan-400/20 to-transparent",
          "dark:from-sky-300/30 dark:via-cyan-400/10",
          isSignUp &&
            "from-teal-400/42 via-emerald-400/18 to-transparent dark:from-teal-300/28",
        )}
      />

      {/* Tertiary float orb */}
      <div
        className={cn(
          "absolute left-[50%] top-[10%] h-[34%] w-[44%] rounded-[50%] blur-[70px] will-change-transform",
          "motion-safe:animate-[tailark-auth-mesh_26s_ease-in-out_infinite_reverse]",
          "bg-gradient-to-bl from-cyan-500/30 to-transparent",
          "dark:from-cyan-300/14",
          isSignUp && "from-emerald-500/28 dark:from-teal-300/12",
        )}
      />

      {/* Perspective grid — darker lines in light mode */}
      <div
        className={cn(
          "absolute inset-0 opacity-[0.45] dark:opacity-[0.28]",
          "motion-safe:animate-[auth-grid-drift_28s_linear_infinite]",
          "[mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_78%)]",
        )}
        style={{
          backgroundImage: `
            linear-gradient(color-mix(in oklch, var(--foreground) 28%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in oklch, var(--foreground) 28%, transparent) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
        }}
      />
      <div
        className={cn(
          "absolute inset-0 opacity-[0.2] dark:opacity-0",
          "motion-safe:animate-[auth-grid-drift_40s_linear_infinite_reverse]",
        )}
        style={{
          backgroundImage: `
            linear-gradient(rgba(14, 116, 144, 0.22) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14, 116, 144, 0.22) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
        }}
      />

      {/* Floating particles — darker/more opaque in light */}
      <div className="absolute inset-0">
        {[
          { t: "18%", l: "12%", d: "0s", s: "size-1.5" },
          { t: "32%", l: "78%", d: "1.2s", s: "size-2" },
          { t: "58%", l: "22%", d: "2.4s", s: "size-1.5" },
          { t: "70%", l: "66%", d: "0.8s", s: "size-2" },
          { t: "42%", l: "48%", d: "3s", s: "size-1.5" },
          { t: "24%", l: "88%", d: "1.8s", s: "size-1.5" },
          { t: "80%", l: "38%", d: "2.1s", s: "size-2" },
          { t: "14%", l: "55%", d: "0.4s", s: "size-1.5" },
        ].map((p, i) => (
          <span
            key={i}
            className={cn(
              "absolute rounded-full",
              "bg-sky-600/70 shadow-[0_0_12px_3px_rgba(2,132,199,0.35)]",
              "dark:bg-cyan-200/60 dark:shadow-[0_0_10px_2px_rgba(125,211,252,0.35)]",
              isSignUp &&
                "bg-teal-600/70 shadow-[0_0_12px_3px_rgba(13,148,136,0.35)] dark:bg-emerald-200/55",
              "motion-safe:animate-[auth-particle-float_7s_ease-in-out_infinite]",
              p.s,
            )}
            style={{ top: p.t, left: p.l, animationDelay: p.d }}
          />
        ))}
      </div>

      {/* Noise */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-multiply dark:opacity-[0.07] dark:mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Soft spotlight — muted wash, not harsh white */}
      <div className="absolute left-1/2 top-[38%] h-[48%] w-[64%] -translate-x-1/2 rounded-full bg-sky-100/35 blur-[80px] dark:bg-background/25" />

      {/* Light-mode edge vignette (slate, not black) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(100,116,139,0.32)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_30%,oklch(0.08_0.02_245_/_0.7)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-400/25 via-transparent to-sky-200/25 dark:from-background dark:via-transparent dark:to-transparent" />
    </div>
  );
}
