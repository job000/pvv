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
  ListOrdered,
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
        id="ros-metode-rekkefoelge"
        title="Skal jeg vurdere hver linje (sannsynlighet, konsekvens) først — og så legge inn i matrisen?"
        icon={ListOrdered}
        defaultOpen
      >
        <p>
          <strong className="text-foreground">Nei, ikke som to separate steg i
          appen.</strong> Her er <strong className="text-foreground">matrisen
          stedet dere legger inn vurderingen</strong>. Dere trenger ikke fylle ut en
          liste «ved siden av» og så overføre tall manuelt — dere klikker en{" "}
          <strong className="text-foreground">celle</strong> (rad × kolonne) og velger
          nivå <strong className="text-foreground">0–5</strong> i popupen.
        </p>
        <p>
          <strong className="text-foreground">Mentalt</strong> kan dere godt tenke:
          «hva er sannsynlighet og konsekvens for denne risikoen?» — det er vanlig
          arbeidsmåte. Når dere er enige, skal det som oftest lande som{" "}
          <strong className="text-foreground">ett punkt i matrisen</strong>: der
          sannsynlighetsnivå og konsekvensnivå møtes (det krysset dere markerer). Da
          beskriver cellen <strong className="text-foreground">den samlede
          risikoen</strong> for det scenarioet, ikke to uavhengige felt du fyller
          først og «baker inn» senere.
        </p>
        <p>
          <strong className="text-foreground">Celle 0</strong> betyr «ikke vurdert
          ennå». Celler dere ikke trenger, kan stå på 0. Mange team har{" "}
          <strong className="text-foreground">én aktiv risiko = ett eller få
          kryss</strong> i matrisen; dere kan bruke notatfeltet over matrisen for å
          forklare hvordan dere har tolket aksene.
        </p>
      </DetailsBlock>

      <DetailsBlock
        id="ros-metode-sporsmal"
        title="Hva er «spørsmålene» — hva vurderer dere egentlig?"
        icon={Grid3x3}
        defaultOpen={false}
      >
        <p>
          Det finnes <strong className="text-foreground">ikke</strong> en egen
          nummerert spørsmålsliste. Risiko og sårbarhet vurderes i en{" "}
          <strong className="text-foreground">matrise</strong> der{" "}
          <strong className="text-foreground">radene og kolonnene</strong> (fra malen)
          definerer hva hvert kryss betyr.
        </p>
        <ul className="list-inside list-disc space-y-1.5 pl-1">
          <li>
            <strong className="text-foreground">Klassisk 5×5:</strong> rader =
            sannsynlighet, kolonner = konsekvens. For <strong className="text-foreground">én
            risiko</strong> peker dere vanligvis på <strong className="text-foreground">én
            celle</strong> der vurderingen «landar» (eller dere beskriver i notat).
          </li>
          <li>
            <strong className="text-foreground">Flere temaer:</strong> dere kan la
            radene være ulike <strong className="text-foreground">risikolinjer /
            scenarioer</strong> (f.eks. «Datainnbrudd», «Feil i automatisering») og
            kolonnene være konsekvens — da fyller dere <strong className="text-foreground">én
            rad om gangen</strong> ved å sette nivå i hvert relevante kryss på den
            raden.
          </li>
        </ul>
        <p>
          Nivå <strong className="text-foreground">0</strong> = ikke vurdert;{" "}
          <strong className="text-foreground">1–5</strong> = lav → kritisk, med farge i
          matrisen og i popup.
        </p>
        <p>
          I popupen kan du skrive <strong className="text-foreground">tekst per
          celle</strong> (begrunnelse, referanse). Det lagres med «Lagre endringer».
          <strong className="text-foreground"> Risikologgen</strong> under matrisen
          loggfører automatisk hver lagret nivåendring og kan suppleres med manuelle
          innlegg med valgfri «hopp til celle».
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
