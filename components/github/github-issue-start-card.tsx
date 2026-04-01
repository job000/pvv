"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { parseSuggestedCodeAndNameFromGithubTitle } from "@/lib/github-process-title";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  ExternalLink,
  FileStack,
  GitBranch,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function candidateMatchesGithubIssue(
  c: Doc<"candidates">,
  repoFullName: string,
  issueNumber: number,
): boolean {
  if (c.githubIssueNumber == null || !c.githubRepoFullName?.trim()) {
    return false;
  }
  const a = c.githubRepoFullName.trim().toLowerCase();
  const b = repoFullName.trim().toLowerCase();
  return a === b && c.githubIssueNumber === issueNumber;
}

type Props = {
  workspaceId: Id<"workspaces">;
  variant: "assessment" | "ros";
  /** Når satt (ROS): brukes som mal for ny analyse fra issue */
  defaultTemplateId?: Id<"rosTemplates"> | null;
};

export function GithubIssueStartCard({
  workspaceId,
  variant,
  defaultTemplateId,
}: Props) {
  const router = useRouter();
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const candidates = useQuery(api.candidates.listByWorkspace, { workspaceId });
  const templates = useQuery(
    api.ros.listTemplates,
    variant === "ros" ? { workspaceId } : "skip",
  );

  const fetchGithubIssue = useAction(
    api.githubIssueImport.fetchGithubIssueForProcessImport,
  );
  const createCandidateFromGithubIssue = useMutation(
    api.candidates.createCandidateFromGithubIssue,
  );
  const createAssessment = useMutation(api.assessments.create);
  const createAnalysis = useMutation(api.ros.createAnalysis);

  const [issueUrl, setIssueUrl] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [standaloneRosTitle, setStandaloneRosTitle] = useState("");
  const [busyMode, setBusyMode] = useState<
    "register" | "url" | "standalone" | null
  >(null);

  const sortedCandidates = useMemo(() => {
    if (!candidates?.length) return [];
    return [...candidates].sort((a, b) =>
      a.code.localeCompare(b.code, "nb", { sensitivity: "base" }),
    );
  }, [candidates]);

  const canEdit =
    membership &&
    (membership.role === "owner" ||
      membership.role === "admin" ||
      membership.role === "member");

  async function handleStartStandaloneRos() {
    const title = standaloneRosTitle.trim();
    if (!title) {
      toast.error("Skriv inn en tittel for ROS-analysen.");
      return;
    }
    if (!canEdit) {
      toast.error("Du trenger medlem-tilgang for å opprette ROS.");
      return;
    }
    setBusyMode("standalone");
    try {
      const tplList = templates ?? [];
      const tplId =
        defaultTemplateId ??
        (tplList.length === 1 ? tplList[0]!._id : tplList[0]?._id);
      if (!tplId) {
        toast.error(
          "Opprett minst én ROS-mal under fanen «Maler» før du starter.",
        );
        return;
      }
      const analysisId = await createAnalysis({
        workspaceId,
        templateId: tplId,
        title: title.slice(0, 240),
      });
      setStandaloneRosTitle("");
      toast.success("Frittstående ROS-analyse opprettet.");
      router.push(`/w/${workspaceId}/ros/a/${analysisId}`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette ROS-analyse.",
      );
    } finally {
      setBusyMode(null);
    }
  }

  async function handleStartFromRegister() {
    if (!selectedCandidateId) {
      toast.error("Velg en prosess fra registeret.");
      return;
    }
    if (!canEdit) {
      toast.error("Du trenger medlem-tilgang for å opprette fra registeret.");
      return;
    }
    const c = (candidates ?? []).find((x) => x._id === selectedCandidateId);
    if (!c) {
      toast.error("Fant ikke prosessen.");
      return;
    }
    setBusyMode("register");
    try {
      const safeTitle = `Vurdering av ${c.name}`.slice(0, 240);

      if (variant === "assessment") {
        const aid = await createAssessment({
          workspaceId,
          title: safeTitle,
          shareWithWorkspace: true,
          fromCandidateId: c._id,
        });
        setSelectedCandidateId("");
        toast.success("Vurdering opprettet fra prosessregisteret.");
        router.push(`/w/${workspaceId}/a/${aid}`);
        return;
      }

      const tplList = templates ?? [];
      const tplId =
        defaultTemplateId ??
        (tplList.length === 1 ? tplList[0]!._id : tplList[0]?._id);
      if (!tplId) {
        toast.error(
          "Opprett minst én ROS-mal under fanen «Maler» før du starter fra prosess.",
        );
        return;
      }
      const analysisId = await createAnalysis({
        workspaceId,
        templateId: tplId,
        candidateId: c._id,
        title: `ROS — ${c.name}`.slice(0, 240),
      });
      setSelectedCandidateId("");
      toast.success("ROS-analyse opprettet fra prosessregisteret.");
      router.push(`/w/${workspaceId}/ros/a/${analysisId}`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette fra registeret.",
      );
    } finally {
      setBusyMode(null);
    }
  }

  async function handleStartFromUrl() {
    const url = issueUrl.trim();
    if (!url) {
      toast.error("Lim inn en issue-URL.");
      return;
    }
    if (!canEdit) {
      toast.error("Du trenger medlem-tilgang for å opprette fra GitHub.");
      return;
    }
    setBusyMode("url");
    try {
      const preview = await fetchGithubIssue({
        workspaceId,
        issueUrl: url,
      });

      let candidateId: Id<"candidates"> | null = null;
      const existing = (candidates ?? []).find((c) =>
        candidateMatchesGithubIssue(
          c,
          preview.repoFullName,
          preview.issueNumber,
        ),
      );
      if (existing) {
        candidateId = existing._id;
      } else {
        const sug = parseSuggestedCodeAndNameFromGithubTitle(preview.title);
        candidateId = await createCandidateFromGithubIssue({
          workspaceId,
          name: sug.name,
          code: sug.code,
          githubRepoFullName: preview.repoFullName,
          githubIssueNumber: preview.issueNumber,
          githubIssueNodeId: preview.issueNodeId,
        });
      }

      const safeTitle = preview.title.slice(0, 240);

      if (variant === "assessment") {
        const aid = await createAssessment({
          workspaceId,
          title: safeTitle,
          shareWithWorkspace: true,
          fromCandidateId: candidateId,
        });
        setIssueUrl("");
        toast.success("Vurdering opprettet fra GitHub-issue.");
        router.push(`/w/${workspaceId}/a/${aid}`);
        return;
      }

      const tplList = templates ?? [];
      const tplId =
        defaultTemplateId ??
        (tplList.length === 1 ? tplList[0]!._id : tplList[0]?._id);
      if (!tplId) {
        toast.error(
          "Opprett minst én ROS-mal under fanen «Maler» før du starter fra issue.",
        );
        return;
      }
      const analysisId = await createAnalysis({
        workspaceId,
        templateId: tplId,
        candidateId,
        title: `ROS — ${safeTitle}`.slice(0, 240),
      });
      setIssueUrl("");
      toast.success("ROS-analyse opprettet og koblet til prosessen fra GitHub.");
      router.push(`/w/${workspaceId}/ros/a/${analysisId}`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke hente eller opprette.",
      );
    } finally {
      setBusyMode(null);
    }
  }

  const busy = busyMode !== null;

  if (membership === undefined || candidates === undefined) {
    return null;
  }

  if (!canEdit) {
    return (
      <Card className="border-border/60 border-dashed bg-muted/10 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Start fra prosessregisteret, GitHub eller frittstående
          </CardTitle>
          <CardDescription>
            Kun medlemmer og administratorer kan opprette vurdering eller ROS her.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const rosNeedsTemplate =
    variant === "ros" &&
    templates !== undefined &&
    templates.length === 0;

  return (
    <Card className="border-border/60 overflow-hidden shadow-sm">
      <CardHeader className="pb-3 pt-4 sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
            <GitBranch className="size-[1.15rem]" aria-hidden />
          </div>
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-lg tracking-tight">
              {variant === "assessment"
                ? "Start vurdering fra prosess eller GitHub"
                : "Start ROS"}
            </CardTitle>
            <CardDescription className="text-sm leading-snug">
              {variant === "ros" ? (
                "Frittstående, fra prosessregister eller GitHub-issue (issue krever token under arbeidsområde)."
              ) : (
                <>
                  <strong className="text-foreground font-medium">
                    Vanligst:
                  </strong>{" "}
                  velg prosessen du allerede har registrert (med eller uten
                  GitHub-kobling) — da trenger du ikke lime inn lenke på nytt.{" "}
                  <strong className="text-foreground font-medium">Alternativ:</strong>{" "}
                  lim inn issue-URL når saken ikke finnes i registeret ennå; da henter PVV
                  fra GitHub (krever token under Innstillinger).
                </>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardFooter className="flex flex-col gap-5 border-t border-border/50 bg-muted/15 px-4 py-4 sm:px-6">
        {variant === "ros" ? (
          <div className="w-full space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                <FileStack className="size-4" aria-hidden />
              </div>
              <p className="text-foreground text-xs font-semibold tracking-tight">
                Frittstående (uten prosess eller GitHub)
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label
                  htmlFor={`ros-standalone-title-${workspaceId}`}
                  className="text-muted-foreground text-xs font-medium"
                >
                  Tittel på analysen
                </Label>
                <Input
                  id={`ros-standalone-title-${workspaceId}`}
                  value={standaloneRosTitle}
                  onChange={(e) => setStandaloneRosTitle(e.target.value)}
                  placeholder="f.eks. Risikovurdering — ny leverandør"
                  className="h-10 bg-background text-sm"
                  maxLength={240}
                  disabled={busy || rosNeedsTemplate}
                  autoComplete="off"
                />
              </div>
              <Button
                type="button"
                variant="default"
                className="h-10 w-full shrink-0 gap-2 sm:w-auto"
                disabled={
                  busy ||
                  !standaloneRosTitle.trim() ||
                  rosNeedsTemplate ||
                  templates === undefined
                }
                onClick={() => void handleStartStandaloneRos()}
              >
                {busyMode === "standalone" ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                )}
                Start frittstående ROS
              </Button>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "w-full",
            variant === "ros" && "border-border/60 relative border-t pt-1",
          )}
        >
          {variant === "ros" ? (
            <span className="bg-muted/30 text-muted-foreground absolute -top-2.5 left-0 px-1 text-[10px] font-medium uppercase tracking-wide">
              eller koblet til prosess / issue
            </span>
          ) : null}
          <div className={cn("space-y-2", variant === "ros" && "pt-3")}>
          <p className="text-foreground text-xs font-semibold tracking-tight">
            Fra prosessregisteret
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label
                htmlFor={`gh-register-${variant}`}
                className="text-muted-foreground text-xs font-medium"
              >
                Velg prosess
              </Label>
              <select
                id={`gh-register-${variant}`}
                className="border-input bg-background h-10 w-full rounded-lg border px-2.5 text-sm shadow-xs disabled:opacity-50"
                value={selectedCandidateId}
                onChange={(e) => setSelectedCandidateId(e.target.value)}
                disabled={busy || rosNeedsTemplate}
              >
                <option value="">Velg prosess …</option>
                {sortedCandidates.map((c) => {
                  const gh =
                    c.githubIssueNumber != null && c.githubRepoFullName?.trim()
                      ? ` · GitHub #${c.githubIssueNumber}`
                      : "";
                  return (
                    <option key={c._id} value={c._id}>
                      {c.code} — {c.name}
                      {gh}
                    </option>
                  );
                })}
              </select>
              {sortedCandidates.length === 0 ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Ingen prosesser ennå. Opprett under{" "}
                  <span className="text-foreground font-medium">Prosessregister</span>
                  , så vises de her.
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="default"
              className="h-10 w-full shrink-0 gap-2 sm:w-auto"
              disabled={
                busy ||
                !selectedCandidateId ||
                rosNeedsTemplate ||
                (variant === "ros" && templates === undefined)
              }
              onClick={() => void handleStartFromRegister()}
            >
              {busyMode === "register" ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              )}
              {variant === "assessment"
                ? "Start vurdering"
                : "Start ROS"}
            </Button>
          </div>
          </div>
        </div>

        <div className="border-border/60 relative border-t pt-1">
          <span className="bg-muted/30 text-muted-foreground absolute -top-2.5 left-0 px-1 text-[10px] font-medium uppercase tracking-wide">
            eller issue-URL
          </span>
          <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label
                htmlFor={`gh-issue-start-${variant}`}
                className="text-muted-foreground text-xs font-medium"
              >
                Issue-URL (når prosessen ikke ligger i registeret)
              </Label>
              <Input
                id={`gh-issue-start-${variant}`}
                type="url"
                value={issueUrl}
                onChange={(e) => setIssueUrl(e.target.value)}
                placeholder="https://github.com/org/repo/issues/42"
                className="h-10 bg-background font-mono text-sm"
                autoComplete="off"
                disabled={busy || rosNeedsTemplate}
              />
              {variant === "ros" && rosNeedsTemplate ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Opprett først en ROS-mal under fanen «Maler», deretter kan du bruke
                  dette kortet.
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-10 w-full shrink-0 gap-2 sm:w-auto"
              disabled={
                busy ||
                !issueUrl.trim() ||
                rosNeedsTemplate ||
                (variant === "ros" && templates === undefined)
              }
              onClick={() => void handleStartFromUrl()}
            >
              {busyMode === "url" ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <ExternalLink className="size-4 shrink-0" aria-hidden />
              )}
              {variant === "assessment"
                ? "Hent og start vurdering"
                : "Hent og start ROS"}
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
