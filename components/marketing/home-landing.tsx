import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LandingMesh } from "@/components/marketing/landing-mesh";
import { BrandMark } from "@/components/brand-mark";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ClipboardCheck,
  LayoutDashboard,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function FeatureCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md dark:bg-card/60",
        className,
      )}
    >
      <CardHeader className="space-y-3">
        <div className="bg-primary/10 text-primary inline-flex size-11 items-center justify-center rounded-xl">
          <Icon className="size-5" aria-hidden />
        </div>
        <CardTitle className="font-heading text-lg">{title}</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {children}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function HomeLanding() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <LandingMesh />

      <header className="border-border/50 bg-background/75 sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="font-heading text-foreground flex items-center gap-2.5 rounded-lg text-lg font-semibold tracking-tight outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="FRO — forsiden"
          >
            <BrandMark size={28} />
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <ThemeModeToggle />
            <Link
              href="/sign-in"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Logg inn
            </Link>
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants({ size: "sm" }),
                "hidden sm:inline-flex",
              )}
            >
              Opprett konto
            </Link>
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ size: "sm" }), "sm:hidden")}
            >
              Registrer
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 md:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
              <span className="bg-primary/80 size-1.5 rounded-full" aria-hidden />
              Prosess · personvern · ROS
            </p>
            <h1 className="font-heading text-foreground text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl md:leading-[1.08]">
              Én plattform for{" "}
              <span className="text-primary">prioriterte oppgaver</span>,{" "}
              vurderinger og risiko
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed sm:text-xl">
              Kartlegg prosesser, gjennomfør vurderinger med tydelig sporbarhet,
              og koble ROS til de samme arbeidsområdene — bygget for team som
              må dokumentere og levere trygt.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/sign-up"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 min-w-[12rem] gap-2 px-8 text-base shadow-md",
                )}
              >
                Kom i gang gratis
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-12 min-w-[12rem] border-border/80 bg-background/50 px-8 text-base backdrop-blur-sm",
                )}
              >
                Logg inn
              </Link>
            </div>
            <p className="text-muted-foreground mt-6 text-sm">
              Roller, invitasjoner og sporbarhet — innebygd i hvert arbeidsområde.
            </p>
          </div>
        </section>

        <section className="border-border/40 border-y bg-muted/20 py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-3 sm:gap-6 sm:px-6">
            <div className="rounded-2xl border border-border/50 bg-card/50 px-6 py-8 text-center backdrop-blur-sm">
              <p className="font-heading text-primary text-3xl font-semibold tabular-nums sm:text-4xl">
                360°
              </p>
              <p className="text-muted-foreground mt-2 text-sm font-medium">
                Prosess + vurderinger + ROS i samme flyt
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/50 px-6 py-8 text-center backdrop-blur-sm">
              <p className="font-heading text-primary text-3xl font-semibold sm:text-4xl">
                Sporbar
              </p>
              <p className="text-muted-foreground mt-2 text-sm font-medium">
                Koblinger mot vurderinger og kandidater
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/50 px-6 py-8 text-center backdrop-blur-sm">
              <p className="font-heading text-primary text-3xl font-semibold sm:text-4xl">
                Team
              </p>
              <p className="text-muted-foreground mt-2 text-sm font-medium">
                Arbeidsområder tilpasset organisasjonen
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Alt du trenger for strukturert vurdering
              </h2>
              <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
                Mindre manuelt dobbeltarbeid — mer tid til faglige beslutninger.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard icon={ClipboardCheck} title="Vurderinger og prosess">
                Veiledede skjemaer, roller og historikk slik at dere leverer
                konsistent kvalitet på tvers av prosesser.
              </FeatureCard>
              <FeatureCard icon={Shield} title="ROS og risiko">
                Fargekodede matriser, journal og kobling til prosesskandidater —
                én rød tråd fra vurdering til risiko.
              </FeatureCard>
              <FeatureCard
                icon={Users}
                title="Arbeidsområder"
                className="sm:col-span-2 lg:col-span-1"
              >
                Del kandidater, vurderinger og innhold trygt med riktig
                tilgangsstyring.
              </FeatureCard>
              <FeatureCard
                icon={LayoutDashboard}
                title="Oversikt"
                className="sm:col-span-2 lg:col-span-3"
              >
                Dashboard og sammenligning slik at ledelse og fag ser status
                på tvers — uten å grave i regneark.
              </FeatureCard>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="from-primary/[0.07] via-primary/[0.04] to-muted/40 dark:from-primary/15 dark:via-primary/8 dark:to-muted/20 mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-to-br px-6 py-14 text-center shadow-sm sm:px-12 sm:py-16">
            <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Klar til å samle teamet ett sted?
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-lg text-lg leading-relaxed">
              Opprett konto på minutter, eller logg inn om du allerede er invitert
              til et arbeidsområde.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 min-w-[11rem] gap-2 px-8",
                )}
              >
                Gå til oversikt
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/sign-up"
                className={cn(
                  buttonVariants({ size: "lg", variant: "secondary" }),
                  "h-12 min-w-[11rem] border border-border/60 bg-background/80 px-8 backdrop-blur-sm",
                )}
              >
                Opprett konto
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-border/40 mt-auto border-t py-10">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} FRO · prioriter og utfør
          </p>
          <div className="flex gap-6">
            <Link
              href="/sign-in"
              className="hover:text-foreground transition-colors"
            >
              Logg inn
            </Link>
            <Link
              href="/sign-up"
              className="hover:text-foreground transition-colors"
            >
              Registrering
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
