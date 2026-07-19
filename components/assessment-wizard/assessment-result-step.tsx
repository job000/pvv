"use client";

import { AssessmentCalcAssumptions } from "@/components/assessment-wizard/assessment-calc-assumptions";
import { buttonVariants } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import type { ComputedSnapshot } from "@/convex/lib/rpaScoring";
import {
  getCalcSectorPreset,
  type CalcSectorPresetId,
  type WorkspaceCalcDefaults,
} from "@/lib/assessment-calc-config";
import {
  buildGovernanceReadinessSummary,
  readinessLabelFromScore,
} from "@/lib/assessment-governance";
import {
  buildRpaSuitabilityReport,
  costsLookLikeDefaults,
  workloadIsUserEntered,
  type SoftBenefit,
} from "@/lib/assessment-rpa-suitability";
import type { AssessmentPayload } from "@/lib/assessment-types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock,
  Coins,
  Gauge,
  Shield,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("nb-NO")} kr`;
}

function riskBand(criticality: number): "Høy" | "Middels" | "Lav" {
  if (criticality >= 60) return "Høy";
  if (criticality >= 38) return "Middels";
  return "Lav";
}

function MetricTile({
  label,
  value,
  hint,
  footnote,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  footnote?: string;
}) {
  return (
    <div className="rounded-2xl bg-background/90 px-4 py-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
      <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
          {hint}
        </p>
      ) : null}
      {footnote ? (
        <p className="text-muted-foreground/80 mt-1 text-[10px] italic">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

function SoftBenefitChip({ benefit }: { benefit: SoftBenefit }) {
  return (
    <li className="rounded-xl bg-background/80 px-3 py-2.5 ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
      <p className="text-foreground text-sm font-medium">{benefit.label}</p>
      <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
        {benefit.why}
      </p>
    </li>
  );
}

export function AssessmentResultStep({
  computed,
  payload,
  workspaceId,
  title,
  assessment,
  hasProcessDesignDocument,
  canEdit,
  workspaceCalcDefaults,
  calcSectorPresetId,
  update,
  updateMany,
}: {
  computed: ComputedSnapshot;
  payload: AssessmentPayload;
  workspaceId: Id<"workspaces">;
  title: string;
  assessment: {
    rosStatus?: string | null;
    pddStatus?: string | null;
  };
  hasProcessDesignDocument: boolean;
  canEdit: boolean;
  workspaceCalcDefaults: WorkspaceCalcDefaults;
  calcSectorPresetId?: CalcSectorPresetId | string | null;
  update: <K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) => void;
  updateMany: (patch: Partial<AssessmentPayload>) => void;
}) {
  const sectorPreset = getCalcSectorPreset(calcSectorPresetId);
  const suitability = buildRpaSuitabilityReport(payload, computed);
  const hoursEntered = workloadIsUserEntered(payload);
  const costsDefault = costsLookLikeDefaults(payload);
  const hoursSaved = Math.max(0, Math.round(computed.benH));
  const risk = riskBand(computed.criticality);
  const priorityBand =
    computed.priorityScore >= 60
      ? "Høy"
      : computed.priorityScore >= 35
        ? "Middels"
        : "Lav";
  const readiness = buildGovernanceReadinessSummary({
    payload,
    rosStatus: assessment.rosStatus,
    pddStatus: assessment.pddStatus,
    hasProcessDesignDocument,
  });

  const summaryLine =
    payload.processDescription?.trim() ||
    payload.processName?.trim() ||
    title;

  const verdictTone =
    suitability.verdict === "egnet"
      ? "from-emerald-500/[0.16] via-background to-primary/[0.06] ring-emerald-500/25"
      : suitability.verdict === "middels"
        ? "from-amber-500/[0.14] via-background to-primary/[0.05] ring-amber-500/20"
        : "from-slate-500/[0.12] via-background to-muted/40 ring-black/[0.06] dark:ring-white/[0.08]";

  const VerdictIcon =
    suitability.verdict === "egnet"
      ? CheckCircle2
      : suitability.verdict === "middels"
        ? CircleHelp
        : AlertTriangle;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
          Resultat
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Beslutningsgrunnlag for ledelse — tall fra svarene deres, med tydelig
          RPA-anbefaling og alternativer.
        </p>
      </div>

      {/* Hero: egnethet */}
      <section
        className={cn(
          "rounded-3xl bg-gradient-to-br p-5 shadow-sm ring-1 sm:p-6",
          verdictTone,
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl",
              suitability.verdict === "egnet"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : suitability.verdict === "middels"
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                  : "bg-muted text-muted-foreground",
            )}
          >
            <VerdictIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
              For ledelse
            </p>
            <h3 className="text-foreground text-2xl font-semibold tracking-tight">
              {suitability.title}
            </h3>
            <p className="text-foreground/90 text-sm font-medium leading-snug">
              {suitability.leadershipLine}
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {suitability.summary}
            </p>
            {summaryLine ? (
              <p className="text-foreground/80 text-sm">{summaryLine}</p>
            ) : null}
          </div>
        </div>

        {suitability.reasons.length > 0 ? (
          <ul className="mt-5 space-y-1.5 border-t border-black/[0.04] pt-4 dark:border-white/[0.06]">
            {suitability.reasons.map((r) => (
              <li
                key={r}
                className="text-muted-foreground flex gap-2 text-xs leading-relaxed"
              >
                <span className="text-foreground/50 mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                {r}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <AssessmentCalcAssumptions
        payload={payload}
        canEdit={canEdit}
        workspaceDefaults={workspaceCalcDefaults}
        update={update}
        updateMany={updateMany}
      />

      {/* Tallfestede gevinster */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="text-muted-foreground size-4" aria-hidden />
          <h3 className="text-foreground text-sm font-semibold">
            Gevinster og potensial
          </h3>
        </div>
        <p className="text-muted-foreground -mt-1 text-xs leading-relaxed">
          Formler: potensial = f(struktur, likhet, digitalisering, volum);
          timer spart ≈ automasjonspotensial × manuelle timer; kr ≈ samme % ×
          (timer × timepris); prioritet = √(potensial × kritikalitet).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricTile
            label="Porteføljeprioritet"
            value={priorityBand}
            hint={`Score ${computed.priorityScore.toFixed(0)} / 100`}
          />
          <MetricTile
            label="Automasjonspotensial"
            value={`${computed.ap.toFixed(0)} %`}
            hint="Andel av manuell tid som typisk kan automatiseres"
          />
          <MetricTile
            label="Timer spart (ca.)"
            value={
              <>
                {hoursSaved}{" "}
                <span className="text-base font-medium">t/år</span>
              </>
            }
            hint={`≈ ${computed.benFte.toFixed(2)} årsverk`}
            footnote={
              hoursEntered
                ? undefined
                : "Basert på standardvolum — fyll inn tid/volum for mer treffsikkert tall"
            }
          />
          <MetricTile
            label="Økonomisk besparelse"
            value={formatCurrency(computed.benC)}
            hint={
              costsDefault
                ? `Netto ca. ${formatCurrency(computed.netBenefitAnnual)} / år (standardkost)`
                : `Netto ca. ${formatCurrency(computed.netBenefitAnnual)} / år`
            }
            footnote={
              costsDefault
                ? "Bygg- og driftskost er standard — juster under Valgfritt mer"
                : computed.paybackMonths != null
                  ? `Tilbakebetaling ca. ${computed.paybackMonths.toFixed(1)} mnd`
                  : undefined
            }
          />
          <MetricTile
            label="Risiko / viktighet"
            value={risk}
            hint="Fra volum, forretningskonsekvens og regulatorisk risiko"
          />
          <MetricTile
            label="Gjennomføring"
            value={computed.easeLabel}
            hint={`Ease ${computed.ease.toFixed(0)} % · leveransesikkerhet ${readinessLabelFromScore(computed.deliveryConfidence)}`}
          />
        </div>
      </section>

      {/* Myke gevinster */}
      <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="text-muted-foreground size-4" aria-hidden />
          <h3 className="text-foreground text-sm font-semibold">
            Gevinster som er vanskelig å tallfeste
          </h3>
        </div>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Kvalitet, sikkerhet og at arbeidet faktisk blir gjort — ofte like
          viktige for beslutning som kroner. Disse påvirker prioritet via
          kritikalitet, men telles ikke om til kunstige kronebeløp.
        </p>
        {sectorPreset ? (
          <div className="bg-muted/25 mt-3 space-y-2 rounded-xl px-3 py-3">
            <p className="text-foreground text-xs font-medium">
              Typiske gevinster ({sectorPreset.label})
            </p>
            <ul className="space-y-1">
              {sectorPreset.savingsFocus.map((line) => (
                <li
                  key={line}
                  className="text-muted-foreground flex gap-2 text-xs leading-relaxed"
                >
                  <span className="text-foreground/40 mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {computed.paybackMonths != null &&
        computed.paybackMonths > 24 &&
        suitability.softBenefits.length > 0 ? (
          <p className="bg-amber-500/10 text-amber-950 dark:text-amber-100 mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed">
            Tilbakebetaling over 24 mnd betyr ikke automatisk «nei». Ved sterke
            myke gevinster kan det fortsatt være fornuftig å utvikle — vurder
            sikkerhet, etterlevelse og pålitelig gjennomføring sammen med
            kroner.
          </p>
        ) : null}
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {suitability.softBenefits.map((b) => (
            <SoftBenefitChip key={b.id} benefit={b} />
          ))}
        </ul>
      </section>

      {/* Alternativer */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Workflow className="text-muted-foreground size-4" aria-hidden />
          <h3 className="text-foreground text-sm font-semibold">
            Hvordan bør dette leveres?
          </h3>
        </div>
        <p className="text-muted-foreground -mt-1 text-xs leading-relaxed">
          Hvis RPA ikke passer, finnes ofte integrasjon, lavkode eller
          prosessforenkling — andre team eller verktøy kan eie leveransen.
        </p>
        <ul className="space-y-2">
          {suitability.alternatives.map((alt) => (
            <li
              key={alt.path}
              className={cn(
                "rounded-2xl px-4 py-3.5 ring-1 transition-shadow",
                alt.recommended
                  ? "bg-primary/[0.06] shadow-sm ring-primary/25"
                  : "bg-card ring-black/[0.04] dark:ring-white/[0.06]",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-foreground text-sm font-semibold">
                  {alt.title}
                </p>
                {alt.recommended ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Anbefalt nå
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {alt.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Klarhet + CTA */}
      <section className="rounded-2xl bg-muted/15 p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Gauge className="text-muted-foreground size-4" aria-hidden />
              <h3 className="text-foreground text-sm font-semibold">
                Beslutningsklarhet
              </h3>
            </div>
            <p className="text-muted-foreground text-xs">
              {readiness.readinessLabel} · {readiness.readyCount}/
              {readiness.totalCount} områder klare
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {suitability.verdict !== "lite_egnet" ||
            computed.priorityScore >= 35 ? (
              <Link
                href={`/w/${workspaceId}/ros`}
                className={cn(
                  buttonVariants({ size: "default" }),
                  "h-11 gap-1.5 rounded-full px-5 font-semibold",
                )}
              >
                <Shield className="size-4" aria-hidden />
                Videre til ROS
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : (
              <p className="text-muted-foreground text-xs font-medium">
                Avklar alternativ leveranse før ROS prioriteres.
              </p>
            )}
          </div>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {readiness.requirements.slice(0, 4).map((item) => (
            <li
              key={item.key}
              className="flex items-start justify-between gap-2 rounded-xl bg-background/80 px-3 py-2.5 text-xs ring-1 ring-black/[0.04] dark:ring-white/[0.08]"
            >
              <span className="text-foreground font-medium">{item.label}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  item.status === "ready"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : item.status === "in_progress"
                      ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {item.status === "ready"
                  ? "Klar"
                  : item.status === "in_progress"
                    ? "Pågår"
                    : "Mangler"}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed">
          <Clock className="mt-0.5 size-3 shrink-0" aria-hidden />
          Tallene er beslutningsstøtte, ikke fasit. Juster timepris og
          arbeidsbasis over, og volum under kandidatsteget, for mer treffsikre
          anslag.
        </p>
      </section>
    </div>
  );
}
