"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
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
  Grid3x3,
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
};

type StartTab = "process" | "github" | "new";

export function GithubIssueStartCard({
  workspaceId,
  variant,
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateDialogMode, setTemplateDialogMode] = useState<
    "process" | "github" | "new" | null
  >(null);
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
  const templatesList = templates ?? [];
  const effectiveSelectedTemplateId =
    variant !== "ros"
      ? ""
      : templatesList.some((template) => template._id === selectedTemplateId)
        ? selectedTemplateId
        : "";

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

      const tplId = effectiveSelectedTemplateId as Id<"rosTemplates"> | "";
      if (!tplId) {
        toast.error("Velg hvilken ROS-mal du vil bruke.");
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

      const tplId = effectiveSelectedTemplateId as Id<"rosTemplates"> | "";
      if (!tplId) {
        toast.error("Velg hvilken ROS-mal du vil bruke.");
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
    if (variant === "ros") {
      if (!selectedCandidateId) {
        toast.error("Velg en prosess først.");
        return;
      }
      if (templates === undefined) {
        toast.error("Laster ROS-maler …");
        return;
      }
      if (templates.length === 0) {
        toast.error("Opprett minst én ROS-mal under «Maler» først.");
        return;
      }
      setTemplateDialogMode("process");
      return;
    }
    await handleStartNewFromRegister();
  }

  async function handleOpenTemplateDialogForUrl() {
    const url = issueUrl.trim();
    if (!url) {
      toast.error("Lim inn en issue-URL.");
      return;
    }
    if (!canEdit) {
      toast.error("Du trenger medlem-tilgang.");
      return;
    }
    if (templates === undefined) {
      toast.error("Laster ROS-maler …");
      return;
    }
    if (templates.length === 0) {
      toast.error("Opprett minst én ROS-mal under «Maler» først.");
      return;
    }
    setTemplateDialogMode("github");
  }

  async function handleOpenTemplateDialogForNew() {
    const title = standaloneTitle.trim();
    if (!title) {
      toast.error("Skriv inn en tittel.");
      return;
    }
    if (!canEdit) {
      toast.error("Du trenger medlem-tilgang.");
      return;
    }
    if (templates === undefined) {
      toast.error("Laster ROS-maler …");
      return;
    }
    if (templates.length === 0) {
      toast.error("Opprett minst én ROS-mal under «Maler» først.");
      return;
    }
    setTemplateDialogMode("new");
  }

  function handleGoToTemplates() {
    setTemplateDialogMode(null);
    setSelectedTemplateId("");
    router.push(`/w/${workspaceId}/ros?fane=maler&nyMal=1`);
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

      const tplId = effectiveSelectedTemplateId as Id<"rosTemplates"> | "";
      if (!tplId) {
        toast.error("Velg hvilken ROS-mal du vil bruke.");
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
  const heading = variant === "assessment" ? "Ny vurdering" : "Start ny ROS";
  const intro =
    variant === "assessment"
      ? "Start fra prosess, GitHub eller en egen tittel."
      : "Velg mal først, og start deretter fra prosess, GitHub eller en ny tittel.";

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
    <section
      className={cn(
        "rounded-3xl border p-4 shadow-sm sm:p-5",
        variant === "ros"
          ? "border-border/60 bg-card/85 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
          : "border-border/50 bg-muted/15",
      )}
      aria-labelledby={`start-${variant}-heading`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2
            id={`start-${variant}-heading`}
            className="font-heading text-foreground text-base font-semibold tracking-tight sm:text-lg"
          >
            {heading}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {intro}
          </p>
        </div>
        {variant === "ros" ? (
          <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
            1. Velg mal  2. Velg kilde  3. Start analyse
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "mb-4 flex gap-1 rounded-2xl p-1",
          variant === "ros" ? "bg-muted/35" : "bg-muted/50",
        )}
        role="tablist"
        aria-label="Opprett fra prosess, GitHub eller blanke ark"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            aria-label={`${t.label}. ${t.desc}`}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 sm:px-3.5",
              activeTab === t.id
                ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}
            <span className="hidden min-[380px]:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "process" ? (
        <div className="space-y-3">
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
                onChange={(e) => {
                  setSelectedCandidateId(e.target.value);
                  if (variant === "ros") {
                    setSelectedTemplateId("");
                    setTemplateDialogMode(null);
                  }
                }}
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
                  Ingen prosesser — legg til under fanen Prosessregister.
                </p>
              ) : null}
              {variant === "assessment" && selectedCandidateId && resumeCheckPending ? (
                <p className="text-muted-foreground text-xs">
                  Sjekker om det finnes en påbegynt vurdering for prosessen …
                </p>
              ) : null}
              {variant === "assessment" && existingAssessment ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{existingAssessment.title}</p>
                  <p className="mt-1 line-clamp-2 leading-snug">
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
                <p className="text-muted-foreground max-w-md text-xs">
                  Fortsett under eller start på nytt fra samme prosess.
                </p>
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
                  className="h-11 gap-2 rounded-2xl px-5 shadow-sm sm:min-w-[10rem] sm:w-auto"
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
      {variant === "ros" ? (
        <Dialog
          open={templateDialogMode !== null}
          onOpenChange={(open) => {
            if (!open) {
              setTemplateDialogMode(null);
            }
          }}
        >
          <DialogContent
            size="md"
            titleId="ros-process-template-title"
            descriptionId="ros-process-template-desc"
          >
            <DialogHeader>
              <p
                id="ros-process-template-title"
                className="font-heading text-lg font-semibold"
              >
                Velg ROS-mal
              </p>
              <p
                id="ros-process-template-desc"
                className="text-muted-foreground text-sm"
              >
                {templateDialogMode === "process" && selectedCandidate
                  ? `Start ROS for ${selectedCandidate.name}.`
                  : templateDialogMode === "github"
                    ? "Velg mal før ROS opprettes fra GitHub."
                    : templateDialogMode === "new"
                      ? "Velg mal før ny ROS opprettes."
                      : "Velg mal for ROS-analysen."}
              </p>
            </DialogHeader>
            <DialogBody className="space-y-4 sm:space-y-5">
              {templateDialogMode === "process" && selectedCandidate ? (
                <div className="rounded-2xl border border-border/50 bg-muted/15 px-3 py-3">
                  <p className="text-muted-foreground text-xs font-medium">
                    Prosess
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedCandidate.code} — {selectedCandidate.name}
                  </p>
                </div>
              ) : null}
              <div className="rounded-2xl border border-border/50 bg-card/50 p-3 sm:p-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ros-template-select-dialog"
                    className="text-muted-foreground text-xs font-medium"
                  >
                    ROS-mal
                  </Label>
                  <select
                    id="ros-template-select-dialog"
                    className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm shadow-sm"
                    value={effectiveSelectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={busy || templates === undefined || rosNeedsTemplate}
                  >
                    <option value="">Velg ROS-mal …</option>
                    {templatesList.map((template) => (
                      <option key={template._id} value={template._id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                {templates === undefined ? (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Laster ROS-maler …
                  </p>
                ) : null}
                {templates !== undefined && templates.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-3">
                    <p className="text-sm font-medium text-foreground">
                      Ingen ROS-maler ennå
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      Opprett en mal først, så kan du komme tilbake og starte ROS.
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Trenger du en ny mal?
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      Gå til `Maler` for å opprette eller redigere ROS-maler.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-w-[11rem] rounded-2xl gap-2"
                    onClick={handleGoToTemplates}
                    disabled={busy}
                  >
                    <Grid3x3 className="size-4" aria-hidden />
                    Opprett ny mal
                  </Button>
                </div>
              </div>
            </DialogBody>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="text-muted-foreground text-xs leading-relaxed">
                Velg mal for å fortsette, eller opprett en ny mal først.
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTemplateDialogMode(null)}
                disabled={busy}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                disabled={
                  busy ||
                  !effectiveSelectedTemplateId ||
                  (templateDialogMode === "process" && !selectedCandidateId) ||
                  (templateDialogMode === "github" && !issueUrl.trim()) ||
                  (templateDialogMode === "new" && !standaloneTitle.trim())
                }
                className="h-11 min-w-[10rem] rounded-2xl"
                onClick={() => {
                  if (templateDialogMode === "process") {
                    void handleStartNewFromRegister();
                    return;
                  }
                  if (templateDialogMode === "github") {
                    void handleStartFromUrl();
                    return;
                  }
                  if (templateDialogMode === "new") {
                    void handleStartStandalone();
                  }
                }}
              >
                {busyMode !== null ? "Oppretter …" : "Start ROS"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {activeTab === "github" ? (
        <div className="space-y-3">
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
              className="h-11 shrink-0 gap-2 rounded-2xl px-5 shadow-sm sm:min-w-[10rem] sm:w-auto"
              disabled={
                busy ||
                !issueUrl.trim() ||
                rosNeedsTemplate ||
                (variant === "ros" && templates === undefined)
              }
              onClick={() =>
                variant === "ros"
                  ? void handleOpenTemplateDialogForUrl()
                  : void handleStartFromUrl()
              }
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
              className="h-11 shrink-0 gap-2 rounded-2xl px-5 shadow-sm sm:min-w-[10rem] sm:w-auto"
              disabled={
                busy ||
                !standaloneTitle.trim() ||
                rosNeedsTemplate ||
                (variant === "ros" && templates === undefined)
              }
              onClick={() =>
                variant === "ros"
                  ? void handleOpenTemplateDialogForNew()
                  : void handleStartStandalone()
              }
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
    </section>
  );
}
