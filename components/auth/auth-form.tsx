"use client";

import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TailarkAuthBackground } from "@/components/auth/tailark-auth-background";
import { BrandMark } from "@/components/brand-mark";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useAuthActions } from "@convex-dev/auth/react";
import { cn } from "@/lib/utils";
import { Mail } from "lucide-react";
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
      // OAuth/magic link har allerede satt window.location i auth-biblioteket.
      if (result.redirect !== undefined) {
        return;
      }
      // Full navigasjon: unngår race der App Router navigerer før Convex Auth
      // har bekreftet sesjon (første innlogging virket «død», andre forsøk gikk).
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
        "relative flex min-h-dvh flex-col",
        className,
      )}
    >
      <TailarkAuthBackground variant={isSignUp ? "signUp" : "signIn"} />

      <div className="absolute right-3 top-3 z-20 sm:right-5 sm:top-5">
        <ThemeModeToggle />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center px-4 pb-10 pt-16 sm:px-6 sm:pt-20">
        <div className="flex flex-col items-center gap-1.5">
          <BrandMark size={40} priority className="rounded-xl" />
          <p className="font-heading text-foreground text-base font-semibold tracking-tight">
            FRO
          </p>
        </div>

        <Card className="border-border/60 bg-card/85 mt-10 w-full max-w-sm border shadow-xl backdrop-blur-md dark:bg-card/80">
          <nav
            className="p-1.5"
            aria-label="Innlogging eller registrering"
          >
            <div className="bg-muted/50 flex rounded-xl p-0.5">
              <Link
                href="/sign-in"
                className={cn(
                  "flex flex-1 items-center justify-center rounded-[10px] py-2 text-center text-sm font-medium transition-colors",
                  !isSignUp
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                scroll={false}
              >
                Logg inn
              </Link>
              <Link
                href="/sign-up"
                className={cn(
                  "flex flex-1 items-center justify-center rounded-[10px] py-2 text-center text-sm font-medium transition-colors",
                  isSignUp
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                scroll={false}
              >
                Ny konto
              </Link>
            </div>
          </nav>

          <form onSubmit={(e) => void submit(e)}>
            <CardContent className="space-y-4 px-5 pb-6 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-muted-foreground text-xs">
                  E-post
                </Label>
                <div className="relative">
                  <Mail
                    className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
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
                    className="h-10 pl-9"
                    placeholder="din@epost.no"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="password"
                    className="text-muted-foreground text-xs"
                  >
                    Passord
                  </Label>
                  {isSignUp ? (
                    <span className="text-muted-foreground text-[11px]">
                      min. 8 tegn
                    </span>
                  ) : null}
                </div>
                <PasswordInput
                  id="password"
                  autoComplete={
                    isSignUp ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-10"
                  placeholder="••••••••"
                />
              </div>
              {error ? (
                <div
                  className="text-destructive bg-destructive/10 border-destructive/25 rounded-lg border px-3 py-2 text-sm"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}
              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full font-semibold shadow-sm"
              >
                {loading
                  ? "…"
                  : isSignUp
                    ? "Opprett konto"
                    : "Logg inn"}
              </Button>
            </CardContent>
          </form>
        </Card>

        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mt-8 text-xs transition-colors"
        >
          ← Forside
        </Link>
      </div>
    </div>
  );
}
