/**
 * Klassisk RPA-livssyklus (7 steg) mappet til PVV-flater og pipeline-status.
 * Ingen egen DB — steget utledes fra pipeline + dokumentasjonsdekning.
 */

import type { Id } from "@/convex/_generated/dataModel";
import type { PipelineStatus } from "@/lib/assessment-pipeline";

export type RpaLifecycleStageId =
  | "identify"
  | "assess"
  | "design"
  | "develop"
  | "test"
  | "deploy"
  | "monitor";

export type RpaDocKind = "pvv" | "ros" | "pdd";

export type RpaLifecycleStage = {
  id: RpaLifecycleStageId;
  index: number;
  /** Kort norsk tittel (produkt) */
  title: string;
  /** Klassisk engelsk navn (vises dempet) */
  classicLabel: string;
  /** Én setning: hva og når */
  summary: string;
  /** Pipeline-statuser som hører til dette steget */
  pipelineStatuses: PipelineStatus[];
  /** Dokumentasjon som typisk skal være på plass i/etter steget */
  docs: RpaDocKind[];
  ctaLabel: string;
};

export const RPA_LIFECYCLE_STAGES: readonly RpaLifecycleStage[] = [
  {
    id: "identify",
    index: 1,
    title: "Identifisering",
    classicLabel: "RPA Candidate Identification",
    summary:
      "Samle kandidater via skjemaer og forslag, og registrer dem som prosesser.",
    pipelineStatuses: [],
    docs: [],
    ctaLabel: "Åpne skjemaer",
  },
  {
    id: "assess",
    index: 2,
    title: "Vurdering og prioritering",
    classicLabel: "Assessment & Prioritization",
    summary:
      "Fullfør PVV-vurdering, score og prioriter hva som skal videre.",
    pipelineStatuses: ["not_assessed", "assessed", "prioritized"],
    docs: ["pvv"],
    ctaLabel: "Til vurderinger",
  },
  {
    id: "design",
    index: 3,
    title: "Design",
    classicLabel: "Design",
    summary:
      "Beskriv As-Is/To-Be i prosessdesign (PDD) og dokumenter risiko i ROS.",
    pipelineStatuses: ["prioritized"],
    docs: ["pdd", "ros"],
    ctaLabel: "Til prosessdesign",
  },
  {
    id: "develop",
    index: 4,
    title: "Utvikling",
    classicLabel: "Development",
    summary: "Bygg roboten. Følg status og oppgaver mens arbeidet pågår.",
    pipelineStatuses: ["development"],
    docs: ["pvv", "pdd", "ros"],
    ctaLabel: "Til oppgaver",
  },
  {
    id: "test",
    index: 5,
    title: "Testing",
    classicLabel: "Testing",
    summary: "UAT og godkjenning før produksjon — marker status som UAT / test.",
    pipelineStatuses: ["uat"],
    docs: ["pvv", "pdd", "ros"],
    ctaLabel: "Til vurderinger",
  },
  {
    id: "deploy",
    index: 6,
    title: "Produksjon",
    classicLabel: "Deployment",
    summary: "Sett i drift når UAT er godkjent. Hold dokumentasjonen oppdatert.",
    pipelineStatuses: ["production"],
    docs: ["pvv", "pdd", "ros"],
    ctaLabel: "Til vurderinger",
  },
  {
    id: "monitor",
    index: 7,
    title: "Overvåkning og endring",
    classicLabel: "Monitoring & Change Management",
    summary:
      "Følg opp i drift, håndter endringer, og marker ferdig når avsluttet.",
    pipelineStatuses: ["monitoring", "done"],
    docs: ["pvv", "pdd", "ros"],
    ctaLabel: "Til oppgaver",
  },
] as const;

export function getRpaLifecycleStage(
  id: RpaLifecycleStageId,
): RpaLifecycleStage {
  const stage = RPA_LIFECYCLE_STAGES.find((s) => s.id === id);
  if (!stage) {
    return RPA_LIFECYCLE_STAGES[0]!;
  }
  return stage;
}

/** Utled livssyklussteg fra vurderingens pipeline-status. */
export function lifecycleStageFromPipeline(
  status: PipelineStatus | undefined | null,
): RpaLifecycleStageId {
  switch (status) {
    case "not_assessed":
    case "assessed":
    case "prioritized":
      return status === "prioritized" ? "design" : "assess";
    case "development":
      return "develop";
    case "uat":
      return "test";
    case "production":
      return "deploy";
    case "monitoring":
    case "done":
      return "monitor";
    case "on_hold":
      return "assess";
    default:
      return "identify";
  }
}

export type ProcessCoverageSignals = {
  hasPvv: boolean;
  hasRos: boolean;
  hasPdd: boolean;
  /** Sterkeste / nyeste pipeline blant koblede vurderinger */
  pipelineStatus?: PipelineStatus | null;
};

/**
 * Utled steg for en prosess i registeret:
 * dokumentasjon først (identifisert → vurdert → design), deretter pipeline.
 */
export function lifecycleStageFromProcessCoverage(
  signals: ProcessCoverageSignals,
): RpaLifecycleStageId {
  if (!signals.hasPvv) {
    return "identify";
  }
  if (signals.pipelineStatus) {
    const fromPipe = lifecycleStageFromPipeline(signals.pipelineStatus);
    // Ikke hopp til develop før design-dok er på plass
    if (
      (fromPipe === "develop" ||
        fromPipe === "test" ||
        fromPipe === "deploy" ||
        fromPipe === "monitor") &&
      (!signals.hasPdd || !signals.hasRos)
    ) {
      return "design";
    }
    if (fromPipe === "design" && signals.hasPdd && signals.hasRos) {
      return "develop";
    }
    return fromPipe;
  }
  if (!signals.hasRos || !signals.hasPdd) {
    return "design";
  }
  return "develop";
}

export function workspaceHrefForStage(
  stageId: RpaLifecycleStageId,
  workspaceId: Id<"workspaces">,
): string {
  const base = `/w/${workspaceId}`;
  switch (stageId) {
    case "identify":
      return `${base}/skjemaer`;
    case "assess":
      return `${base}/vurderinger`;
    case "design":
      return `${base}/prosessdesign`;
    case "develop":
      return `${base}/oppgaver`;
    case "test":
    case "deploy":
      return `${base}/vurderinger`;
    case "monitor":
      return `${base}/oppgaver`;
    default:
      return base;
  }
}

export function primaryActionForStage(
  stageId: RpaLifecycleStageId,
  workspaceId: Id<"workspaces">,
): { href: string; label: string } {
  const stage = getRpaLifecycleStage(stageId);
  return {
    href: workspaceHrefForStage(stageId, workspaceId),
    label: stage.ctaLabel,
  };
}

/** Anker på Hjem for «Se hele livssyklusen». */
export function rpaLifecycleHomeHref(workspaceId: Id<"workspaces">): string {
  return `/w/${workspaceId}#rpa-livssyklus`;
}

export function lifecycleContextLine(stageId: RpaLifecycleStageId): string {
  const stage = getRpaLifecycleStage(stageId);
  return `Steg ${stage.index} av ${RPA_LIFECYCLE_STAGES.length} · ${stage.title}`;
}

export type PipelineCountMap = Partial<Record<PipelineStatus, number>>;

/**
 * Live antall per livssyklussteg fra pipeline-fordeling + ventende forslag.
 * Identify bruker pendingIntake; øvrige summerer relevante pipeline-statuser.
 */
export function lifecycleLiveCounts(args: {
  pipelineCounts?: PipelineCountMap | null;
  pendingIntakeCount?: number;
}): Record<RpaLifecycleStageId, number> {
  const p = args.pipelineCounts ?? {};
  const n = (s: PipelineStatus) => p[s] ?? 0;
  return {
    identify: Math.max(0, args.pendingIntakeCount ?? 0),
    assess: n("not_assessed") + n("assessed"),
    design: n("prioritized"),
    develop: n("development"),
    test: n("uat"),
    deploy: n("production"),
    monitor: n("monitoring") + n("done"),
  };
}

/** Steget med flest aktive saker (ekskl. tomme), ellers null. */
export function hottestLifecycleStage(
  counts: Record<RpaLifecycleStageId, number>,
): RpaLifecycleStageId | null {
  let best: RpaLifecycleStageId | null = null;
  let bestN = 0;
  for (const stage of RPA_LIFECYCLE_STAGES) {
    const n = counts[stage.id] ?? 0;
    if (n > bestN) {
      bestN = n;
      best = stage.id;
    }
  }
  return bestN > 0 ? best : null;
}
