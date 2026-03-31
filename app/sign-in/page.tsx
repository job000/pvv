"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn("password", {
        flow: mode === "signUp" ? "signUp" : "signIn",
        email,
        password,
      });
      /* Standard workspace og invitasjoner kjøres på dashboard når sesjonen er klar — ikke her (krever innlogging). */
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        formatUserFacingError(
          err,
          mode === "signUp"
            ? "Kunne ikke opprette konto. Prøv igjen."
            : "Innlogging feilet. Sjekk e-post og passord.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            {mode === "signIn" ? "Logg inn" : "Opprett konto"}
          </CardTitle>
          <CardDescription>
            PVV — samarbeid om RPA-vurderinger med roller og versjoner.
          </CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passord</Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "signUp" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Vent …" : mode === "signIn" ? "Logg inn" : "Registrer"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => {
                setMode(mode === "signIn" ? "signUp" : "signIn");
                setError(null);
              }}
            >
              {mode === "signIn" ? "Ny bruker?" : "Har du konto?"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <Link
        href="/"
        className="mt-6 text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        ← Til forsiden
      </Link>
    </div>
  );
}
