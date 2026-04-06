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
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
  Info,
  LayoutGrid,
  Loader2,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type CoverageRow = {
  candidateId: Id<"candidates">;
  name: string;
  code: string;
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
  if (hasPvv && hasRos) {
    return "border-l-emerald-500/90";
  }
  if (hasPvv || hasRos) {
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

function formatNbDateTime(ms: number): string {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(ms));
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
                  <p
                    id="process-coverage-detail-desc"
                    className="text-muted-foreground text-sm leading-relaxed"
                  >
                    Full oversikt over PVV-vurderinger og ROS-analyser knyttet til
                    denne prosessen i registeret.
                  </p>
                </div>
                {sourceBadges(row)}
              </div>
              <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>
                  Prosess oppdatert i register:{" "}
                  <time dateTime={new Date(row.candidateUpdatedAt).toISOString()}>
                    {formatNbDateTime(row.candidateUpdatedAt)} (
                    {formatRelativeUpdatedAt(row.candidateUpdatedAt)})
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
                    Ingen vurdering har denne prosess-ID-en i utkastet ennå. Velg
                    prosessen i veiviseren steg 1, eller start fra prosessregisteret.
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
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            Sist aktivitet{" "}
                            {formatRelativeUpdatedAt(a.updatedAt)} ·{" "}
                            {formatNbDateTime(a.updatedAt)}
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
                    Ingen ROS-analyse er knyttet til denne prosessen. Opprett fra
                    ROS-arbeidsflaten eller koble ved opprettelse av analyse.
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
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            Sist oppdatert {formatRelativeUpdatedAt(r.updatedAt)} ·{" "}
                            {formatNbDateTime(r.updatedAt)}
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

              <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
                <Info className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
                PVV kobles via prosess-ID i vurderingens utkast. ROS kobles direkte
                til prosessraden i databasen.
              </p>
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
}: {
  workspaceId: Id<"workspaces">;
}) {
  const router = useRouter();
  const rows = useQuery(api.candidates.listProcessCoverage, { workspaceId });
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const createAssessment = useMutation(api.assessments.create);
  const removeCandidate = useMutation(api.candidates.remove);
  const [q, setQ] = useState("");
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
    if (!rows?.length) return [];
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(t) ||
        r.code.toLowerCase().includes(t),
    );
  }, [rows, q]);

  if (rows === undefined) {
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
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-[13px] leading-relaxed">
          Når du legger inn prosesser, vises PVV- og ROS-dekning her.
        </p>
      </div>
    );
  }

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
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
            Dekning
          </p>
          <h2
            id="process-coverage-heading"
            className="font-heading text-lg font-semibold tracking-tight text-foreground"
          >
            PVV og ROS per prosess
          </h2>
          <p className="text-muted-foreground max-w-prose text-[13px] leading-relaxed sm:text-sm">
            Oversikt over hvilke prosesser som er brukt i{" "}
            <strong className="text-foreground font-medium">vurderinger</strong>{" "}
            (utkastets prosess-ID) og som har{" "}
            <strong className="text-foreground font-medium">ROS-analyse</strong>{" "}
            knyttet til seg.{" "}
            Bruk knappene{" "}
            <span className="text-foreground font-medium">Start vurdering</span>{" "}
            eller{" "}
            <span className="text-foreground font-medium">Åpne vurdering</span>{" "}
            — kortet navigerer ikke ved klikk.{" "}
            <span className="text-foreground font-medium">Se full oversikt</span>{" "}
            viser alle lenker og ROS. Medlemmer kan slette prosessen med{" "}
            <span className="text-foreground font-medium">Slett prosess</span>{" "}
            (også i detaljdialogen).
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk i navn eller ID …"
            className="h-11 min-h-[44px] bg-background pl-10 pr-3 text-[16px] sm:h-10 sm:min-h-0 sm:text-sm md:pl-10 md:pr-3"
            aria-label="Filtrer prosesser"
          />
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => {
          const issueUrl = githubIssueUrl(c);
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
                  "flex h-full flex-col overflow-hidden rounded-2xl border border-l-4 border-border/45 bg-card text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]",
                  coverageAccent(c),
                )}
              >
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-primary font-mono text-xs font-semibold tracking-wide">
                        {c.code}
                      </p>
                      {sourceBadges(c)}
                    </div>
                    <h3 className="text-foreground line-clamp-2 text-base font-semibold leading-snug">
                      {c.name}
                    </h3>
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

                  <div className="border-border/50 space-y-3 border-t pt-3">
                    <div className="flex gap-2">
                      <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                        <ClipboardList className="size-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                          PVV-vurdering
                        </p>
                        {c.pvv.count === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            Ikke koblet i utkast ennå
                          </p>
                        ) : (
                          <p className="text-foreground text-sm">
                            {c.pvv.count === 1
                              ? "1 vurdering"
                              : `${c.pvv.count} vurderinger`}
                            {c.pvv.latestAt != null ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · sist aktivitet{" "}
                                {formatRelativeUpdatedAt(c.pvv.latestAt)}
                              </span>
                            ) : null}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="bg-emerald-500/12 text-emerald-800 dark:text-emerald-200 flex size-8 shrink-0 items-center justify-center rounded-lg">
                        <Shield className="size-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                          ROS
                        </p>
                        {c.ros.count === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            Ingen analyse knyttet til prosessen
                          </p>
                        ) : (
                          <p className="text-foreground text-sm">
                            {c.ros.count === 1
                              ? "1 analyse"
                              : `${c.ros.count} analyser`}
                            {c.ros.latestAt != null ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · sist oppdatert{" "}
                                {formatRelativeUpdatedAt(c.ros.latestAt)}
                              </span>
                            ) : null}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-col gap-2 border-t border-border/40 pt-3">
                    <Button
                      type="button"
                      className="h-11 min-h-[44px] w-full justify-center gap-2 text-[13px] font-semibold shadow-sm sm:h-10 sm:min-h-0 sm:min-w-[12rem]"
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
                      variant="outline"
                      className="h-11 min-h-[44px] w-full text-[13px] font-medium sm:h-10 sm:min-h-0"
                      onClick={() => setDetail(c)}
                    >
                      Se full oversikt
                    </Button>
                    {canCreatePvv ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 h-11 min-h-[44px] w-full gap-2 border-destructive/35 text-[13px] font-medium sm:h-10 sm:min-h-0"
                        disabled={deleteBusyId === c.candidateId}
                        onClick={() => void deleteProcess(c)}
                      >
                        {deleteBusyId === c.candidateId ? (
                          <Loader2
                            className="size-4 shrink-0 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <Trash2 className="size-4 shrink-0" aria-hidden />
                        )}
                        Slett prosess
                      </Button>
                    ) : null}
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
