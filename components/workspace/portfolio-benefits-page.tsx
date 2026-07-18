"use client";

import { buttonVariants } from "@/components/ui/button-variants";
import { SearchInput } from "@/components/ui/search-input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import {
  REALIZATION_LABELS,
  SOFT_GAIN_LEADERSHIP,
} from "@/lib/portfolio-benefit-copy";
import { downloadPortfolioBenefitsPdf } from "@/lib/portfolio-benefits-pdf";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Coins,
  Download,
  Layers,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TabId = "oversikt" | "diagrammer" | "kvalitet" | "kandidater";
type RealizationFilter = "all" | "potential" | "in_delivery" | "realized";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "oversikt", label: "Oversikt" },
  { id: "diagrammer", label: "Diagrammer" },
  { id: "kvalitet", label: "Kvalitet" },
  { id: "kandidater", label: "Kandidater" },
];

const CHART_COLORS = [
  "oklch(0.42 0.04 250)",
  "oklch(0.5 0.06 200)",
  "oklch(0.48 0.05 160)",
  "oklch(0.55 0.04 80)",
  "oklch(0.45 0.05 30)",
  "oklch(0.4 0.04 300)",
];

function formatHours(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0 kr";
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(".", ",")} MNOK`;
  }
  if (Math.abs(n) >= 1000) {
    return `${Math.round(n / 1000).toLocaleString("nb-NO")} kkr`;
  }
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

function formatFte(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}

function HeroMetric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className="font-heading mt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">
        {value}
        {unit ? (
          <span className="text-muted-foreground ml-1.5 text-base font-medium sm:text-lg">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

export function PortfolioBenefitsPage({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const data = useQuery(api.portfolioBenefits.workspacePortfolio, {
    workspaceId,
  });
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const [tab, setTab] = useState<TabId>("oversikt");
  const [search, setSearch] = useState("");
  const [pipelineFilter, setPipelineFilter] = useState<"all" | PipelineStatus>(
    "all",
  );
  const [realizationFilter, setRealizationFilter] =
    useState<RealizationFilter>("all");
  const [onlyQuantified, setOnlyQuantified] = useState(false);
  const [candidateSort, setCandidateSort] = useState<
    "money_desc" | "money_asc" | "hours_desc" | "updated"
  >("money_desc");

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const filtered = data.items.filter((item) => {
      if (pipelineFilter !== "all" && item.pipelineStatus !== pipelineFilter) {
        return false;
      }
      if (
        realizationFilter !== "all" &&
        item.realizationBucket !== realizationFilter
      ) {
        return false;
      }
      if (onlyQuantified && !item.hasQuantifiedBenefit) return false;
      if (q && !item.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (candidateSort) {
        case "money_asc":
          return a.currencySavedPerYear - b.currencySavedPerYear;
        case "hours_desc":
          return b.hoursSavedPerYear - a.hoursSavedPerYear;
        case "updated":
          return b.updatedAt - a.updatedAt;
        case "money_desc":
        default:
          return b.currencySavedPerYear - a.currencySavedPerYear;
      }
    });
    return sorted;
  }, [
    data,
    search,
    pipelineFilter,
    realizationFilter,
    onlyQuantified,
    candidateSort,
  ]);

  const benefitDrivers = useMemo(() => {
    const empty = {
      topMoney: [] as NonNullable<typeof data>["items"],
      lowMoney: [] as NonNullable<typeof data>["items"],
      noNumbers: [] as NonNullable<typeof data>["items"],
      totalCurrency: 0,
    };
    if (!data) return empty;
    const totalCurrency = data.totals.currencySavedPerYear;
    const byMoney = [...data.items].sort(
      (a, b) => b.currencySavedPerYear - a.currencySavedPerYear,
    );
    const withMoney = byMoney.filter((i) => i.currencySavedPerYear > 0);
    const topMoney = withMoney.slice(0, 5);
    // Unngå å gjenta toppene når det er få kandidater
    const lowMoney = [...withMoney]
      .sort((a, b) => a.currencySavedPerYear - b.currencySavedPerYear)
      .filter(
        (i) =>
          !topMoney.slice(0, 3).some((t) => t.assessmentId === i.assessmentId),
      )
      .slice(0, 4);
    const noNumbers = data.items
      .filter((i) => !i.hasQuantifiedBenefit)
      .slice(0, 5);
    return { topMoney, lowMoney, noNumbers, totalCurrency };
  }, [data]);

  const displayTotals = useMemo(() => {
    if (!data) {
      return { hours: 0, currency: 0, fte: 0, net: 0 };
    }
    if (realizationFilter === "all" && pipelineFilter === "all" && !onlyQuantified && !search.trim()) {
      return {
        hours: data.totals.hoursSavedPerYear,
        currency: data.totals.currencySavedPerYear,
        fte: data.totals.fteFreed,
        net: data.totals.netBenefitAnnual,
      };
    }
    return filteredItems.reduce(
      (acc, item) => {
        acc.hours += item.hoursSavedPerYear;
        acc.currency += item.currencySavedPerYear;
        acc.fte += item.fteFreed;
        acc.net += item.netBenefitAnnual;
        return acc;
      },
      { hours: 0, currency: 0, fte: 0, net: 0 },
    );
  }, [data, filteredItems, realizationFilter, pipelineFilter, onlyQuantified, search]);

  const pipelineChartData = useMemo(() => {
    if (!data) return [];
    return data.byPipeline
      .filter((r) => r.count > 0)
      .map((r) => ({
        name: PIPELINE_STATUS_LABELS[r.status as PipelineStatus] ?? r.status,
        timer: Math.round(r.hoursSavedPerYear),
        kr: Math.round(r.currencySavedPerYear),
      }));
  }, [data]);

  const realizationChartData = useMemo(() => {
    if (!data) return [];
    return [
      {
        name: "Potensial",
        timer: Math.round(data.potentialTotals.hoursSavedPerYear),
        kr: Math.round(data.potentialTotals.currencySavedPerYear),
      },
      {
        name: "Leveranse",
        timer: Math.round(data.inDeliveryTotals.hoursSavedPerYear),
        kr: Math.round(data.inDeliveryTotals.currencySavedPerYear),
      },
      {
        name: "I drift",
        timer: Math.round(data.realizedTotals.hoursSavedPerYear),
        kr: Math.round(data.realizedTotals.currencySavedPerYear),
      },
    ];
  }, [data]);

  const softChartData = useMemo(() => {
    if (!data) return [];
    return data.softGainFrequency
      .filter((g) => g.count > 0 && g.soft)
      .map((g) => ({ name: g.label, count: g.count }));
  }, [data]);

  const phasePieData = useMemo(() => {
    if (!data) return [];
    return data.byPipeline
      .filter((r) => r.count > 0)
      .map((r) => ({
        name: PIPELINE_STATUS_LABELS[r.status as PipelineStatus] ?? r.status,
        value: r.count,
      }));
  }, [data]);

  const exportPdf = () => {
    if (!data) return;
    downloadPortfolioBenefitsPdf({
      workspaceName: workspace?.name?.trim() || "Arbeidsområde",
      totals: data.totals,
      potential: data.potentialTotals,
      inDelivery: data.inDeliveryTotals,
      realized: data.realizedTotals,
      byPipeline: data.byPipeline,
      softGains: data.softGainFrequency,
      candidates: data.items.map((i) => ({
        title: i.title,
        pipelineStatus: i.pipelineStatus,
        hoursSavedPerYear: i.hoursSavedPerYear,
        currencySavedPerYear: i.currencySavedPerYear,
        fteFreed: i.fteFreed,
      })),
    });
  };

  if (data === undefined) {
    return (
      <div className="space-y-6">
        <div className="bg-muted/40 h-10 w-48 animate-pulse rounded-full" />
        <div className="bg-muted/30 h-40 animate-pulse rounded-3xl" />
      </div>
    );
  }

  if (data === null) {
    return (
      <p className="text-destructive text-sm">
        Kunne ikke laste gevinster. Sjekk at du er innlogget.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10 lg:max-w-4xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Gevinster
          </h1>
          <p className="text-muted-foreground text-sm">
            {data.assessmentCount} kandidater · ca.-tall fra vurderingsmodellen
          </p>
        </div>
        <button
          type="button"
          onClick={exportPdf}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-10 shrink-0 gap-2 rounded-full",
          )}
        >
          <Download className="size-3.5" aria-hidden />
          Eksporter PDF
        </button>
      </header>

      <nav
        className="flex gap-1 overflow-x-auto rounded-full border border-border/50 bg-background p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Gevinstvisning"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "oversikt" ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-border/40 bg-card px-5 py-6 sm:px-8 sm:py-8">
            <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
              Årlig potensial
            </p>
            <div className="mt-5 grid gap-8 sm:grid-cols-2">
              <HeroMetric
                label="Besparelse"
                value={formatMoney(displayTotals.currency)}
              />
              <HeroMetric
                label="Timer frigjort"
                value={formatHours(displayTotals.hours)}
                unit="/ år"
              />
              <HeroMetric
                label="Kapasitet"
                value={formatFte(displayTotals.fte)}
                unit="FTE"
              />
              <HeroMetric
                label="Netto etter drift"
                value={formatMoney(displayTotals.net)}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                ["potential", data.potentialTotals, Clock3],
                ["in_delivery", data.inDeliveryTotals, Layers],
                ["realized", data.realizedTotals, Sparkles],
              ] as const
            ).map(([key, t, Icon]) => {
              const active = realizationFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setRealizationFilter((prev) => (prev === key ? "all" : key))
                  }
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left transition-colors",
                    active
                      ? "border-foreground/25 bg-foreground text-background"
                      : "border-border/40 bg-muted/10 hover:bg-muted/25",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "text-[11px] font-medium",
                        active ? "text-background/75" : "text-muted-foreground",
                      )}
                    >
                      {REALIZATION_LABELS[key]}
                    </p>
                    <Icon
                      className={cn(
                        "size-3.5",
                        active ? "text-background/70" : "text-muted-foreground",
                      )}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-2 text-lg font-semibold tabular-nums">
                    {formatMoney(t.currencySavedPerYear)}
                  </p>
                </button>
              );
            })}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-heading text-base font-semibold">
                  Hva driver tallene?
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Hvilke kandidater står bak besparelsen — og hvor det nesten ikke
                  er tall.
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-medium underline-offset-2 hover:underline"
                onClick={() => {
                  setCandidateSort("money_desc");
                  setOnlyQuantified(true);
                  setTab("kandidater");
                }}
              >
                Se hele listen
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/40 bg-card p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  <TrendingUp className="size-3.5" aria-hidden />
                  Største besparelse
                </p>
                {benefitDrivers.topMoney.length === 0 ? (
                  <p className="text-muted-foreground mt-3 text-sm">
                    Ingen kandidater med kroner-besparelse ennå.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {benefitDrivers.topMoney.map((item, idx) => {
                      const share =
                        benefitDrivers.totalCurrency > 0
                          ? Math.round(
                              (item.currencySavedPerYear /
                                benefitDrivers.totalCurrency) *
                                100,
                            )
                          : 0;
                      return (
                        <li key={item.assessmentId}>
                          <button
                            type="button"
                            className="hover:bg-muted/30 w-full rounded-xl px-2 py-2 text-left transition-colors"
                            onClick={() => {
                              setSearch(item.title);
                              setCandidateSort("money_desc");
                              setTab("kandidater");
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 text-sm font-medium leading-snug">
                                <span className="text-muted-foreground mr-1.5 tabular-nums">
                                  {idx + 1}.
                                </span>
                                {item.title}
                              </p>
                              <p className="shrink-0 text-sm font-semibold tabular-nums">
                                {formatMoney(item.currencySavedPerYear)}
                              </p>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="bg-muted h-1.5 min-w-0 flex-1 overflow-hidden rounded-full">
                                <div
                                  className="h-full rounded-full bg-emerald-600/70"
                                  style={{ width: `${Math.min(share, 100)}%` }}
                                />
                              </div>
                              <span className="text-muted-foreground w-10 shrink-0 text-right text-[11px] tabular-nums">
                                {share}%
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-1 text-[11px]">
                              {formatHours(item.hoursSavedPerYear)} t/år ·{" "}
                              {PIPELINE_STATUS_LABELS[
                                item.pipelineStatus as PipelineStatus
                              ] ?? item.pipelineStatus}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-border/40 bg-card p-4">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                  <TrendingDown className="size-3.5" aria-hidden />
                  Lite eller ingen tall
                </p>
                {benefitDrivers.lowMoney.length === 0 &&
                benefitDrivers.noNumbers.length === 0 ? (
                  <p className="text-muted-foreground mt-3 text-sm">
                    Alle kandidater har tallfestet gevinst.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {benefitDrivers.lowMoney.map((item) => (
                      <li key={item.assessmentId}>
                        <button
                          type="button"
                          className="hover:bg-muted/30 w-full rounded-xl px-2 py-2 text-left transition-colors"
                          onClick={() => {
                            setSearch(item.title);
                            setCandidateSort("money_asc");
                            setOnlyQuantified(true);
                            setTab("kandidater");
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-sm font-medium leading-snug">
                              {item.title}
                            </p>
                            <p className="text-muted-foreground shrink-0 text-sm tabular-nums">
                              {formatMoney(item.currencySavedPerYear)}
                            </p>
                          </div>
                          <p className="text-muted-foreground mt-1 text-[11px]">
                            Lav andel av totalen · {formatHours(item.hoursSavedPerYear)}{" "}
                            t/år
                          </p>
                        </button>
                      </li>
                    ))}
                    {benefitDrivers.noNumbers.map((item) => (
                      <li key={item.assessmentId}>
                        <button
                          type="button"
                          className="hover:bg-muted/30 w-full rounded-xl px-2 py-2 text-left transition-colors"
                          onClick={() => {
                            setSearch(item.title);
                            setOnlyQuantified(false);
                            setTab("kandidater");
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-sm font-medium leading-snug">
                              {item.title}
                            </p>
                            <span className="text-muted-foreground shrink-0 text-[11px] font-medium">
                              Uten tall
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1 text-[11px]">
                            Mangler kvantifisert besparelse i vurderingen
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <p className="text-muted-foreground text-center text-xs leading-relaxed">
            Trykk en fase eller en kandidat for å gå dypere. Diagrammer og kvalitet
            ligger i fanene over.
          </p>
        </div>
      ) : null}

      {tab === "diagrammer" ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-border/40 bg-card p-4 sm:p-5">
            <h2 className="font-heading text-base font-semibold">Per fase</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Timer og kroner fordelt på pipeline
            </p>
            <div className="mt-4 h-64 w-full min-w-0 sm:h-72">
              {pipelineChartData.length === 0 ? (
                <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
                  Ingen data ennå
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineChartData} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={52} />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip
                      formatter={(value, name) => {
                        const n = typeof value === "number" ? value : Number(value);
                        return name === "kr"
                          ? [formatMoney(n), "Kroner"]
                          : [`${formatHours(n)} t`, "Timer"];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="timer" name="Timer" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="kr" name="Kroner" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-border/40 bg-card p-4 sm:p-5">
              <h2 className="font-heading text-base font-semibold">Realisering</h2>
              <div className="mt-4 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={realizationChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip
                      formatter={(value, name) => {
                        const n = typeof value === "number" ? value : Number(value);
                        return name === "kr"
                          ? [formatMoney(n), "Kroner"]
                          : [`${formatHours(n)} t`, "Timer"];
                      }}
                    />
                    <Bar dataKey="kr" name="Kroner" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl border border-border/40 bg-card p-4 sm:p-5">
              <h2 className="font-heading text-base font-semibold">Antall</h2>
              <div className="mt-4 h-56 w-full">
                {phasePieData.length === 0 ? (
                  <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
                    Ingen kandidater
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={phasePieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={2}
                      >
                        {phasePieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {tab === "kvalitet" ? (
        <div className="space-y-4">
          <section className="rounded-3xl border border-border/40 bg-card px-5 py-6 sm:px-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  Det som ikke alltid kan prises
                </h2>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  Kvalitet, sikkerhet og at arbeidet faktisk blir gjort — synlig uten å
                  tvinges inn i én kroneverdi.
                </p>
              </div>
            </div>
          </section>

          {softChartData.length > 0 ? (
            <section className="rounded-2xl border border-border/40 bg-card p-4 sm:p-5">
              <div className="h-56 w-full sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={softChartData} layout="vertical" margin={{ left: 4, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Vurderinger" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : (
            <p className="text-muted-foreground rounded-2xl border border-dashed border-border/50 px-4 py-8 text-center text-sm">
              Ingen kvalitets- eller sikkerhetstagger valgt i vurderingene ennå.
            </p>
          )}

          <ul className="space-y-3">
            {data.softGainFrequency
              .filter((g) => g.soft && g.count > 0)
              .map((g) => {
                const copy = SOFT_GAIN_LEADERSHIP[g.id];
                return (
                  <li
                    key={g.id}
                    className="rounded-2xl border border-border/40 px-4 py-3.5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-foreground">
                        {copy?.label ?? g.label}
                      </p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {g.count}
                      </p>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm leading-snug">
                      {copy?.why ??
                        "Viktig for porteføljen, vanskelig å prise direkte."}
                    </p>
                  </li>
                );
              })}
          </ul>
        </div>
      ) : null}

      {tab === "kandidater" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk …"
              className="h-10 w-full rounded-full sm:max-w-xs"
              aria-label="Søk kandidat"
            />
            <select
              className="border-input bg-background h-10 rounded-full border px-3 text-sm"
              value={pipelineFilter}
              onChange={(e) =>
                setPipelineFilter(e.target.value as "all" | PipelineStatus)
              }
              aria-label="Filtrer fase"
            >
              <option value="all">Alle faser</option>
              {(Object.keys(PIPELINE_STATUS_LABELS) as PipelineStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {PIPELINE_STATUS_LABELS[s]}
                  </option>
                ),
              )}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyQuantified}
                onChange={(e) => setOnlyQuantified(e.target.checked)}
                className="size-4 rounded"
              />
              Kun med tall
            </label>
            <select
              className="border-input bg-background h-10 rounded-full border px-3 text-sm"
              value={candidateSort}
              onChange={(e) =>
                setCandidateSort(
                  e.target.value as
                    | "money_desc"
                    | "money_asc"
                    | "hours_desc"
                    | "updated",
                )
              }
              aria-label="Sorter kandidater"
            >
              <option value="money_desc">Mest kroner først</option>
              <option value="money_asc">Minst kroner først</option>
              <option value="hours_desc">Flest timer først</option>
              <option value="updated">Sist oppdatert</option>
            </select>
            <p className="text-muted-foreground text-xs tabular-nums sm:ml-auto">
              {filteredItems.length} av {data.assessmentCount}
            </p>
          </div>

          {filteredItems.length === 0 ? (
            <p className="text-muted-foreground rounded-2xl border border-dashed border-border/50 px-4 py-10 text-center text-sm">
              Ingen treff
            </p>
          ) : (
            <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/40 bg-card">
              {filteredItems.map((item) => (
                <li key={item.assessmentId}>
                  <Link
                    href={`/w/${workspaceId}/a/${item.assessmentId}`}
                    className="hover:bg-muted/20 flex items-center gap-3 px-4 py-3.5 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {PIPELINE_STATUS_LABELS[
                          item.pipelineStatus as PipelineStatus
                        ] ?? item.pipelineStatus}
                        {" · "}
                        {formatMoney(item.currencySavedPerYear)}
                        {" · "}
                        {formatHours(item.hoursSavedPerYear)} t
                        {data.totals.currencySavedPerYear > 0 &&
                        item.currencySavedPerYear > 0
                          ? ` · ${Math.round(
                              (item.currencySavedPerYear /
                                data.totals.currencySavedPerYear) *
                                100,
                            )}% av kr`
                          : !item.hasQuantifiedBenefit
                            ? " · uten tall"
                            : ""}
                      </p>
                    </div>
                    {item.currencySavedPerYear > 0 ? (
                      <ArrowUpRight
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                    ) : (
                      <ArrowDownRight
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Coins className="size-3.5" aria-hidden />
              Drift {formatMoney(data.totals.annualRunCost)}/år
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              Etablering {formatMoney(data.totals.buildCost)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
