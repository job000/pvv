"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { parseSuggestedCodeAndNameFromGithubTitle } from "@/lib/github-process-title";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  ExternalLink,
  FileStack,
  GitBranch,
  Loader2,
  Plus,
  Sparkles,
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
  defaultTemplateId?: Id<"rosTemplates"> | null;
};

type StartTab = "process" | "github" | "new";

export function GithubIssueStartCard({
  workspaceId,
  variant,
  defaultTemplateId,
}: Props) {
  const router = useRouter();
  const convex = useConvex();
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

  const [activeTab, setActiveTab] = useState<StartTab>("process");
  const [issueUrl, setIssueUrl] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [standaloneTitle, setStandaloneTitle] = useState("");
  const [busyMode, setBusyMode] = useState<
    "register" | "url" | "standalone" | null
  >(null);
  const existingAssessmentQuery = useQuery(
    api.assessments.findLatestForCandidate,
    variant === "assessment" && selectedCandidateId
      ? {
          workspaceId,
          candidateId: selectedCandidateId as Id<"candidates">,
        }
      : "skip",
  );

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
  const selectedCandidate =
    (candidates ?? []).find((candidate) => candidate._id === selectedCandidateId) ?? null;
  const existingAssessment =
    variant === "assessment" ? (existingAssessmentQuery ?? null) : null;
  const resumeCheckPending =
    variant === "assessment" &&
    Boolean(selectedCandidateId) &&
    existingAssessmentQuery === undefined;

  async function handleStartStandalone() {
    const title = standaloneTitle.trim();
    if (!title) {
      toast.error("Skriv inn en tittel.");
      return;
    }
    if (!canEdit) {
      toast.error("Du trenger medlem-tilgang.");
      return;
    }
    setBusyMode("standalone");
    try {
      if (variant === "assessment") {
        const aid = await createAssessment({
          workspaceId,
          title: title.slice(0, 240),
          shareWithWorkspace: true,
        });
        setStandaloneTitle("");
        router.push(`/w/${workspaceId}/a/${aid}`);
        return;
      }

      const tplList = templates ?? [];
      const tplId =
        defaultTemplateId ??
        (tplList.length === 1 ? tplList[0]!._id : tplList[0]?._id);
      if (!tplId) {
        toast.error("Opprett minst én ROS-mal under «Maler» først.");
        return;
      }
      const analysisId = await createAnalysis({
        workspaceId,
        templateId: tplId,
        title: title.slice(0, 240),
      });
      setStandaloneTitle("");
      router.push(`/w/${workspaceId}/ros/a/${analysisId}`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette.",
      );
    } finally {
      setBusyMode(null);
    }
  }

  async function createAssessmentFromCandidate(candidate: Doc<"candidates">) {
    const safeTitle = `Vurdering av ${candidate.name}`.slice(0, 240);
    const aid = await createAssessment({
      workspaceId,
      title: safeTitle,
      shareWithWorkspace: true,
      fromCandidateId: candidate._id,
    });
    setSelectedCandidateId("");
    router.push(`/w/${workspaceId}/a/${aid}`);
  }

  async function handleContinueFromRegister() {
    if (!selectedCandidateId || !existingAssessment) {
      toast.error("Velg en prosess fra registeret.");
      return;
    }
    if (!canEdit) {
      toast.error("Du trenger medlem-tilgang.");
      return;
    }
    setBusyMode("register");
    try {
      router.push(`/w/${workspaceId}/a/${existingAssessment.assessmentId}`);
    } finally {
      setBusyMode(null);
    }
  }

  async function handleStartNewFromRegister() {
    if (!selectedCandidate) {
      toast.error("Fant ikke prosessen.");
      return;
    }
    if (!canEdit) {
      toast.error("Du trenger medlem-tilgang.");
      return;
    }
    setBusyMode("register");
    try {
      if (variant === "assessment") {
        await createAssessmentFromCandidate(selectedCandidate);
        return;
      }

      const tplList = templates ?? [];
      const tplId =
        defaultTemplateId ??
        (tplList.length === 1 ? tplList[0]!._id : tplList[0]?._id);
      if (!tplId) {
        toast.error("Opprett minst én ROS-mal under «Maler» først.");
        return;
      }
      const analysisId = await createAnalysis({
        workspaceId,
        templateId: tplId,
        candidateId: selectedCandidate._id,
        title: `ROS — ${selectedCandidate.name}`.slice(0, 240),
      });
      setSelectedCandidateId("");
      router.push(`/w/${workspaceId}/ros/a/${analysisId}`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette.",
      );
    } finally {
      setBusyMode(null);
    }
  }

  async function handleStartFromRegister() {
    if (variant === "assessment" && existingAssessment) {
      await handleContinueFromRegister();
      return;
    }
    await handleStartNewFromRegister();
  }

  async function handleStartFromUrl() {
    const url = issueUrl.trim();
    if (!url) {
      toast.error("Lim inn en issue-URL.");
      return;
    }
    if (!canEdit) {
      toast.error("Du trenger medlem-tilgang.");
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
        const existingAssessment = await convex.query(
          api.assessments.findLatestForCandidate,
          {
            workspaceId,
            candidateId,
          },
        );
        if (existingAssessment) {
          setSelectedCandidateId(candidateId);
          setActiveTab("process");
          setIssueUrl("");
          toast.message(
            "Fant en påbegynt vurdering for prosessen. Velg om du vil fortsette eller starte på nytt.",
          );
          return;
        }
        const aid = await createAssessment({
          workspaceId,
          title: safeTitle,
          shareWithWorkspace: true,
          fromCandidateId: candidateId,
        });
        setIssueUrl("");
        router.push(`/w/${workspaceId}/a/${aid}`);
        return;
      }

      const tplList = templates ?? [];
      const tplId =
        defaultTemplateId ??
        (tplList.length === 1 ? tplList[0]!._id : tplList[0]?._id);
      if (!tplId) {
        toast.error("Opprett minst én ROS-mal under «Maler» først.");
        return;
      }
      const analysisId = await createAnalysis({
        workspaceId,
        templateId: tplId,
        candidateId,
        title: `ROS — ${safeTitle}`.slice(0, 240),
      });
      setIssueUrl("");
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
      <div className="rounded-2xl bg-muted/15 px-5 py-4 text-sm text-muted-foreground">
        Kun medlemmer og administratorer kan opprette{" "}
        {variant === "assessment" ? "vurderinger" : "ROS-analyser"} her.
      </div>
    );
  }

  const rosNeedsTemplate =
    variant === "ros" &&
    templates !== undefined &&
    templates.length === 0;

  const actionLabel =
    variant === "assessment" ? "Start vurdering" : "Start ROS";
  const processActionLabel =
    variant === "assessment" && existingAssessment
      ? "Fortsett vurdering"
      : actionLabel;

  const tabs: { id: StartTab; icon: React.ReactNode; label: string; desc: string }[] = [
    {
      id: "process",
      icon: <FileStack className="size-4" aria-hidden />,
      label: "Fra prosess",
      desc: "Velg en registrert prosess",
    },
    {
      id: "github",
      icon: <GitBranch className="size-4" aria-hidden />,
      label: "Fra GitHub",
      desc: "Importer fra issue-lenke",
    },
    {
      id: "new",
      icon: <Plus className="size-4" aria-hidden />,
      label: "Opprett ny",
      desc: "Start med egendefinert tittel",
    },
  ];

  return (
    <div className="rounded-2xl bg-muted/20 p-4 sm:p-5">
      {/* Tab bar */}
      <div
        className="mb-5 flex gap-0.5 rounded-xl bg-muted/50 p-1"
        role="tablist"
        aria-label="Velg opprettelsesmetode"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
              activeTab === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === "process" ? (
        <div className="space-y-3">
          <div>
            <p className="text-foreground text-sm font-semibold">
              Start fra prosessregisteret
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Velg en prosess som allerede er registrert.
            </p>
          </div>
          <div className="space-y-3">
            <div className="min-w-0 space-y-1.5">
              <Label
                htmlFor={`gh-register-${variant}`}
                className="text-muted-foreground text-xs font-medium"
              >
                Prosess
              </Label>
              <select
                id={`gh-register-${variant}`}
                className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm shadow-sm disabled:opacity-50"
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
                <p className="text-muted-foreground text-xs">
                  Ingen prosesser ennå — opprett under Prosessregister.
                </p>
              ) : null}
              {variant === "assessment" && selectedCandidateId && resumeCheckPending ? (
                <p className="text-muted-foreground text-xs">
                  Sjekker om det finnes en påbegynt vurdering for prosessen …
                </p>
              ) : null}
              {variant === "assessment" && existingAssessment ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{existingAssessment.title}</p>
                  <p className="mt-1 leading-relaxed">
                    Sist oppdatert{" "}
                    {new Date(existingAssessment.updatedAt).toLocaleString("nb-NO")} ·{" "}
                    {existingAssessment.nextStepHint}
                  </p>
                </div>
              ) : null}
            </div>

            <div
              className={cn(
                "flex flex-col gap-3",
                variant === "assessment" && existingAssessment
                  ? "rounded-2xl border border-border/50 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                  : "sm:flex-row sm:justify-end",
              )}
            >
              {variant === "assessment" && existingAssessment ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Det finnes allerede en påbegynt vurdering
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fortsett den eksisterende, eller opprett en ny vurdering fra samme
                    prosess.
                  </p>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                {variant === "assessment" && existingAssessment ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2 rounded-xl px-5 shadow-sm sm:w-auto"
                    disabled={busy || resumeCheckPending}
                    onClick={() => void handleStartNewFromRegister()}
                  >
                    <Sparkles className="size-4" aria-hidden />
                    Start på nytt
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-10 gap-2 rounded-xl px-5 shadow-sm sm:w-auto"
                  disabled={
                    busy ||
                    !selectedCandidateId ||
                    resumeCheckPending ||
                    rosNeedsTemplate ||
                    (variant === "ros" && templates === undefined)
                  }
                  onClick={() => void handleStartFromRegister()}
                >
                  {busyMode === "register" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <ArrowRight className="size-4" aria-hidden />
                  )}
                  {processActionLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "github" ? (
        <div className="space-y-3">
          <div>
            <p className="text-foreground text-sm font-semibold">
              Importer fra GitHub
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Lim inn en issue-lenke. Prosessen opprettes automatisk.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label
                htmlFor={`gh-issue-start-${variant}`}
                className="text-muted-foreground text-xs font-medium"
              >
                Issue-URL
              </Label>
              <Input
                id={`gh-issue-start-${variant}`}
                type="url"
                value={issueUrl}
                onChange={(e) => setIssueUrl(e.target.value)}
                placeholder="https://github.com/org/repo/issues/42"
                className="h-10 rounded-xl bg-background font-mono text-sm shadow-sm"
                autoComplete="off"
                disabled={busy || rosNeedsTemplate}
              />
            </div>
            <Button
              type="button"
              className="h-10 shrink-0 gap-2 rounded-xl px-5 shadow-sm sm:w-auto"
              disabled={
                busy ||
                !issueUrl.trim() ||
                rosNeedsTemplate ||
                (variant === "ros" && templates === undefined)
              }
              onClick={() => void handleStartFromUrl()}
            >
              {busyMode === "url" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ExternalLink className="size-4" aria-hidden />
              )}
              Hent og start
            </Button>
          </div>
          {variant === "ros" && rosNeedsTemplate ? (
            <p className="text-muted-foreground text-xs">
              Opprett først en ROS-mal under «Maler».
            </p>
          ) : null}
        </div>
      ) : null}

      {activeTab === "new" ? (
        <div className="space-y-3">
          <div>
            <p className="text-foreground text-sm font-semibold">
              {variant === "assessment"
                ? "Ny vurdering"
                : "Frittstående ROS-analyse"}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {variant === "assessment"
                ? "Gi saken et navn og start veiviseren."
                : "Opprett uten kobling til prosess eller GitHub."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label
                htmlFor={`new-start-title-${variant}`}
                className="text-muted-foreground text-xs font-medium"
              >
                Tittel
              </Label>
              <Input
                id={`new-start-title-${variant}`}
                value={standaloneTitle}
                onChange={(e) => setStandaloneTitle(e.target.value)}
                placeholder={
                  variant === "assessment"
                    ? "F.eks. Fakturamottak fra leverandører"
                    : "F.eks. Risikovurdering — ny leverandør"
                }
                className="h-10 rounded-xl bg-background text-sm shadow-sm"
                maxLength={240}
                autoComplete="off"
                disabled={busy || rosNeedsTemplate}
              />
            </div>
            <Button
              type="button"
              className="h-10 shrink-0 gap-2 rounded-xl px-5 shadow-sm sm:w-auto"
              disabled={
                busy ||
                !standaloneTitle.trim() ||
                rosNeedsTemplate ||
                (variant === "ros" && templates === undefined)
              }
              onClick={() => void handleStartStandalone()}
            >
              {busyMode === "standalone" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {actionLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
