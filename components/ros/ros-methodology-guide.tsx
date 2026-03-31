"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  ChevronDown,
  CircleHelp,
  GitBranch,
  Grid3x3,
  Link2,
} from "lucide-react";

type Variant = "page" | "compact";

function DetailsBlock({
  id,
  title,
  icon: Icon,
  children,
  defaultOpen,
}: {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      id={id}
      className="border-border/60 group border-b last:border-b-0"
      open={defaultOpen}
    >
      <summary className="hover:bg-muted/30 flex cursor-pointer list-none items-center gap-2 rounded-lg py-3 pr-2 text-left text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
        <Icon className="text-primary size-4 shrink-0" aria-hidden />
        {title}
      </summary>
      <div className="text-muted-foreground space-y-3 pb-4 pl-6 text-sm leading-relaxed">
        {children}
      </div>
    </details>
  );
}

export function RosMethodologyGuide({
  className,
  variant = "page",
  workspaceId,
}: {
  className?: string;
  variant?: Variant;
  workspaceId?: string;
}) {
  const blocks = (
    <>
      <DetailsBlock
        id="ros-metode-sporsmal"
        title="Hva er «spørsmålene» — hva vurderer dere egentlig?"
        icon={Grid3x3}
        defaultOpen={variant === "page"}
      >
        <p>
          I denne løsningen er det <strong className="text-foreground">ikke</strong> en
          egen nummerert spørsmålsliste. Risiko og sårbarhet vurderes i en{" "}
          <strong className="text-foreground">matrise</strong> der{" "}
          <strong className="text-foreground">radene og kolonnene</strong> (definert i
          malen) er dimensjonene dere scorer.
        </p>
        <ul className="list-inside list-disc space-y-1.5 pl-1">
          <li>
            <strong className="text-foreground">Vanlig bruk:</strong> radene =
            sannsynlighet (eller trussel), kolonnene = konsekvens.{" "}
            <strong className="text-foreground">Hvert kryss (celle)</strong> er ett
            vurderingspunkt: «Hvilket risikonivå (0–5) gir denne kombinasjonen?»
          </li>
          <li>
            <strong className="text-foreground">Alternativ:</strong> dere kan skrive
            radetiketter som konkrete{" "}
            <strong className="text-foreground">risikoscenarioer</strong> eller temaer
            (f.eks. «Datainnbrudd», «Feil i automatisering») og beholde kolonner som
            konsekvensnivå — da blir hver rad et tema dere vurderer celle for celle
            langs konsekvensaksen.
          </li>
        </ul>
        <p>
          Nivå <strong className="text-foreground">0</strong> = ikke vurdert ennå;{" "}
          <strong className="text-foreground">1–5</strong> = fra lav til kritisk, med
          farge i matrisen og i popup når dere klikker en celle.
        </p>
      </DetailsBlock>

      <DetailsBlock
        id="ros-metode-for-etter"
        title="Før og etter risiko — hvor håndteres det?"
        icon={ArrowLeftRight}
      >
        <p>
          <strong className="text-foreground">Før endring / dagens stand:</strong> den
          utfylte ROS-matrisen sammen med koblede{" "}
          <strong className="text-foreground">PVV-vurderinger</strong> beskriver
          utgangspunktet for prosessen (kandidaten). I PVV-skjemaet finnes også feltet{" "}
          <strong className="text-foreground">«Risiko før endring (ROS)»</strong>{" "}
          (status, lenke, notat) — det er sporbarhet mot dokumentasjon, mens den
          detaljerte scoringen ligger i ROS-matrisen her.
        </p>
        <p>
          <strong className="text-foreground">Etter tiltak eller endring:</strong> bruk{" "}
          <strong className="text-foreground">Versjonskontroll</strong> på
          ROS-analysen: lagre et øyeblikksbilde <em>før</em> større endringer, oppdater
          matrisen når tiltak er satt inn, og lagre ny versjon — da dokumenterer dere
          «før og etter» i tid. Alternativt kan dere opprette en ny ROS-analyse for
          «etter»-bildet hvis dere vil skille prosjekter.
        </p>
        <p className="flex items-start gap-2">
          <GitBranch className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="text-foreground">Oppgaver</strong> under analysen kan
            brukes til oppfølging av tiltak som skal redusere risiko.
          </span>
        </p>
      </DetailsBlock>

      <DetailsBlock
        id="ros-metode-pvv"
        title="Kobling til PVV — én rød tråd"
        icon={Link2}
      >
        <p>
          Når dere oppretter en ROS-analyse, velger dere en{" "}
          <strong className="text-foreground">kandidat (prosess)</strong> og kan koble{" "}
          <strong className="text-foreground">én eller flere PVV-vurderinger</strong>.
          Da ser dere samme referanser i PVV og i ROS, og kan åpne vurderingsskjemaet fra
          koblingslisten på analysen.
        </p>
        {workspaceId ? (
          <p className="text-foreground text-xs">
            PVV-oversikt:{" "}
            <a
              href={`/w/${workspaceId}/vurderinger`}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Vurderinger
            </a>
            {" · "}
            <a
              href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Prosesser / kandidater
            </a>
          </p>
        ) : null}
      </DetailsBlock>
    </>
  );

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "border-border/60 bg-muted/15 rounded-xl border px-3 py-1",
          className,
        )}
      >
        <p className="text-muted-foreground px-1 py-2 flex items-center gap-2 text-xs font-medium">
          <CircleHelp className="size-3.5 shrink-0" aria-hidden />
          Metode og spørsmål
        </p>
        {blocks}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-border/60 from-muted/20 to-card rounded-2xl border bg-gradient-to-b p-5 shadow-sm",
        className,
      )}
    >
      <h2 className="font-heading mb-1 flex items-center gap-2 text-base font-semibold">
        <CircleHelp className="text-primary size-5" aria-hidden />
        Slik fungerer ROS i dette arbeidsområdet
      </h2>
      <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
        Her forklares hvor «spørsmålene» sitter, hvordan før/etter håndteres, og hvordan
        dette henger sammen med PVV.
      </p>
      {blocks}
    </div>
  );
}
