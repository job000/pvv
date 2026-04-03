"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  INTAKE_MAPPING_TARGET_LABELS,
  defaultIntakeQuestions,
  detectTechnicalTerms,
} from "@/lib/intake-form";
import { effectiveGithubDefaultRepos } from "@/lib/github-workspace-helpers";
import { cn } from "@/lib/utils";
import { toastDeleteWithUndo } from "@/lib/toast-delete-undo";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  GitBranch,
  LayoutGrid,
  Link2,
  List,
  Plus,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

  const createForm = useMutation(api.intakeForms.create);
  const saveForm = useMutation(api.intakeForms.save);
  const archiveForm = useMutation(api.intakeForms.archive);
  const updateFormIntegrations = useMutation(api.intakeForms.updateIntegrations);
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [githubIntakeDialogOpen, setGithubIntakeDialogOpen] = useState(false);
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
  const activeFormId =
    selectedFormId && visibleFormIds.includes(selectedFormId)
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
  const [formsView, setFormsView] = useState<"cards" | "compact">("compact");
  /** Når false: kun kompakt sammendrag under listen — mer plass til køen til høyre. */
  const [formWorkspacePanelExpanded, setFormWorkspacePanelExpanded] =
    useState(true);
  const prevActiveFormIdRef = useRef<Id<"intakeForms"> | null>(null);
  const [showFormOverview, setShowFormOverview] = useState(false);
  const [showResponses, setShowResponses] = useState(false);

  const selectedForm = forms.find((form) => form._id === activeFormId) ?? null;

  useEffect(() => {
    if (activeFormId !== prevActiveFormIdRef.current) {
      prevActiveFormIdRef.current = activeFormId;
      if (activeFormId !== null) {
        setFormWorkspacePanelExpanded(true);
      }
    }
  }, [activeFormId]);

  const selectedFormQuestions = useMemo(
    () => (editorData ? toEditableQuestions(editorData.questions) : []),
    [editorData],
  );
  const selectedFormLayoutMode = editorData?.form.layoutMode ?? "one_per_screen";
  const selectedFormConfirmationMode = editorData?.form.confirmationMode ?? "none";
  const selectedFormDescription = editorData?.form.description ?? "";
  const integrationDraft = activeFormId ? integrationDrafts[activeFormId] : undefined;
  const rosIntegrationEnabled =
    integrationDraft?.rosIntegrationEnabled ?? Boolean(editorData?.form.rosIntegrationEnabled);
  const linkedRosTemplateId =
    integrationDraft?.linkedRosTemplateId ?? editorData?.form.linkedRosTemplateId ?? null;
  const linkedRosTemplate = useMemo(
    () => rosTemplates.find((template) => template._id === linkedRosTemplateId) ?? null,
    [linkedRosTemplateId, rosTemplates],
  );
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
  const selectedFormBadges = useMemo(() => {
    if (!selectedForm) {
      return [];
    }
    return [
      `${selectedForm.questionCount} spørsmål`,
      `${selectedForm.responseCount} svar`,
      selectedFormConfirmationMode === "email_copy"
        ? "E-postbekreftelse"
        : "Ingen bekreftelse",
      selectedFormLayoutMode === "one_per_screen"
        ? (editorData?.form.questionsPerPage ?? 1) > 1
          ? `Stegvis (${editorData?.form.questionsPerPage ?? 1} per side)`
          : "Stegvis (1 per side)"
        : "Gruppert visning",
    ];
  }, [
    selectedForm,
    selectedFormConfirmationMode,
    selectedFormLayoutMode,
    editorData?.form.questionsPerPage,
  ]);
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
    setExpandedQuestionIds(nextQuestions.map((question) => question.id));
    setMappingSectionOpenIds(questionIdsWithMappingSectionInitiallyOpen(nextQuestions));
  }

  function toggleQuestionExpanded(questionId: string) {
    setExpandedQuestionIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((item) => item !== questionId)
        : [...prev, questionId],
    );
  }

  function openAllQuestions() {
    setExpandedQuestionIds(questions.map((question) => question.id));
  }

  function closeAllQuestions() {
    setExpandedQuestionIds([]);
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

  async function handleCreateForm() {
    try {
      const formId = await createForm({
        workspaceId,
        title: "Nytt skjema",
      });
      setSelectedFormId(formId);
      setTitle("Nytt skjema");
      setDescription("");
      setLayoutMode("one_per_screen");
      setQuestionsPerPage(1);
      setStatus("draft");
      setConfirmationMode("none");
      setEditorOpen(true);
      const nextQuestions = defaultIntakeQuestions();
      setQuestions(nextQuestions);
      setExpandedQuestionIds(nextQuestions.map((question) => question.id));
      setMappingSectionOpenIds(questionIdsWithMappingSectionInitiallyOpen(nextQuestions));
      toast.success("Nytt skjema opprettet.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke opprette skjema.");
    }
  }

  async function handleSaveForm() {
    if (!activeFormId) return;
    try {
      await saveForm({
        formId: activeFormId,
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
      toast.success("Skjema lagret.");
      setEditorOpen(false);
    } catch (error) {
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
        error instanceof Error ? error.message : "Kunne ikke oppdatere skjema-status.",
      );
    }
  }

  async function handleSaveIntegrations() {
    if (!activeFormId) return;
    try {
      let nextTemplateId = linkedRosTemplateId;
      if (rosIntegrationEnabled && !nextTemplateId) {
        if ((rosTemplates?.length ?? 0) > 0) {
          nextTemplateId = rosTemplates[0]!._id;
        } else {
          nextTemplateId = await createRosTemplate({
            workspaceId,
            name: selectedForm ? `ROS-mal · ${selectedForm.title}` : "Standard ROS-mal",
            description: "Automatisk opprettet fra skjema-kobling.",
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
        name: selectedForm ? `ROS-mal · ${selectedForm.title}` : "Standard ROS-mal",
        description: "Automatisk opprettet fra skjema-kobling.",
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
      toast.success("Standard ROS-mal opprettet og koblet til skjemaet.");
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

  if (formsQuery === undefined || submissionsQuery === undefined) {
    return <p className="text-sm text-muted-foreground">Laster skjemaer …</p>;
  }

  const canDeleteIntakeSubmissions =
    myWorkspaceMembership !== undefined &&
    myWorkspaceMembership !== null &&
    myWorkspaceMembership.role !== "viewer";

  const pendingCount = submissions.filter(
    (submission) => submission.status === "submitted" || submission.status === "under_review",
  ).length;
  const activeFormResponseRows = activeFormId
    ? submissions.filter((submission) => submission.formId === activeFormId)
    : [];
  const mappingSummary = selectedFormQuestions.reduce(
    (acc, question) => {
      for (const target of question.mappingTargets) {
        if (
          target.kind === "assessmentText" ||
          target.kind === "assessmentScale" ||
          target.kind === "assessmentNumber" ||
          target.kind === "assessmentChoice"
        ) {
          acc.assessment += 1;
        } else if (
          target.kind === "rosConsequence" ||
          target.kind === "rosRiskDescription"
        ) {
          acc.ros += 1;
        } else if (target.kind === "pvvPersonalData") {
          acc.pvv += 1;
        } else if (target.kind === "derivedFrequency") {
          acc.assessment += 1;
        }
      }
      return acc;
    },
    { assessment: 0, ros: 0, pvv: 0 },
  );
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
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border/50 bg-muted/15 px-3 py-2.5 text-sm">
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
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/15 px-3 py-2.5 text-xs text-muted-foreground">
          <GitBranch className="size-3.5 shrink-0" />
          Utkast på GitHub-prosjekttavle
        </div>
      );
    }
    if (!canCreateIntakeGithubIssue) {
      return null;
    }
    return (
      <div className="border-primary/25 bg-muted/15 mt-3 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-xl">
            <GitBranch className="text-primary size-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">GitHub</p>
            <p className="text-muted-foreground text-xs">
              Issue eller utkast på prosjekt-tavlen.
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

  return (
    <div className="space-y-6 pb-6">
      <header className="border-border/50 bg-muted/10 flex flex-col gap-4 rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight">
              Skjemaer
            </h1>
            <p className="text-muted-foreground max-w-xl text-sm leading-snug">
              Del lenke → motta svar → godkjenn → vurdering (ROS valgfritt).
            </p>
          </div>
          <Button type="button" className="h-11 shrink-0 rounded-xl" onClick={handleCreateForm}>
            <Plus className="size-4" />
            Nytt skjema
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="bg-card rounded-2xl border border-border/50 px-4 py-3 shadow-sm">
            <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
              Skjemaer
            </p>
            <p className="font-heading mt-0.5 text-2xl font-semibold tabular-nums">
              {forms.length}
            </p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 px-4 py-3 shadow-sm">
            <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
              Ventende
            </p>
            <p className="font-heading mt-0.5 text-2xl font-semibold tabular-nums">
              {pendingCount}
            </p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 px-4 py-3 shadow-sm">
            <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
              ROS-maler
            </p>
            <p className="font-heading mt-0.5 text-2xl font-semibold tabular-nums">
              {rosTemplates?.length ?? 0}
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-3xl">
          <CardHeader className="gap-3 pb-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Dine skjemaer</CardTitle>
                <CardDescription className="mt-1">
                  Velg et skjema for å redigere, dele lenke eller behandle svar.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="inline-flex rounded-full border border-border/50 bg-muted/40 p-0.5 shadow-inner"
                  role="group"
                  aria-label="Visning av skjemaliste"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "gap-1.5 rounded-full px-3.5",
                      formsView === "cards" &&
                        "bg-background text-foreground shadow-sm ring-1 ring-border/60",
                    )}
                    onClick={() => setFormsView("cards")}
                  >
                    <LayoutGrid className="size-3.5" />
                    Kort
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "gap-1.5 rounded-full px-3.5",
                      formsView === "compact" &&
                        "bg-background text-foreground shadow-sm ring-1 ring-border/60",
                    )}
                    onClick={() => setFormsView("compact")}
                  >
                    <List className="size-3.5" />
                    Kompakt
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {forms.length === 0 ? (
              <div className="border-border/60 bg-muted/10 rounded-2xl border border-dashed p-6 text-center">
                <FileText className="text-muted-foreground mx-auto mb-2 size-6" />
                <p className="font-medium">Ingen skjemaer ennå</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Trykk «Nytt skjema» over.
                </p>
              </div>
            ) : (
              <div
                className={
                  formsView === "cards"
                    ? "grid gap-3 sm:grid-cols-2"
                    : "flex flex-col gap-1"
                }
              >
                {forms.map((form) => {
                  const isSelected = activeFormId === form._id;
                  const statusLabel =
                    form.status === "published"
                      ? "Publisert"
                      : form.status === "archived"
                        ? "Arkivert"
                        : "Utkast";
                  return (
                    <button
                      key={form._id}
                      type="button"
                      onClick={() => setSelectedFormId(form._id)}
                      className={cn(
                        "rounded-2xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        formsView === "cards" ? "p-4" : "px-3 py-2.5",
                        isSelected
                          ? formsView === "cards"
                            ? "border-primary/70 bg-primary/[0.06] shadow-md ring-2 ring-primary/25"
                            : "border-primary/60 bg-primary/[0.07] shadow-sm ring-1 ring-primary/20"
                          : "border-border/50 hover:border-border hover:bg-muted/15",
                      )}
                    >
                      {formsView === "compact" ? (
                        <div className="flex min-h-10 items-center gap-3">
                          <FileText
                            className={cn(
                              "size-4 shrink-0",
                              isSelected ? "text-primary" : "text-muted-foreground",
                            )}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate font-medium leading-tight">{form.title}</p>
                              {form.isTemplate ? (
                                <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                                  Mal
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-muted-foreground mt-0.5 truncate text-xs tabular-nums">
                              {form.questionCount} spørsmål · {form.responseCount} svar
                              {form.activeActivationCount > 0
                                ? ` · ${form.activeActivationCount} aktiveringer`
                                : ""}
                            </p>
                          </div>
                          <Badge
                            variant={form.status === "published" ? "secondary" : "outline"}
                            className="shrink-0 text-[10px]"
                          >
                            {statusLabel}
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium">{form.title}</p>
                              {form.isTemplate ? <Badge variant="outline">Mal</Badge> : null}
                              {form.sourceTemplateFormId ? (
                                <Badge variant="outline">Aktivert fra mal</Badge>
                              ) : null}
                            </div>
                            <p className="text-muted-foreground text-sm tabular-nums">
                              {form.questionCount} spørsmål · {form.responseCount} svar
                              {form.activeActivationCount > 0
                                ? ` · ${form.activeActivationCount} aktiveringer`
                                : ""}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              {form.confirmationMode === "email_copy"
                                ? "E-post til svarer"
                                : "Uten e-post"}
                            </p>
                          </div>
                          <Badge variant={form.status === "published" ? "secondary" : "outline"}>
                            {statusLabel}
                          </Badge>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedForm ? (
              !formWorkspacePanelExpanded ? (
                <div className="relative flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 pt-3 pr-11 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-3.5 sm:pr-12 sm:pt-3.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="absolute right-2 top-2 z-10 rounded-full shadow-sm"
                    aria-label="Utvid skjemadetaljer"
                    onClick={() => setFormWorkspacePanelExpanded(true)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate font-heading text-base font-semibold sm:text-lg">
                          {selectedForm.title}
                        </p>
                        <Badge
                          variant={selectedForm.status === "published" ? "secondary" : "outline"}
                          className="shrink-0"
                        >
                          {selectedForm.status === "published"
                            ? "Publisert"
                            : selectedForm.status === "archived"
                              ? "Arkivert"
                              : "Utkast"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs tabular-nums sm:text-sm">
                        {selectedForm.questionCount} spørsmål · {activeFormResponseRows.length} svar
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3 sm:border-t-0 sm:pt-0 sm:pr-0">
                    {selectedForm.status === "published" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleSetFormStatus("draft")}
                      >
                        Avpubliser
                      </Button>
                    ) : selectedForm.status === "draft" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleSetFormStatus("published")}
                      >
                        Publiser
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl"
                      disabled={!editorData}
                      onClick={() => {
                        primeEditorState(editorData);
                        setEditorOpen(true);
                      }}
                    >
                      Rediger
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      aria-label="ROS, mal, lenker"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Settings2 className="size-4" />
                      <span className="hidden sm:inline">ROS, mal, lenker</span>
                    </Button>
                  </div>
                </div>
              ) : (
              <div className="relative space-y-4 rounded-[28px] border border-border/60 bg-card p-4 pt-4 pr-11 shadow-sm sm:p-5 sm:pr-14">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="absolute right-3 top-3 z-10 rounded-full shadow-sm sm:right-4 sm:top-4"
                  aria-label="Minimer skjemadetaljer"
                  onClick={() => setFormWorkspacePanelExpanded(false)}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-heading text-xl font-semibold">{selectedForm.title}</p>
                      <Badge variant={selectedForm.status === "published" ? "secondary" : "outline"}>
                        {selectedForm.status === "published"
                          ? "Publisert"
                          : selectedForm.status === "archived"
                            ? "Arkivert"
                            : "Utkast"}
                      </Badge>
                      {selectedForm.isTemplate ? <Badge variant="outline">Delt som mal</Badge> : null}
                      {selectedForm.sourceTemplateFormId ? (
                        <Badge variant="outline">Kopi fra mal</Badge>
                      ) : null}
                    </div>
                    {selectedFormDescription.trim() ? (
                      <p className="text-muted-foreground max-w-3xl text-sm leading-snug">
                        {selectedFormDescription}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {selectedFormBadges.map((badge) => (
                        <Badge key={badge} variant="outline">
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedForm.status === "published" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => handleSetFormStatus("draft")}
                      >
                        Avpubliser
                      </Button>
                    ) : selectedForm.status === "draft" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => handleSetFormStatus("published")}
                      >
                        Publiser
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      className="rounded-xl"
                      disabled={!editorData}
                      onClick={() => {
                        primeEditorState(editorData);
                        setEditorOpen(true);
                      }}
                    >
                      Rediger skjema
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      disabled={!editorData}
                      onClick={() => {
                        primeEditorState(editorData);
                        setPreviewOpen(true);
                      }}
                    >
                      <ExternalLink className="size-4" />
                      Forhåndsvis
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Settings2 className="size-4" />
                      ROS, mal, lenker
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Skjules med en gang — angre i varselet nederst"
                      onClick={() => void handleArchiveForm()}
                    >
                      <Trash2 className="size-4" />
                      Slett
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <div className="border-border/50 bg-muted/10 rounded-xl border px-3 py-2.5">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                      Innhold
                    </p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums">
                      {selectedForm.questionCount} spørsmål · {activeFormResponseRows.length} svar
                    </p>
                  </div>
                  <div className="border-border/50 bg-muted/10 rounded-xl border px-3 py-2.5">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                      Lenker
                    </p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums">{links.length} aktive</p>
                  </div>
                  <div className="border-border/50 bg-muted/10 rounded-xl border px-3 py-2.5">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                      Auto-utfylling
                    </p>
                    <p className="mt-0.5 text-sm font-medium leading-snug">
                      {mappingSummary.assessment} vurdering · {mappingSummary.ros} ROS ·{" "}
                      {mappingSummary.pvv} PVV
                    </p>
                  </div>
                  <div className="border-border/50 bg-muted/10 rounded-xl border px-3 py-2.5">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                      Deling
                    </p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums">
                      {activations.length} aktiveringer
                    </p>
                  </div>
                </div>

                <div className="border-border/50 bg-background/70 rounded-2xl border p-3 sm:p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium">Flere detaljer</p>
                      <p className="text-muted-foreground text-xs">
                        Oppsett og koblinger (valgfritt).
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setShowFormOverview((prev) => !prev)}
                    >
                      {showFormOverview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      {showFormOverview ? "Skjul detaljer" : "Vis detaljer"}
                    </Button>
                  </div>
                  {showFormOverview ? (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                        <p className="text-sm font-medium">Skjemaoppsett</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {selectedFormConfirmationMode === "email_copy"
                              ? "E-postbekreftelse"
                              : "Ingen bekreftelse"}
                          </Badge>
                          <Badge variant="outline">
                            {selectedFormLayoutMode === "one_per_screen"
                              ? "Ett spørsmål per skjerm"
                              : "Gruppert visning"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-2 text-xs leading-snug">
                          Juster i «Innstillinger».
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                        <p className="text-sm font-medium">Auto-utfylling</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">Vurdering {mappingSummary.assessment}</Badge>
                          <Badge variant="outline">ROS {mappingSummary.ros}</Badge>
                          <Badge variant="outline">PVV {mappingSummary.pvv}</Badge>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="border-border/50 bg-background/70 space-y-3 rounded-2xl border p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Svar på dette skjemaet</p>
                      <p className="text-muted-foreground text-xs">
                        Klikk for gjennomgang og godkjenning.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{activeFormResponseRows.length} svar</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setShowResponses((prev) => !prev)}
                      >
                        {showResponses ? (
                          <>
                            <ChevronUp className="size-4" />
                            Skjul
                          </>
                        ) : (
                          <>
                            <ChevronDown className="size-4" />
                            Vis
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {showResponses ? (
                    activeFormResponseRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Ingen har sendt inn dette skjemaet ennå.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activeFormResponseRows.map((submission) => (
                          <div
                            key={submission._id}
                            className="rounded-2xl border border-border/50 bg-muted/10 p-4 transition hover:bg-muted/20"
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 flex-col gap-3 text-left md:flex-row md:items-center md:justify-between"
                                onClick={async () => {
                                  setSelectedSubmissionId(submission._id);
                                  setReviewTitle(null);
                                  setReviewPayload(null);
                                  setCreateRos(null);
                                  setRejectionReason("");
                                  setReviewOpen(true);
                                  if (submission.status === "submitted") {
                                    await markUnderReview({ submissionId: submission._id });
                                  }
                                }}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {submission.generatedAssessmentDraft.title}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {new Date(submission.submittedAt).toLocaleString("nb-NO")}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {submission.generatedRosSuggestion.shouldCreateRos ? (
                                    <Badge variant="outline">ROS-forslag</Badge>
                                  ) : null}
                                  {submission.personDataSignal ? (
                                    <Badge variant="outline">Persondata</Badge>
                                  ) : null}
                                  <Badge
                                    variant={
                                      submission.status === "approved"
                                        ? "secondary"
                                        : submission.status === "rejected"
                                          ? "outline"
                                          : "default"
                                    }
                                  >
                                    {submission.status === "submitted"
                                      ? "Ny"
                                      : submission.status === "under_review"
                                        ? "Under vurdering"
                                        : submission.status === "approved"
                                          ? "Godkjent"
                                          : "Avslått"}
                                  </Badge>
                                </div>
                              </button>
                              {canDeleteIntakeSubmissions ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0 rounded-lg text-muted-foreground hover:text-destructive"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleRemoveSubmission(submission);
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  Slett
                                </Button>
                              ) : null}
                            </div>
                            {renderSubmissionGithubStrip(submission)}
                          </div>
                        ))}
                      </div>
                    )
                  ) : null}
                </div>
              </div>
              )
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle>Alle innsendte forslag</CardTitle>
            <CardDescription className="mt-1">
              Samlet kø på tvers av skjemaer — godkjenn for å opprette vurdering.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {submissions.length === 0 ? (
              <div className="border-border/60 bg-muted/10 rounded-2xl border border-dashed p-6 text-center">
                <ClipboardCheck className="text-muted-foreground mx-auto mb-2 size-6" />
                <p className="font-medium">Ingen forslag i køen</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  De dukker opp her når noen sender inn.
                </p>
              </div>
            ) : (
              submissions.map((submission) => (
                <div
                  key={submission._id}
                  className="rounded-2xl border border-border/50 bg-card p-4 transition hover:bg-muted/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={async () => {
                        setSelectedSubmissionId(submission._id);
                        setReviewTitle(null);
                        setReviewPayload(null);
                        setCreateRos(null);
                        setRejectionReason("");
                        setReviewOpen(true);
                        if (submission.status === "submitted") {
                          await markUnderReview({ submissionId: submission._id });
                        }
                      }}
                    >
                      <p className="font-medium">{submission.generatedAssessmentDraft.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {submission.formTitle} ·{" "}
                        {new Date(submission.submittedAt).toLocaleString("nb-NO")}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          submission.status === "approved"
                            ? "secondary"
                            : submission.status === "rejected"
                              ? "outline"
                              : "default"
                        }
                      >
                        {submission.status === "submitted"
                          ? "Ny"
                          : submission.status === "under_review"
                            ? "Under vurdering"
                            : submission.status === "approved"
                              ? "Godkjent"
                              : "Avslått"}
                      </Badge>
                      {canDeleteIntakeSubmissions ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-lg text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveSubmission(submission)}
                        >
                          <Trash2 className="size-4" />
                          Slett
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {submission.personDataSignal ? (
                      <Badge variant="outline">Persondata</Badge>
                    ) : null}
                    {submission.generatedRosSuggestion.shouldCreateRos ? (
                      <Badge variant="outline">ROS-forslag</Badge>
                    ) : null}
                    <Badge variant="outline">
                      {submission.generatedRosSuggestion.risks.length} risikoer
                    </Badge>
                  </div>
                  {renderSubmissionGithubStrip(submission)}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent size="xl" titleId="intake-editor-title">
          <DialogHeader>
            <p id="intake-editor-title" className="font-heading text-lg font-semibold">
              Rediger skjema
            </p>
            <p className="text-muted-foreground text-sm">
              Spørsmål, layout og koblinger til vurdering / ROS / PVV.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <div className="rounded-[28px] border border-border/60 bg-muted/20 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                    <Settings2 className="size-3.5" />
                    Skjemaoppsett
                  </div>
                  <h3 className="font-heading text-xl font-semibold">
                    Navn og visning
                  </h3>
                  <p className="text-muted-foreground max-w-2xl text-sm leading-snug">
                    Tittel, beskrivelse og hvordan spørsmålene vises.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{questions.length} spørsmål</Badge>
                  <Badge variant="outline">
                    {questions.filter((question) => question.visibilityRule).length} oppfølginger
                  </Badge>
                  <Badge variant="outline">
                    {confirmationMode === "email_copy"
                      ? "E-postbekreftelse aktiv"
                      : "Ingen e-postbekreftelse"}
                  </Badge>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                <div className="space-y-4 rounded-2xl border border-border/60 bg-background p-4">
                  <div className="space-y-2">
                    <Label>Navn</Label>
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="F.eks. Innmelding av ny prosess"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Beskrivelse</Label>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Kort hjelpetekst som forklarer hvorfor skjemaet fylles ut."
                    />
                  </div>
                </div>
                <div className="space-y-4 rounded-2xl border border-border/60 bg-background p-4">
                  <div className="space-y-2">
                    <Label>Layout</Label>
                    <select
                      className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                      value={layoutMode}
                      onChange={(event) =>
                        setLayoutMode(
                          event.target.value as "one_per_screen" | "grouped",
                        )
                      }
                    >
                      <option value="one_per_screen">Steg for steg (flere spørsmål per side)</option>
                      <option value="grouped">Gruppert skjema</option>
                    </select>
                  </div>
                  {layoutMode === "one_per_screen" ? (
                    <div className="space-y-2">
                      <Label htmlFor="intake-questions-per-page">Spørsmål per side</Label>
                      <Input
                        id="intake-questions-per-page"
                        type="number"
                        min={1}
                        max={25}
                        className="h-10 rounded-xl"
                        value={questionsPerPage}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          if (!Number.isFinite(parsed)) {
                            return;
                          }
                          setQuestionsPerPage(Math.min(25, Math.max(1, parsed)));
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Hvor mange synlige spørsmål som vises før «Neste» i den offentlige
                        flyten (1–25).
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label>Bekreftelse til svarer</Label>
                    <select
                      className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
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
                    <p className="text-xs text-muted-foreground">
                      Når e-postbekreftelse er aktiv, må den som svarer oppgi e-post på
                      slutten av skjemaet.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Spørsmål</p>
                  <p className="text-sm text-muted-foreground">
                    Hold dem korte og konkrete. Unngå fagord.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      const nextQuestions = defaultIntakeQuestions();
                      setQuestions(nextQuestions);
                      setExpandedQuestionIds(nextQuestions.map((question) => question.id));
                      setMappingSectionOpenIds(
                        questionIdsWithMappingSectionInitiallyOpen(nextQuestions),
                      );
                    }}
                  >
                    <Sparkles className="size-4" />
                    Bruk eksempel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      const nextQuestion = emptyQuestion();
                      updateQuestions((prev) => [...prev, nextQuestion]);
                      setExpandedQuestionIds((prev) => [...prev, nextQuestion.id]);
                    }}
                  >
                    <Plus className="size-4" />
                    Nytt spørsmål
                  </Button>
                  <Button type="button" variant="ghost" className="rounded-xl" onClick={openAllQuestions}>
                    Vis alle
                  </Button>
                  <Button type="button" variant="ghost" className="rounded-xl" onClick={closeAllQuestions}>
                    Skjul alle
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
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
          </DialogBody>
          <DialogFooter className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleArchiveForm}>
                Arkiver
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Lukk
              </Button>
              <Button type="button" onClick={handleSaveForm}>
                Lagre skjema
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent size="xl" titleId="intake-settings-title">
          <DialogHeader>
            <p id="intake-settings-title" className="font-heading text-lg font-semibold">
              ROS, mal og lenker
            </p>
            <p className="text-muted-foreground text-sm leading-snug">
              Publisering og sletting ligger på hovedsiden over.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-5">
            {selectedForm ? (
              <>
                <section className="border-border/60 bg-card rounded-2xl border p-4 shadow-sm sm:p-5">
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
                  <div className="grid gap-3 md:grid-cols-2">
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

                <section className="border-border/60 bg-card rounded-2xl border p-4 shadow-sm sm:p-5">
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
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <div className="space-y-2">
                            <Label className="text-sm" htmlFor="settings-activate-workspace">
                              Aktiver i arbeidsområde
                            </Label>
                            <select
                              id="settings-activate-workspace"
                              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
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
                            className="rounded-xl sm:min-w-[10rem]"
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

                <section className="border-border/60 bg-card rounded-2xl border p-4 shadow-sm sm:p-5">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold leading-tight">Delbare lenker</h3>
                    <p className="text-muted-foreground text-xs leading-snug">
                      Utløp, maks svar, åpen eller e-post.
                    </p>
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-sm" htmlFor="settings-link-expires">
                          Utløper
                        </Label>
                        <Input
                          id="settings-link-expires"
                          type="datetime-local"
                          value={expiresAt}
                          onChange={(event) => setExpiresAt(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm" htmlFor="settings-link-max">
                          Maks svar
                        </Label>
                        <Input
                          id="settings-link-max"
                          value={maxResponses}
                          onChange={(event) => setMaxResponses(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                        <Label className="text-sm" htmlFor="settings-link-access">
                          Tilgang
                        </Label>
                        <select
                          id="settings-link-access"
                          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
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
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" className="rounded-xl" onClick={handleCreateLink}>
                        <Link2 className="size-4" />
                        Opprett lenke
                      </Button>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    {links.length === 0 ? (
                      <p className="text-muted-foreground text-xs">Ingen lenker ennå.</p>
                    ) : (
                      links.map((link) => (
                        <div
                          key={link._id}
                          className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-1 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={link.isActive ? "secondary" : "outline"}>
                                {renderLinkStatusLabel(link.status)}
                              </Badge>
                              <span className="text-muted-foreground">
                                {link.responseCount}
                                {link.maxResponses ? ` / ${link.maxResponses}` : ""} svar
                              </span>
                            </div>
                            <p className="break-all text-xs text-muted-foreground">
                              {typeof window !== "undefined"
                                ? `${window.location.origin}/f/${link.token}`
                                : `/f/${link.token}`}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/f/${link.token}`,
                                )
                              }
                            >
                              <ExternalLink className="size-4" />
                              Kopier
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() =>
                                link.status === "paused"
                                  ? resumeLink({ linkId: link._id })
                                  : pauseLink({ linkId: link._id })
                              }
                            >
                              {link.status === "paused" ? "Fortsett" : "Pause"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => removeLink({ linkId: link._id })}
                            >
                              <Trash2 className="size-4" />
                              Slett
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
        <DialogContent size="xl" titleId="submission-review-title">
          <DialogHeader>
            <p id="submission-review-title" className="font-heading text-lg font-semibold">
              Gjennomgå forslag
            </p>
            <p className="text-sm text-muted-foreground">
              Sammenlign innsendte svar med auto-generert vurdering før du godkjenner.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-6">
            {submissionDetail ? (
              <>
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
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Innsendte svar</p>
                      <p className="text-sm text-muted-foreground">
                        {submissionDetail.form?.title ?? "Skjema"} ·{" "}
                        {new Date(submissionDetail.submission.submittedAt).toLocaleString(
                          "nb-NO",
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                          className="rounded-2xl border border-border/50 bg-muted/10 p-4"
                        >
                          <p className="text-sm font-medium">{question.label}</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                            {answerLabel}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Generert vurdering</p>
                      <p className="text-sm text-muted-foreground">
                        Endringer merkes som auto-generert eller manuelt justert.
                      </p>
                    </div>
                    <div className="w-full max-w-xs">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Forslag klart til gjennomgang</span>
                        <span>100 %</span>
                      </div>
                      <Progress value={100} className="h-2 rounded-full" />
                    </div>
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
          <DialogFooter className="flex flex-wrap justify-between gap-2">
            {submissionDetail && submissionDetail.submission.status !== "approved" ? (
              <div className="flex gap-2">
                <div className="space-y-2">
                  <Textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Skriv kort hvorfor forslaget avslås"
                    className="min-h-24 w-[22rem]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dette er påkrevd ved avslag og vises internt som begrunnelse.
                  </p>
                  {rejectionReasonMissing ? (
                    <p className="text-xs text-destructive">
                      Legg inn en kort begrunnelse før du klikker «Avslå».
                    </p>
                  ) : null}
                </div>
              </div>
            ) : submissionDetail?.submission.status === "approved" ? (
              <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                Godkjente forslag kan ikke godkjennes eller avslås på nytt her.
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {submissionDetail && canDeleteIntakeSubmissions ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
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
              <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>
                Lukk
              </Button>
              {submissionDetail && submissionDetail.submission.status !== "approved" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReject}
                    disabled={rejectionReasonMissing}
                  >
                    <XCircle className="size-4" />
                    Avslå
                  </Button>
                  <Button type="button" onClick={handleApprove}>
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
