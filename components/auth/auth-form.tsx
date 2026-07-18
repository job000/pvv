"use client";

import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TailarkAuthBackground } from "@/components/auth/tailark-auth-background";
import { BrandMark } from "@/components/brand-mark";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { api } from "@/convex/_generated/api";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

type AuthMode = "signIn" | "signUp";
type View = "auth" | "forgot" | "resetCode";

type GenderValue = "" | "female" | "male" | "other" | "prefer_not";

export function AuthForm({
  defaultMode,
  className,
}: {
  defaultMode: AuthMode;
  className?: string;
}) {
  const { signIn } = useAuthActions();
  const patchProfile = useMutation(api.users.patchMyUserSettings);

  const [view, setView] = useState<View>("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<GenderValue>("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = defaultMode === "signUp";
  const wide = isSignUp && view === "auth";

  const passwordsMatch = useMemo(() => {
    if (!isSignUp || !confirmPassword) return true;
    return password === confirmPassword;
  }, [isSignUp, password, confirmPassword]);

  function clearFeedback() {
    setError(null);
    setInfo(null);
  }

  function goAfterAuth() {
    const next = new URLSearchParams(window.location.search).get("next");
    const safeNext =
      next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    window.location.assign(safeNext);
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    clearFeedback();

    if (isSignUp) {
      if (!firstName.trim()) {
        setError("Fornavn er påkrevd.");
        return;
      }
      if (password.length < 8) {
        setError("Passordet må være minst 8 tegn.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passordene stemmer ikke overens.");
        return;
      }
      const parsedAge = age.trim() ? Number(age) : undefined;
      if (
        age.trim() &&
        (Number.isNaN(parsedAge) ||
          !Number.isInteger(parsedAge) ||
          parsedAge! < 0 ||
          parsedAge! > 120)
      ) {
        setError("Ugyldig alder (0–120).");
        return;
      }
    }

    setLoading(true);
    try {
      const name = [firstName, lastName].filter(Boolean).join(" ").trim();
      const result = await signIn("password", {
        flow: isSignUp ? "signUp" : "signIn",
        email: email.trim(),
        password,
        ...(isSignUp
          ? {
              name,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
            }
          : {}),
      });

      if (isSignUp) {
        const parsedAge = age.trim() ? Number(age) : undefined;
        try {
          await patchProfile({
            firstName: firstName.trim(),
            lastName: lastName.trim() || undefined,
            age: parsedAge,
            gender: gender === "" ? undefined : gender,
          });
        } catch {
          // Konto er opprettet — profil kan fylles senere under Innstillinger.
        }
      }

      if (result.redirect !== undefined) {
        return;
      }
      goAfterAuth();
    } catch (err) {
      setError(
        formatUserFacingError(
          err,
          isSignUp
            ? "Kunne ikke opprette konto. Prøv igjen."
            : "Kunne ikke logge inn. Sjekk e-post og passord.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function normalizedEmail() {
    return email.trim().toLowerCase();
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    clearFeedback();
    const addr = normalizedEmail();
    if (!addr.includes("@")) {
      setError("Ugyldig e-postadresse.");
      return;
    }
    setEmail(addr);
    setLoading(true);
    try {
      await signIn("password", {
        flow: "reset",
        email: addr,
      });
      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      const localDev =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");
      setInfo(
        localDev
          ? `Kode sendt til ${addr}. Uten RESEND_API_KEY finner du koden i Convex-loggerne.`
          : `Hvis kontoen finnes, har vi sendt en kode til ${addr}. Sjekk også søppelpost.`,
      );
      setView("resetCode");
    } catch (err) {
      setError(
        formatUserFacingError(
          err,
          "Kunne ikke sende tilbakestillingskode. Prøv igjen.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitResetCode(e: React.FormEvent) {
    e.preventDefault();
    clearFeedback();
    if (newPassword.length < 8) {
      setError("Passordet må være minst 8 tegn.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passordene stemmer ikke overens.");
      return;
    }
    const addr = normalizedEmail();
    const code = resetCode.replace(/\s+/g, "").trim();
    if (code.length < 6) {
      setError("Skriv inn koden fra e-posten.");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn("password", {
        flow: "reset-verification",
        email: addr,
        code,
        newPassword,
      });
      if (result.redirect !== undefined) {
        return;
      }
      goAfterAuth();
    } catch (err) {
      setError(
        formatUserFacingError(
          err,
          "Ugyldig eller utløpt kode. Be om ny kode og prøv igjen.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  const title =
    view === "forgot"
      ? "Glemt passord"
      : view === "resetCode"
        ? "Ny passordkode"
        : isSignUp
          ? "Opprett konto"
          : "Velkommen tilbake";

  const subtitle =
    view === "forgot"
      ? "Vi sender en engangskode til e-posten din"
      : view === "resetCode"
        ? `Skriv inn koden vi sendte til ${email || "e-posten din"}`
        : isSignUp
          ? "Kom i gang med Zorlin — fyll inn det viktigste først"
          : "Logg inn for å fortsette til Zorlin";

  return (
    <div
      className={cn(
        "relative flex min-h-dvh flex-col items-center justify-center py-10",
        className,
      )}
    >
      <TailarkAuthBackground variant={isSignUp ? "signUp" : "signIn"} />

      <div className="absolute right-3 top-3 z-20 sm:right-5 sm:top-5">
        <ThemeModeToggle
          className={cn(
            "size-10 border border-border/80 bg-card text-foreground shadow-md",
            "hover:bg-muted hover:text-foreground",
            "dark:border-white/15 dark:bg-card/80 dark:shadow-none",
            "dark:hover:bg-card dark:hover:text-foreground",
          )}
        />
      </div>

      <div
        className={cn(
          "relative z-10 flex w-full flex-col items-center px-5",
          wide ? "max-w-[34rem]" : "max-w-[26rem]",
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-4 rounded-[1.75rem] bg-primary/25 blur-2xl motion-safe:animate-pulse" />
            <BrandMark
              size={44}
              priority
              className="relative shadow-lg"
            />
          </div>
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-[1.7rem]">
              {title}
            </h1>
            <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mt-8 w-full rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.22)] backdrop-blur-2xl",
            "sm:p-8",
            "dark:border-white/[0.08] dark:bg-card/75 dark:shadow-[0_24px_80px_-28px_rgba(0,0,0,0.65)]",
          )}
        >
          {view === "auth" ? (
            <>
              <nav aria-label="Innlogging eller registrering">
                <div className="flex rounded-2xl bg-muted/60 p-1 ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
                  <Link
                    href="/sign-in"
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-xl py-2.5 text-sm font-medium transition-all duration-200",
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
                      "flex flex-1 items-center justify-center rounded-xl py-2.5 text-sm font-medium transition-all duration-200",
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

              <form
                onSubmit={(e) => void submitAuth(e)}
                className="mt-6 space-y-4"
              >
                {isSignUp ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="firstName"
                      label="Fornavn"
                      icon={<UserRound className="size-3.5" aria-hidden />}
                    >
                      <Input
                        id="firstName"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        className="h-11 rounded-xl"
                        placeholder="Ola"
                      />
                    </Field>
                    <Field id="lastName" label="Etternavn">
                      <Input
                        id="lastName"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-11 rounded-xl"
                        placeholder="Nordmann"
                      />
                    </Field>
                  </div>
                ) : null}

                <Field
                  id="email"
                  label="E-post"
                  icon={<Mail className="size-3.5" aria-hidden />}
                >
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 rounded-xl"
                    placeholder="din@epost.no"
                  />
                </Field>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="password"
                      className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
                    >
                      <Lock className="size-3.5 shrink-0" aria-hidden />
                      Passord
                      {isSignUp ? (
                        <span className="font-normal opacity-70">· min. 8 tegn</span>
                      ) : null}
                    </Label>
                    {!isSignUp ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => {
                          clearFeedback();
                          setView("forgot");
                        }}
                      >
                        Glemt passord?
                      </button>
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
                    className="h-11 rounded-xl"
                    placeholder="••••••••"
                  />
                </div>

                {isSignUp ? (
                  <>
                    <Field id="confirmPassword" label="Bekreft passord">
                      <PasswordInput
                        id="confirmPassword"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        className="h-11 rounded-xl"
                        placeholder="Skriv passordet på nytt"
                      />
                      {!passwordsMatch ? (
                        <p className="text-amber-600 dark:text-amber-400 text-xs">
                          Passordene stemmer ikke overens.
                        </p>
                      ) : null}
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id="gender" label="Kjønn (valgfritt)">
                        <select
                          id="gender"
                          value={gender}
                          onChange={(e) =>
                            setGender(e.target.value as GenderValue)
                          }
                          className="border-input bg-background flex h-11 w-full rounded-xl border px-3 text-sm"
                        >
                          <option value="">Ikke oppgitt</option>
                          <option value="female">Kvinne</option>
                          <option value="male">Mann</option>
                          <option value="other">Annet</option>
                          <option value="prefer_not">Ønsker ikke å oppgi</option>
                        </select>
                      </Field>
                      <Field id="age" label="Alder (valgfritt)">
                        <Input
                          id="age"
                          type="number"
                          min={0}
                          max={120}
                          inputMode="numeric"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          className="h-11 rounded-xl"
                          placeholder="—"
                        />
                      </Field>
                    </div>
                  </>
                ) : null}

                <Feedback error={error} info={info} isSignUp={isSignUp} />

                <Button
                  type="submit"
                  disabled={loading || (isSignUp && !passwordsMatch)}
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
            </>
          ) : null}

          {view === "forgot" ? (
            <form
              onSubmit={(e) => void submitForgot(e)}
              className="space-y-4"
            >
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
                onClick={() => {
                  clearFeedback();
                  setView("auth");
                }}
              >
                <ArrowLeft className="size-4" />
                Tilbake til innlogging
              </button>

              <Field
                id="forgot-email"
                label="E-post"
                icon={<Mail className="size-3.5" aria-hidden />}
              >
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl"
                  placeholder="din@epost.no"
                />
              </Field>

              <Feedback error={error} info={info} isSignUp={false} />

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl text-sm font-semibold"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Send tilbakestillingskode"
                )}
              </Button>
            </form>
          ) : null}

          {view === "resetCode" ? (
            <form
              onSubmit={(e) => void submitResetCode(e)}
              className="space-y-4"
            >
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
                onClick={() => {
                  clearFeedback();
                  setResetCode("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setView("forgot");
                }}
              >
                <ArrowLeft className="size-4" />
                Tilbake
              </button>

              <Field id="reset-code" label="Kode fra e-post">
                <Input
                  id="reset-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={resetCode}
                  onChange={(e) =>
                    setResetCode(e.target.value.replace(/[^\d]/g, "").slice(0, 8))
                  }
                  required
                  maxLength={8}
                  className="h-11 rounded-xl tracking-[0.25em]"
                  placeholder="12345678"
                />
              </Field>

              <Field id="new-password" label="Nytt passord">
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-11 rounded-xl"
                  placeholder="Minst 8 tegn"
                />
              </Field>

              <Field id="confirm-new-password" label="Bekreft nytt passord">
                <PasswordInput
                  id="confirm-new-password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-11 rounded-xl"
                  placeholder="Skriv passordet på nytt"
                />
              </Field>

              <Feedback error={error} info={info} isSignUp={false} />

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl text-sm font-semibold"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Sett nytt passord
                    <ArrowRight className="ml-1.5 size-4" />
                  </>
                )}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
      >
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}

function Feedback({
  error,
  info,
  isSignUp,
}: {
  error: string | null;
  info: string | null;
  isSignUp: boolean;
}) {
  if (!error && !info) return null;
  return (
    <div className="space-y-2">
      {info ? (
        <div
          className="rounded-xl bg-sky-500/10 px-4 py-3 text-sm text-sky-900 dark:text-sky-100"
          role="status"
        >
          {info}
        </div>
      ) : null}
      {error ? (
        <div
          className="text-destructive bg-destructive/10 rounded-xl px-4 py-3 text-sm leading-relaxed"
          role="alert"
        >
          <p>{error}</p>
          {!isSignUp && /ingen konto|opprett en ny konto/i.test(error) ? (
            <p className="text-muted-foreground mt-2 text-xs">
              <Link
                href="/sign-up"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Opprett konto
              </Link>
            </p>
          ) : null}
          {isSignUp && /allerede en konto|logge inn i stedet/i.test(error) ? (
            <p className="text-muted-foreground mt-2 text-xs">
              <Link
                href="/sign-in"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Gå til innlogging
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
