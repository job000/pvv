"use client";

import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useAuthActions } from "@convex-dev/auth/react";
import { cn } from "@/lib/utils";
import { Lock, Mail, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn("password", {
        flow: defaultMode === "signUp" ? "signUp" : "signIn",
        email,
        password,
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        formatUserFacingError(
          err,
          defaultMode === "signUp"
            ? "Kunne ikke opprette konto. Prøv igjen."
            : "Innlogging feilet. Sjekk e-post og passord.",
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
        "bg-background flex min-h-dvh flex-col lg:grid lg:min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <aside className="relative flex flex-col justify-between overflow-hidden border-b border-border/60 px-8 py-10 lg:min-h-dvh lg:border-b-0 lg:border-r lg:px-12 lg:py-14">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_0%_-20%,hsl(var(--primary)/0.18),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_100%,hsl(var(--primary)/0.12),transparent_50%)]"
          aria-hidden
        />
        <div className="relative space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary/15 text-primary flex size-11 items-center justify-center rounded-2xl shadow-sm ring-1 ring-primary/20">
              <Shield className="size-6" aria-hidden />
            </div>
            <div>
              <p className="font-heading text-lg font-semibold tracking-tight">
                PVV
              </p>
              <p className="text-muted-foreground text-sm">
                Prosess og personvern
              </p>
            </div>
          </div>
          <div className="max-w-md space-y-3">
            <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              {isSignUp
                ? "Opprett konto og kom i gang"
                : "Velkommen tilbake"}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Samarbeid om PVV-vurderinger, prosessregister og ROS i felles
              arbeidsområder — med roller, sporbarhet og versjoner.
            </p>
          </div>
          <ul className="text-muted-foreground max-w-sm space-y-2.5 text-sm leading-relaxed">
            <li className="flex gap-2">
              <span className="text-primary mt-0.5 font-bold">✓</span>
              Trygg innlogging med kryptert passord
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5 font-bold">✓</span>
              Invitasjoner og tilganger per arbeidsområde
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5 font-bold">✓</span>
              Fungerer på mobil og som PWA
            </li>
          </ul>
        </div>
        <p className="text-muted-foreground relative mt-10 hidden text-xs leading-relaxed lg:block">
          Ved å fortsette godtar du at vi behandler data i tråd med formålet
          for tjenesten. Kontakt administratoren i din organisasjon ved spørsmål.
        </p>
      </aside>

      <main className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-8 lg:px-12 lg:py-14">
        <div className="mx-auto w-full max-w-[min(100%,22rem)]">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <Lock className="text-primary size-5" aria-hidden />
              <span className="font-heading font-semibold">PVV</span>
            </div>
          </div>

          <Card className="border-border/80 shadow-lg shadow-black/5">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="font-heading text-xl tracking-tight">
                {isSignUp ? "Registrer deg" : "Logg inn"}
              </CardTitle>
              <CardDescription>
                {isSignUp
                  ? "Opprett en konto med e-post og passord."
                  : "Skriv inn e-postadressen og passordet ditt."}
              </CardDescription>
            </CardHeader>

            <nav
              className="px-6 pb-2"
              aria-label="Velg innlogging eller registrering"
            >
              <div className="bg-muted/60 flex rounded-xl p-1">
                <Link
                  href="/sign-in"
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors",
                    !isSignUp
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  scroll={false}
                >
                  Logg inn
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors",
                    isSignUp
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  scroll={false}
                >
                  Ny bruker
                </Link>
              </div>
            </nav>

            <form onSubmit={(e) => void submit(e)}>
              <CardContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
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
                      className="pl-9"
                      placeholder="navn@bedrift.no"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Label htmlFor="password">Passord</Label>
                    {isSignUp ? (
                      <span
                        id="password-hint"
                        className="text-muted-foreground text-xs"
                      >
                        Minst 8 tegn
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
                    placeholder="••••••••"
                    aria-describedby={isSignUp ? "password-hint" : undefined}
                  />
                </div>
                {error ? (
                  <div
                    className="text-destructive bg-destructive/10 border-destructive/30 rounded-lg border px-3 py-2.5 text-sm leading-relaxed"
                    role="alert"
                  >
                    {error}
                  </div>
                ) : null}
              </CardContent>
              <div className="flex flex-col gap-3 border-t border-border/60 px-6 py-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-full text-[15px] font-semibold shadow-sm"
                >
                  {loading
                    ? "Vent …"
                    : isSignUp
                      ? "Opprett konto"
                      : "Logg inn"}
                </Button>
              </div>
            </form>
          </Card>

          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground mt-8 inline-flex items-center gap-1 text-sm transition-colors"
          >
            <span aria-hidden>←</span> Til forsiden
          </Link>
        </div>
      </main>
    </div>
  );
}
