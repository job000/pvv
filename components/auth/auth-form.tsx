"use client";

import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TailarkAuthBackground } from "@/components/auth/tailark-auth-background";
import { BrandMark } from "@/components/brand-mark";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useAuthActions } from "@convex-dev/auth/react";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type AuthMode = "signIn" | "signUp";

export function AuthForm({
  defaultMode,
  className,
}: {
  defaultMode: AuthMode;
  className?: string;
}) {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn("password", {
        flow: defaultMode === "signUp" ? "signUp" : "signIn",
        email,
        password,
      });
      if (result.redirect !== undefined) {
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext =
        next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      window.location.assign(safeNext);
    } catch (err) {
      setError(
        formatUserFacingError(
          err,
          defaultMode === "signUp"
            ? "Kunne ikke opprette konto."
            : "Feil e-post eller passord.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  const isSignUp = defaultMode === "signUp";

  return (
    <div
      className={cn(
        "relative flex min-h-dvh flex-col items-center justify-center",
        className,
      )}
    >
      <TailarkAuthBackground variant={isSignUp ? "signUp" : "signIn"} />

      <div className="absolute right-3 top-3 z-20 sm:right-5 sm:top-5">
        <ThemeModeToggle />
      </div>

      <div className="relative z-10 flex w-full max-w-[26rem] flex-col items-center px-5">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl bg-primary/20 blur-xl motion-safe:animate-pulse" />
            <BrandMark size={36} priority className="relative rounded-xl shadow-md ring-1 ring-white/20" />
          </div>
          <div className="text-center">
            <h1 className="font-heading text-xl font-bold tracking-tight">
              {isSignUp ? "Opprett konto" : "Velkommen tilbake"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {isSignUp
                ? "Kom i gang med FRO på sekunder"
                : "Logg inn for å fortsette til FRO"}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="mt-8 w-full rounded-3xl bg-card/80 p-6 shadow-xl ring-1 ring-black/[0.04] backdrop-blur-xl sm:p-8 dark:bg-card/70 dark:ring-white/[0.06]">
          {/* Tabs */}
          <nav aria-label="Innlogging eller registrering">
            <div className="flex rounded-2xl bg-muted/50 p-1">
              <Link
                href="/sign-in"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all duration-200",
                  !isSignUp
                    ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                    : "text-muted-foreground hover:text-foreground",
                )}
                scroll={false}
              >
                Logg inn
              </Link>
              <Link
                href="/sign-up"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all duration-200",
                  isSignUp
                    ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                    : "text-muted-foreground hover:text-foreground",
                )}
                scroll={false}
              >
                Ny konto
              </Link>
            </div>
          </nav>

          {/* Form */}
          <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                E-post
              </Label>
              <div className="relative">
                <Mail
                  className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl pl-10 text-sm"
                  placeholder="din@epost.no"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Passord
                </Label>
                {isSignUp && (
                  <span className="text-muted-foreground text-[10px]">
                    min. 8 tegn
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock
                  className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 z-10"
                  aria-hidden
                />
                <PasswordInput
                  id="password"
                  autoComplete={
                    isSignUp ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-11 rounded-xl pl-10 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div
                className="text-destructive bg-destructive/10 rounded-xl px-4 py-3 text-sm"
                role="alert"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl text-sm font-semibold shadow-md transition-all duration-200 hover:shadow-lg"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {isSignUp ? "Opprett konto" : "Logg inn"}
                  <ArrowRight className="ml-1.5 size-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer link */}
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mt-6 text-xs transition-colors"
        >
          ← Tilbake til forsiden
        </Link>
      </div>
    </div>
  );
}
