import {
  PIPELINE_KANBAN_ORDER,
  PIPELINE_STATUS_LABELS,
  PIPELINE_STATUSES,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";

/**
 * Gjetter PVV-pipelinestatus ut fra navnet på et enkeltvalg i GitHub Projects
 * (typisk tavlekolonne). Brukes til å speile rekkefølge og overskrifter.
 */
export function inferPipelineStatusFromGithubOptionName(
  raw: string,
): PipelineStatus | null {
  const name = raw.trim();
  if (!name) return null;
  const n = name.toLowerCase();

  for (const status of PIPELINE_STATUSES) {
    if (n === PIPELINE_STATUS_LABELS[status].toLowerCase()) {
      return status;
    }
  }

  const rules: Array<{ test: (s: string) => boolean; status: PipelineStatus }> =
    [
      { test: (s) => /på vent|on hold|^blocked$/i.test(s), status: "on_hold" },
      { test: (s) => /ferdig|^\s*done\s*$|complete|closed|resolved/i.test(s), status: "done" },
      {
        test: (s) => /overvåk|monitoring|watch/i.test(s),
        status: "monitoring",
      },
      {
        test: (s) =>
          /produksjon|production|live|deployed|released/i.test(s) &&
          !/uat|test/i.test(s),
        status: "production",
      },
      { test: (s) => /\buat\b|acceptance|staging|pre-?prod/i.test(s), status: "uat" },
      {
        test: (s) =>
          /utvikl|development|\bdev\b|in progress|building|implement/i.test(s),
        status: "development",
      },
      {
        test: (s) => /prioriter|prioritized|ready for dev|ready to start/i.test(s),
        status: "prioritized",
      },
      {
        test: (s) =>
          /^vurdert$|assessed|reviewed|ready for assess/i.test(s) &&
          !/re-?review/i.test(s),
        status: "assessed",
      },
      {
        test: (s) =>
          /ikke vurdert|not assessed|backlog|new|todo|to do|open|draft/i.test(s),
        status: "not_assessed",
      },
    ];

  for (const { test, status } of rules) {
    if (test(n)) return status;
  }

  return null;
}

export type GithubKanbanDisplay = {
  /** Kolonnerekkefølge (venstre → høyre) */
  order: PipelineStatus[];
  /** Kolonneoverskrift / nedtrekk: GitHub-navn når vi har treff, ellers PVV-standard */
  labelForStatus: (status: PipelineStatus) => string;
};

/**
 * Bygger kolonnerekkefølge og visningsnavn fra GitHubs liste over statusvalg
 * (samme rekkefølge som i GraphQL / tavle). Uklassifiserte PVV-statuser legges sist.
 */
export function githubKanbanDisplayFromStatusOptions(
  options: { name: string }[] | null | undefined,
): GithubKanbanDisplay {
  const labelOverride = new Map<PipelineStatus, string>();
  const ordered: PipelineStatus[] = [];
  const seen = new Set<PipelineStatus>();

  if (options?.length) {
    for (const o of options) {
      const inferred = inferPipelineStatusFromGithubOptionName(o.name);
      if (inferred && !seen.has(inferred)) {
        seen.add(inferred);
        ordered.push(inferred);
        labelOverride.set(inferred, o.name.trim());
      }
    }
  }

  for (const s of PIPELINE_KANBAN_ORDER) {
    if (!seen.has(s)) {
      ordered.push(s);
    }
  }

  function labelForStatus(status: PipelineStatus): string {
    return labelOverride.get(status) ?? PIPELINE_STATUS_LABELS[status];
  }

  return { order: ordered, labelForStatus };
}
