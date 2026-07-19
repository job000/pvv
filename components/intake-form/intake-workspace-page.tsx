"use client";

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
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search-input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  INTAKE_FORM_TEMPLATE_CATALOG,
  INTAKE_MAPPING_TARGET_LABELS,
  detectTechnicalTerms,
} from "@/lib/intake-form";
import {
  DEFAULT_ROS_COL_LABELS,
  RPA_INTAKE_ROS_COL_AXIS,
  RPA_INTAKE_ROS_ROW_AXIS,
  RPA_INTAKE_ROS_ROW_DESCRIPTIONS,
  RPA_INTAKE_ROS_ROW_LABELS,
  RPA_INTAKE_ROS_TEMPLATE_DESCRIPTION,
  RPA_INTAKE_ROS_TEMPLATE_NAME,
} from "@/lib/ros-defaults";
import { effectiveGithubDefaultRepos } from "@/lib/github-workspace-helpers";
import { cn } from "@/lib/utils";
import { toastDeleteWithUndo } from "@/lib/toast-delete-undo";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Eye,
  ExternalLink,
  FileText,
  GitBranch,
  Link2,
  MoreHorizontal,
  Plus,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { IntakeSubmissionCollabPanel } from "@/components/intake-form/intake-submission-collab-panel";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type EditableQuestion = {
  id: string;
  label: string;
  helpText?: string;
  questionType: "text" | "number" | "multiple_choice" | "scale" | "yes_no";
  required: boolean;
  options: Array<{ id: string; label: string }>;
  visibilityRule?:
    | {
        parentQuestionKey: string;
        match:
          | { kind: "yes_no"; value: boolean }
          | { kind: "multiple_choice"; optionId: string }
          | { kind: "scale"; value: number };
      }
    | undefined;
  mappingTargets: Array<
    | { kind: "assessmentText"; field: string }
    | { kind: "assessmentScale"; field: string }
    | { kind: "assessmentNumber"; field: string }
    | { kind: "assessmentChoice"; field: string }
    | { kind: "derivedFrequency" }
    | { kind: "rosConsequence" }
    | { kind: "rosRiskDescription" }
    | { kind: "pvvPersonalData" }
    | { kind: "assessmentRpaBarrier" }
    | { kind: "assessmentRpaSimilar" }
    | { kind: "assessmentStabilityBoth" }
    | { kind: "assessmentScaleInvertedLength" }
  >;
};

function questionIdsWithMappingSectionInitiallyOpen(
  questionList: EditableQuestion[],
): string[] {
  return questionList
    .filter((item) => item.mappingTargets.length > 0)
    .map((item) => item.id);
}

type ReviewPayload = AssessmentPayload;

type FormSummary = {
  _id: Id<"intakeForms">;
  title: string;
  status: "draft" | "published" | "archived";
  confirmationMode: "none" | "email_copy";
  isTemplate: boolean;
  sourceTemplateFormId?: Id<"intakeForms">;
  orgUnitId?: Id<"orgUnits">;
  questionCount: number;
  responseCount: number;
  activeActivationCount: number;
};

type FormEditorData = {
  form: {
    _id: Id<"intakeForms">;
    title: string;
    description?: string;
    status: "draft" | "published" | "archived";
    layoutMode: "one_per_screen" | "grouped";
    questionsPerPage?: number;
    confirmationMode: "none" | "email_copy";
    rosIntegrationEnabled?: boolean;
    linkedRosTemplateId?: Id<"rosTemplates">;
    isTemplate?: boolean;
    sourceTemplateFormId?: Id<"intakeForms">;
    orgUnitId?: Id<"orgUnits">;
  };
  questions: Array<{
    _id: string;
    questionKey?: string;
    label: string;
    helpText?: string;
    questionType: EditableQuestion["questionType"];
    required: boolean;
    options?: Array<{ id: string; label: string }>;
    visibilityRule?: EditableQuestion["visibilityRule"];
    mappingTargets: EditableQuestion["mappingTargets"];
  }>;
};

type LinkRow = {
  _id: Id<"intakeFormLinks">;
  token: string;
  responseCount: number;
  maxResponses?: number;
  pausedAt?: number;
  status: "active" | "paused" | "expired" | "max_responses" | "revoked";
  isActive: boolean;
};

type ActivationRow = {
  _id: Id<"intakeFormActivations">;
  targetWorkspaceId: Id<"workspaces">;
  targetWorkspaceName: string;
  activatedFormId: Id<"intakeForms">;
  activatedFormTitle: string;
  activatedAt: number;
  deactivatedAt?: number;
  isActive: boolean;
};

type WorkspaceChoice = {
  workspace: {
    _id: Id<"workspaces">;
    name: string;
  };
  role: "owner" | "admin" | "member" | "viewer";
};

type SubmissionSummary = {
  _id: Id<"intakeSubmissions">;
  formId: Id<"intakeForms">;
  submittedAt: number;
  status: "submitted" | "under_review" | "approved" | "rejected";
  formTitle: string;
  personDataSignal: boolean;
  generatedAssessmentDraft: {
    title: string;
  };
  generatedRosSuggestion: {
    shouldCreateRos: boolean;
    risks: Array<{ id: string }>;
  };
  githubRepoFullName?: string;
  githubIssueNumber?: number;
  githubProjectItemNodeId?: string;
};

type IntakeSubmissionStatus = SubmissionSummary["status"];

function intakeSubmissionStatusBadgeProps(status: IntakeSubmissionStatus): {
  variant: "default" | "secondary" | "outline" | "destructive";
  label: string;
  className?: string;
} {
  switch (status) {
    case "submitted":
      return { variant: "default", label: "Ny" };
    case "under_review":
      return {
        variant: "outline",
        label: "Under vurdering",
        className:
          "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-400/35 dark:bg-amber-400/10 dark:text-amber-50",
      };
    case "approved":
      return {
        variant: "outline",
        label: "Godkjent",
        className:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:border-emerald-400/35 dark:bg-emerald-400/10 dark:text-emerald-50",
      };
    case "rejected":
      return { variant: "destructive", label: "Avslått" };
    default: {
      const _exhaustive: never = status;
      return { variant: "outline", label: String(_exhaustive) };
    }
  }
}

function IntakeSubmissionStatusBadge({ status }: { status: IntakeSubmissionStatus }) {
  const p = intakeSubmissionStatusBadgeProps(status);
  return (
    <Badge variant={p.variant} className={cn("shrink-0", p.className)}>
      {p.label}
    </Badge>
  );
}

function intakeSubmissionReviewHint(status: IntakeSubmissionStatus): string {
  switch (status) {
    case "submitted":
    case "under_review":
      return "Åpne gjennomgang for å godkjenne eller avslå";
    case "approved":
      return "Trykk for å se detaljer og lenke til vurdering";
    case "rejected":
      return "Trykk for å se gjennomgang og begrunnelse";
    default: {
      const _e: never = status;
      return String(_e);
    }
  }
}

/** Kø-kort: klikk åpner gjennomgang; slett og GitHub er sekundære. */
function IntakeSubmissionQueueCard({
  submission,
  subtitle,
  onOpenReview,
  onDelete,
  canDelete,
  extraBadges,
  githubSlot,
}: {
  submission: SubmissionSummary;
  subtitle: string;
  onOpenReview: () => void | Promise<void>;
  onDelete: () => void;
  canDelete: boolean;
  extraBadges?: ReactNode;
  githubSlot: ReactNode;
}) {
  const title = submission.generatedAssessmentDraft.title;
  const hint = intakeSubmissionReviewHint(submission.status);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card transition-colors hover:border-border">
      <button
        type="button"
        className={cn(
          "group w-full cursor-pointer p-4 text-left transition-colors sm:px-5",
          "hover:bg-muted/25",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        onClick={() => void onOpenReview()}
        aria-label={`Gjennomgå forslag: ${title}`}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-[15px] font-medium tracking-tight text-foreground">
                {title}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <IntakeSubmissionStatusBadge status={submission.status} />
                {canDelete ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Slett forslag"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete();
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </span>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
            {extraBadges ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {extraBadges}
              </div>
            ) : null}
            <p className="pt-0.5 text-xs font-medium text-muted-foreground">
              {hint}
            </p>
          </div>
          <ChevronRight
            className="mt-1 size-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden
          />
        </div>
      </button>
      {githubSlot}
    </div>
  );
}

type SubmissionDetail = {
  form:
    | {
        title?: string;
        rosIntegrationEnabled?: boolean;
        linkedRosTemplateId?: Id<"rosTemplates">;
      }
    | null;
  questions: Array<{ _id: string; label: string }>;
  submission: {
    _id: Id<"intakeSubmissions">;
    submittedAt: number;
    status: "submitted" | "under_review" | "approved" | "rejected";
    personDataSignal: boolean;
    answers: Array<
      | { questionId: string; kind: "text"; value: string }
      | { questionId: string; kind: "number"; value: number }
      | {
          questionId: string;
          kind: "multiple_choice";
          optionId: string;
          label: string;
        }
      | { questionId: string; kind: "scale"; value: number }
      | { questionId: string; kind: "yes_no"; value: boolean }
    >;
    generatedAssessmentDraft: {
      title: string;
      payload: ReviewPayload;
      autoFilledFields: string[];
    };
    generatedRosSuggestion: {
      shouldCreateRos: boolean;
      summary?: string;
      risks: Array<{ id: string; title: string; description: string }>;
    };
    approvedAssessmentId?: Id<"assessments">;
    submitterMeta?: { name?: string; email?: string };
    githubRepoFullName?: string;
    githubIssueNumber?: number;
    githubProjectItemNodeId?: string;
  };
};

type PreviewQuestion = {
  id: string;
  label: string;
  helpText?: string;
  questionType: EditableQuestion["questionType"];
  required: boolean;
  options: Array<{ id: string; label: string }>;
  visibilityRule?: EditableQuestion["visibilityRule"];
};

function defaultIntakeGithubIssueTitle(
  formTitle: string,
  meta: { name?: string; email?: string },
  submissionDraftTitle?: string,
): string {
  const who = meta.name?.trim() || meta.email?.trim() || "Ukjent innsender";
  const draft = submissionDraftTitle?.trim();
  if (draft && draft.length > 0) {
    return `[Skjemaforslag] ${draft} — ${who}`.slice(0, 256);
  }
  return `[Skjemaforslag] ${formTitle.trim() || "Skjema"} — ${who}`.slice(0, 256);
}

function submissionGithubKind(sub: {
  githubRepoFullName?: string;
  githubIssueNumber?: number;
  githubProjectItemNodeId?: string;
}): "issue" | "draft" | null {
  const hasIssue =
    Boolean(sub.githubRepoFullName?.trim()) && sub.githubIssueNumber != null;
  if (hasIssue) return "issue";
  if (Boolean(sub.githubProjectItemNodeId?.trim())) return "draft";
  return null;
}

const REVIEW_FIELDS = [
  ["processName", "Prosessnavn"],
  ["processDescription", "Beskrivelse"],
  ["processGoal", "Mål / automatisering"],
  ["processVolumeNotes", "Volum og frekvens"],
  ["processConstraints", "Begrensninger / risiko"],
  ["hfSecurityInformationNotes", "Sikkerhet og personvern"],
  ["rpaBarrierNotes", "Beslutningsgrunnlag — forklaring (hindring)"],
  ["rpaBenefitKindsAndOperationsNotes", "Gevinst, tid, robot vs. manuelt"],
  ["rpaLifecycleContact", "Kontaktperson til produksjon"],
  ["rpaManualFallbackWhenRobotFails", "Manuell reserve ved robotfeil"],
] as const satisfies ReadonlyArray<readonly [keyof AssessmentPayload, string]>;

function emptyQuestion(): EditableQuestion {
  return {
    id: crypto.randomUUID(),
    label: "",
    helpText: "",
    questionType: "text",
    required: true,
    options: [],
    visibilityRule: undefined,
    mappingTargets: [],
  };
}

function createEmptyFollowUpQuestion(parent: EditableQuestion): EditableQuestion {
  return {
    ...emptyQuestion(),
    visibilityRule: createDefaultVisibilityRule(parent),
  };
}

function toEditableQuestions(
  questions: FormEditorData["questions"],
): EditableQuestion[] {
  return normalizeQuestionVisibility(
    questions.map((question) => ({
      id: question.questionKey ?? question._id,
      label: question.label,
      helpText: question.helpText ?? "",
      questionType: question.questionType,
      required: question.required,
      options: question.options ?? [],
      visibilityRule: question.visibilityRule,
      mappingTargets: question.mappingTargets,
    })),
  );
}

function formatDateTimeLocal(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function renderQuestionTypeLabel(kind: EditableQuestion["questionType"]) {
  switch (kind) {
    case "text":
      return "Tekst";
    case "number":
      return "Tall";
    case "multiple_choice":
      return "Flervalg";
    case "scale":
      return "Skala 1-5";
    case "yes_no":
      return "Ja / Nei";
  }
}

function canHaveFollowUps(questionType: EditableQuestion["questionType"]) {
  return (
    questionType === "yes_no" ||
    questionType === "multiple_choice" ||
    questionType === "scale"
  );
}

function getQuestionHeadline(question: EditableQuestion, index: number) {
  return question.label.trim() || `Spørsmål ${index + 1}`;
}

function createDefaultVisibilityRule(
  parent: EditableQuestion | undefined,
): EditableQuestion["visibilityRule"] {
  if (!parent) {
    return undefined;
  }
  switch (parent.questionType) {
    case "yes_no":
      return {
        parentQuestionKey: parent.id,
        match: { kind: "yes_no", value: true },
      };
    case "multiple_choice":
      return parent.options[0]
        ? {
            parentQuestionKey: parent.id,
            match: { kind: "multiple_choice", optionId: parent.options[0].id },
          }
        : undefined;
    case "scale":
      return {
        parentQuestionKey: parent.id,
        match: { kind: "scale", value: 4 },
      };
    default:
      return undefined;
  }
}

function normalizeQuestionVisibility(questions: EditableQuestion[]): EditableQuestion[] {
  return questions.map((question, index, allQuestions) => {
    const rule = question.visibilityRule;
    if (!rule) {
      return question;
    }

    const parentIndex = allQuestions.findIndex((candidate) => candidate.id === rule.parentQuestionKey);
    if (parentIndex < 0 || parentIndex >= index) {
      return { ...question, visibilityRule: undefined };
    }

    const parent = allQuestions[parentIndex];
    if (rule.match.kind !== parent.questionType) {
      return { ...question, visibilityRule: undefined };
    }

    if (rule.match.kind === "multiple_choice") {
      const match = rule.match;
      if (!parent.options.some((option) => option.id === match.optionId)) {
        return { ...question, visibilityRule: undefined };
      }
    }

    if (rule.match.kind === "scale" && (rule.match.value < 1 || rule.match.value > 5)) {
      return { ...question, visibilityRule: undefined };
    }

    return question;
  });
}

function describeVisibilityRule(
  question: PreviewQuestion,
  questions: PreviewQuestion[],
): string | null {
  const rule = question.visibilityRule;
  if (!rule) {
    return null;
  }
  const parent = questions.find((candidate) => candidate.id === rule.parentQuestionKey);
  const parentLabel = parent?.label || "et tidligere spørsmål";

  switch (rule.match.kind) {
    case "yes_no":
      return `Vises når «${parentLabel}» er svart ${rule.match.value ? "Ja" : "Nei"}.`;
    case "multiple_choice": {
      const match = rule.match;
      const optionLabel =
        parent?.options.find((option) => option.id === match.optionId)?.label ?? "valget";
      return `Vises når «${parentLabel}» er satt til «${optionLabel}».`;
    }
    case "scale":
      return `Vises når «${parentLabel}» er satt til ${rule.match.value}.`;
  }
}

function renderLinkStatusLabel(status: LinkRow["status"]) {
  switch (status) {
    case "active":
      return "Aktiv";
    case "paused":
      return "Pauset";
    case "expired":
      return "Utløpt";
    case "max_responses":
      return "Full";
    default:
      return "Stengt";
  }
}

function MappingTargetPicker({
  question,
  onChange,
}: {
  question: EditableQuestion;
  onChange: (next: EditableQuestion["mappingTargets"]) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {INTAKE_MAPPING_TARGET_LABELS.map((target) => {
        const key =
          "field" in target
            ? `${target.kind}:${target.value}`
            : `${target.kind}:${target.value}`;
        const checked = question.mappingTargets.some((existing) => {
          if (existing.kind !== target.kind) return false;
          if ("field" in existing && "value" in target) {
            return existing.field === target.value;
          }
          return !("field" in existing) && !("field" in target);
        });
        return (
          <label
            key={key}
            className="flex items-start gap-2 rounded-xl border border-border/50 bg-background px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={checked}
              onChange={(event) => {
                if (event.target.checked) {
                  if (
                    target.kind === "assessmentText" ||
                    target.kind === "assessmentScale" ||
                    target.kind === "assessmentNumber" ||
                    target.kind === "assessmentChoice"
                  ) {
                    onChange([
                      ...question.mappingTargets,
                      { kind: target.kind, field: target.value },
                    ]);
                    return;
                  }
                  onChange([...question.mappingTargets, { kind: target.kind }]);
                  return;
                }
                onChange(
                  question.mappingTargets.filter((existing) => {
                    if (existing.kind !== target.kind) return true;
                    if ("field" in existing && "value" in target) {
                      return existing.field !== target.value;
                    }
                    return false;
                  }),
                );
              }}
            />
            <span>{target.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function ReviewField({
  label,
  fieldKey,
  draft,
  original,
  onChange,
}: {
  label: string;
  fieldKey: keyof AssessmentPayload;
  draft: ReviewPayload;
  original: ReviewPayload;
  onChange: (field: keyof AssessmentPayload, value: string) => void;
}) {
  const value = String(draft[fieldKey] ?? "");
  const autoValue = String(original[fieldKey] ?? "");
  const changed = value !== autoValue;
  return (
    <div className="space-y-2 rounded-2xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium">{label}</Label>
        <Badge variant={changed ? "secondary" : "outline"}>
          {changed ? "Manuelt justert" : "Auto-generert"}
        </Badge>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(fieldKey, event.target.value)}
        className="min-h-24"
      />
    </div>
  );
}

function AdminFormPreview({
  title,
  description,
  layoutMode,
  questionsPerPage,
  confirmationMode,
  questions,
}: {
  title: string;
  description: string;
  layoutMode: "one_per_screen" | "grouped";
  questionsPerPage: number;
  confirmationMode: "none" | "email_copy";
  questions: PreviewQuestion[];
}) {
  const perPage = Math.min(25, Math.max(1, Math.floor(questionsPerPage)));
  const previewQuestions =
    layoutMode === "one_per_screen" ? questions.slice(0, perPage) : questions;

  return (
    <div className="space-y-4 rounded-[28px] border border-border/50 bg-background p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Forhåndsvisning
        </p>
        <h3 className="font-heading text-xl font-semibold">
          {title.trim() || "Nytt skjema"}
        </h3>
        {description.trim() ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Legg til en kort beskrivelse for de som fyller ut skjemaet.
          </p>
        )}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {layoutMode === "one_per_screen"
              ? perPage === 1
                ? "Ett spørsmål per side"
                : `Opptil ${perPage} spørsmål per side`
              : "Gruppert skjema"}
          </span>
          <span>{questions.length} spørsmål</span>
        </div>
        <Progress
          value={
            questions.length > 0
              ? layoutMode === "one_per_screen"
                ? Math.min(100, (100 * perPage) / (questions.length + perPage))
                : 100
              : 0
          }
          className="h-2 rounded-full"
        />
        {confirmationMode === "email_copy" ? (
          <p className="text-xs text-muted-foreground">
            På slutten må brukeren oppgi e-post og får en kopi av svarene sine.
          </p>
        ) : null}
      </div>
      {previewQuestions.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/10 p-4">
          {previewQuestions.map((question, index) => (
            <div key={question.id} className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Spørsmål {index + 1}
                </p>
                <p className="font-medium">{question.label || "Uten spørsmålstekst"}</p>
                {question.helpText ? (
                  <p className="text-sm text-muted-foreground">{question.helpText}</p>
                ) : null}
                {describeVisibilityRule(question, questions) ? (
                  <p className="text-xs text-muted-foreground">
                    {describeVisibilityRule(question, questions)}
                  </p>
                ) : null}
              </div>
              {question.questionType === "text" ? (
                <div className="rounded-2xl border border-border/50 bg-card px-4 py-5 text-sm text-muted-foreground">
                  Tekstsvar
                </div>
              ) : null}
              {question.questionType === "number" ? (
                <div className="rounded-2xl border border-border/50 bg-card px-4 py-5 text-sm text-muted-foreground">
                  Tallfelt
                </div>
              ) : null}
              {question.questionType === "multiple_choice" ? (
                <div className="grid gap-2">
                  {question.options.map((option) => (
                    <div
                      key={option.id}
                      className="rounded-2xl border border-border/50 bg-card px-4 py-3 text-sm"
                    >
                      {option.label}
                    </div>
                  ))}
                </div>
              ) : null}
              {question.questionType === "scale" ? (
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <div
                      key={value}
                      className="rounded-2xl border border-border/50 bg-card px-3 py-3 text-center text-sm font-medium"
                    >
                      {value}
                    </div>
                  ))}
                </div>
              ) : null}
              {question.questionType === "yes_no" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {["Ja", "Nei"].map((label) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-border/50 bg-card px-4 py-3 text-sm"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
          Legg til spørsmål for å forhåndsvise skjemaet.
        </div>
      )}
      {layoutMode === "one_per_screen" && questions.length > previewQuestions.length ? (
        <p className="text-xs text-muted-foreground">
          Forhåndsvisningen viser første side. Resten kommer når svarer blar videre i den
          offentlige flyten.
        </p>
      ) : null}
    </div>
  );
}

export function IntakeWorkspacePage({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const searchParams = useSearchParams();
  const formsQuery = useQuery(api.intakeForms.listByWorkspace, { workspaceId });
  const myWorkspacesQuery = useQuery(api.workspaces.listMine, {});
  const submissionsQuery = useQuery(api.intakeSubmissions.listByWorkspace, {
    workspaceId,
  });
  const rosTemplatesQuery = useQuery(api.ros.listTemplates, { workspaceId });
  const workspaceDocQuery = useQuery(api.workspaces.get, { workspaceId });
  const myWorkspaceMembership = useQuery(api.workspaces.getMyMembership, {
    workspaceId,
  });
  const orgUnitsQuery = useQuery(api.orgUnits.listByWorkspace, { workspaceId });

  const createForm = useMutation(api.intakeForms.create);
  const saveForm = useMutation(api.intakeForms.save);
  const archiveForm = useMutation(api.intakeForms.archive);
  const updateFormIntegrations = useMutation(api.intakeForms.updateIntegrations);
  const setFormOrgUnit = useMutation(api.intakeForms.setFormOrgUnit);
  const setFormStatus = useMutation(api.intakeForms.setStatus);
  const publishTemplate = useMutation(api.intakeForms.publishTemplate);
  const activateTemplate = useMutation(api.intakeForms.activateTemplate);
  const deactivateActivation = useMutation(api.intakeForms.deactivateActivation);
  const createLink = useMutation(api.intakeLinks.create);
  const pauseLink = useMutation(api.intakeLinks.pause);
  const resumeLink = useMutation(api.intakeLinks.resume);
  const removeLink = useMutation(api.intakeLinks.remove);
  const approveSubmission = useMutation(api.intakeSubmissions.approve);
  const rejectSubmission = useMutation(api.intakeSubmissions.reject);
  const removeSubmission = useMutation(api.intakeSubmissions.remove);
  const markUnderReview = useMutation(api.intakeSubmissions.markUnderReview);
  const createRosTemplate = useMutation(api.ros.createTemplate);
  const listGithubProjectStatusOptions = useAction(
    api.githubCandidateProject.listGithubProjectStatusOptions,
  );
  const createGithubRepoIssueForIntakeSubmission = useAction(
    api.githubCandidateProject.createGithubRepoIssueForIntakeSubmission,
  );

  const [selectedFormId, setSelectedFormId] = useState<Id<"intakeForms"> | null>(null);
  /** True mens redigeringsvinduet er for et helt nytt skjema — ikke opprettet i databasen før bruker trykker «Opprett skjema». */
  const [isCreatingNewForm, setIsCreatingNewForm] = useState(false);
  const selectedFormIdBeforeCreateRef = useRef<Id<"intakeForms"> | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  /** Steg i redigeringsdialogen — unngår å vise alt på én gang. */
  const [editorSection, setEditorSection] = useState<
    "basics" | "questions" | "settings"
  >("basics");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [githubIntakeDialogOpen, setGithubIntakeDialogOpen] = useState(false);
  const [intakeTemplatePickerOpen, setIntakeTemplatePickerOpen] = useState(false);
  const [githubDialogOpenVersion, setGithubDialogOpenVersion] = useState(0);
  const [selectedSubmissionId, setSelectedSubmissionId] =
    useState<Id<"intakeSubmissions"> | null>(null);
  const [pendingDeletedFormIds, setPendingDeletedFormIds] = useState<
    Id<"intakeForms">[]
  >([]);
  const [pendingDeletedSubmissionIds, setPendingDeletedSubmissionIds] = useState<
    Id<"intakeSubmissions">[]
  >([]);
  const allForms = useMemo(
    () => (formsQuery ?? []) as FormSummary[],
    [formsQuery],
  );
  const visibleFormIds = allForms
    .filter(
      (form) =>
        form.status !== "archived" && !pendingDeletedFormIds.includes(form._id),
    )
    .map((form) => form._id);
  const activeFormId = isCreatingNewForm
    ? null
    : selectedFormId && visibleFormIds.includes(selectedFormId)
      ? selectedFormId
      : (visibleFormIds[0] ?? null);

  const editorDataQuery = useQuery(
    api.intakeForms.getEditor,
    activeFormId ? { formId: activeFormId } : "skip",
  );
  const linksQuery = useQuery(
    api.intakeLinks.listByForm,
    activeFormId ? { formId: activeFormId } : "skip",
  );
  const activationsQuery = useQuery(
    api.intakeForms.listActivations,
    activeFormId ? { formId: activeFormId } : "skip",
  );
  const submissionDetailQuery = useQuery(
    api.intakeSubmissions.getDetail,
    selectedSubmissionId ? { submissionId: selectedSubmissionId } : "skip",
  );

  const forms = useMemo(
    () =>
      allForms.filter(
        (form) =>
          form.status !== "archived" && !pendingDeletedFormIds.includes(form._id),
      ),
    [allForms, pendingDeletedFormIds],
  );
  const myWorkspaces = useMemo(
    () => (myWorkspacesQuery ?? []) as WorkspaceChoice[],
    [myWorkspacesQuery],
  );
  const submissions = useMemo(
    () =>
      ((submissionsQuery ?? []) as SubmissionSummary[]).filter(
        (submission) => !pendingDeletedSubmissionIds.includes(submission._id),
      ),
    [pendingDeletedSubmissionIds, submissionsQuery],
  );
  const rosTemplates = useMemo(
    () =>
      (rosTemplatesQuery ?? []) as Array<{ _id: Id<"rosTemplates">; name: string }>,
    [rosTemplatesQuery],
  );
  const editorData = (editorDataQuery ?? null) as FormEditorData | null;
  const links = (linksQuery ?? []) as LinkRow[];
  const activations = (activationsQuery ?? []) as ActivationRow[];
  const submissionDetail = (submissionDetailQuery ?? null) as SubmissionDetail | null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [layoutMode, setLayoutMode] = useState<"one_per_screen" | "grouped">(
    "one_per_screen",
  );
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    "draft",
  );
  const [confirmationMode, setConfirmationMode] = useState<
    "none" | "email_copy"
  >("none");
  const [questionsPerPage, setQuestionsPerPage] = useState(1);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<string[]>([]);
  const [mappingSectionOpenIds, setMappingSectionOpenIds] = useState<string[]>(
    [],
  );
  const [expiresAt, setExpiresAt] = useState(() =>
    formatDateTimeLocal(Date.now() + 1000 * 60 * 60 * 24 * 7),
  );
  const [maxResponses, setMaxResponses] = useState("25");
  const [accessMode, setAccessMode] = useState<"anonymous" | "email_required">(
    "anonymous",
  );
  const [reviewTitle, setReviewTitle] = useState<string | null>(null);
  const [reviewPayload, setReviewPayload] = useState<ReviewPayload | null>(null);
  const [createRos, setCreateRos] = useState<boolean | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [intakeGithubIssueTitle, setIntakeGithubIssueTitle] = useState("");
  const [intakeGithubIssueBody, setIntakeGithubIssueBody] = useState("");
  const [intakeGithubStatusOptionId, setIntakeGithubStatusOptionId] =
    useState("");
  const [intakeGithubRepoChoice, setIntakeGithubRepoChoice] = useState("");
  const [intakeGithubStatusLoading, setIntakeGithubStatusLoading] =
    useState(false);
  const [intakeGithubStatusError, setIntakeGithubStatusError] = useState<
    string | null
  >(null);
  const [intakeGithubStatusOptions, setIntakeGithubStatusOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [intakeGithubStatusFieldName, setIntakeGithubStatusFieldName] =
    useState<string | null>(null);
  const [intakeGithubCreateBusy, setIntakeGithubCreateBusy] = useState(false);

  const workspaceGithubDefaultRepos = useMemo(
    () => effectiveGithubDefaultRepos(workspaceDocQuery ?? null),
    [workspaceDocQuery],
  );

  const intakeGithubMembershipLoading = myWorkspaceMembership === undefined;

  /** Samme GitHub-prosjekt, PAT og statusfelt som under arbeidsområdets innstillinger / prosessregister — ikke egen skjema-konfigurasjon. */
  const canCreateIntakeGithubIssue = useMemo(() => {
    if (intakeGithubMembershipLoading) {
      return false;
    }
    if (!myWorkspaceMembership || myWorkspaceMembership.role === "viewer") {
      return false;
    }
    return Boolean(workspaceDocQuery?.githubProjectNodeId?.trim());
  }, [
    intakeGithubMembershipLoading,
    myWorkspaceMembership,
    workspaceDocQuery?.githubProjectNodeId,
  ]);

  useEffect(() => {
    setIntakeGithubRepoChoice((prev) =>
      prev && workspaceGithubDefaultRepos.includes(prev)
        ? prev
        : (workspaceGithubDefaultRepos[0] ?? ""),
    );
  }, [workspaceGithubDefaultRepos]);

  useEffect(() => {
    if (!githubIntakeDialogOpen || !submissionDetail || !selectedSubmissionId) {
      return;
    }
    if (submissionDetail.submission._id !== selectedSubmissionId) {
      return;
    }
    setIntakeGithubIssueTitle(
      defaultIntakeGithubIssueTitle(
        submissionDetail.form?.title ?? "Skjema",
        submissionDetail.submission.submitterMeta ?? {},
        reviewTitle ?? submissionDetail.submission.generatedAssessmentDraft.title,
      ),
    );
    setIntakeGithubIssueBody("");
    // reviewTitle is read when the dialog opens (githubDialogOpenVersion) — omit from deps so
    // editing «Tittel» i gjennomgang ikke nullstiller feltet mens dialogen er åpen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    githubIntakeDialogOpen,
    githubDialogOpenVersion,
    selectedSubmissionId,
    submissionDetail?.submission._id,
  ]);

  useEffect(() => {
    if ((!reviewOpen && !githubIntakeDialogOpen) || !canCreateIntakeGithubIssue) {
      setIntakeGithubStatusLoading(false);
      return;
    }
    let cancelled = false;
    setIntakeGithubStatusLoading(true);
    setIntakeGithubStatusError(null);
    void listGithubProjectStatusOptions({ workspaceId })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setIntakeGithubStatusOptions(result.options);
        setIntakeGithubStatusFieldName(result.fieldName);
        setIntakeGithubStatusOptionId((prev) =>
          prev && result.options.some((option) => option.id === prev)
            ? prev
            : (result.options[0]?.id ?? ""),
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setIntakeGithubStatusError(formatUserFacingError(error));
        setIntakeGithubStatusOptions([]);
        setIntakeGithubStatusFieldName(null);
        setIntakeGithubStatusOptionId("");
      })
      .finally(() => {
        if (!cancelled) {
          setIntakeGithubStatusLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    reviewOpen,
    githubIntakeDialogOpen,
    canCreateIntakeGithubIssue,
    workspaceId,
    listGithubProjectStatusOptions,
  ]);

  const [selectedTargetWorkspaceId, setSelectedTargetWorkspaceId] = useState<
    Id<"workspaces"> | null
  >(null);
  const [integrationDrafts, setIntegrationDrafts] = useState<
    Record<
      string,
      {
        rosIntegrationEnabled: boolean;
        linkedRosTemplateId: Id<"rosTemplates"> | null;
      }
    >
  >({});
  const [pageTab, setPageTab] = useState<"skjemaer" | "forslag">("skjemaer");
  const [formMoreOpen, setFormMoreOpen] = useState(false);
  const formMoreBtnRef = useRef<HTMLButtonElement | null>(null);
  const [formMoreMenuPos, setFormMoreMenuPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [settingsSection, setSettingsSection] = useState<
    "org" | "ros" | "mal" | "lenker"
  >("org");
  const [settingsFillViewport, setSettingsFillViewport] = useState(false);
  const [formSearch, setFormSearch] = useState("");
  const [formStatusFilter, setFormStatusFilter] = useState<
    "all" | "draft" | "published"
  >("all");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [queueFormFilter, setQueueFormFilter] = useState<Id<"intakeForms"> | null>(
    null,
  );
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<
    "all" | IntakeSubmissionStatus
  >("all");
  const [selectedQueueSubmissionIds, setSelectedQueueSubmissionIds] = useState<
    Id<"intakeSubmissions">[]
  >([]);

  const selectedForm = forms.find((form) => form._id === activeFormId) ?? null;

  /** Valgt skjema vises alltid i panelet under — aldri duplisert som eget kort i listen. */
  const formsForSidebarList = useMemo(() => {
    if (!activeFormId) {
      return forms;
    }
    return forms.filter((f) => f._id !== activeFormId);
  }, [forms, activeFormId]);

  useEffect(() => {
    setFormMoreOpen(false);
  }, [activeFormId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setSettingsFillViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (settingsOpen) {
      setSettingsSection("org");
    }
  }, [settingsOpen]);

  const openedForslagDeepLinkRef = useRef<string | null>(null);
  /** Deep-link fra Oppgaver / varsel: ?forslag=<submissionId> */
  useEffect(() => {
    const raw = searchParams.get("forslag");
    if (!raw || !submissionsQuery) return;
    if (openedForslagDeepLinkRef.current === raw) return;
    const match = submissionsQuery.find((s) => s._id === raw);
    if (!match) return;
    openedForslagDeepLinkRef.current = raw;
    setPageTab("forslag");
    void openSubmissionForReview({
      _id: match._id,
      status: match.status,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link once per forslag-id
  }, [searchParams, submissionsQuery]);

  useLayoutEffect(() => {
    if (!formMoreOpen) {
      setFormMoreMenuPos(null);
      return;
    }
    const sync = () => {
      const el = formMoreBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Åpne over knappen så menyen ligger over kortet (ikke klippet av overflow)
      setFormMoreMenuPos({
        top: Math.max(8, r.top - 8),
        right: Math.max(8, window.innerWidth - r.right),
      });
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [formMoreOpen]);

  const integrationDraft = activeFormId ? integrationDrafts[activeFormId] : undefined;
  const rosIntegrationEnabled =
    integrationDraft?.rosIntegrationEnabled ?? Boolean(editorData?.form.rosIntegrationEnabled);
  const linkedRosTemplateId =
    integrationDraft?.linkedRosTemplateId ?? editorData?.form.linkedRosTemplateId ?? null;
  const linkedRosTemplate = useMemo(
    () => rosTemplates.find((template) => template._id === linkedRosTemplateId) ?? null,
    [linkedRosTemplateId, rosTemplates],
  );
  const orgUnitNameById = useMemo(() => {
    const m = new Map<Id<"orgUnits">, string>();
    for (const u of orgUnitsQuery ?? []) {
      m.set(u._id, u.name);
    }
    return m;
  }, [orgUnitsQuery]);
  const selectedFormOrgUnitId = editorData?.form.orgUnitId;
  const targetWorkspaceOptions = useMemo(
    () =>
      myWorkspaces
        .filter(
          (item) => item.workspace._id !== workspaceId && item.role !== "viewer",
        )
        .map((item) => ({
          id: item.workspace._id,
          name: item.workspace.name,
          role: item.role,
        })),
    [myWorkspaces, workspaceId],
  );
  const resolvedTargetWorkspaceId = targetWorkspaceOptions.some(
    (option) => option.id === selectedTargetWorkspaceId,
  )
    ? selectedTargetWorkspaceId
    : (targetWorkspaceOptions[0]?.id ?? null);
  const updateQuestions = (updater: (prev: EditableQuestion[]) => EditableQuestion[]) =>
    setQuestions((prev) => normalizeQuestionVisibility(updater(prev)));
  const updateSingleQuestion = (
    questionId: string,
    updater: (question: EditableQuestion) => EditableQuestion,
  ) =>
    updateQuestions((prev) =>
      prev.map((item) => (item.id === questionId ? updater(item) : item)),
    );
  const plainLanguageWarnings = useMemo(
    () =>
      questions.map((question) => ({
        id: question.id,
        terms: detectTechnicalTerms(question.label),
      })),
    [questions],
  );

  function primeEditorState(source: FormEditorData | null) {
    if (!source) {
      return;
    }
    setIsCreatingNewForm(false);
    setTitle(source.form.title);
    setDescription(source.form.description ?? "");
    setLayoutMode(source.form.layoutMode);
    setQuestionsPerPage(
      Math.min(25, Math.max(1, Math.floor(source.form.questionsPerPage ?? 1))),
    );
    setStatus(source.form.status);
    setConfirmationMode(source.form.confirmationMode);
    const nextQuestions = toEditableQuestions(source.questions);
    setQuestions(nextQuestions);
    const firstId = nextQuestions[0]?.id;
    setExpandedQuestionIds(firstId ? [firstId] : []);
    setMappingSectionOpenIds(questionIdsWithMappingSectionInitiallyOpen(nextQuestions));
  }

  function toggleQuestionExpanded(questionId: string) {
    setExpandedQuestionIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((item) => item !== questionId)
        : [...prev, questionId],
    );
  }

  function toggleMappingSectionOpen(questionId: string) {
    setMappingSectionOpenIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((item) => item !== questionId)
        : [...prev, questionId],
    );
  }

  function setFollowUpEnabled(questionId: string, enabled: boolean) {
    const questionIndex = questions.findIndex((question) => question.id === questionId);
    if (questionIndex === -1) {
      return;
    }
    const availableParents = questions
      .slice(0, questionIndex)
      .filter((candidate) => canHaveFollowUps(candidate.questionType));

    if (enabled && availableParents.length === 0) {
      toast.error(
        "Legg til et tidligere Ja / Nei-, flervalg- eller skala-spørsmål først.",
      );
      return;
    }

    updateSingleQuestion(questionId, (question) => ({
      ...question,
      visibilityRule: enabled
        ? createDefaultVisibilityRule(availableParents[availableParents.length - 1])
        : undefined,
    }));
    setExpandedQuestionIds((prev) =>
      prev.includes(questionId) ? prev : [...prev, questionId],
    );
  }

  function isDescendantOf(
    question: EditableQuestion,
    ancestorId: string,
    allQuestions: EditableQuestion[],
  ): boolean {
    let currentParentId = question.visibilityRule?.parentQuestionKey;
    while (currentParentId) {
      if (currentParentId === ancestorId) {
        return true;
      }
      currentParentId = allQuestions.find((item) => item.id === currentParentId)?.visibilityRule
        ?.parentQuestionKey;
    }
    return false;
  }

  function addFollowUpQuestion(parentId: string) {
    const parent = questions.find((question) => question.id === parentId);
    if (!parent || !canHaveFollowUps(parent.questionType)) {
      toast.error("Oppfølgingsspørsmål må kobles til Ja / Nei, flervalg eller skala.");
      return;
    }

    const nextQuestion = createEmptyFollowUpQuestion(parent);
    updateQuestions((prev) => {
      const parentIndex = prev.findIndex((question) => question.id === parentId);
      if (parentIndex === -1) {
        return prev;
      }
      let insertIndex = parentIndex + 1;
      while (
        insertIndex < prev.length &&
        isDescendantOf(prev[insertIndex], parentId, prev)
      ) {
        insertIndex += 1;
      }
      return [
        ...prev.slice(0, insertIndex),
        nextQuestion,
        ...prev.slice(insertIndex),
      ];
    });
    setExpandedQuestionIds((prev) => [...prev, nextQuestion.id]);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const questionCard = document.querySelector<HTMLElement>(
          `[data-question-card-id="${nextQuestion.id}"]`,
        );
        questionCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        const labelInput = document.querySelector<HTMLInputElement>(
          `[data-question-label-input="${nextQuestion.id}"]`,
        );
        labelInput?.focus();
        labelInput?.select();
      });
    });
  }

  function applyIntakeQuestionTemplate(
    buildQuestions: (typeof INTAKE_FORM_TEMPLATE_CATALOG)[number]["buildQuestions"],
  ) {
    const nextQuestions = buildQuestions() as EditableQuestion[];
    setQuestions(nextQuestions);
    // Kun første spørsmål åpent — mindre støy
    const firstId = nextQuestions[0]?.id;
    setExpandedQuestionIds(firstId ? [firstId] : []);
    setMappingSectionOpenIds([]);
    setIntakeTemplatePickerOpen(false);
    setEditorSection("questions");
    toast.success("Mal er lastet inn — husk å lagre skjemaet.");
  }

  const intakeTemplatesByCategory = useMemo(() => {
    const map = new Map<string, (typeof INTAKE_FORM_TEMPLATE_CATALOG)[number][]>();
    for (const template of INTAKE_FORM_TEMPLATE_CATALOG) {
      const list = map.get(template.category) ?? [];
      list.push(template);
      map.set(template.category, list);
    }
    return [...map.entries()];
  }, []);

  function handleCreateForm() {
    selectedFormIdBeforeCreateRef.current = selectedFormId;
    setPageTab("skjemaer");
    setIsCreatingNewForm(true);
    setSelectedFormId(null);
    setTitle("");
    setDescription("");
    setLayoutMode("one_per_screen");
    setQuestionsPerPage(1);
    setStatus("draft");
    setConfirmationMode("none");
    const nextQuestion = emptyQuestion();
    setQuestions([nextQuestion]);
    setExpandedQuestionIds([nextQuestion.id]);
    setMappingSectionOpenIds([]);
    setEditorSection("basics");
    setEditorOpen(true);
  }

  /** Velg skjema i listen — må avslutte «nytt skjema»-utkast, ellers er activeFormId låst til null. */
  function selectWorkspaceForm(formId: Id<"intakeForms">) {
    setIsCreatingNewForm(false);
    selectedFormIdBeforeCreateRef.current = null;
    setSelectedFormId(formId);
    setEditorOpen(false);
    setFormMoreOpen(false);
  }

  async function handleSaveForm() {
    const wasCreating = isCreatingNewForm;
    let formId: Id<"intakeForms"> | null = wasCreating ? null : activeFormId;
    let createdFormId: Id<"intakeForms"> | null = null;
    try {
      if (wasCreating) {
        createdFormId = await createForm({
          workspaceId,
          title: title.trim() || "Nytt skjema",
        });
        formId = createdFormId;
      }
      if (!formId) {
        toast.error("Kunne ikke lagre — mangler skjema.");
        return;
      }
      await saveForm({
        formId,
        title,
        description,
        status,
        layoutMode,
        confirmationMode,
        questionsPerPage,
        questions: questions.map((question, index) => ({
          id: question.id || `question-${index + 1}`,
          label: question.label,
          helpText: question.helpText,
          questionType: question.questionType,
          required: question.required,
          options: question.options,
          visibilityRule: question.visibilityRule,
          mappingTargets: question.mappingTargets as Parameters<typeof saveForm>[0]["questions"][number]["mappingTargets"],
          groupKey: undefined,
          plainLanguageHint:
            detectTechnicalTerms(question.label).length > 0
              ? "Vurder enklere språk for dette spørsmålet."
              : undefined,
        })),
      });
      if (wasCreating) {
        setIsCreatingNewForm(false);
        selectedFormIdBeforeCreateRef.current = null;
        setSelectedFormId(formId);
      }
      toast.success(wasCreating ? "Skjema opprettet." : "Skjema lagret.");
      setEditorOpen(false);
    } catch (error) {
      if (wasCreating && createdFormId) {
        setIsCreatingNewForm(false);
        setSelectedFormId(createdFormId);
        selectedFormIdBeforeCreateRef.current = null;
      }
      toast.error(error instanceof Error ? error.message : "Kunne ikke lagre skjema.");
    }
  }

  async function handleToggleTemplate(enabled: boolean) {
    if (!activeFormId) return;
    try {
      await publishTemplate({ formId: activeFormId, enabled });
      toast.success(
        enabled ? "Skjemaet kan nå brukes som mal." : "Skjemaet er ikke lenger delt som mal.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke oppdatere malstatus.");
    }
  }

  async function handleActivateTemplate() {
    if (!activeFormId || !resolvedTargetWorkspaceId) return;
    try {
      await activateTemplate({
        formId: activeFormId,
        targetWorkspaceId: resolvedTargetWorkspaceId,
      });
      toast.success("Skjemaet er aktivert i valgt arbeidsområde.");
      window.open(`/w/${resolvedTargetWorkspaceId}/skjemaer`, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke aktivere skjemaet.");
    }
  }

  async function handleDeactivateActivation(activationId: Id<"intakeFormActivations">) {
    try {
      await deactivateActivation({ activationId });
      toast.success("Aktiveringen er slått av.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke deaktivere skjemaet.");
    }
  }

  async function handleSetFormStatus(nextStatus: "draft" | "published") {
    if (!activeFormId) return;
    try {
      await setFormStatus({
        formId: activeFormId,
        status: nextStatus,
      });
      setStatus(nextStatus);
      toast.success(
        nextStatus === "published"
          ? "Skjemaet er publisert."
          : "Skjemaet er avpublisert og satt tilbake til utkast.",
      );
    } catch (error) {
      toast.error(
        formatUserFacingError(
          error,
          "Kunne ikke oppdatere skjema-status. Prøv igjen.",
        ),
      );
    }
  }

  async function handleFormOrgUnitChange(value: string) {
    if (!activeFormId) return;
    try {
      await setFormOrgUnit({
        formId: activeFormId,
        orgUnitId: value === "" ? null : (value as Id<"orgUnits">),
      });
      toast.success("Organisasjonsenhet lagret.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Kunne ikke lagre organisasjonsenhet.",
      );
    }
  }

  async function handleSaveIntegrations() {
    if (!activeFormId) return;
    try {
      let nextTemplateId = linkedRosTemplateId;
      if (rosIntegrationEnabled && !nextTemplateId) {
        if ((rosTemplates?.length ?? 0) > 0) {
          const preferred = rosTemplates.find(
            (t) => t.name === RPA_INTAKE_ROS_TEMPLATE_NAME,
          );
          nextTemplateId = preferred?._id ?? rosTemplates[0]!._id;
        } else {
          nextTemplateId = await createRosTemplate({
            workspaceId,
            name: RPA_INTAKE_ROS_TEMPLATE_NAME,
            description: RPA_INTAKE_ROS_TEMPLATE_DESCRIPTION,
            rowAxisTitle: RPA_INTAKE_ROS_ROW_AXIS,
            colAxisTitle: RPA_INTAKE_ROS_COL_AXIS,
            rowLabels: [...RPA_INTAKE_ROS_ROW_LABELS],
            colLabels: [...DEFAULT_ROS_COL_LABELS],
            rowDescriptions: [...RPA_INTAKE_ROS_ROW_DESCRIPTIONS],
          });
        }
      }
      await updateFormIntegrations({
        formId: activeFormId,
        rosIntegrationEnabled,
        linkedRosTemplateId: rosIntegrationEnabled ? nextTemplateId ?? null : null,
      });
      setIntegrationDrafts((prev) => ({
        ...prev,
        [activeFormId]: {
          rosIntegrationEnabled,
          linkedRosTemplateId: rosIntegrationEnabled ? nextTemplateId ?? null : null,
        },
      }));
      toast.success(
        rosIntegrationEnabled
          ? "Skjemaet er nå koblet til vurdering og risikoanalyse."
          : "Koblingen til risikoanalyse er slått av. Vurdering opprettes fortsatt ved godkjenning.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke lagre koblingen til ROS-mal.",
      );
    }
  }

  async function handleCreateLinkedRosTemplate() {
    if (!activeFormId) return;
    try {
      const templateId = await createRosTemplate({
        workspaceId,
        name: RPA_INTAKE_ROS_TEMPLATE_NAME,
        description: RPA_INTAKE_ROS_TEMPLATE_DESCRIPTION,
        rowAxisTitle: RPA_INTAKE_ROS_ROW_AXIS,
        colAxisTitle: RPA_INTAKE_ROS_COL_AXIS,
        rowLabels: [...RPA_INTAKE_ROS_ROW_LABELS],
        colLabels: [...DEFAULT_ROS_COL_LABELS],
        rowDescriptions: [...RPA_INTAKE_ROS_ROW_DESCRIPTIONS],
      });
      await updateFormIntegrations({
        formId: activeFormId,
        rosIntegrationEnabled: true,
        linkedRosTemplateId: templateId,
      });
      setIntegrationDrafts((prev) => ({
        ...prev,
        [activeFormId]: {
          rosIntegrationEnabled: true,
          linkedRosTemplateId: templateId,
        },
      }));
      toast.success("RPA-tilpasset ROS-mal opprettet og koblet til skjemaet.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke opprette ROS-mal for skjemaet.",
      );
    }
  }

  async function handleArchiveForm() {
    if (!activeFormId || !selectedForm) return;
    const formId = activeFormId;
    const formTitle = selectedForm.title;
    const nextVisibleFormId =
      forms.find((form) => form._id !== formId)?._id ?? null;

    setPendingDeletedFormIds((prev) =>
      prev.includes(formId) ? prev : [...prev, formId],
    );
    setSelectedFormId(nextVisibleFormId);
    setEditorOpen(false);
    setSettingsOpen(false);

    toastDeleteWithUndo({
      title: "Sletter skjema",
      itemLabel: formTitle,
      onCommit: async () => {
        await archiveForm({ formId });
        setPendingDeletedFormIds((prev) => prev.filter((id) => id !== formId));
      },
      onFailed: () => {
        setPendingDeletedFormIds((prev) => prev.filter((id) => id !== formId));
        setSelectedFormId(formId);
      },
      onCancel: () => {
        setPendingDeletedFormIds((prev) => prev.filter((id) => id !== formId));
        setSelectedFormId(formId);
      },
    });
  }

  async function handleCreateLink() {
    if (!activeFormId) return;
    try {
      const expires = new Date(expiresAt).getTime();
      const result = await createLink({
        formId: activeFormId,
        expiresAt: expires,
        maxResponses: maxResponses.trim() ? Number(maxResponses) : undefined,
        restrictedAccessMode: accessMode,
      });
      await navigator.clipboard.writeText(
        `${window.location.origin}/f/${result.token}`,
      );
      toast.success("Lenke opprettet og kopiert.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke opprette lenke.");
    }
  }

  async function handleApprove() {
    if (!selectedSubmissionId || !submissionDetail) return;
    if (submissionDetail.submission.status === "approved") {
      toast.error("Forslaget er allerede godkjent.");
      return;
    }
    const effectivePayload =
      reviewPayload ?? submissionDetail.submission.generatedAssessmentDraft.payload;
    const effectiveTitle =
      reviewTitle ?? submissionDetail.submission.generatedAssessmentDraft.title;
    try {
      const result = await approveSubmission({
        submissionId: selectedSubmissionId,
        generatedAssessmentDraft: {
          title: effectiveTitle,
          payload: effectivePayload,
          autoFilledFields:
            submissionDetail.submission.generatedAssessmentDraft.autoFilledFields,
        },
        createRos:
          createRos ??
          (Boolean(submissionDetail.form?.rosIntegrationEnabled) &&
            submissionDetail.submission.generatedRosSuggestion.shouldCreateRos),
      });
      toast.success("Forslaget er godkjent.");
      setReviewOpen(false);
      setGithubIntakeDialogOpen(false);
      setSelectedSubmissionId(null);
      if (result.assessmentId) {
        window.location.href = `/w/${workspaceId}/a/${result.assessmentId}`;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke godkjenne forslaget.");
    }
  }

  async function handleReject() {
    if (!selectedSubmissionId || !submissionDetail) return;
    if (submissionDetail.submission.status === "approved") {
      toast.error("Godkjente forslag kan ikke avslås.");
      return;
    }
    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      toast.error("Skriv en kort begrunnelse før du avslår forslaget.");
      return;
    }
    try {
      await rejectSubmission({
        submissionId: selectedSubmissionId,
        reason: trimmedReason,
      });
      toast.success("Forslaget er avslått.");
      setReviewOpen(false);
      setGithubIntakeDialogOpen(false);
      setSelectedSubmissionId(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Kunne ikke avslå forslaget. Prøv igjen med en kort begrunnelse.",
      );
    }
  }

  async function openSubmissionForReview(submission: {
    _id: Id<"intakeSubmissions">;
    status: SubmissionSummary["status"];
  }) {
    setSelectedSubmissionId(submission._id);
    setReviewTitle(null);
    setReviewPayload(null);
    setCreateRos(null);
    setRejectionReason("");
    setReviewOpen(true);
    if (submission.status === "submitted") {
      await markUnderReview({ submissionId: submission._id });
    }
  }

  function handleRemoveSubmission(submission: {
    _id: Id<"intakeSubmissions">;
    generatedAssessmentDraft: { title: string };
  }) {
    const submissionId = submission._id;
    setPendingDeletedSubmissionIds((prev) =>
      prev.includes(submissionId) ? prev : [...prev, submissionId],
    );
    if (selectedSubmissionId === submissionId) {
      setReviewOpen(false);
      setGithubIntakeDialogOpen(false);
      setSelectedSubmissionId(null);
    }
    toastDeleteWithUndo({
      title: "Sletter forslag",
      itemLabel: submission.generatedAssessmentDraft.title,
      onCommit: async () => {
        await removeSubmission({ submissionId });
        setPendingDeletedSubmissionIds((prev) =>
          prev.filter((id) => id !== submissionId),
        );
      },
      onFailed: () => {
        setPendingDeletedSubmissionIds((prev) =>
          prev.filter((id) => id !== submissionId),
        );
      },
      onCancel: () => {
        setPendingDeletedSubmissionIds((prev) =>
          prev.filter((id) => id !== submissionId),
        );
      },
    });
  }

  const canDeleteIntakeSubmissions =
    myWorkspaceMembership !== undefined &&
    myWorkspaceMembership !== null &&
    myWorkspaceMembership.role !== "viewer";

  const pendingCount = submissions.filter(
    (submission) => submission.status === "submitted" || submission.status === "under_review",
  ).length;
  const formSearchLower = formSearch.trim().toLowerCase();
  const submissionSearchLower = submissionSearch.trim().toLowerCase();
  const formsForSidebarDisplay = formsForSidebarList.filter((form) => {
    if (formStatusFilter !== "all" && form.status !== formStatusFilter) {
      return false;
    }
    if (!formSearchLower) return true;
    const org = form.orgUnitId ? orgUnitNameById.get(form.orgUnitId) ?? "" : "";
    return (
      form.title.toLowerCase().includes(formSearchLower) ||
      org.toLowerCase().includes(formSearchLower)
    );
  });
  const queueFormFilterTitle = queueFormFilter
    ? forms.find((f) => f._id === queueFormFilter)?.title ?? "valgt skjema"
    : null;
  const submissionsForQueue = submissions.filter((submission) => {
    if (queueFormFilter && submission.formId !== queueFormFilter) {
      return false;
    }
    if (submissionStatusFilter !== "all" && submission.status !== submissionStatusFilter) {
      return false;
    }
    if (!submissionSearchLower) return true;
    return (
      submission.formTitle.toLowerCase().includes(submissionSearchLower) ||
      submission.generatedAssessmentDraft.title
        .toLowerCase()
        .includes(submissionSearchLower)
    );
  });

  function openForslagForForm(formId: Id<"intakeForms">) {
    setQueueFormFilter(formId);
    setPageTab("forslag");
  }
  useEffect(() => {
    const allowed = new Set(submissionsForQueue.map((s) => s._id));
    setSelectedQueueSubmissionIds((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      if (next.length === prev.length) {
        let same = true;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i] !== next[i]) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [submissionsForQueue]);
  const selectedQueueRows = useMemo(() => {
    if (selectedQueueSubmissionIds.length === 0) return [];
    const picked = new Set(selectedQueueSubmissionIds);
    return submissionsForQueue.filter((s) => picked.has(s._id));
  }, [selectedQueueSubmissionIds, submissionsForQueue]);
  const selectedQueueUnderReviewCount = selectedQueueRows.filter(
    (s) => s.status === "submitted",
  ).length;
  const toggleQueueSubmission = (id: Id<"intakeSubmissions">) => {
    setSelectedQueueSubmissionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  async function markSelectedQueueUnderReview() {
    if (selectedQueueSubmissionIds.length === 0) return;
    const targets = selectedQueueRows.filter((s) => s.status === "submitted");
    if (targets.length === 0) {
      toast.message("Ingen nye forslag i utvalget.");
      return;
    }
    await Promise.all(targets.map((s) => markUnderReview({ submissionId: s._id })));
    toast.success(`${targets.length} forslag markert som under vurdering.`);
  }
  async function deleteSelectedQueueRows() {
    if (selectedQueueSubmissionIds.length === 0) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Slette ${selectedQueueSubmissionIds.length} valgte forslag permanent?`,
      )
    ) {
      return;
    }
    await Promise.all(
      selectedQueueSubmissionIds.map((submissionId) =>
        removeSubmission({ submissionId }),
      ),
    );
    setSelectedQueueSubmissionIds([]);
    toast.success("Valgte forslag er slettet.");
  }
  const activeFormResponseRows = activeFormId
    ? submissions.filter((submission) => submission.formId === activeFormId)
    : [];
  const rejectionReasonMissing = rejectionReason.trim().length === 0;

  const renderSubmissionGithubStrip = (submission: SubmissionSummary) => {
    const ghKind = submissionGithubKind(submission);
    const showGithubRow =
      Boolean(workspaceDocQuery?.githubProjectNodeId?.trim()) || ghKind !== null;
    if (!showGithubRow) {
      return null;
    }
    if (ghKind === "issue") {
      return (
        <div className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border/50 bg-muted/15 px-3 py-2.5 text-sm">
          <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">GitHub:</span>
          <Link
            href={`https://github.com/${submission.githubRepoFullName}/issues/${submission.githubIssueNumber}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1 font-medium text-primary underline"
          >
            <span className="truncate">
              {submission.githubRepoFullName}#{submission.githubIssueNumber}
            </span>
            <ExternalLink className="size-3.5 shrink-0" />
          </Link>
        </div>
      );
    }
    if (ghKind === "draft") {
      return (
        <div className="mx-3 mb-3 flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/15 px-3 py-2.5 text-xs text-muted-foreground">
          <GitBranch className="size-3.5 shrink-0" />
          Utkast på GitHub-prosjekttavle
        </div>
      );
    }
    if (!canCreateIntakeGithubIssue) {
      return null;
    }
    return (
      <div className="border-primary/20 bg-muted/10 mx-3 mb-3 flex flex-col gap-3 rounded-2xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-xl">
            <GitBranch className="text-primary size-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">GitHub (valgfritt)</p>
            <p className="text-muted-foreground text-xs leading-snug">
              Kobler forslaget til prosjekt-tavlen. Godkjenning og vurdering gjør du i gjennomgang over.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 rounded-xl"
          onClick={async (e) => {
            e.stopPropagation();
            e.preventDefault();
            setSelectedSubmissionId(submission._id);
            setReviewTitle(null);
            setReviewPayload(null);
            setCreateRos(null);
            setRejectionReason("");
            setGithubDialogOpenVersion((v) => v + 1);
            setGithubIntakeDialogOpen(true);
            if (submission.status === "submitted") {
              await markUnderReview({ submissionId: submission._id });
            }
          }}
        >
          <GitBranch className="size-4" />
          Legg til
        </Button>
      </div>
    );
  };

  if (formsQuery === undefined || submissionsQuery === undefined) {
    return <p className="text-sm text-muted-foreground">Laster skjemaer …</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Skjemaer
          </h1>
          <p className="text-sm text-muted-foreground">
            Samle inn forslag og gjør dem om til prosesser.
          </p>
          <p className="text-muted-foreground text-xs">
            Steg 1 av 7 · Identifisering ·{" "}
            <Link
              href={`/w/${workspaceId}#rpa-livssyklus`}
              className="text-foreground font-medium underline-offset-2 hover:underline"
            >
              Se hele livssyklusen
            </Link>
          </p>
        </div>
        <Button
          type="button"
          className="h-11 shrink-0 gap-2 rounded-xl px-5 text-sm font-medium"
          onClick={handleCreateForm}
        >
          <Plus className="size-4" />
          Nytt skjema
        </Button>
      </header>

      <nav
        className="inline-flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-full border border-border/50 bg-background p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Skjemaer eller forslag"
      >
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "skjemaer"}
          onClick={() => setPageTab("skjemaer")}
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors sm:h-9",
            pageTab === "skjemaer"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Skjemaer
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
              pageTab === "skjemaer"
                ? "bg-background/20 text-background"
                : "bg-muted text-muted-foreground",
            )}
          >
            {forms.length}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "forslag"}
          onClick={() => setPageTab("forslag")}
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors sm:h-9",
            pageTab === "forslag"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Forslag
          {pendingCount > 0 ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
                pageTab === "forslag"
                  ? "bg-background/20 text-background"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {pendingCount}
            </span>
          ) : null}
        </button>
      </nav>

      {pageTab === "skjemaer" ? (
        <section className="space-y-3">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput
                value={formSearch}
                onChange={(e) => setFormSearch(e.target.value)}
                placeholder="Søk skjema eller enhet …"
                className="h-9 w-full rounded-full sm:max-w-xs"
                aria-label="Søk i skjemaer"
              />
              <select
                className="border-input bg-background h-9 rounded-full border px-3 text-xs sm:w-44"
                value={formStatusFilter}
                onChange={(e) =>
                  setFormStatusFilter(
                    e.target.value as "all" | "draft" | "published",
                  )
                }
                aria-label="Filtrer skjemaer på status"
              >
                <option value="all">Alle statuser</option>
                <option value="draft">Utkast</option>
                <option value="published">Publisert</option>
              </select>
            </div>
            {forms.length === 0 ? (
              <div className="border-border/60 bg-muted/10 rounded-2xl border border-dashed p-6 text-center">
                <FileText className="text-muted-foreground mx-auto mb-2 size-6" />
                <p className="font-medium">Ingen skjemaer ennå</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Trykk «Nytt skjema» over.
                </p>
              </div>
            ) : formsForSidebarDisplay.length === 0 ? (
              formSearchLower || formStatusFilter !== "all" ? (
                <p className="text-muted-foreground px-1 text-sm">
                  Ingen treff i filteret. Prøv et annet søk eller status.
                </p>
              ) : null
            ) : (
              <div className="flex flex-col gap-2">
                {formsForSidebarDisplay.map((form) => {
                  const statusLabel =
                    form.status === "published"
                      ? "Publisert"
                      : form.status === "archived"
                        ? "Arkivert"
                        : "Utkast";
                  const selected = form._id === selectedForm?._id;
                  return (
                    <button
                      key={form._id}
                      type="button"
                      onClick={() => selectWorkspaceForm(form._id)}
                      className={cn(
                        "rounded-2xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        selected
                          ? "border-foreground/20 bg-muted/30 shadow-sm"
                          : "border-border/50 hover:border-border hover:bg-muted/15",
                      )}
                    >
                      <div className="flex min-h-10 items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate font-medium leading-tight">
                              {form.title}
                            </p>
                            {form.isTemplate ? (
                              <Badge
                                variant="outline"
                                className="hidden shrink-0 sm:inline-flex"
                              >
                                Mal
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs tabular-nums">
                            {form.questionCount} spørsmål · {form.responseCount}{" "}
                            svar
                            {form.orgUnitId
                              ? ` · ${orgUnitNameById.get(form.orgUnitId) ?? "Org."}`
                              : ""}
                          </p>
                        </div>
                        <Badge
                          variant={
                            form.status === "published" ? "secondary" : "outline"
                          }
                          className="shrink-0 text-[10px]"
                        >
                          {statusLabel}
                        </Badge>
                        <ChevronRight
                          className="text-muted-foreground size-4 shrink-0 opacity-50"
                          aria-hidden
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedForm ? (
              <div className="relative z-10 overflow-hidden rounded-2xl border border-border/60 bg-card">
                <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate font-heading text-lg font-semibold tracking-tight">
                          {selectedForm.title}
                        </p>
                        <Badge
                          variant={
                            selectedForm.status === "published"
                              ? "secondary"
                              : "outline"
                          }
                          className="shrink-0"
                        >
                          {selectedForm.status === "published"
                            ? "Publisert"
                            : selectedForm.status === "archived"
                              ? "Arkivert"
                              : "Utkast"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm tabular-nums">
                        {selectedForm.questionCount} spørsmål ·{" "}
                        <button
                          type="button"
                          className="text-foreground font-medium underline-offset-2 hover:underline"
                          onClick={() => openForslagForForm(selectedForm._id)}
                        >
                          {activeFormResponseRows.length} svar
                        </button>
                        {links.length > 0 ? ` · ${links.length} lenker` : ""}
                      </p>
                      {selectedForm.orgUnitId ? (
                        <p className="text-muted-foreground truncate text-xs">
                          {orgUnitNameById.get(selectedForm.orgUnitId) ??
                            "Organisasjonsenhet"}
                        </p>
                      ) : null}
                    </div>
                    <div className="relative z-20 shrink-0">
                      <Button
                        ref={formMoreBtnRef}
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-xl"
                        aria-label="Flere handlinger"
                        aria-expanded={formMoreOpen}
                        aria-haspopup="menu"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormMoreOpen((v) => !v);
                        }}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                      {formMoreOpen && formMoreMenuPos
                        ? createPortal(
                            <>
                              <button
                                type="button"
                                className="fixed inset-0 z-[220] cursor-default"
                                aria-label="Lukk meny"
                                onClick={() => setFormMoreOpen(false)}
                              />
                              <div
                                role="menu"
                                className="bg-popover fixed z-[230] min-w-[12.5rem] -translate-y-full rounded-xl border border-border/60 p-1 shadow-2xl"
                                style={{
                                  top: formMoreMenuPos.top,
                                  right: formMoreMenuPos.right,
                                }}
                              >
                                {selectedForm.status === "published" ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm"
                                    onClick={() => {
                                      setFormMoreOpen(false);
                                      void handleSetFormStatus("draft");
                                    }}
                                  >
                                    Avpubliser
                                  </button>
                                ) : selectedForm.status === "draft" ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm"
                                    disabled={selectedForm.questionCount === 0}
                                    onClick={() => {
                                      setFormMoreOpen(false);
                                      void handleSetFormStatus("published");
                                    }}
                                  >
                                    Publiser
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm"
                                  onClick={() => {
                                    setFormMoreOpen(false);
                                    setSettingsOpen(true);
                                  }}
                                >
                                  <Settings2
                                    className="size-3.5 opacity-70"
                                    aria-hidden
                                  />
                                  Innstillinger og lenker
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm"
                                  onClick={() => {
                                    setFormMoreOpen(false);
                                    openForslagForForm(selectedForm._id);
                                  }}
                                >
                                  Se forslag
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-destructive"
                                  onClick={() => {
                                    setFormMoreOpen(false);
                                    void handleArchiveForm();
                                  }}
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                  Arkiver
                                </button>
                              </div>
                            </>,
                            document.body,
                          )
                        : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl"
                      disabled={!editorData}
                      onClick={() => {
                        primeEditorState(editorData);
                        setEditorSection("questions");
                        setEditorOpen(true);
                      }}
                    >
                      Rediger skjema
                    </Button>
                    {activeFormResponseRows.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => openForslagForForm(selectedForm._id)}
                      >
                        Se svar
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : isCreatingNewForm ? (
              <div className="border-border/60 bg-muted/15 mt-3 rounded-2xl border border-dashed p-5 text-center sm:text-left">
                <p className="text-sm font-medium">Du oppretter et nytt skjema</p>
                <p className="text-muted-foreground mt-1 text-sm leading-snug">
                  Fullfør stegene i vinduet. Ingenting lagres før du trykker «Opprett
                  skjema».
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput
                value={submissionSearch}
                onChange={(e) => setSubmissionSearch(e.target.value)}
                placeholder="Søk i forslag …"
                className="h-9 w-full rounded-full sm:max-w-xs"
                aria-label="Søk i forslag"
              />
              <span className="text-xs tabular-nums text-muted-foreground">
                {submissionsForQueue.length} i kø
              </span>
            </div>
            {queueFormFilter ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-muted/40 text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
                  Fra «{queueFormFilterTitle}»
                  <button
                    type="button"
                    className="text-foreground font-medium underline-offset-2 hover:underline"
                    onClick={() => setQueueFormFilter(null)}
                  >
                    Fjern
                  </button>
                </span>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSubmissionStatusFilter("all")}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  submissionStatusFilter === "all"
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground",
                )}
              >
                Alle
              </button>
              <button
                type="button"
                onClick={() => setSubmissionStatusFilter("submitted")}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  submissionStatusFilter === "submitted"
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground",
                )}
              >
                Nye
              </button>
              <button
                type="button"
                onClick={() => setSubmissionStatusFilter("under_review")}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  submissionStatusFilter === "under_review"
                    ? "border-amber-500/40 bg-amber-500/10 text-foreground"
                    : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground",
                )}
              >
                Under vurdering
              </button>
            </div>
            {selectedQueueSubmissionIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/50 bg-muted/[0.08] px-3 py-2">
                <button
                  type="button"
                  className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() =>
                    setSelectedQueueSubmissionIds(
                      selectedQueueSubmissionIds.length ===
                        submissionsForQueue.length
                        ? []
                        : submissionsForQueue.map((s) => s._id),
                    )
                  }
                >
                  {selectedQueueSubmissionIds.length === submissionsForQueue.length
                    ? "Fjern alle"
                    : "Velg alle"}
                </button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {selectedQueueSubmissionIds.length} valgt
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={selectedQueueUnderReviewCount === 0}
                    onClick={() => void markSelectedQueueUnderReview()}
                  >
                    Marker under vurdering ({selectedQueueUnderReviewCount})
                  </Button>
                  {canDeleteIntakeSubmissions ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void deleteSelectedQueueRows()}
                    >
                      Slett valgte
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {submissions.length === 0 ? (
              <div className="border-border/60 bg-muted/10 rounded-2xl border border-dashed p-6 text-center">
                <ClipboardCheck className="text-muted-foreground mx-auto mb-2 size-6" />
                <p className="font-medium">Ingen forslag i køen</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  De dukker opp her når noen sender inn.
                </p>
              </div>
            ) : submissionsForQueue.length === 0 ? (
              <div className="border-border/60 bg-muted/10 rounded-2xl border border-dashed p-6 text-center">
                <ClipboardCheck className="text-muted-foreground mx-auto mb-2 size-6" />
                <p className="font-medium">Ingen treff</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Endre filter eller søk for å vise flere forslag.
                </p>
              </div>
            ) : (
              submissionsForQueue.map((submission) => (
                <div
                  key={submission._id}
                  className="flex items-start gap-2 rounded-2xl border border-transparent p-1"
                >
                  <label className="mt-3 flex shrink-0 cursor-pointer items-center px-1">
                    <input
                      type="checkbox"
                      checked={selectedQueueSubmissionIds.includes(submission._id)}
                      onChange={() => toggleQueueSubmission(submission._id)}
                      className="size-4 rounded border-border text-primary focus:ring-ring"
                      aria-label={`Velg forslag ${submission.generatedAssessmentDraft.title}`}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <IntakeSubmissionQueueCard
                      submission={submission}
                      subtitle={`${submission.formTitle} · ${new Date(submission.submittedAt).toLocaleString("nb-NO")}`}
                      onOpenReview={() => void openSubmissionForReview(submission)}
                      onDelete={() => handleRemoveSubmission(submission)}
                      canDelete={canDeleteIntakeSubmissions}
                      extraBadges={
                        <>
                          {submission.personDataSignal ? (
                            <Badge variant="outline">Persondata</Badge>
                          ) : null}
                          {submission.generatedRosSuggestion.shouldCreateRos ? (
                            <Badge variant="outline">ROS-forslag</Badge>
                          ) : null}
                          {submission.generatedRosSuggestion.shouldCreateRos &&
                          submission.generatedRosSuggestion.risks.length > 0 ? (
                            <Badge variant="outline">
                              {submission.generatedRosSuggestion.risks.length} risikoer
                            </Badge>
                          ) : null}
                        </>
                      }
                      githubSlot={renderSubmissionGithubStrip(submission)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open && isCreatingNewForm) {
            setIsCreatingNewForm(false);
            setSelectedFormId(
              selectedFormIdBeforeCreateRef.current ?? forms[0]?._id ?? null,
            );
            selectedFormIdBeforeCreateRef.current = null;
          }
        }}
      >
        <DialogContent
          size="6xl"
          className="max-h-[min(92vh,85vh)]"
          titleId="intake-editor-title"
        >
          <DialogHeader>
            <p
              id="intake-editor-title"
              className="font-heading text-xl font-semibold tracking-tight sm:text-2xl"
            >
              {isCreatingNewForm ? "Nytt skjema" : "Rediger skjema"}
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {editorSection === "basics"
                ? "Gi skjemaet et navn. Du kan legge til spørsmål etterpå."
                : editorSection === "questions"
                  ? "Bygg spørsmålene. Avanserte valg ligger under Innstillinger."
                  : "Hvordan skjemaet vises for den som svarer."}
            </p>
            <div
              role="tablist"
              aria-label="Skjemaredigering"
              className="bg-muted/40 mt-3 inline-flex max-w-full flex-wrap gap-1 rounded-full border border-border/50 p-1"
            >
              {(
                [
                  ["basics", "1. Navn"],
                  ["questions", "2. Spørsmål"],
                  ["settings", "3. Innstillinger"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={editorSection === id}
                  onClick={() => setEditorSection(id)}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-sm font-medium transition-colors touch-manipulation",
                    editorSection === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </DialogHeader>
          <DialogBody className="space-y-5">
            {editorSection === "basics" ? (
              <div className="mx-auto max-w-xl space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="intake-form-title" className="text-sm font-medium">
                    Navn
                  </Label>
                  <Input
                    id="intake-form-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="F.eks. Innmelding av ny prosess"
                    className="h-12 rounded-xl text-base"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="intake-form-description"
                    className="text-sm font-medium"
                  >
                    Beskrivelse{" "}
                    <span className="text-muted-foreground font-normal">
                      (valgfritt)
                    </span>
                  </Label>
                  <Textarea
                    id="intake-form-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Kort hjelpetekst til dem som fyller ut."
                    className="min-h-[6rem] resize-y rounded-xl text-base"
                  />
                </div>
                <div className="bg-muted/30 rounded-2xl border border-border/50 p-4">
                  <p className="text-sm font-medium">Vil du starte fra en mal?</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Ellers legger du til spørsmål selv i neste steg.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-xl"
                    onClick={() => setIntakeTemplatePickerOpen(true)}
                  >
                    <Sparkles className="size-3.5" />
                    Velg eksempelmal
                  </Button>
                </div>
              </div>
            ) : null}

            {editorSection === "settings" ? (
              <div className="mx-auto max-w-lg space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Layout</Label>
                  <select
                    className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm"
                    value={layoutMode}
                    onChange={(event) =>
                      setLayoutMode(
                        event.target.value as "one_per_screen" | "grouped",
                      )
                    }
                  >
                    <option value="one_per_screen">
                      Steg for steg (flere spørsmål per side)
                    </option>
                    <option value="grouped">Alt på én side</option>
                  </select>
                </div>
                {layoutMode === "one_per_screen" ? (
                  <div className="space-y-2">
                    <Label
                      className="text-sm font-medium"
                      htmlFor="intake-questions-per-page"
                    >
                      Spørsmål per side
                    </Label>
                    <Input
                      id="intake-questions-per-page"
                      type="number"
                      min={1}
                      max={25}
                      className="h-11 rounded-xl"
                      value={questionsPerPage}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        if (!Number.isFinite(parsed)) return;
                        setQuestionsPerPage(Math.min(25, Math.max(1, parsed)));
                      }}
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Bekreftelse til svarer
                  </Label>
                  <select
                    className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm"
                    value={confirmationMode}
                    onChange={(event) =>
                      setConfirmationMode(
                        event.target.value as "none" | "email_copy",
                      )
                    }
                  >
                    <option value="none">Ingen bekreftelse</option>
                    <option value="email_copy">
                      Send kopi av svarene til oppgitt e-post
                    </option>
                  </select>
                </div>
              </div>
            ) : null}

            {editorSection === "questions" ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Spørsmål</p>
                  <p className="text-muted-foreground text-sm">
                    {questions.length} i skjemaet · hold dem korte og konkrete
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setIntakeTemplatePickerOpen(true)}
                  >
                    <Sparkles className="size-3.5" />
                    Mal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      const nextQuestion = emptyQuestion();
                      updateQuestions((prev) => [...prev, nextQuestion]);
                      setExpandedQuestionIds((prev) => [
                        ...prev,
                        nextQuestion.id,
                      ]);
                    }}
                  >
                    <Plus className="size-4" />
                    Nytt spørsmål
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {questions.map((question, index) => {
                  const warning = plainLanguageWarnings.find((item) => item.id === question.id);
                  const availableParentQuestions = questions
                    .slice(0, index)
                    .filter((candidate) => canHaveFollowUps(candidate.questionType));
                  const selectedParent = availableParentQuestions.find(
                    (candidate) => candidate.id === question.visibilityRule?.parentQuestionKey,
                  );
                  const isExpanded = expandedQuestionIds.includes(question.id);
                  const mappingCount = question.mappingTargets.length;
                  const mappingSectionOpen = mappingSectionOpenIds.includes(
                    question.id,
                  );
                  const childFollowUps = questions.filter(
                    (candidate) => candidate.visibilityRule?.parentQuestionKey === question.id,
                  );
                  return (
                    <div
                      key={question.id}
                      data-question-card-id={question.id}
                      className="rounded-[26px] border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          onClick={() => toggleQuestionExpanded(question.id)}
                        >
                          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {index + 1}
                          </div>
                          <div className="min-w-0 space-y-2">
                            <div>
                              <p className="truncate text-sm font-semibold">
                                {getQuestionHeadline(question, index)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {renderQuestionTypeLabel(question.questionType)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">
                                {question.required ? "Påkrevd" : "Valgfritt"}
                              </Badge>
                              {question.visibilityRule ? (
                                <Badge variant="secondary">Oppfølging</Badge>
                              ) : null}
                              <Badge variant="outline">
                                {mappingCount} kobling{mappingCount === 1 ? "" : "er"}
                              </Badge>
                            </div>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleQuestionExpanded(question.id)}
                            aria-label={isExpanded ? "Skjul spørsmål" : "Vis spørsmål"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              updateQuestions((prev) =>
                                prev.filter((item) => item.id !== question.id),
                              );
                              setExpandedQuestionIds((prev) =>
                                prev.filter((item) => item !== question.id),
                              );
                              setMappingSectionOpenIds((prev) =>
                                prev.filter((item) => item !== question.id),
                              );
                            }}
                            aria-label="Slett spørsmål"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="space-y-4 border-t border-border/50 px-4 py-4 sm:px-5">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                              <Label>Spørsmålstekst</Label>
                              <Input
                                data-question-label-input={question.id}
                                value={question.label}
                                onChange={(event) =>
                                  updateSingleQuestion(question.id, (item) => ({
                                    ...item,
                                    label: event.target.value,
                                  }))
                                }
                                placeholder="Hva gjør du i dag?"
                              />
                              {warning && warning.terms.length > 0 ? (
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                  Vurder enklere språk. Fant: {warning.terms.join(", ")}.
                                </p>
                              ) : null}
                            </div>
                            <div className="space-y-2">
                              <Label>Hjelpetekst</Label>
                              <Input
                                value={question.helpText ?? ""}
                                onChange={(event) =>
                                  updateSingleQuestion(question.id, (item) => ({
                                    ...item,
                                    helpText: event.target.value,
                                  }))
                                }
                                placeholder="Hjelpetekst som gjør spørsmålet lettere å forstå"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <select
                                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                                value={question.questionType}
                                onChange={(event) =>
                                  updateSingleQuestion(question.id, (item) => ({
                                    ...item,
                                    questionType:
                                      event.target.value as EditableQuestion["questionType"],
                                    options:
                                      event.target.value === "multiple_choice"
                                        ? item.options.length > 0
                                          ? item.options
                                          : [
                                              { id: crypto.randomUUID(), label: "Valg 1" },
                                              { id: crypto.randomUUID(), label: "Valg 2" },
                                            ]
                                        : [],
                                  }))
                                }
                              >
                                <option value="text">Tekst</option>
                                <option value="number">Tall</option>
                                <option value="multiple_choice">Flervalg</option>
                                <option value="scale">Skala 1-5</option>
                                <option value="yes_no">Ja / Nei</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 rounded-2xl border border-border/50 bg-muted/10 p-3">
                            <button
                              type="button"
                              className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition ${
                                question.required
                                  ? "bg-foreground text-background"
                                  : "border border-border bg-background text-foreground"
                              }`}
                              onClick={() =>
                                updateSingleQuestion(question.id, (item) => ({
                                  ...item,
                                  required: !item.required,
                                }))
                              }
                            >
                              {question.required ? "Påkrevd" : "Valgfritt"}
                            </button>
                            <p className="self-center text-xs text-muted-foreground">
                              Påkrevde spørsmål må besvares før innsending.
                            </p>
                          </div>

                          {question.questionType === "multiple_choice" ? (
                            <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/10 p-4">
                              <div>
                                <Label>Svaralternativer</Label>
                                <p className="text-xs text-muted-foreground">
                                  Velg korte svar som er lette for svareren å forstå.
                                </p>
                              </div>
                              <div className="space-y-2">
                                {question.options.map((option) => (
                                  <div key={option.id} className="flex gap-2">
                                    <Input
                                      value={option.label}
                                      onChange={(event) =>
                                        updateSingleQuestion(question.id, (item) => ({
                                          ...item,
                                          options: item.options.map((current) =>
                                            current.id === option.id
                                              ? { ...current, label: event.target.value }
                                              : current,
                                          ),
                                        }))
                                      }
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() =>
                                        updateSingleQuestion(question.id, (item) => ({
                                          ...item,
                                          options: item.options.filter(
                                            (current) => current.id !== option.id,
                                          ),
                                        }))
                                      }
                                    >
                                      Fjern
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    updateSingleQuestion(question.id, (item) => ({
                                      ...item,
                                      options: [
                                        ...item.options,
                                        { id: crypto.randomUUID(), label: "Nytt valg" },
                                      ],
                                    }))
                                  }
                                >
                                  <Plus className="size-4" />
                                  Legg til valg
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-3 rounded-2xl border border-border/50 bg-background p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <Label>Oppfølgingsspørsmål</Label>
                                <p className="text-xs text-muted-foreground">
                                  {question.visibilityRule
                                    ? "Dette spørsmålet vises bare når et tidligere svar matcher."
                                    : "Opprett oppfølgingsspørsmål som vises etter bestemte svar."}
                                </p>
                              </div>
                            {question.visibilityRule ? (
                              <Button
                                type="button"
                                variant="default"
                                className="rounded-full"
                                onClick={() => setFollowUpEnabled(question.id, false)}
                              >
                                Deaktiver oppfølging
                              </Button>
                            ) : canHaveFollowUps(question.questionType) ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => addFollowUpQuestion(question.id)}
                              >
                                <Plus className="size-4" />
                                Legg til oppfølgingsspørsmål
                              </Button>
                            ) : null}
                            </div>
                            {question.visibilityRule ? (
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Basert på spørsmål</Label>
                                  <select
                                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                                    value={question.visibilityRule.parentQuestionKey}
                                    onChange={(event) =>
                                      updateSingleQuestion(question.id, (item) => ({
                                        ...item,
                                        visibilityRule: createDefaultVisibilityRule(
                                          questions.find(
                                            (candidate) => candidate.id === event.target.value,
                                          ),
                                        ),
                                      }))
                                    }
                                  >
                                    {availableParentQuestions.map((candidate) => (
                                      <option key={candidate.id} value={candidate.id}>
                                        {candidate.label || "Uten spørsmålstekst"}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Vis når svaret er</Label>
                                  {selectedParent?.questionType === "yes_no" ? (
                                    <select
                                      className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                                      value={
                                        question.visibilityRule.match.kind === "yes_no" &&
                                        question.visibilityRule.match.value
                                          ? "yes"
                                          : "no"
                                      }
                                      onChange={(event) =>
                                        updateSingleQuestion(question.id, (item) =>
                                          item.visibilityRule
                                            ? {
                                                ...item,
                                                visibilityRule: {
                                                  ...item.visibilityRule,
                                                  match: {
                                                    kind: "yes_no",
                                                    value: event.target.value === "yes",
                                                  },
                                                },
                                              }
                                            : item,
                                        )
                                      }
                                    >
                                      <option value="yes">Ja</option>
                                      <option value="no">Nei</option>
                                    </select>
                                  ) : null}
                                  {selectedParent?.questionType === "multiple_choice" ? (
                                    <select
                                      className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                                      value={
                                        question.visibilityRule.match.kind === "multiple_choice"
                                          ? question.visibilityRule.match.optionId
                                          : selectedParent.options[0]?.id
                                      }
                                      onChange={(event) =>
                                        updateSingleQuestion(question.id, (item) =>
                                          item.visibilityRule
                                            ? {
                                                ...item,
                                                visibilityRule: {
                                                  ...item.visibilityRule,
                                                  match: {
                                                    kind: "multiple_choice",
                                                    optionId: event.target.value,
                                                  },
                                                },
                                              }
                                            : item,
                                        )
                                      }
                                    >
                                      {selectedParent.options.map((option) => (
                                        <option key={option.id} value={option.id}>
                                          {option.label || "Uten valgtekst"}
                                        </option>
                                      ))}
                                    </select>
                                  ) : null}
                                  {selectedParent?.questionType === "scale" ? (
                                    <select
                                      className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                                      value={
                                        question.visibilityRule.match.kind === "scale"
                                          ? question.visibilityRule.match.value
                                          : 4
                                      }
                                      onChange={(event) =>
                                        updateSingleQuestion(question.id, (item) =>
                                          item.visibilityRule
                                            ? {
                                                ...item,
                                                visibilityRule: {
                                                  ...item.visibilityRule,
                                                  match: {
                                                    kind: "scale",
                                                    value: Number(event.target.value),
                                                  },
                                                },
                                              }
                                            : item,
                                        )
                                      }
                                    >
                                      {[1, 2, 3, 4, 5].map((value) => (
                                        <option key={value} value={value}>
                                          {value}
                                        </option>
                                      ))}
                                    </select>
                                  ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground md:col-span-2">
                                  {describeVisibilityRule(question, questions) ??
                                    "Dette spørsmålet vises alltid."}
                                </p>
                              </div>
                            ) : !canHaveFollowUps(question.questionType) ? (
                              <div className="rounded-xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground">
                                Bare Ja / Nei, flervalg og skala kan styre oppfølgingslogikk.
                                Bruk en av disse hvis spørsmålet skal vise oppfølging.
                              </div>
                            ) : childFollowUps.length > 0 ? (
                              <div className="space-y-3 rounded-xl bg-muted/50 px-3 py-3">
                                <p className="text-xs font-medium text-foreground">
                                  {childFollowUps.length} oppfølgingsspørsmål koblet til dette
                                  spørsmålet
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {childFollowUps.map((child) => (
                                    <button
                                      key={child.id}
                                      type="button"
                                      className="rounded-full border border-border bg-background px-3 py-1 text-xs"
                                      onClick={() => {
                                        setExpandedQuestionIds((prev) =>
                                          prev.includes(child.id) ? prev : [...prev, child.id],
                                        );
                                        requestAnimationFrame(() => {
                                          requestAnimationFrame(() => {
                                            const childCard = document.querySelector<HTMLElement>(
                                              `[data-question-card-id="${child.id}"]`,
                                            );
                                            childCard?.scrollIntoView({
                                              behavior: "smooth",
                                              block: "nearest",
                                            });
                                            const childInput =
                                              document.querySelector<HTMLInputElement>(
                                                `[data-question-label-input="${child.id}"]`,
                                              );
                                            childInput?.focus();
                                            childInput?.select();
                                          });
                                        });
                                      }}
                                    >
                                      {child.label.trim() || "Nytt oppfølgingsspørsmål"}
                                    </button>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Klikk på et oppfølgingsspørsmål for å redigere spørsmålstekst og
                                  svar manuelt.
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground">
                                Klikk på «Legg til oppfølgingsspørsmål» for å opprette et nytt
                                spørsmål som kobles til dette og kan fylles ut manuelt.
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/10 p-4">
                            <button
                              type="button"
                              className="flex w-full items-start justify-between gap-3 rounded-xl text-left outline-none ring-offset-background transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring -m-1 p-1"
                              onClick={() => toggleMappingSectionOpen(question.id)}
                              aria-expanded={mappingSectionOpen}
                              aria-label={
                                mappingSectionOpen
                                  ? "Skjul koblinger"
                                  : "Vis koblinger"
                              }
                            >
                              <div className="min-w-0 space-y-1">
                                <p className="text-sm font-medium leading-none">
                                  Koblinger
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Velg hvilke felter dette spørsmålet skal fylle ut
                                  automatisk.
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                                {mappingCount > 0 && !mappingSectionOpen ? (
                                  <Badge variant="secondary" className="tabular-nums">
                                    {mappingCount}
                                  </Badge>
                                ) : null}
                                <ChevronDown
                                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                                    mappingSectionOpen ? "rotate-180" : ""
                                  }`}
                                />
                              </div>
                            </button>
                            {mappingSectionOpen ? (
                              <MappingTargetPicker
                                question={question}
                                onChange={(next) =>
                                  updateSingleQuestion(question.id, (item) => ({
                                    ...item,
                                    mappingTargets: next,
                                  }))
                                }
                              />
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            ) : null}
          </DialogBody>
          <DialogFooter className="flex flex-wrap justify-between gap-3 sm:gap-4">
            <div className="flex flex-wrap gap-2">
              {editorSection === "questions" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl px-5 sm:h-12"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="size-4" />
                  Forhåndsvis
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 min-w-[5.5rem] rounded-xl px-5 sm:h-12"
                onClick={() => setEditorOpen(false)}
              >
                Avbryt
              </Button>
              {editorSection === "basics" ? (
                <Button
                  type="button"
                  className="h-11 min-w-[10rem] rounded-xl px-6 text-base font-medium sm:h-12"
                  disabled={!title.trim()}
                  onClick={() => setEditorSection("questions")}
                >
                  Neste: Spørsmål
                </Button>
              ) : editorSection === "questions" && isCreatingNewForm ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl px-5 sm:h-12"
                    onClick={() => setEditorSection("settings")}
                  >
                    Innstillinger
                  </Button>
                  <Button
                    type="button"
                    className="h-11 min-w-[10rem] rounded-xl px-6 text-base font-medium sm:h-12"
                    disabled={!title.trim()}
                    onClick={() => void handleSaveForm()}
                  >
                    Opprett skjema
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  className="h-11 min-w-[10rem] rounded-xl px-6 text-base font-medium sm:h-12"
                  disabled={!title.trim()}
                  onClick={() => void handleSaveForm()}
                >
                  {isCreatingNewForm ? "Opprett skjema" : "Lagre"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={intakeTemplatePickerOpen} onOpenChange={setIntakeTemplatePickerOpen}>
        <DialogContent size="3xl" titleId="intake-template-picker-title">
          <DialogHeader>
            <p id="intake-template-picker-title" className="font-heading text-lg font-semibold">
              Velg eksempelmal
            </p>
            <p className="text-sm text-muted-foreground">
              Erstatter alle spørsmål i skjemaet med malen. Du kan redigere etterpå.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-6">
            {intakeTemplatesByCategory.map(([category, templates]) => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {category}
                </p>
                <div className="flex flex-col gap-2">
                  {templates.map((template) => (
                    <Button
                      key={template.id}
                      type="button"
                      variant="outline"
                      className="h-auto min-h-11 w-full min-w-0 shrink flex-col items-stretch gap-1 rounded-xl py-3 text-left whitespace-normal"
                      onClick={() => applyIntakeQuestionTemplate(template.buildQuestions)}
                    >
                      <span className="block w-full min-w-0 text-pretty font-medium break-words">
                        {template.title}
                      </span>
                      <span className="block w-full min-w-0 text-pretty text-xs font-normal leading-snug break-words text-muted-foreground">
                        {template.description}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIntakeTemplatePickerOpen(false)}
            >
              Avbryt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent
          size="2xl"
          fillViewport={settingsFillViewport}
          className={settingsFillViewport ? undefined : "max-h-[min(96dvh,56rem)] max-w-2xl"}
          titleId="intake-settings-title"
        >
          <DialogHeader className="sticky top-0 z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p id="intake-settings-title" className="font-heading text-lg font-semibold">
                  Innstillinger
                </p>
                <p className="text-muted-foreground truncate text-sm leading-snug">
                  {selectedForm?.title ?? "Velg et skjema først"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 rounded-full sm:size-10"
                aria-label="Lukk innstillinger"
                onClick={() => setSettingsOpen(false)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            {selectedForm ? (
              <nav
                className="mt-3 -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Innstillingsseksjoner"
              >
                {(
                  [
                    ["org", "Organisasjon"],
                    ["ros", "ROS"],
                    ["mal", "Mal"],
                    ["lenker", "Lenker"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={settingsSection === id}
                    onClick={() => setSettingsSection(id)}
                    className={cn(
                      "h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors sm:h-9 sm:px-3.5",
                      settingsSection === id
                        ? "bg-foreground text-background"
                        : "bg-muted/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            ) : null}
          </DialogHeader>
          <DialogBody className="space-y-5 overflow-x-hidden">
            {selectedForm ? (
              <>
                <section
                  className={cn(
                    "border-border/60 bg-card rounded-2xl border p-4 shadow-sm sm:p-5",
                    settingsSection !== "org" && "hidden",
                  )}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-1">
                      <h3 className="flex items-center gap-2 text-sm font-semibold leading-tight">
                        <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
                        Organisasjon
                      </h3>
                      <p className="text-muted-foreground text-xs leading-snug">
                        Knytt skjemaet til en enhet i organisasjonstreet — brukes i oversikter og
                        filtrering.
                      </p>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <Label className="text-sm" htmlFor="intake-form-org-unit">
                      Organisasjonsenhet
                    </Label>
                    <select
                      id="intake-form-org-unit"
                      className="border-input bg-background flex h-10 w-full rounded-xl border px-3 text-sm"
                      value={selectedFormOrgUnitId ?? ""}
                      onChange={(e) => void handleFormOrgUnitChange(e.target.value)}
                      disabled={orgUnitsQuery === undefined}
                    >
                      <option value="">— Ikke satt —</option>
                      {(orgUnitsQuery ?? []).map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-muted-foreground text-[11px] leading-snug">
                      Fjern koblingen før en enhet kan slettes fra organisasjonskartet.
                    </p>
                  </div>
                </section>

                <section
                  className={cn(
                    "border-border/60 bg-card rounded-2xl border p-4 shadow-sm sm:p-5",
                    settingsSection !== "ros" && "hidden",
                  )}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-semibold leading-tight">
                        Vurdering og ROS
                      </h3>
                      <p className="text-muted-foreground text-xs leading-snug">
                        Vurdering ved godkjenning. ROS er valgfritt.
                      </p>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="border-border/50 bg-muted/20 flex flex-col justify-between gap-2 rounded-xl border p-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Vurdering</p>
                        <p className="text-muted-foreground text-[11px] leading-snug">
                          Alltid ved godkjenning.
                        </p>
                      </div>
                      <Badge className="w-fit" variant="secondary">
                        Aktiv
                      </Badge>
                    </div>
                    <div className="border-border/50 bg-muted/20 flex flex-col justify-between gap-2 rounded-xl border p-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium">ROS</p>
                        <p className="text-muted-foreground text-[11px] leading-snug">
                          Slå på for ROS-mal og forslag.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-pressed={rosIntegrationEnabled}
                        className={`inline-flex h-9 w-fit shrink-0 items-center justify-center rounded-full px-4 text-sm font-medium transition ${
                          rosIntegrationEnabled
                            ? "bg-foreground text-background"
                            : "border border-border bg-background text-foreground hover:bg-muted/60"
                        }`}
                        onClick={() =>
                          activeFormId
                            ? setIntegrationDrafts((prev) => ({
                                ...prev,
                                [activeFormId]: {
                                  rosIntegrationEnabled: !rosIntegrationEnabled,
                                  linkedRosTemplateId,
                                },
                              }))
                            : undefined
                        }
                      >
                        {rosIntegrationEnabled ? "På" : "Av"}
                      </button>
                    </div>
                  </div>
                  {rosIntegrationEnabled ? (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm" htmlFor="settings-ros-template">
                            ROS-mal
                          </Label>
                          <select
                            id="settings-ros-template"
                            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            value={linkedRosTemplateId ?? ""}
                            onChange={(event) =>
                              activeFormId
                                ? setIntegrationDrafts((prev) => ({
                                    ...prev,
                                    [activeFormId]: {
                                      rosIntegrationEnabled,
                                      linkedRosTemplateId: event.target.value
                                        ? (event.target.value as Id<"rosTemplates">)
                                        : null,
                                    },
                                  }))
                                : undefined
                            }
                          >
                            <option value="">
                              {(rosTemplates?.length ?? 0) > 0
                                ? "Standard (første mal)"
                                : "Ingen mal"}
                            </option>
                            {rosTemplates.map((template) => (
                              <option key={template._id} value={template._id}>
                                {template.name}
                              </option>
                            ))}
                          </select>
                          <p className="text-muted-foreground text-[11px] leading-snug">
                            {linkedRosTemplate
                              ? linkedRosTemplate.name
                              : (rosTemplates?.length ?? 0) > 0
                                ? "Tom = første tilgjengelige mal."
                                : "Opprett standard-mal under."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl"
                            onClick={handleCreateLinkedRosTemplate}
                          >
                            Opprett standard ROS-mal
                          </Button>
                          <Button
                            type="button"
                            className="rounded-xl"
                            onClick={handleSaveIntegrations}
                          >
                            Lagre kobling
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Separator className="my-4" />
                      <div className="border-border/60 bg-muted/15 rounded-xl border border-dashed p-3">
                        <p className="text-muted-foreground text-xs leading-snug">
                          ROS er av. Slå på over for å velge mal.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl"
                            onClick={handleSaveIntegrations}
                          >
                            Lagre kobling
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </section>

                <section
                  className={cn(
                    "border-border/60 bg-card rounded-2xl border p-4 shadow-sm sm:p-5",
                    settingsSection !== "mal" && "hidden",
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-semibold leading-tight">Mal og aktivering</h3>
                      <p className="text-muted-foreground text-xs leading-snug">
                        Del som mal, deretter aktiver kopi i annet område.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={selectedForm.isTemplate ? "secondary" : "outline"}
                      className="w-full shrink-0 rounded-xl sm:w-auto"
                      disabled={Boolean(selectedForm.sourceTemplateFormId)}
                      onClick={() => handleToggleTemplate(!selectedForm.isTemplate)}
                    >
                      {selectedForm.isTemplate ? "Fjern som mal" : "Del som mal"}
                    </Button>
                  </div>
                  {selectedForm.sourceTemplateFormId ? (
                    <p className="text-muted-foreground mt-3 text-xs leading-snug">
                      Aktivert fra mal — ikke delt som ny mal her.
                    </p>
                  ) : (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-3">
                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <div className="min-w-0 space-y-2">
                            <Label className="text-sm" htmlFor="settings-activate-workspace">
                              Aktiver i arbeidsområde
                            </Label>
                            <select
                              id="settings-activate-workspace"
                              className="border-input bg-background h-10 w-full min-w-0 max-w-full rounded-xl border px-3 text-sm"
                              value={resolvedTargetWorkspaceId ?? ""}
                              onChange={(event) =>
                                setSelectedTargetWorkspaceId(
                                  event.target.value
                                    ? (event.target.value as Id<"workspaces">)
                                    : null,
                                )
                              }
                            >
                              {targetWorkspaceOptions.length === 0 ? (
                                <option value="">Ingen andre arbeidsområder tilgjengelig</option>
                              ) : (
                                targetWorkspaceOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                          <Button
                            type="button"
                            className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:min-w-[10rem]"
                            disabled={!selectedForm.isTemplate || !resolvedTargetWorkspaceId}
                            onClick={handleActivateTemplate}
                          >
                            Aktiver kopi
                          </Button>
                        </div>
                        {!selectedForm.isTemplate ? (
                          <p className="text-muted-foreground text-[11px] leading-snug">
                            «Del som mal» må være på for å aktivere andre steder.
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Aktiveringer</p>
                      <Badge variant="outline">{activations.length}</Badge>
                    </div>
                    {activations.length === 0 ? (
                      <p className="text-muted-foreground text-xs">Ingen ennå.</p>
                    ) : (
                      <div className="space-y-2">
                        {activations.map((activation) => (
                          <div
                            key={activation._id}
                            className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">
                                  {activation.targetWorkspaceName}
                                </p>
                                <Badge variant={activation.isActive ? "secondary" : "outline"}>
                                  {activation.isActive ? "Aktiv" : "Deaktivert"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {activation.activatedFormTitle} ·{" "}
                                {formatDateTime(activation.activatedAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl"
                                onClick={() =>
                                  window.open(
                                    `/w/${activation.targetWorkspaceId}/skjemaer`,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                Åpne
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl"
                                disabled={!activation.isActive}
                                onClick={() => handleDeactivateActivation(activation._id)}
                              >
                                Deaktiver
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section
                  className={cn(
                    "border-border/60 bg-card min-w-0 rounded-2xl border p-4 shadow-sm sm:p-5",
                    settingsSection !== "lenker" && "hidden",
                  )}
                >
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold leading-tight">Delbare lenker</h3>
                    <p className="text-muted-foreground text-xs leading-snug">
                      Utløp, maks svar, åpen eller e-post.
                    </p>
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="min-w-0 space-y-2 sm:col-span-2">
                        <Label className="text-sm" htmlFor="settings-link-expires">
                          Utløper
                        </Label>
                        <Input
                          id="settings-link-expires"
                          type="datetime-local"
                          value={expiresAt}
                          onChange={(event) => setExpiresAt(event.target.value)}
                          className="min-w-0 max-w-full"
                        />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <Label className="text-sm" htmlFor="settings-link-max">
                          Maks svar
                        </Label>
                        <Input
                          id="settings-link-max"
                          inputMode="numeric"
                          value={maxResponses}
                          onChange={(event) => setMaxResponses(event.target.value)}
                          className="min-w-0 max-w-full"
                        />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <Label className="text-sm" htmlFor="settings-link-access">
                          Tilgang
                        </Label>
                        <select
                          id="settings-link-access"
                          className="border-input bg-background h-10 w-full min-w-0 max-w-full rounded-xl border px-3 text-sm"
                          value={accessMode}
                          onChange={(event) =>
                            setAccessMode(
                              event.target.value as "anonymous" | "email_required",
                            )
                          }
                        >
                          <option value="anonymous">Åpen lenke</option>
                          <option value="email_required">Krev e-post</option>
                        </select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="h-11 w-full rounded-xl sm:h-10 sm:w-auto"
                      onClick={handleCreateLink}
                    >
                      <Link2 className="size-4" />
                      Opprett lenke
                    </Button>
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    {links.length === 0 ? (
                      <p className="text-muted-foreground text-xs">Ingen lenker ennå.</p>
                    ) : (
                      links.map((link) => (
                        <div
                          key={link._id}
                          className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/50 bg-muted/15 p-3 sm:p-4"
                        >
                          <div className="min-w-0 space-y-1.5 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={link.isActive ? "secondary" : "outline"}>
                                {renderLinkStatusLabel(link.status)}
                              </Badge>
                              <span className="text-muted-foreground text-xs sm:text-sm">
                                {link.responseCount}
                                {link.maxResponses ? ` / ${link.maxResponses}` : ""} svar
                              </span>
                            </div>
                            <p className="text-muted-foreground break-all font-mono text-[11px] leading-relaxed [overflow-wrap:anywhere]">
                              {typeof window !== "undefined"
                                ? `${window.location.origin}/f/${link.token}`
                                : `/f/${link.token}`}
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              className="min-w-0 rounded-xl px-2 text-xs sm:px-3 sm:text-sm"
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/f/${link.token}`,
                                )
                              }
                            >
                              <ExternalLink className="size-3.5 shrink-0 sm:size-4" />
                              <span className="truncate">Kopier</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-w-0 rounded-xl px-2 text-xs sm:px-3 sm:text-sm"
                              onClick={() =>
                                link.status === "paused"
                                  ? resumeLink({ linkId: link._id })
                                  : pauseLink({ linkId: link._id })
                              }
                            >
                              <span className="truncate">
                                {link.status === "paused" ? "Fortsett" : "Pause"}
                              </span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-w-0 rounded-xl px-2 text-xs sm:px-3 sm:text-sm"
                              onClick={() => removeLink({ linkId: link._id })}
                            >
                              <Trash2 className="size-3.5 shrink-0 sm:size-4" />
                              <span className="truncate">Slett</span>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Velg et skjema først.</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent size="lg" titleId="intake-preview-title">
          <DialogHeader>
            <p id="intake-preview-title" className="font-heading text-lg font-semibold">
              Forhåndsvis skjema
            </p>
            <p className="text-sm text-muted-foreground">
              Dette er hvordan skjemaet ser ut for de som fyller det ut.
            </p>
          </DialogHeader>
          <DialogBody>
            <AdminFormPreview
              title={title}
              description={description}
              layoutMode={layoutMode}
              questionsPerPage={questionsPerPage}
              confirmationMode={confirmationMode}
              questions={questions}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent
          size="5xl"
          titleId="submission-review-title"
          className="max-h-[96dvh] max-w-[min(96vw,80rem)]"
        >
          <DialogHeader className="py-2.5 sm:px-6 sm:py-3">
            <p id="submission-review-title" className="font-heading text-base font-semibold sm:text-lg">
              Gjennomgå forslag
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
              Øverst: deleger til kollega. Nederst: godkjenne eller avslå selv.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-5 px-5 py-3 sm:px-6 sm:py-4">
            {submissionDetail ? (
              <>
                {selectedSubmissionId ? (
                  <IntakeSubmissionCollabPanel
                    workspaceId={workspaceId}
                    submissionId={selectedSubmissionId}
                    canAct={canDeleteIntakeSubmissions}
                  />
                ) : null}

                {(() => {
                  const ghSub = submissionDetail.submission;
                  const intakeGithubHasIssue =
                    Boolean(ghSub.githubRepoFullName?.trim()) &&
                    ghSub.githubIssueNumber != null;
                  const intakeGithubHasDraft =
                    Boolean(ghSub.githubProjectItemNodeId?.trim()) &&
                    !intakeGithubHasIssue;
                  const showIntakeGithubSection =
                    Boolean(workspaceDocQuery?.githubProjectNodeId?.trim()) ||
                    intakeGithubHasIssue ||
                    Boolean(ghSub.githubProjectItemNodeId?.trim());
                  if (!showIntakeGithubSection) {
                    return null;
                  }
                  return (
                    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <GitBranch className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium">GitHub-prosjekt</p>
                          {intakeGithubHasIssue ? (
                            <Link
                              href={`https://github.com/${ghSub.githubRepoFullName}/issues/${ghSub.githubIssueNumber}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline"
                            >
                              {ghSub.githubRepoFullName}#{ghSub.githubIssueNumber}
                              <ExternalLink className="size-3.5" />
                            </Link>
                          ) : intakeGithubHasDraft ? (
                            <p className="text-xs text-muted-foreground">
                              Utkast på prosjekttavle — åpne prosjektet i GitHub for å se kortet.
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Legg til i teamets prosjekt — ikke automatisk ved innsending.
                            </p>
                          )}
                        </div>
                      </div>
                      {!intakeGithubHasIssue && !intakeGithubHasDraft && canCreateIntakeGithubIssue ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="shrink-0 rounded-xl"
                          onClick={() => {
                            setGithubDialogOpenVersion((v) => v + 1);
                            setGithubIntakeDialogOpen(true);
                          }}
                        >
                          <GitBranch className="size-4" />
                          {workspaceGithubDefaultRepos.length === 0
                            ? "Legg til (utkast)"
                            : "Opprett issue"}
                        </Button>
                      ) : null}
                    </div>
                  );
                })()}
                <section className="space-y-3 rounded-2xl border border-border/40 bg-muted/[0.04] p-3 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                      <div className="bg-muted/30 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 sm:size-9 sm:rounded-xl">
                        <FileText className="text-muted-foreground size-3.5 sm:size-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">Innsendte svar</p>
                        <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
                          {submissionDetail.form?.title ?? "Skjema"} ·{" "}
                          {new Date(submissionDetail.submission.submittedAt).toLocaleString(
                            "nb-NO",
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {submissionDetail.submission.personDataSignal ? (
                        <Badge variant="outline">Persondata</Badge>
                      ) : null}
                      {submissionDetail.submission.generatedRosSuggestion.shouldCreateRos ? (
                        <Badge variant="outline">ROS-forslag</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {submissionDetail.questions.map((question) => {
                      const answer = submissionDetail.submission.answers.find(
                        (item) => item.questionId === question._id,
                      );
                      let answerLabel = "Ikke besvart";
                      if (answer?.kind === "text") answerLabel = answer.value;
                      if (answer?.kind === "number") answerLabel = String(answer.value);
                      if (answer?.kind === "multiple_choice") answerLabel = answer.label;
                      if (answer?.kind === "scale") answerLabel = String(answer.value);
                      if (answer?.kind === "yes_no") answerLabel = answer.value ? "Ja" : "Nei";
                      return (
                        <div
                          key={question._id}
                          className="rounded-xl border border-border/60 bg-card/90 p-3.5 shadow-sm sm:rounded-2xl sm:p-4"
                        >
                          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                            Innsendt svar
                          </p>
                          <p className="text-foreground mt-1 text-sm font-medium leading-snug">
                            {question.label}
                          </p>
                          <p className="text-foreground/90 mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                            {answerLabel}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3">
                  <div>
                    <p className="font-medium">Generert vurdering</p>
                    <p className="text-muted-foreground text-xs sm:text-sm">
                      Rediger før godkjenning — blir utgangspunktet for den nye vurderingen.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Tittel</Label>
                    <Input
                      value={
                        reviewTitle ??
                        submissionDetail.submission.generatedAssessmentDraft.title
                      }
                      onChange={(event) => setReviewTitle(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-3">
                    {REVIEW_FIELDS.map(([fieldKey, label]) => (
                      <ReviewField
                        key={fieldKey}
                        label={label}
                        fieldKey={fieldKey}
                        draft={
                          reviewPayload ??
                          submissionDetail.submission.generatedAssessmentDraft.payload
                        }
                        original={submissionDetail.submission.generatedAssessmentDraft.payload}
                        onChange={(field, value) =>
                          setReviewPayload((prev) => ({
                            ...(prev ??
                              submissionDetail.submission.generatedAssessmentDraft.payload),
                            [field]: value,
                          }))
                        }
                      />
                    ))}
                  </div>
                </section>

                <section className="space-y-3 rounded-2xl border border-border/50 bg-muted/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">ROS-forslag</p>
                      <p className="text-sm text-muted-foreground">
                        {submissionDetail.submission.generatedRosSuggestion.summary}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {submissionDetail.submission.generatedRosSuggestion.risks.length} risikoer
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {submissionDetail.submission.generatedRosSuggestion.risks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Ingen konkrete risikoer ble identifisert automatisk.
                      </p>
                    ) : (
                      submissionDetail.submission.generatedRosSuggestion.risks.map((risk) => (
                        <div
                          key={risk.id}
                          className="rounded-2xl border border-border/50 bg-card p-3"
                        >
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="size-4 text-amber-600" />
                            <p className="font-medium">{risk.title}</p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {risk.description}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <label className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={
                        createRos ??
                        (Boolean(submissionDetail.form?.rosIntegrationEnabled) &&
                          submissionDetail.submission.generatedRosSuggestion.shouldCreateRos)
                      }
                      onChange={(event) => setCreateRos(event.target.checked)}
                    />
                    <span>
                      <span className="font-medium">Opprett ROS-utkast ved godkjenning</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {submissionDetail.form?.rosIntegrationEnabled
                          ? "Bruker skjemaets valgte ROS-mal. Hvis ingen mal finnes, opprettes en standard-mal automatisk."
                          : "Slå på ROS-kobling i skjemainnstillinger hvis dette skjemaet skal opprette risikoanalyse automatisk."}
                      </span>
                    </span>
                  </label>
                </section>

                {submissionDetail.submission.status === "approved" ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                    <div className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-100">
                      <CheckCircle2 className="size-4" />
                      Forslaget er allerede godkjent
                    </div>
                    {submissionDetail.submission.approvedAssessmentId ? (
                      <div className="mt-2">
                        <Link
                          href={`/w/${workspaceId}/a/${submissionDetail.submission.approvedAssessmentId}`}
                          className="inline-flex items-center gap-1 font-medium underline"
                        >
                          Åpne opprettet vurdering
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </div>
                    ) : (
                      <p className="mt-2 text-emerald-900/90 dark:text-emerald-100/90">
                        Vurderingen er opprettet. Oppdater siden hvis lenken ikke vises ennå.
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Laster forslag …</p>
            )}
          </DialogBody>
          <DialogFooter className="gap-2 px-5 py-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:px-6 sm:py-3">
            {submissionDetail && submissionDetail.submission.status !== "approved" ? (
              <div className="min-w-0 w-full max-w-full flex-1 space-y-1 sm:max-w-md">
                <Textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Begrunnelse ved avslag (påkrevd) — vises internt"
                  rows={2}
                  className="min-h-[4.25rem] w-full max-w-full resize-y text-sm"
                />
                {rejectionReasonMissing ? (
                  <p className="text-xs text-destructive">
                    Legg inn en kort begrunnelse før du klikker «Avslå».
                  </p>
                ) : null}
              </div>
            ) : submissionDetail?.submission.status === "approved" ? (
              <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                Godkjente forslag kan ikke godkjennes eller avslås på nytt her.
              </div>
            ) : null}
            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2">
              {submissionDetail && canDeleteIntakeSubmissions ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    handleRemoveSubmission({
                      _id: submissionDetail.submission._id,
                      generatedAssessmentDraft: {
                        title: submissionDetail.submission.generatedAssessmentDraft.title,
                      },
                    })
                  }
                >
                  <Trash2 className="size-4" />
                  Slett forslag
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => setReviewOpen(false)}
              >
                Lukk
              </Button>
              {submissionDetail && submissionDetail.submission.status !== "approved" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={handleReject}
                    disabled={rejectionReasonMissing}
                  >
                    <XCircle className="size-4" />
                    Avslå
                  </Button>
                  <Button type="button" className="shrink-0" onClick={handleApprove}>
                    <CheckCircle2 className="size-4" />
                    Godkjenn og opprett vurdering
                  </Button>
                </>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={githubIntakeDialogOpen} onOpenChange={setGithubIntakeDialogOpen}>
        <DialogContent size="lg" titleId="intake-github-dialog-title">
          <DialogHeader>
            <p
              id="intake-github-dialog-title"
              className="font-heading text-lg font-semibold"
            >
              Legg til i GitHub-prosjekt
            </p>
            <p className="text-sm text-muted-foreground">
              Bruker samme prosjekt, tilgang (PAT), statusfelt og standard-repos som under
              arbeidsområdets innstillinger — ikke automatisk ved innsending.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {!submissionDetail || submissionDetail.submission._id !== selectedSubmissionId ? (
              <p className="text-sm text-muted-foreground">Laster forslag …</p>
            ) : (
              (() => {
                const ghSub = submissionDetail.submission;
                const intakeGithubHasIssue =
                  Boolean(ghSub.githubRepoFullName?.trim()) &&
                  ghSub.githubIssueNumber != null;
                const intakeGithubHasDraft =
                  Boolean(ghSub.githubProjectItemNodeId?.trim()) &&
                  !intakeGithubHasIssue;
                if (intakeGithubHasIssue) {
                  return (
                    <div className="rounded-2xl border border-border/50 bg-card p-4 text-sm">
                      <p className="font-medium">Allerede koblet til GitHub-issue</p>
                      <Link
                        href={`https://github.com/${ghSub.githubRepoFullName}/issues/${ghSub.githubIssueNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 font-medium text-primary underline"
                      >
                        {ghSub.githubRepoFullName}#{ghSub.githubIssueNumber}
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>
                  );
                }
                if (intakeGithubHasDraft) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      Dette forslaget er allerede lagt inn som utkast på prosjekttavlen. Åpne
                      prosjektet i GitHub for å se kortet.
                    </p>
                  );
                }
                if (!canCreateIntakeGithubIssue) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      {intakeGithubMembershipLoading
                        ? "Laster tilgang til arbeidsområdet …"
                        : !workspaceDocQuery?.githubProjectNodeId?.trim()
                          ? "Koble GitHub-prosjekt under arbeidsområdets innstillinger (samme som for prosessregister og vurderinger)."
                          : "Kun medlemmer, administratorer og eiere kan legge til her."}
                    </p>
                  );
                }
                return (
                  <div className="space-y-3">
                    {intakeGithubStatusLoading ? (
                      <p className="text-sm text-muted-foreground">
                        Henter statusalternativer fra GitHub …
                      </p>
                    ) : null}
                    {intakeGithubStatusError ? (
                      <p className="text-sm text-destructive">{intakeGithubStatusError}</p>
                    ) : null}
                    {intakeGithubStatusFieldName ? (
                      <p className="text-xs text-muted-foreground">
                        Statusfelt: {intakeGithubStatusFieldName}
                      </p>
                    ) : null}
                    {workspaceGithubDefaultRepos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Uten standard-repo opprettes et utkast på tavlen (samme oppførsel som
                        prosessregister uten repo). Legg til standard-repo i innstillinger hvis du
                        vil at det skal bli en ekte issue automatisk.
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="intake-github-dlg-status">Status i prosjekt</Label>
                      <select
                        id="intake-github-dlg-status"
                        className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={intakeGithubStatusOptionId}
                        onChange={(event) =>
                          setIntakeGithubStatusOptionId(event.target.value)
                        }
                        disabled={
                          intakeGithubStatusLoading || intakeGithubStatusOptions.length === 0
                        }
                      >
                        {intakeGithubStatusOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {workspaceGithubDefaultRepos.length > 1 ? (
                      <div className="space-y-2">
                        <Label htmlFor="intake-github-dlg-repo">GitHub-repo</Label>
                        <select
                          id="intake-github-dlg-repo"
                          className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={intakeGithubRepoChoice}
                          onChange={(event) =>
                            setIntakeGithubRepoChoice(event.target.value)
                          }
                        >
                          {workspaceGithubDefaultRepos.map((repo) => (
                            <option key={repo} value={repo}>
                              {repo}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div
                      role="status"
                      className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground"
                    >
                      <p className="font-medium text-foreground">Innhold til GitHub</p>
                      <p className="mt-1.5">
                        Når «Tekst til GitHub» under står tom, henter serveren{" "}
                        <span className="font-medium text-foreground">
                          alle utfylte svar fra dette skjemaet
                        </span>
                        , innsender, tidspunkt og auto-generert vurderingsutkast, og bygger
                        Markdown til utkastet eller issuet.
                      </p>
                      <p className="mt-2 text-xs tabular-nums">
                        {submissionDetail.questions.length} spørsmål i skjemaet ·{" "}
                        {
                          submissionDetail.questions.filter((q) =>
                            submissionDetail.submission.answers.some(
                              (a) => a.questionId === q._id,
                            ),
                          ).length
                        }{" "}
                        med registrert svar
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="intake-github-dlg-title">Tittel</Label>
                      <Input
                        id="intake-github-dlg-title"
                        value={intakeGithubIssueTitle}
                        onChange={(event) => setIntakeGithubIssueTitle(event.target.value)}
                        maxLength={256}
                      />
                      <p className="text-xs text-muted-foreground">
                        Standard er innsendt vurderingstittel og innsender — tilpass ved behov.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="intake-github-dlg-body">Tekst til GitHub (valgfritt)</Label>
                      <p
                        id="intake-github-dlg-body-hint"
                        className="text-xs text-muted-foreground"
                      >
                        Skriv kun her hvis du vil erstatte den automatiske teksten. Tomt felt =
                        alle skjemasvar og vurderingsutkast inkluderes.
                      </p>
                      <Textarea
                        id="intake-github-dlg-body"
                        aria-describedby="intake-github-dlg-body-hint"
                        value={intakeGithubIssueBody}
                        onChange={(event) => setIntakeGithubIssueBody(event.target.value)}
                        placeholder="La stå tom: da brukes alle svar, innsender og vurderingsutkast automatisk."
                        className="min-h-28"
                      />
                    </div>
                    <Button
                      type="button"
                      className="rounded-xl"
                      disabled={
                        intakeGithubCreateBusy ||
                        intakeGithubStatusLoading ||
                        !intakeGithubStatusOptionId.trim()
                      }
                      onClick={async () => {
                        setIntakeGithubCreateBusy(true);
                        try {
                          const result = await createGithubRepoIssueForIntakeSubmission({
                            submissionId: submissionDetail.submission._id,
                            statusOptionId: intakeGithubStatusOptionId,
                            repoFullName:
                              workspaceGithubDefaultRepos.length > 1
                                ? intakeGithubRepoChoice
                                : undefined,
                            issueTitle: intakeGithubIssueTitle.trim() || undefined,
                            issueBody: intakeGithubIssueBody.trim() || undefined,
                          });
                          toast.success(
                            result.kind === "draft"
                              ? "Utkast er lagt på prosjekttavlen (samme prosjekt som for prosesser)."
                              : "Issue opprettet i GitHub og lagt i prosjektet.",
                          );
                          setGithubIntakeDialogOpen(false);
                        } catch (error: unknown) {
                          toast.error(formatUserFacingError(error));
                        } finally {
                          setIntakeGithubCreateBusy(false);
                        }
                      }}
                    >
                      <GitBranch className="size-4" />
                      {intakeGithubCreateBusy
                        ? "Oppretter …"
                        : workspaceGithubDefaultRepos.length === 0
                          ? "Legg til i GitHub-prosjekt (utkast)"
                          : "Opprett issue i GitHub-prosjekt"}
                    </Button>
                  </div>
                );
              })()
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setGithubIntakeDialogOpen(false)}
            >
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
