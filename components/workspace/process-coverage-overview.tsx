"use client";

import { PipelineStatusSelect } from "@/components/assessment/pipeline-status-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { NativeSelectField } from "@/components/ui/native-select-field";
import { SearchInput } from "@/components/ui/search-input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { orgSubtreeIds, orgUnitSearchLabel } from "@/lib/org-unit-filter";
import { toast } from "@/lib/app-toast";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { formatRelativeUpdatedAt } from "@/lib/assessment-ui-helpers";
import {
  PIPELINE_STATUS_LABELS,
  normalizePipelineStatus,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  Loader2,
  Shield,
  Trash2,
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
  candidateUpdatedAt: number;
  githubRepoFullName: string | null;
  githubIssueNumber: number | null;
  githubProjectItemNodeId: string | null;
  pvv: {
    count: number;
    latestAt: number | null;
    assessments: Array<{
      assessmentId: Id<"assessments">;
      title: string;
      updatedAt: number;
      pipelineStatus: string;
    }>;
  };
  pdd: {
    count: number;
    latestAt: number | null;
    documents: Array<{
      documentId: Id<"processDesignDocuments">;
      assessmentId: Id<"assessments">;
      title: string;
      updatedAt: number;
    }>;
  };
  ros: {
    count: number;
    latestAt: number | null;
    analyses: Array<{
      analysisId: Id<"rosAnalyses">;
      title: string;
      updatedAt: number;
    }>;
  };
};

function formatCoverageUpdatedAt(ts: number | null): string {
  if (ts == null) return "Ikke oppdatert ennå";
  try {
    return `sist oppdatert ${new Date(ts).toLocaleDateString("nb-NO")}`;
  } catch {
    return `sist oppdatert ${ts}`;
  }
}

function sourceBadges(c: CoverageRow) {
  const hasIssue =
    c.githubIssueNumber != null && Boolean(c.githubRepoFullName?.trim());
  const hasProject = Boolean(c.githubProjectItemNodeId?.trim());
  return (
    <div className="flex flex-wrap gap-1.5">
      {hasIssue ? (
        <Badge
          variant="secondary"
          className="gap-1 bg-slate-500/10 text-[10px] font-medium text-slate-800 dark:text-slate-200"
        >
          <GitBranch className="size-3" aria-hidden />
          GitHub #{c.githubIssueNumber}
        </Badge>
      ) : null}
      {hasProject ? (
        <Badge
          variant="secondary"
          className="gap-1 bg-violet-500/10 text-[10px] font-medium text-violet-900 dark:text-violet-100"
        >
          <FolderKanban className="size-3" aria-hidden />
          Tavle
        </Badge>
      ) : null}
      {!hasIssue && !hasProject ? (
        <Badge variant="outline" className="text-[10px] font-normal">
          Opprettet i PVV
        </Badge>
      ) : null}
    </div>
  );
}

function coverageAccent(c: CoverageRow): string {
  const hasPvv = c.pvv.count > 0;
  const hasRos = c.ros.count > 0;
  const hasPdd = c.pdd.count > 0;
  if (hasPvv && hasRos && hasPdd) {
    return "border-l-emerald-500/90";
  }
  if (hasPvv || hasRos || hasPdd) {
    return "border-l-amber-500/85";
  }
  return "border-l-slate-400/50";
}

function githubIssueUrl(c: CoverageRow): string | null {
  if (c.githubIssueNumber == null || !c.githubRepoFullName?.trim()) {
    return null;
  }
  return `https://github.com/${c.githubRepoFullName.trim()}/issues/${c.githubIssueNumber}`;
}

function ProcessDocumentSummaryRow({
  icon: Icon,
  toneClass,
  label,
  title,
  href,
  updatedAt,
  count,
}: {
  icon: typeof ClipboardList;
  toneClass: string;
  label: string;
  title?: string;
  href?: string;
  updatedAt: number | null;
  count: number;
}) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          toneClass,
        )}
      >
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        {href && title ? (
          <Link
            href={href}
            className="line-clamp-1 text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {label}: {title}
          </Link>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">
            {label}: ingen dokumentasjon ennå
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {count > 1 ? `${count} dokumenter · ` : ""}
          {formatCoverageUpdatedAt(updatedAt)}
        </p>
      </div>
    </div>
  );
}

function ProcessCoverageDetailDialog({
  workspaceId,
  row,
  open,
  onOpenChange,
  onPrimaryPvv,
  primaryPvvBusy,
  primaryPvvDisabled,
  canEditPipelineStatus,
  canDeleteProcess,
  onDeleteProcess,
  deleteProcessBusy,
}: {
  workspaceId: Id<"workspaces">;
  row: CoverageRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrimaryPvv: (row: CoverageRow) => boolean | Promise<boolean>;
  primaryPvvBusy: boolean;
  primaryPvvDisabled: boolean;
  canEditPipelineStatus: boolean;
  canDeleteProcess: boolean;
  onDeleteProcess: (row: CoverageRow) => void;
  deleteProcessBusy: boolean;
}) {
  const issueUrl = row ? githubIssueUrl(row) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="2xl"
        titleId="process-coverage-detail-title"
        descriptionId="process-coverage-detail-desc"
        className="max-h-[min(92vh,48rem)]"
      >
        {row ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <p className="text-primary font-mono text-sm font-semibold tracking-wide">
                    {row.code}
                  </p>
                  <h2
                    id="process-coverage-detail-title"
                    className="text-foreground font-heading text-xl font-semibold leading-snug"
                  >
                    {row.name}
                  </h2>
                  <span id="process-coverage-detail-desc" className="sr-only">
                    Dokumentasjon for denne prosessen.
                  </span>
                </div>
                {sourceBadges(row)}
              </div>
              <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                <span>
                  Register:{" "}
                  <time dateTime={new Date(row.candidateUpdatedAt).toISOString()}>
                    {formatRelativeUpdatedAt(row.candidateUpdatedAt)}
                  </time>
                </span>
                {issueUrl ? (
                  <a
                    href={issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                  >
                    Issue på GitHub
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </div>
            </DialogHeader>

            <DialogBody className="space-y-6">
              <section
                className="rounded-xl border border-border/60 bg-muted/20 p-4"
                aria-labelledby="pvv-detail-heading"
              >
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList className="text-primary size-5 shrink-0" aria-hidden />
                  <h3
                    id="pvv-detail-heading"
                    className="text-foreground text-base font-semibold"
                  >
                    PVV-vurderinger ({row.pvv.count})
                  </h3>
                </div>
                {row.pvv.assessments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Ingen vurdering med denne prosess-ID ennå.
                  </p>
                ) : (
                  <ul className="divide-border/60 divide-y rounded-lg border border-border/50 bg-background">
                    {row.pvv.assessments.map((a) => (
                      <li
                        key={a.assessmentId}
                        className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/w/${workspaceId}/a/${a.assessmentId}`}
                            className="text-foreground hover:text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {a.title}
                          </Link>
                          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                            {formatRelativeUpdatedAt(a.updatedAt)}
                          </p>
                        </div>
                        {canEditPipelineStatus ? (
                          <PipelineStatusSelect
                            assessmentId={a.assessmentId}
                            value={normalizePipelineStatus(
                              a.pipelineStatus as PipelineStatus,
                            )}
                            compact
                            className="w-fit shrink-0"
                          />
                        ) : (
                          <Badge variant="outline" className="w-fit shrink-0">
                            {
                              PIPELINE_STATUS_LABELS[
                                normalizePipelineStatus(
                                  a.pipelineStatus as PipelineStatus,
                                )
                              ]
                            }
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                className="rounded-xl border border-border/60 bg-blue-500/[0.06] p-4 dark:bg-blue-950/20"
                aria-labelledby="pdd-detail-heading"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Workflow className="size-5 shrink-0 text-blue-700 dark:text-blue-300" />
                  <h3
                    id="pdd-detail-heading"
                    className="text-foreground text-base font-semibold"
                  >
                    Prosessdesign / PDD ({row.pdd.count})
                  </h3>
                </div>
                {row.pdd.documents.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Ingen PDD koblet til prosessen ennå.
                  </p>
                ) : (
                  <ul className="divide-border/60 divide-y rounded-lg border border-border/50 bg-background">
                    {row.pdd.documents.map((d) => (
                      <li
                        key={d.documentId}
                        className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/w/${workspaceId}/a/${d.assessmentId}/prosessdesign`}
                            className="text-foreground hover:text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {d.title}
                          </Link>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {formatCoverageUpdatedAt(d.updatedAt)}
                          </p>
                        </div>
                        <Link
                          href={`/w/${workspaceId}/a/${d.assessmentId}/prosessdesign`}
                          className="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium"
                        >
                          Åpne
                          <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                className="rounded-xl border border-border/60 bg-emerald-500/[0.06] p-4 dark:bg-emerald-950/20"
                aria-labelledby="ros-detail-heading"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Shield className="size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <h3
                    id="ros-detail-heading"
                    className="text-foreground text-base font-semibold"
                  >
                    ROS-analyser ({row.ros.count})
                  </h3>
                </div>
                {row.ros.analyses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Ingen ROS knyttet til prosessen.
                  </p>
                ) : (
                  <ul className="divide-border/60 divide-y rounded-lg border border-border/50 bg-background">
                    {row.ros.analyses.map((r) => (
                      <li
                        key={r.analysisId}
                        className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/w/${workspaceId}/ros/a/${r.analysisId}`}
                            className="text-foreground hover:text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {r.title}
                          </Link>
                          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                            {formatRelativeUpdatedAt(r.updatedAt)}
                          </p>
                        </div>
                        <Link
                          href={`/w/${workspaceId}/ros/a/${r.analysisId}`}
                          className="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium"
                        >
                          Åpne
                          <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

            </DialogBody>

            <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {canDeleteProcess && row ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10 gap-1.5"
                    disabled={deleteProcessBusy}
                    onClick={() => onDeleteProcess(row)}
                  >
                    {deleteProcessBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                    Slett prosess
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Lukk
                </Button>
              </div>
              {row ? (
                <Button
                  type="button"
                  disabled={primaryPvvBusy || primaryPvvDisabled}
                  onClick={() => {
                    void Promise.resolve(onPrimaryPvv(row)).then((ok) => {
                      if (ok) onOpenChange(false);
                    });
                  }}
                  className="gap-2"
                >
                  {primaryPvvBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  {row.pvv.count > 0 ? "Åpne vurdering" : "Start vurdering"}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ProcessCoverageOverview({
  workspaceId,
  title = "Dokumentasjon per prosess",
  description = "Hold oversikt over vurderinger, risiko og prosessdesign for hver prosess.",
}: {
  workspaceId: Id<"workspaces">;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const rows = useQuery(api.candidates.listProcessCoverage, { workspaceId });
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const createAssessment = useMutation(api.assessments.create);
  const removeCandidate = useMutation(api.candidates.remove);
  const [q, setQ] = useState("");
  const [orgUnitFilter, setOrgUnitFilter] = useState<"" | Id<"orgUnits">>("");
  const [detail, setDetail] = useState<CoverageRow | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<Id<"candidates"> | null>(
    null,
  );
  const [creatingCandidateId, setCreatingCandidateId] =
    useState<Id<"candidates"> | null>(null);

  const canCreatePvv =
    membership &&
    (membership.role === "owner" ||
      membership.role === "admin" ||
      membership.role === "member");

  /** @returns true når navigasjon/opprettelse lyktes (dialog kan lukkes) */
  async function goToPvvForProcess(c: CoverageRow): Promise<boolean> {
    if (creatingCandidateId) {
      return false;
    }
    const latest = c.pvv.assessments[0];
    if (c.pvv.count > 0 && latest) {
      router.push(`/w/${workspaceId}/a/${latest.assessmentId}`);
      return true;
    }
    if (membership === undefined) {
      return false;
    }
    if (!canCreatePvv) {
      toast.error(
        "Du trenger medlem-tilgang for å opprette vurdering fra prosesskortet.",
      );
      return false;
    }
    setCreatingCandidateId(c.candidateId);
    try {
      const aid = await createAssessment({
        workspaceId,
        title: `Vurdering av ${c.name}`.slice(0, 240),
        shareWithWorkspace: true,
        fromCandidateId: c.candidateId,
      });
      router.push(`/w/${workspaceId}/a/${aid}`);
      return true;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette vurdering.",
      );
      return false;
    } finally {
      setCreatingCandidateId(null);
    }
  }

  async function deleteProcess(c: CoverageRow) {
    if (!canCreatePvv) {
      return;
    }
    const msg = c.githubProjectItemNodeId
      ? "Slette denne prosessen fra registeret? Fjern eventuelt kortet i GitHub-prosjekt manuelt. Eksisterende PVV-koblinger bør ryddes manuelt."
      : "Slette denne prosessen fra registeret? Eksisterende PVV-koblinger bør ryddes manuelt.";
    if (typeof window !== "undefined" && !window.confirm(msg)) {
      return;
    }
    setDeleteBusyId(c.candidateId);
    try {
      await removeCandidate({ candidateId: c.candidateId });
      toast.success("Prosess slettet.");
      setDetail((d) => (d?.candidateId === c.candidateId ? null : d));
    } catch (e) {
      toast.error(formatUserFacingError(e, "Kunne ikke slette prosessen."));
    } finally {
      setDeleteBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!rows?.length || orgUnits === undefined) return [];
    let list = rows;
    if (orgUnitFilter) {
      const subtree = orgSubtreeIds(orgUnitFilter, orgUnits);
      list = list.filter((r) =>
        r.orgUnitId ? subtree.has(r.orgUnitId) : false,
      );
    }
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((r) => {
      const orgBlob = orgUnitSearchLabel(r.orgUnitId ?? undefined, orgUnits).toLowerCase();
      return (
        r.name.toLowerCase().includes(t) ||
        r.code.toLowerCase().includes(t) ||
        orgBlob.includes(t)
      );
    });
  }, [rows, q, orgUnitFilter, orgUnits]);

  const summary = useMemo(() => {
    const source = rows ?? [];
    const complete = source.filter(
      (row) => row.pvv.count > 0 && row.ros.count > 0 && row.pdd.count > 0,
    ).length;
    const needsAttention = source.filter(
      (row) => row.pvv.count === 0 || row.ros.count === 0 || row.pdd.count === 0,
    ).length;
    const withoutPdd = source.filter((row) => row.pdd.count === 0).length;
    return {
      total: source.length,
      complete,
      needsAttention,
      withoutPdd,
    };
  }, [rows]);

  if (rows === undefined || (rows.length > 0 && orgUnits === undefined)) {
    return (
      <div
        data-tutorial-anchor="pvv-ros"
        className="bg-muted/30 flex min-h-[8rem] items-center justify-center rounded-2xl border border-dashed border-border/60"
      >
        <div className="text-muted-foreground text-sm">Laster oversikt …</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        data-tutorial-anchor="pvv-ros"
        className="rounded-2xl border border-dashed border-border/50 bg-gradient-to-b from-muted/25 to-card px-4 py-10 text-center ring-1 ring-black/[0.03] dark:ring-white/[0.05]"
      >
        <LayoutGrid className="text-muted-foreground mx-auto mb-3 size-9 opacity-60" />
        <p className="text-foreground text-sm font-semibold">
          Ingen prosesser i registeret ennå
        </p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Legg til prosesser i registeret for å se status her.
        </p>
      </div>
    );
  }

  const orgUnitsList = orgUnits ?? [];

  return (
    <section
      data-tutorial-anchor="pvv-ros"
      className="space-y-4"
      aria-labelledby="process-coverage-heading"
    >
      <ProcessCoverageDetailDialog
        workspaceId={workspaceId}
        row={detail}
        open={detail !== null}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
        onPrimaryPvv={goToPvvForProcess}
        primaryPvvBusy={
          detail !== null && creatingCandidateId === detail.candidateId
        }
        primaryPvvDisabled={
          detail !== null &&
          detail.pvv.count === 0 &&
          membership === undefined
        }
        canEditPipelineStatus={Boolean(canCreatePvv)}
        canDeleteProcess={Boolean(canCreatePvv)}
        onDeleteProcess={(row) => void deleteProcess(row)}
        deleteProcessBusy={
          detail !== null && deleteBusyId === detail.candidateId
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="process-coverage-heading"
            className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <FilterToolbar className="w-full sm:ml-auto sm:max-w-2xl">
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk i navn, ID eller organisasjon …"
            aria-label="Filtrer prosesser"
            className="min-w-0 flex-1 sm:min-w-[min(100%,18rem)]"
          />
          <NativeSelectField
            id="process-coverage-org"
            label="Organisasjon"
            value={orgUnitFilter}
            onChange={(e) =>
              setOrgUnitFilter(
                e.target.value === "" ? "" : (e.target.value as Id<"orgUnits">),
              )
            }
            aria-label="Filtrer etter organisasjonsenhet"
            className="w-full min-w-0 sm:w-[min(100%,14rem)]"
          >
            <option value="">Alle enheter</option>
            {orgUnitsList.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </NativeSelectField>
        </FilterToolbar>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/50 bg-card/60 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Prosesser
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
            {summary.total}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
            Komplette
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
            {summary.complete}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
            Mangler PDD
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
            {summary.withoutPdd}
          </p>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => {
          const issueUrl = githubIssueUrl(c);
          const orgLabel = orgUnitSearchLabel(c.orgUnitId ?? undefined, orgUnitsList);
          const hasPvv = c.pvv.count > 0;
          const awaitingMembership = membership === undefined;
          const startBlocked =
            !hasPvv && awaitingMembership && !creatingCandidateId;
          const busy = creatingCandidateId === c.candidateId;
          const startDisabled =
            startBlocked ||
            busy ||
            (!hasPvv && membership !== undefined && !canCreatePvv);
          return (
            <li key={c.candidateId}>
              <article
                className={cn(
                  "flex h-full flex-col overflow-hidden rounded-3xl border border-l-4 border-border/45 bg-card/80 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] backdrop-blur-sm dark:ring-white/[0.05]",
                  coverageAccent(c),
                )}
              >
                <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-primary font-mono text-[11px] font-semibold tracking-[0.14em]">
                        {c.code}
                      </p>
                      {sourceBadges(c)}
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-foreground line-clamp-2 text-lg font-semibold leading-snug">
                        {c.name}
                      </h3>
                      {orgLabel !== "—" ? (
                        <p className="text-sm text-muted-foreground">{orgLabel}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          c.pvv.count > 0
                            ? "border-primary/30 bg-primary/5 text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        PVV {c.pvv.count > 0 ? "klar" : "mangler"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          c.ros.count > 0
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "text-muted-foreground",
                        )}
                      >
                        ROS {c.ros.count > 0 ? "klar" : "mangler"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          c.pdd.count > 0
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                            : "text-muted-foreground",
                        )}
                      >
                        PDD {c.pdd.count > 0 ? "klar" : "mangler"}
                      </Badge>
                    </div>
                    {issueUrl ? (
                      <a
                        href={issueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                      >
                        Issue på GitHub
                        <ExternalLink className="size-3 opacity-70" aria-hidden />
                      </a>
                    ) : null}
                  </div>

                  <div className="border-border/40 space-y-2.5 border-t pt-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Dokumenter
                    </p>
                    <ProcessDocumentSummaryRow
                      icon={ClipboardList}
                      toneClass="bg-primary/10 text-primary"
                      label="PVV"
                      title={c.pvv.assessments[0]?.title}
                      href={
                        c.pvv.assessments[0]
                          ? `/w/${workspaceId}/a/${c.pvv.assessments[0].assessmentId}`
                          : undefined
                      }
                      updatedAt={c.pvv.latestAt}
                      count={c.pvv.count}
                    />
                    <ProcessDocumentSummaryRow
                      icon={Shield}
                      toneClass="bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                      label="Risiko"
                      title={c.ros.analyses[0]?.title}
                      href={
                        c.ros.analyses[0]
                          ? `/w/${workspaceId}/ros/a/${c.ros.analyses[0].analysisId}`
                          : undefined
                      }
                      updatedAt={c.ros.latestAt}
                      count={c.ros.count}
                    />
                    <ProcessDocumentSummaryRow
                      icon={Workflow}
                      toneClass="bg-blue-500/12 text-blue-800 dark:text-blue-200"
                      label="PDD"
                      title={c.pdd.documents[0]?.title}
                      href={
                        c.pdd.documents[0]
                          ? `/w/${workspaceId}/a/${c.pdd.documents[0].assessmentId}/prosessdesign`
                          : undefined
                      }
                      updatedAt={c.pdd.latestAt}
                      count={c.pdd.count}
                    />
                  </div>

                  <div className="mt-auto flex flex-col gap-2 border-t border-border/40 pt-4">
                    <Button
                      type="button"
                      className="h-11 min-h-[44px] w-full justify-center gap-2 rounded-2xl text-[13px] font-semibold shadow-sm"
                      disabled={startDisabled}
                      onClick={() => void goToPvvForProcess(c)}
                    >
                      {busy ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <ChevronRight className="size-4 shrink-0" aria-hidden />
                      )}
                      {startBlocked
                        ? "Laster …"
                        : busy
                          ? "Oppretter …"
                          : hasPvv
                            ? "Åpne vurdering"
                            : "Start vurdering"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 w-full rounded-2xl text-[13px] font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setDetail(c)}
                    >
                      Se alle dokumenter
                    </Button>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && rows.length > 0 ? (
        <p className="text-muted-foreground text-center text-sm">
          Ingen treff for «{q.trim()}».
        </p>
      ) : null}
    </section>
  );
}
