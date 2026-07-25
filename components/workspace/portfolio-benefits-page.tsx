"use client";

import { ProductEmptyState } from "@/components/product";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { SearchInput } from "@/components/ui/search-input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PIPELINE_STATUSES,
  PIPELINE_STATUS_LABELS,
  PIPELINE_STATUS_TONES,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import {
  REALIZATION_LABELS,
  SOFT_GAIN_LEADERSHIP,
} from "@/lib/portfolio-benefit-copy";
import { downloadPortfolioBenefitsPdf } from "@/lib/portfolio-benefits-pdf";
import { useStickyState } from "@/lib/use-sticky-state";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  ArrowUpRight,
  ChartColumn,
  ClipboardList,
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
import { useEffect, useMemo, useRef, useState } from "react";
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
type ChartMetric = "timer" | "kr";
type CandidateSort = "money_desc" | "money_asc" | "hours_desc" | "updated";

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

const selectClass = cn(
  "border-input h-11 w-full appearance-none rounded-xl border border-border/60 bg-background bg-[length:1rem] bg-[right_0.85rem_center] bg-no-repeat px-3 pr-10 text-sm shadow-sm",
  "transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
  "sm:h-10 sm:w-auto sm:min-w-[9.5rem] dark:bg-input/30",
);

const selectChevronStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
} as const;

function formatHours(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0 kr";
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mill. kr`;
  }
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

function formatFte(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}

function isPipelineStatus(value: string): value is PipelineStatus {
  return (PIPELINE_STATUSES as readonly string[]).includes(value);
}

function chartRowKey(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as { key?: unknown; payload?: { key?: unknown } };
  if (typeof row.key === "string") return row.key;
  if (typeof row.payload?.key === "string") return row.payload.key;
  return null;
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
    <div className="min-w-0 overflow-hidden">
      <p className="text-muted-foreground text-[10px] font-medium tracking-[0.12em] uppercase sm:text-[11px]">
        {label}
      </p>
      <p className="font-heading mt-1 text-2xl font-semibold tracking-tight break-words tabular-nums text-foreground sm:text-3xl md:text-4xl">
        {value}
        {unit ? (
          <span className="text-muted-foreground ml-1 text-sm font-medium sm:ml-1.5 sm:text-base md:text-lg">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function MetricToggle({
  value,
  onChange,
}: {
  value: ChartMetric;
  onChange: (next: ChartMetric) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-border/50 bg-background p-0.5"
      role="group"
      aria-label="Vis timer eller kroner"
    >
      {(
        [
          ["timer", "Timer"],
          ["kr", "Kroner"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "min-h-9 rounded-full px-3 text-xs font-medium touch-manipulation transition-colors",
            value === id
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
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

  const [tab, setTab] = useStickyState<TabId>(
    `gevinster:${workspaceId}:tab`,
    "oversikt",
  );
  const [search, setSearch] = useState("");
  const [pipelineFilter, setPipelineFilter] = useStickyState<
    "all" | PipelineStatus
  >(`gevinster:${workspaceId}:pipeline`, "all");
  const [realizationFilter, setRealizationFilter] =
    useStickyState<RealizationFilter>(
      `gevinster:${workspaceId}:realization`,
      "all",
    );
  const [onlyQuantified, setOnlyQuantified] = useStickyState(
    `gevinster:${workspaceId}:onlyQuantified`,
    false,
  );
  const [candidateSort, setCandidateSort] = useStickyState<CandidateSort>(
    `gevinster:${workspaceId}:sort`,
    "money_desc",
  );
  const [chartMetric, setChartMetric] = useStickyState<ChartMetric>(
    `gevinster:${workspaceId}:chartMetric`,
    "kr",
  );
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLLIElement | null>(null);

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
      withoutNumbers: 0,
    };
    if (!data) return empty;
    const totalCurrency = data.totals.currencySavedPerYear;
    const byMoney = [...data.items].sort(
      (a, b) => b.currencySavedPerYear - a.currencySavedPerYear,
    );
    const withMoney = byMoney.filter((i) => i.currencySavedPerYear > 0);
    const topMoney = withMoney.slice(0, 5);
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
    const withoutNumbers = data.items.filter(
      (i) => !i.hasQuantifiedBenefit,
    ).length;
    return { topMoney, lowMoney, noNumbers, totalCurrency, withoutNumbers };
  }, [data]);

  const displayTotals = useMemo(() => {
    if (!data) {
      return { hours: 0, currency: 0, fte: 0, net: 0 };
    }
    if (
      realizationFilter === "all" &&
      pipelineFilter === "all" &&
      !onlyQuantified &&
      !search.trim()
    ) {
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
  }, [
    data,
    filteredItems,
    realizationFilter,
    pipelineFilter,
    onlyQuantified,
    search,
  ]);

  const pipelineChartData = useMemo(() => {
    if (!data) return [];
    return data.byPipeline
      .filter((r) => r.count > 0)
      .map((r) => ({
        key: r.status,
        name: PIPELINE_STATUS_LABELS[r.status as PipelineStatus] ?? r.status,
        timer: Math.round(r.hoursSavedPerYear),
        kr: Math.round(r.currencySavedPerYear),
        count: r.count,
      }));
  }, [data]);

  const realizationChartData = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: "potential" as const,
        name: "Potensial",
        timer: Math.round(data.potentialTotals.hoursSavedPerYear),
        kr: Math.round(data.potentialTotals.currencySavedPerYear),
      },
      {
        key: "in_delivery" as const,
        name: "Leveranse",
        timer: Math.round(data.inDeliveryTotals.hoursSavedPerYear),
        kr: Math.round(data.inDeliveryTotals.currencySavedPerYear),
      },
      {
        key: "realized" as const,
        name: "I drift",
        timer: Math.round(data.realizedTotals.hoursSavedPerYear),
        kr: Math.round(data.realizedTotals.currencySavedPerYear),
      },
    ];
  }, [data]);

  const softGains = useMemo(() => {
    if (!data) return [];
    const rows = data.softGainFrequency.filter((g) => g.soft && g.count > 0);
    const max = Math.max(...rows.map((g) => g.count), 1);
    return rows.map((g) => ({
      ...g,
      share: Math.round((g.count / max) * 100),
    }));
  }, [data]);

  const phasePieData = useMemo(() => {
    if (!data) return [];
    return data.byPipeline
      .filter((r) => r.count > 0)
      .map((r) => ({
        key: r.status,
        name: PIPELINE_STATUS_LABELS[r.status as PipelineStatus] ?? r.status,
        value: r.count,
      }));
  }, [data]);

  useEffect(() => {
    if (tab !== "kandidater" || !highlightId) return;
    const node = highlightRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(() => setHighlightId(null), 2800);
    return () => window.clearTimeout(t);
  }, [tab, highlightId, filteredItems]);

  const openCandidate = (assessmentId: string) => {
    setHighlightId(assessmentId);
    setSearch("");
    setTab("kandidater");
  };

  const openPipelineCandidates = (status: PipelineStatus) => {
    setPipelineFilter(status);
    setHighlightId(null);
    setTab("kandidater");
  };

  const openRealizationCandidates = (bucket: Exclude<RealizationFilter, "all">) => {
    setRealizationFilter(bucket);
    setHighlightId(null);
    setTab("kandidater");
  };

  const hasActiveFilters =
    search.trim().length > 0 ||
    pipelineFilter !== "all" ||
    realizationFilter !== "all" ||
    onlyQuantified;

  const clearFilters = () => {
    setSearch("");
    setPipelineFilter("all");
    setRealizationFilter("all");
    setOnlyQuantified(false);
    setHighlightId(null);
  };

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
      <ProductEmptyState
        icon={ChartColumn}
        title="Kunne ikke laste gevinster"
        description="Sjekk at du er innlogget og har tilgang til arbeidsområdet."
      />
    );
  }

  const verdictParts = [
    `${formatMoney(data.totals.currencySavedPerYear)} potensial`,
    `${formatMoney(data.realizedTotals.currencySavedPerYear)} i drift`,
    benefitDrivers.withoutNumbers > 0
      ? `${benefitDrivers.withoutNumbers} uten tall`
      : "alle med tall",
  ];

  const chartValueFormatter = (value: unknown) => {
    const n = typeof value === "number" ? value : Number(value);
    return chartMetric === "kr"
      ? [formatMoney(n), "Kroner"]
      : [`${formatHours(n)} t`, "Timer"];
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-none space-y-5 overflow-x-clip pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
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
            "min-h-11 w-full shrink-0 gap-2 rounded-full touch-manipulation sm:min-h-10 sm:w-auto",
          )}
        >
          <Download className="size-3.5" aria-hidden />
          Eksporter PDF
        </button>
      </header>

      <nav
        className="-mx-3 flex gap-1 overflow-x-auto overscroll-x-contain px-3 [scrollbar-width:none] sm:mx-0 sm:rounded-full sm:border sm:border-border/50 sm:bg-background sm:p-1 sm:px-1 [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Gevinstvisning"
      >
        <div className="flex min-w-full gap-1 rounded-full border border-border/50 bg-background p-1 sm:min-w-0 sm:flex-1 sm:border-0 sm:bg-transparent sm:p-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "min-h-11 min-w-0 flex-1 rounded-full px-2.5 text-xs font-medium touch-manipulation transition-colors sm:min-h-10 sm:px-4 sm:text-sm",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "oversikt" ? (
        <div className="space-y-6">
          {data.assessmentCount === 0 ? (
            <ProductEmptyState
              icon={ClipboardList}
              title="Ingen kandidater ennå"
              description="Når vurderinger får tall for tid og kostnad, samles potensialet her."
              action={
                <Link
                  href={`/w/${workspaceId}/vurderinger`}
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "min-h-11 rounded-full touch-manipulation",
                  )}
                >
                  Gå til vurderinger
                </Link>
              }
            />
          ) : (
            <>
              <section className="rounded-3xl border border-border/40 bg-card px-4 py-5 sm:px-8 sm:py-8">
                <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
                  Årlig potensial
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:mt-5 sm:gap-8">
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
                <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
                  {verdictParts.join(" · ")}
                </p>
              </section>

              {realizationFilter !== "all" ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">Viser</span>
                  <span className="font-medium">
                    {REALIZATION_LABELS[realizationFilter]}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-9"
                    onClick={() => setRealizationFilter("all")}
                  >
                    Nullstill fase
                  </Button>
                </div>
              ) : null}

              <section className="-mx-3 flex gap-2 overflow-x-auto overscroll-x-contain px-3 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
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
                        setRealizationFilter((prev) =>
                          prev === key ? "all" : key,
                        )
                      }
                      className={cn(
                        "min-w-[11.5rem] shrink-0 rounded-2xl border px-4 py-4 text-left touch-manipulation transition-colors sm:min-w-0",
                        active
                          ? "border-foreground/25 bg-foreground text-background"
                          : "border-border/40 bg-muted/10 hover:bg-muted/25",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-[11px] font-medium",
                            active
                              ? "text-background/75"
                              : "text-muted-foreground",
                          )}
                        >
                          {REALIZATION_LABELS[key]}
                        </p>
                        <Icon
                          className={cn(
                            "size-3.5",
                            active
                              ? "text-background/70"
                              : "text-muted-foreground",
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
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-heading text-base font-semibold">
                      Hva driver tallene?
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Hvilke kandidater står bak besparelsen — og hvor det nesten
                      ikke er tall.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="min-h-10 self-start text-xs font-medium underline-offset-2 touch-manipulation hover:underline"
                    onClick={() => {
                      setCandidateSort("money_desc");
                      setOnlyQuantified(true);
                      setHighlightId(null);
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
                      <ProductEmptyState
                        className="mt-3 border-0 bg-transparent py-6 ring-0"
                        title="Ingen kroner-besparelse ennå"
                        description="Fyll inn tid og kostnad i vurderinger for å se fordelingen her."
                      />
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
                                className="hover:bg-muted/30 w-full rounded-xl px-2 py-2 text-left transition-colors touch-manipulation"
                                onClick={() => openCandidate(item.assessmentId)}
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
                                      style={{
                                        width: `${Math.min(share, 100)}%`,
                                      }}
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
                              className="hover:bg-muted/30 w-full rounded-xl px-2 py-2 text-left transition-colors touch-manipulation"
                              onClick={() => openCandidate(item.assessmentId)}
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
                                Lav andel av totalen ·{" "}
                                {formatHours(item.hoursSavedPerYear)} t/år
                              </p>
                            </button>
                          </li>
                        ))}
                        {benefitDrivers.noNumbers.map((item) => (
                          <li key={item.assessmentId}>
                            <button
                              type="button"
                              className="hover:bg-muted/30 w-full rounded-xl px-2 py-2 text-left transition-colors touch-manipulation"
                              onClick={() => {
                                setOnlyQuantified(false);
                                openCandidate(item.assessmentId);
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
                Trykk en fase eller en kandidat for å gå dypere. Diagrammer og
                kvalitet ligger i fanene over.
              </p>
            </>
          )}
        </div>
      ) : null}

      {tab === "diagrammer" ? (
        <div className="space-y-4">
          {pipelineChartData.length === 0 && phasePieData.length === 0 ? (
            <ProductEmptyState
              icon={ChartColumn}
              title="Ingen diagramdata ennå"
              description="Når vurderinger er i pipeline, vises fordeling av timer og kroner her."
              action={
                <Link
                  href={`/w/${workspaceId}/vurderinger`}
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "min-h-11 rounded-full touch-manipulation",
                  )}
                >
                  Gå til vurderinger
                </Link>
              }
            />
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl border border-border/40 bg-card p-3 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-heading text-base font-semibold">
                      Per fase
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {chartMetric === "kr" ? "Kroner" : "Timer"} fordelt på
                      pipeline — trykk en søyle for å se kandidater
                    </p>
                  </div>
                  <MetricToggle value={chartMetric} onChange={setChartMetric} />
                </div>
                <div className="mt-4 h-60 w-full min-w-0 sm:h-72">
                  {pipelineChartData.length === 0 ? (
                    <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
                      Ingen data ennå
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={pipelineChartData}
                        margin={{ left: 0, right: 4, top: 4, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border/50"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 9 }}
                          interval={0}
                          angle={-28}
                          textAnchor="end"
                          height={56}
                        />
                        <YAxis tick={{ fontSize: 10 }} width={44} />
                        <Tooltip formatter={chartValueFormatter} />
                        <Bar
                          dataKey={chartMetric}
                          name={chartMetric === "kr" ? "Kroner" : "Timer"}
                          fill={CHART_COLORS[0]}
                          radius={[4, 4, 0, 0]}
                          cursor="pointer"
                          onClick={(entry) => {
                            const key = chartRowKey(entry);
                            if (key && isPipelineStatus(key)) {
                              openPipelineCandidates(key);
                            }
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <div className="grid gap-4 md:grid-cols-2">
                <section className="overflow-hidden rounded-2xl border border-border/40 bg-card p-3 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="font-heading text-base font-semibold">
                        Realisering
                      </h2>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Trykk for å filtrere kandidater
                      </p>
                    </div>
                    <MetricToggle
                      value={chartMetric}
                      onChange={setChartMetric}
                    />
                  </div>
                  <div className="mt-4 h-52 w-full min-w-0 sm:h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={realizationChartData}
                        margin={{ left: 0, right: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border/50"
                        />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={44} />
                        <Tooltip formatter={chartValueFormatter} />
                        <Bar
                          dataKey={chartMetric}
                          name={chartMetric === "kr" ? "Kroner" : "Timer"}
                          fill={CHART_COLORS[2]}
                          radius={[4, 4, 0, 0]}
                          cursor="pointer"
                          onClick={(entry) => {
                            const key = chartRowKey(entry);
                            if (
                              key === "potential" ||
                              key === "in_delivery" ||
                              key === "realized"
                            ) {
                              openRealizationCandidates(key);
                            }
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-border/40 bg-card p-3 sm:p-5">
                  <h2 className="font-heading text-base font-semibold">
                    Antall
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Trykk et segment for å se kandidater i fasen
                  </p>
                  <div className="mt-4 h-52 w-full min-w-0 sm:h-56">
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
                            innerRadius={40}
                            outerRadius={68}
                            paddingAngle={2}
                            cursor="pointer"
                            onClick={(_, index) => {
                              const row = phasePieData[index];
                              if (row && isPipelineStatus(row.key)) {
                                openPipelineCandidates(row.key);
                              }
                            }}
                          >
                            {phasePieData.map((_, i) => (
                              <Cell
                                key={i}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "kvalitet" ? (
        <div className="space-y-4">
          <section className="rounded-3xl border border-border/40 bg-card px-5 py-6 sm:px-6">
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="text-muted-foreground mt-0.5 size-5 shrink-0"
                aria-hidden
              />
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  Det som ikke alltid kan prises
                </h2>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  Kvalitet, sikkerhet og at arbeidet faktisk blir gjort — synlig
                  uten å tvinges inn i én kroneverdi.
                </p>
              </div>
            </div>
          </section>

          {softGains.length === 0 ? (
            <ProductEmptyState
              icon={ShieldCheck}
              title="Ingen kvalitets- eller sikkerhetstagger ennå"
              description="Velg myke gevinster i vurderinger for å vise hva porteføljen også leverer utover kroner og timer."
              action={
                <Link
                  href={`/w/${workspaceId}/vurderinger`}
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "min-h-11 rounded-full touch-manipulation",
                  )}
                >
                  Gå til vurderinger
                </Link>
              }
            />
          ) : (
            <ul className="space-y-3">
              {softGains.map((g) => {
                const copy = SOFT_GAIN_LEADERSHIP[g.id];
                return (
                  <li
                    key={g.id}
                    className="rounded-2xl border border-border/40 bg-card px-4 py-3.5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-foreground">
                        {copy?.label ?? g.label}
                      </p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {g.count}{" "}
                        {g.count === 1 ? "vurdering" : "vurderinger"}
                      </p>
                    </div>
                    <div className="bg-muted mt-2.5 h-1.5 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-foreground/55"
                        style={{ width: `${Math.min(g.share, 100)}%` }}
                      />
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm leading-snug">
                      {copy?.why ??
                        "Viktig for porteføljen, vanskelig å prise direkte."}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "kandidater" ? (
        <div className="space-y-4">
          <FilterToolbar className="rounded-2xl border border-border/50 bg-card/30 p-3 sm:p-3.5">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk kandidat …"
              aria-label="Søk kandidat"
              className="min-w-0 flex-1 sm:max-w-md"
              inputClassName="h-11 min-h-11 rounded-xl border-border/60 md:h-10 md:min-h-10"
            />
            <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:w-auto">
              <span className="px-0.5 font-medium">Fase</span>
              <select
                aria-label="Filtrer fase"
                value={pipelineFilter}
                onChange={(e) =>
                  setPipelineFilter(e.target.value as "all" | PipelineStatus)
                }
                className={selectClass}
                style={selectChevronStyle}
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
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:w-auto">
              <span className="px-0.5 font-medium">Realisering</span>
              <select
                aria-label="Filtrer realisering"
                value={realizationFilter}
                onChange={(e) =>
                  setRealizationFilter(e.target.value as RealizationFilter)
                }
                className={selectClass}
                style={selectChevronStyle}
              >
                <option value="all">Alle</option>
                <option value="potential">{REALIZATION_LABELS.potential}</option>
                <option value="in_delivery">
                  {REALIZATION_LABELS.in_delivery}
                </option>
                <option value="realized">{REALIZATION_LABELS.realized}</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:w-auto">
              <span className="px-0.5 font-medium">Sorter</span>
              <select
                aria-label="Sorter kandidater"
                value={candidateSort}
                onChange={(e) =>
                  setCandidateSort(e.target.value as CandidateSort)
                }
                className={selectClass}
                style={selectChevronStyle}
              >
                <option value="money_desc">Mest kroner først</option>
                <option value="money_asc">Minst kroner først</option>
                <option value="hours_desc">Flest timer først</option>
                <option value="updated">Sist oppdatert</option>
              </select>
            </label>
            <label className="flex min-h-11 items-end gap-2 pb-1 text-sm touch-manipulation sm:min-h-10">
              <input
                type="checkbox"
                checked={onlyQuantified}
                onChange={(e) => setOnlyQuantified(e.target.checked)}
                className="size-4 rounded"
              />
              Kun med tall
            </label>
            <div className="flex flex-wrap items-end justify-between gap-2 sm:ml-auto">
              <p className="text-muted-foreground pb-1 text-xs tabular-nums">
                {filteredItems.length} av {data.assessmentCount}
              </p>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10"
                  onClick={clearFilters}
                >
                  Nullstill filter
                </Button>
              ) : null}
            </div>
          </FilterToolbar>

          {filteredItems.length === 0 ? (
            <ProductEmptyState
              icon={ClipboardList}
              title={hasActiveFilters ? "Ingen treff" : "Ingen kandidater"}
              description={
                hasActiveFilters
                  ? "Prøv et annet søk eller nullstill filtrene."
                  : "Når vurderinger er klare, dukker de opp her med besparelse og timer."
              }
              action={
                hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 rounded-full"
                    onClick={clearFilters}
                  >
                    Nullstill filter
                  </Button>
                ) : (
                  <Link
                    href={`/w/${workspaceId}/vurderinger`}
                    className={cn(
                      buttonVariants({ variant: "default", size: "sm" }),
                      "min-h-11 rounded-full touch-manipulation",
                    )}
                  >
                    Gå til vurderinger
                  </Link>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/40 bg-card">
              {filteredItems.map((item) => {
                const status = item.pipelineStatus as PipelineStatus;
                const tone = PIPELINE_STATUS_TONES[status];
                const highlighted = highlightId === item.assessmentId;
                return (
                  <li
                    key={item.assessmentId}
                    ref={highlighted ? highlightRef : undefined}
                    className={cn(
                      highlighted && "bg-foreground/[0.06] ring-1 ring-inset ring-foreground/15",
                    )}
                  >
                    <Link
                      href={`/w/${workspaceId}/a/${item.assessmentId}`}
                      className="hover:bg-muted/20 flex min-h-14 items-center gap-3 px-3 py-3.5 touch-manipulation transition-colors sm:px-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                              tone?.pill ??
                                "bg-muted text-muted-foreground ring-border/50",
                            )}
                          >
                            {PIPELINE_STATUS_LABELS[status] ??
                              item.pipelineStatus}
                          </span>
                          {!item.hasQuantifiedBenefit ? (
                            <span className="bg-muted text-muted-foreground inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-border/50">
                              Uten tall
                            </span>
                          ) : null}
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {formatMoney(item.currencySavedPerYear)}
                            {" · "}
                            {formatHours(item.hoursSavedPerYear)} t
                            {data.totals.currencySavedPerYear > 0 &&
                            item.currencySavedPerYear > 0
                              ? ` · ${Math.round(
                                  (item.currencySavedPerYear /
                                    data.totals.currencySavedPerYear) *
                                    100,
                                )}%`
                              : ""}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
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
