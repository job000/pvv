import type { AssessmentPayload } from "./assessment-types";

export type DecisionReadinessStatus = "missing" | "in_progress" | "ready";

export type ReadinessRequirementKey =
  | "process_profile"
  | "economic_case"
  | "delivery_anchor"
  | "ros"
  | "pdd"
  | "process_design";

export type ReadinessRequirement = {
  key: ReadinessRequirementKey;
  label: string;
  description: string;
  status: DecisionReadinessStatus;
};

export type GovernanceReadinessSummary = {
  readinessScore: number;
  readinessLabel: "Lav" | "Middels" | "Høy";
  readyCount: number;
  totalCount: number;
  requirements: ReadinessRequirement[];
};

function hasText(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function statusFromChecks(complete: boolean, started: boolean): DecisionReadinessStatus {
  if (complete) return "ready";
  if (started) return "in_progress";
  return "missing";
}

function statusScore(status: DecisionReadinessStatus): number {
  switch (status) {
    case "ready":
      return 1;
    case "in_progress":
      return 0.5;
    case "missing":
      return 0;
  }
}

export function readinessLabelFromScore(score: number): "Lav" | "Middels" | "Høy" {
  if (score >= 75) return "Høy";
  if (score >= 45) return "Middels";
  return "Lav";
}

export function buildGovernanceReadinessSummary(args: {
  payload: Pick<
    AssessmentPayload,
    | "processDescription"
    | "processGoal"
    | "processActors"
    | "processSystems"
    | "processFlowSummary"
    | "processConstraints"
    | "hfEconomicRationaleNotes"
    | "rpaBenefitKindsAndOperationsNotes"
    | "rpaLifecycleContact"
    | "rpaManualFallbackWhenRobotFails"
  >;
  rosStatus?: string | null;
  pddStatus?: string | null;
  hasProcessDesignDocument?: boolean;
}) : GovernanceReadinessSummary {
  const processProfileReady =
    hasText(args.payload.processDescription) &&
    hasText(args.payload.processGoal) &&
    hasText(args.payload.processActors) &&
    hasText(args.payload.processSystems) &&
    hasText(args.payload.processFlowSummary);
  const processProfileStarted =
    processProfileReady ||
    hasText(args.payload.processDescription) ||
    hasText(args.payload.processGoal) ||
    hasText(args.payload.processActors) ||
    hasText(args.payload.processSystems) ||
    hasText(args.payload.processFlowSummary) ||
    hasText(args.payload.processConstraints);

  const economicCaseReady =
    hasText(args.payload.hfEconomicRationaleNotes) &&
    hasText(args.payload.rpaBenefitKindsAndOperationsNotes);
  const economicCaseStarted =
    economicCaseReady ||
    hasText(args.payload.hfEconomicRationaleNotes) ||
    hasText(args.payload.rpaBenefitKindsAndOperationsNotes);

  const deliveryAnchorReady =
    hasText(args.payload.rpaLifecycleContact) &&
    hasText(args.payload.rpaManualFallbackWhenRobotFails);
  const deliveryAnchorStarted =
    deliveryAnchorReady ||
    hasText(args.payload.rpaLifecycleContact) ||
    hasText(args.payload.rpaManualFallbackWhenRobotFails);

  const normalizedRosStatus = args.rosStatus ?? "not_started";
  const normalizedPddStatus = args.pddStatus ?? "not_started";
  const rosReady =
    normalizedRosStatus === "completed" || normalizedRosStatus === "not_applicable";
  const rosStarted = rosReady || normalizedRosStatus === "in_progress";
  const pddReady =
    normalizedPddStatus === "completed" || normalizedPddStatus === "not_applicable";
  const pddStarted = pddReady || normalizedPddStatus === "in_progress";

  const processDesignReady = args.hasProcessDesignDocument === true;
  const processDesignStarted = processDesignReady;

  const requirements: ReadinessRequirement[] = [
    {
      key: "process_profile",
      label: "Prosessprofil",
      description: "Beskrivelse, mål, roller, systemer og flyt er dokumentert.",
      status: statusFromChecks(processProfileReady, processProfileStarted),
    },
    {
      key: "economic_case",
      label: "Gevinstgrunnlag",
      description: "Det finnes både økonomisk rasjonale og en kort forklaring av forventet nytte.",
      status: statusFromChecks(economicCaseReady, economicCaseStarted),
    },
    {
      key: "delivery_anchor",
      label: "Leveranse og forankring",
      description: "Kontaktperson og manuell reserve ved feil er avklart.",
      status: statusFromChecks(deliveryAnchorReady, deliveryAnchorStarted),
    },
    {
      key: "ros",
      label: "ROS",
      description: "Risiko er vurdert eller eksplisitt markert som ikke relevant.",
      status: statusFromChecks(rosReady, rosStarted),
    },
    {
      key: "pdd",
      label: "Personvern",
      description: "Personvernvurdering er ferdig eller markert som ikke relevant.",
      status: statusFromChecks(pddReady, pddStarted),
    },
    {
      key: "process_design",
      label: "Prosessdesign",
      description: "RPA prosessdesign er opprettet for videre arbeid og overlevering.",
      status: statusFromChecks(processDesignReady, processDesignStarted),
    },
  ];

  const totalCount = requirements.length;
  const readyCount = requirements.filter((item) => item.status === "ready").length;
  const readinessScore = Math.round(
    (requirements.reduce((sum, item) => sum + statusScore(item.status), 0) / totalCount) * 100,
  );

  return {
    readinessScore,
    readinessLabel: readinessLabelFromScore(readinessScore),
    readyCount,
    totalCount,
    requirements,
  };
}
