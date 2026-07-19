"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { OrgRosRollup } from "@/components/workspace/org-unit-ros-kpi-strip";
import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";
import { orgSubtreeIds } from "@/lib/org-unit-filter";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  Shield,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type CoverageRow = {
  candidateId: Id<"candidates">;
  name: string;
  code: string;
  orgUnitId: Id<"orgUnits"> | null;
  pvv: { count: number; assessments: Array<{ assessmentId: Id<"assessments"> }> };
  ros: { count: number; analyses: Array<{ analysisId: Id<"rosAnalyses"> }> };
  pdd: { count: number };
};

function missingLabels(c: CoverageRow): string[] {
  const missing: string[] = [];
  if (c.pvv.count === 0) missing.push("vurdering");
  if (c.ros.count === 0) missing.push("ROS");
  return missing;
}

function primaryAction(c: CoverageRow): {
  label: string;
  kind: "open-pvv" | "create-pvv" | "open-ros" | "create-ros";
} {
  if (c.pvv.count === 0) {
    return { label: "Start vurdering", kind: "create-pvv" };
  }
  if (c.ros.count === 0) {
    return { label: "Start ROS", kind: "create-ros" };
  }
  if (c.pvv.assessments[0]) {
    return { label: "Åpne vurdering", kind: "open-pvv" };
  }
  return { label: "Start vurdering", kind: "create-pvv" };
}

export function OrgUnitWorkPanel({
  workspaceId,
  orgUnits,
  activeOrgUnitId,
  onSelectOrgUnit,
  activeRollup,
  unassignedCount,
}: {
  workspaceId: Id<"workspaces">;
  orgUnits: Doc<"orgUnits">[];
  activeOrgUnitId: Id<"orgUnits"> | "";
  onSelectOrgUnit: (id: Id<"orgUnits">) => void;
  activeRollup: OrgRosRollup | null;
  unassignedCount: number;
}) {
  const router = useRouter();
  const coverage = useQuery(api.candidates.listProcessCoverage, {
    workspaceId,
  });
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const rosTemplates = useQuery(api.ros.listTemplates, { workspaceId });
  const createAssessment = useMutation(api.assessments.create);
  const createRosAnalysis = useMutation(api.ros.createAnalysis);
  const [busyId, setBusyId] = useState<Id<"candidates"> | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(false);

  const canWrite =
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "member";

  const activeId =
    activeOrgUnitId || (orgUnits[0]?._id as Id<"orgUnits"> | undefined);

  const activeUnit = useMemo(
    () => orgUnits.find((u) => u._id === activeId) ?? null,
    [orgUnits, activeId],
  );

  const subtree = useMemo(() => {
    if (!activeId) return new Set<Id<"orgUnits">>();
    return orgSubtreeIds(activeId, orgUnits);
  }, [activeId, orgUnits]);

  const unitRows = useMemo(() => {
    if (!coverage) return null;
    if (showUnassigned) {
      return coverage.filter((c) => c.orgUnitId == null);
    }
    return coverage.filter(
      (c) => c.orgUnitId != null && subtree.has(c.orgUnitId),
    );
  }, [coverage, showUnassigned, subtree]);

  const needsAttention = useMemo(() => {
    if (!unitRows) return null;
    return unitRows
      .filter((c) => missingLabels(c).length > 0)
      .sort((a, b) => {
        const am = missingLabels(a).length;
        const bm = missingLabels(b).length;
        return bm - am || a.name.localeCompare(b.name, "nb");
      });
  }, [unitRows]);

  async function runAction(c: CoverageRow) {
    if (busyId) return;
    const action = primaryAction(c);

    if (action.kind === "open-pvv") {
      const latest = c.pvv.assessments[0];
      if (latest) {
        router.push(`/w/${workspaceId}/a/${latest.assessmentId}`);
      }
      return;
    }

    if (action.kind === "open-ros") {
      const latest = c.ros.analyses[0];
      if (latest) {
        router.push(`/w/${workspaceId}/ros/a/${latest.analysisId}`);
      }
      return;
    }

    if (!canWrite) {
      toast.error("Du trenger medlem-tilgang for å opprette her.");
      return;
    }

    setBusyId(c.candidateId);
    try {
      if (action.kind === "create-pvv") {
        const aid = await createAssessment({
          workspaceId,
          title: `Vurdering av ${c.name}`.slice(0, 240),
          shareWithWorkspace: true,
          fromCandidateId: c.candidateId,
        });
        router.push(`/w/${workspaceId}/a/${aid}`);
        return;
      }
      if (action.kind === "create-ros") {
        const templateId = rosTemplates?.[0]?._id;
        if (!templateId) {
          toast.error("Ingen ROS-mal finnes ennå. Åpne ROS for å komme i gang.");
          router.push(`/w/${workspaceId}/ros`);
          return;
        }
        const rid = await createRosAnalysis({
          workspaceId,
          templateId,
          title: `ROS — ${c.name} (${c.code})`.slice(0, 240),
          candidateId: c.candidateId,
          orgUnitId: c.orgUnitId ?? undefined,
        });
        router.push(`/w/${workspaceId}/ros/a/${rid}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke starte.");
    } finally {
      setBusyId(null);
    }
  }

  if (orgUnits.length === 0) {
    return null;
  }

  const processCount = showUnassigned
    ? (unitRows?.length ?? 0)
    : (activeRollup?.candidateCount ?? unitRows?.length ?? 0);
  const assessmentCount = showUnassigned
    ? (unitRows?.filter((c) => c.pvv.count > 0).length ?? 0)
    : (activeRollup?.assessmentCount ?? 0);
  const rosCount = showUnassigned
    ? (unitRows?.filter((c) => c.ros.count > 0).length ?? 0)
    : (activeRollup?.analysisCount ?? 0);

  const attentionList = needsAttention?.slice(0, 6) ?? null;
  const attentionTotal = needsAttention?.length ?? 0;

  return (
    <section
      className="space-y-5 rounded-2xl border border-border/50 bg-card/60 p-4 shadow-sm sm:p-5"
      aria-label="Arbeid i organisasjonsenhet"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Arbeid i enhet
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Velg enhet — se hva som mangler, og ta neste steg derfra.
          </p>
        </div>
        <select
          className="border-input bg-background h-11 w-full shrink-0 rounded-xl border border-border/50 px-3 text-sm sm:max-w-xs"
          value={activeId ?? ""}
          onChange={(e) => {
            setShowUnassigned(false);
            onSelectOrgUnit(e.target.value as Id<"orgUnits">);
          }}
          aria-label="Velg organisasjonsenhet"
          disabled={showUnassigned}
        >
          {orgUnits.map((u) => (
            <option key={u._id} value={u._id}>
              {ORG_UNIT_KIND_LABELS[u.kind]} · {u.name}
            </option>
          ))}
        </select>
      </div>

      {unassignedCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowUnassigned((v) => !v)}
          className={cn(
            "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
            showUnassigned
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-amber-500/20 bg-amber-500/[0.06] hover:bg-amber-500/10",
          )}
        >
          <Workflow className="text-amber-600 dark:text-amber-400 mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 text-sm">
            <span className="text-foreground font-medium">
              {unassignedCount} uten enhet
            </span>
            <span className="text-muted-foreground">
              {" "}
              — {showUnassigned ? "viser disse nå. Trykk for å gå tilbake." : "trykk for å følge opp."}
            </span>
          </span>
        </button>
      ) : null}

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-baseline gap-2">
          <span className="text-muted-foreground">Prosesser</span>
          <span className="font-semibold tabular-nums text-foreground">
            {processCount}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-muted-foreground">Vurderinger</span>
          <span className="font-semibold tabular-nums text-foreground">
            {assessmentCount}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-muted-foreground">ROS</span>
          <span className="font-semibold tabular-nums text-foreground">
            {rosCount}
          </span>
        </div>
      </div>

      {unitRows === null || needsAttention === null ? (
        <div className="bg-muted/40 h-24 animate-pulse rounded-xl" aria-busy />
      ) : attentionTotal === 0 ? (
        <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-5 text-center">
          <p className="text-foreground text-sm font-medium">
            {processCount === 0
              ? showUnassigned
                ? "Ingen prosesser uten enhet"
                : "Ingen prosesser i denne enheten ennå"
              : "Alt som trengs er på plass her"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {processCount === 0
              ? "Opprett eller plasser prosesser under Prosesser."
              : "Vurdering og ROS er koblet for prosessene i utvalget."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href={
                showUnassigned
                  ? `/w/${workspaceId}/vurderinger?fane=prosesser`
                  : `/w/${workspaceId}/vurderinger?fane=prosesser&orgUnit=${activeId}`
              }
              className="text-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium hover:underline"
            >
              Åpne prosesser
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {attentionTotal} trenger oppfølging
              {!showUnassigned && activeUnit ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  i {activeUnit.name}
                </span>
              ) : null}
            </p>
            {!showUnassigned && activeId ? (
              <Link
                href={`/w/${workspaceId}/vurderinger?fane=prosesser&orgUnit=${activeId}`}
                className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 hover:underline"
              >
                Se alle
              </Link>
            ) : null}
          </div>

          <ul className="divide-border/50 divide-y rounded-xl border border-border/50 bg-background/80">
            {attentionList!.map((c) => {
              const missing = missingLabels(c);
              const action = primaryAction(c);
              const busy = busyId === c.candidateId;
              return (
                <li
                  key={c.candidateId}
                  className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
                      {c.code}
                    </p>
                    <p className="text-foreground truncate text-sm font-semibold">
                      {c.name}
                    </p>
                    <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {missing.includes("vurdering") ? (
                        <span className="inline-flex items-center gap-1">
                          <ClipboardList className="size-3 opacity-70" />
                          Mangler vurdering
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                          <ClipboardList className="size-3 opacity-70" />
                          Har vurdering
                        </span>
                      )}
                      {missing.includes("ROS") ? (
                        <span className="inline-flex items-center gap-1">
                          <Shield className="size-3 opacity-70" />
                          Mangler ROS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                          <Shield className="size-3 opacity-70" />
                          Har ROS
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 shrink-0 rounded-xl px-4 sm:h-9"
                    disabled={busy || membership === undefined}
                    onClick={() => void runAction(c)}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      action.label
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>

          {attentionTotal > 6 ? (
            <p className="text-muted-foreground text-center text-xs">
              +{attentionTotal - 6} til — åpne Prosesser for hele listen.
            </p>
          ) : null}
        </div>
      )}

      {!showUnassigned && activeId ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border/40 pt-3 text-sm">
          <Link
            href={`/w/${workspaceId}/vurderinger?orgUnit=${activeId}`}
            className="text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
          >
            Vurderinger
          </Link>
          <Link
            href={`/w/${workspaceId}/ros?fane=analyser&orgUnit=${activeId}`}
            className="text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
          >
            ROS
          </Link>
          <Link
            href={`/w/${workspaceId}/prosessdesign?orgUnit=${activeId}`}
            className="text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
          >
            Prosessdesign
          </Link>
        </div>
      ) : null}
    </section>
  );
}
