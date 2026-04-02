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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  INTAKE_MAPPING_TARGET_LABELS,
  defaultIntakeQuestions,
  detectTechnicalTerms,
} from "@/lib/intake-form";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Link2,
  Plus,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type EditableQuestion = {
  id: string;
  label: string;
  helpText?: string;
  questionType: "text" | "multiple_choice" | "scale" | "yes_no";
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
    | { kind: "derivedFrequency" }
    | { kind: "rosConsequence" }
    | { kind: "rosRiskDescription" }
    | { kind: "pvvPersonalData" }
  >;
};

type ReviewPayload = AssessmentPayload;

type FormSummary = {
  _id: Id<"intakeForms">;
  title: string;
  status: "draft" | "published" | "archived";
  confirmationMode: "none" | "email_copy";
  questionCount: number;
  responseCount: number;
};

type FormEditorData = {
  form: {
    _id: Id<"intakeForms">;
    title: string;
    description?: string;
    status: "draft" | "published" | "archived";
    layoutMode: "one_per_screen" | "grouped";
    confirmationMode: "none" | "email_copy";
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
};

type SubmissionDetail = {
  form: { title?: string } | null;
  questions: Array<{ _id: string; label: string }>;
  submission: {
    _id: Id<"intakeSubmissions">;
    submittedAt: number;
    status: "submitted" | "under_review" | "approved" | "rejected";
    personDataSignal: boolean;
    answers: Array<
      | { questionId: string; kind: "text"; value: string }
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

const REVIEW_FIELDS = [
  ["processName", "Prosessnavn"],
  ["processDescription", "Beskrivelse"],
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

function formatDateTimeLocal(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderQuestionTypeLabel(kind: EditableQuestion["questionType"]) {
  switch (kind) {
    case "text":
      return "Tekst";
    case "multiple_choice":
      return "Flervalg";
    case "scale":
      return "Skala 1-5";
    case "yes_no":
      return "Ja / Nei";
  }
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
                  if (target.kind === "assessmentText" || target.kind === "assessmentScale") {
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
  confirmationMode,
  questions,
}: {
  title: string;
  description: string;
  layoutMode: "one_per_screen" | "grouped";
  confirmationMode: "none" | "email_copy";
  questions: PreviewQuestion[];
}) {
  const previewQuestions =
    layoutMode === "one_per_screen" ? questions.slice(0, 1) : questions;

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
              ? "Ett spørsmål per skjerm"
              : "Gruppert skjema"}
          </span>
          <span>{questions.length} spørsmål</span>
        </div>
        <Progress
          value={questions.length > 0 ? (layoutMode === "one_per_screen" ? 25 : 100) : 0}
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
      {layoutMode === "one_per_screen" && questions.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          Forhåndsvisningen viser første skjerm. Resten av spørsmålene vises ett og ett
          i den offentlige flyten.
        </p>
      ) : null}
    </div>
  );
}

export function IntakeWorkspacePage({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const formsQuery = useQuery(api.intakeForms.listByWorkspace, { workspaceId });
  const submissionsQuery = useQuery(api.intakeSubmissions.listByWorkspace, {
    workspaceId,
  });
  const rosTemplatesQuery = useQuery(api.ros.listTemplates, { workspaceId });

  const createForm = useMutation(api.intakeForms.create);
  const saveForm = useMutation(api.intakeForms.save);
  const archiveForm = useMutation(api.intakeForms.archive);
  const createLink = useMutation(api.intakeLinks.create);
  const pauseLink = useMutation(api.intakeLinks.pause);
  const resumeLink = useMutation(api.intakeLinks.resume);
  const removeLink = useMutation(api.intakeLinks.remove);
  const approveSubmission = useMutation(api.intakeSubmissions.approve);
  const rejectSubmission = useMutation(api.intakeSubmissions.reject);
  const markUnderReview = useMutation(api.intakeSubmissions.markUnderReview);

  const [selectedFormId, setSelectedFormId] = useState<Id<"intakeForms"> | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] =
    useState<Id<"intakeSubmissions"> | null>(null);
  const activeFormId =
    selectedFormId ??
    (((formsQuery ?? []) as FormSummary[])[0]?._id ?? null);

  const editorDataQuery = useQuery(
    api.intakeForms.getEditor,
    activeFormId ? { formId: activeFormId } : "skip",
  );
  const linksQuery = useQuery(
    api.intakeLinks.listByForm,
    activeFormId ? { formId: activeFormId } : "skip",
  );
  const submissionDetailQuery = useQuery(
    api.intakeSubmissions.getDetail,
    selectedSubmissionId ? { submissionId: selectedSubmissionId } : "skip",
  );

  const forms = useMemo(
    () => (formsQuery ?? []) as FormSummary[],
    [formsQuery],
  );
  const submissions = useMemo(
    () => (submissionsQuery ?? []) as SubmissionSummary[],
    [submissionsQuery],
  );
  const rosTemplates = useMemo(
    () => (rosTemplatesQuery ?? []) as Array<{ _id: Id<"rosTemplates"> }>,
    [rosTemplatesQuery],
  );
  const editorData = (editorDataQuery ?? null) as FormEditorData | null;
  const links = (linksQuery ?? []) as LinkRow[];
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
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<string[]>([]);
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

  const selectedForm = forms.find((form) => form._id === activeFormId) ?? null;
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
    setStatus(source.form.status);
    setConfirmationMode(source.form.confirmationMode);
    const nextQuestions = normalizeQuestionVisibility(
      source.questions.map((question) => ({
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
    setQuestions(nextQuestions);
    setExpandedQuestionIds(nextQuestions.map((question) => question.id));
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

  function setFollowUpEnabled(questionId: string, enabled: boolean) {
    const questionIndex = questions.findIndex((question) => question.id === questionId);
    if (questionIndex === -1) {
      return;
    }
    const availableParents = questions
      .slice(0, questionIndex)
      .filter((candidate) => candidate.questionType !== "text");

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
    if (!parent || parent.questionType === "text") {
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
      setStatus("draft");
      setConfirmationMode("none");
      setEditorOpen(true);
      const nextQuestions = defaultIntakeQuestions();
      setQuestions(nextQuestions);
      setExpandedQuestionIds(nextQuestions.map((question) => question.id));
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

  async function handleArchiveForm() {
    if (!activeFormId) return;
    try {
      await archiveForm({ formId: activeFormId });
      toast.success("Skjema arkivert.");
      setEditorOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke arkivere skjema.");
    }
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
          (submissionDetail.submission.generatedRosSuggestion.shouldCreateRos &&
            rosTemplates.length > 0),
      });
      toast.success("Forslaget er godkjent.");
      setReviewOpen(false);
      setSelectedSubmissionId(null);
      if (result.assessmentId) {
        window.location.href = `/w/${workspaceId}/a/${result.assessmentId}`;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke godkjenne forslaget.");
    }
  }

  async function handleReject() {
    if (!selectedSubmissionId) return;
    try {
      await rejectSubmission({
        submissionId: selectedSubmissionId,
        reason: rejectionReason,
      });
      toast.success("Forslaget er avslått.");
      setReviewOpen(false);
      setSelectedSubmissionId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke avslå forslaget.");
    }
  }

  if (formsQuery === undefined || submissionsQuery === undefined) {
    return <p className="text-sm text-muted-foreground">Laster skjemaer …</p>;
  }

  const pendingCount = submissions.filter(
    (submission) => submission.status === "submitted" || submission.status === "under_review",
  ).length;
  const activeFormResponseRows = activeFormId
    ? submissions.filter((submission) => submission.formId === activeFormId)
    : [];
  const mappingSummary = questions.reduce(
    (acc, question) => {
      for (const target of question.mappingTargets) {
        if (target.kind === "assessmentText" || target.kind === "assessmentScale") {
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

  return (
    <div className="space-y-8 pb-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/10 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Form Builder
            </p>
            <h1 className="font-heading text-xl font-semibold tracking-tight">
              Skjema og intake
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Lag enkle skjema for ansatte eller eksterne, samle forslag og godkjenn
              dem før det blir opprettet vurdering og ROS.
            </p>
          </div>
          <Button type="button" className="h-11 rounded-xl" onClick={handleCreateForm}>
            <Plus className="size-4" />
            Nytt skjema
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Skjemaer</CardDescription>
              <CardTitle>{forms.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Ventende forslag</CardDescription>
              <CardTitle>{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>ROS-maler</CardDescription>
              <CardTitle>{rosTemplates?.length ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-3xl">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Skjemaer</CardTitle>
              <CardDescription>
                Velg et skjema for å redigere spørsmål, koblinger og delbare lenker.
              </CardDescription>
            </div>
            {selectedForm ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  primeEditorState(editorData);
                  setEditorOpen(true);
                }}
              >
                Rediger skjema
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {forms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
                <FileText className="mx-auto mb-3 size-6 text-muted-foreground" />
                <p className="font-medium">Ingen skjemaer ennå</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start med et enkelt skjema og legg inn vanlige spørsmål i klart språk.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {forms.map((form) => (
                  <button
                    key={form._id}
                    type="button"
                    onClick={() => setSelectedFormId(form._id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedFormId === form._id
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:bg-muted/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{form.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {form.questionCount} spørsmål · {form.responseCount} svar
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {form.confirmationMode === "email_copy"
                            ? "Sender bekreftelse til svarers e-post"
                            : "Ingen e-postbekreftelse"}
                        </p>
                      </div>
                      <Badge variant={form.status === "published" ? "secondary" : "outline"}>
                        {form.status === "published"
                          ? "Publisert"
                          : form.status === "archived"
                            ? "Arkivert"
                            : "Utkast"}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedForm ? (
              <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Kobling og forhåndsvisning</p>
                    <p className="text-xs text-muted-foreground">
                      Se hvordan skjemaet ser ut, og hvilke spørsmål som fyller vurdering,
                      ROS og PVV.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      primeEditorState(editorData);
                      setPreviewOpen(true);
                    }}
                  >
                    <ExternalLink className="size-4" />
                    Forhåndsvis skjema
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Vurdering {mappingSummary.assessment}
                  </Badge>
                  <Badge variant="outline">ROS {mappingSummary.ros}</Badge>
                  <Badge variant="outline">PVV {mappingSummary.pvv}</Badge>
                  <Badge variant="outline">
                    {confirmationMode === "email_copy"
                      ? "E-postbekreftelse på"
                      : "Ingen bekreftelse"}
                  </Badge>
                  <Badge variant="outline">
                    {layoutMode === "one_per_screen"
                      ? "Ett spørsmål per skjerm"
                      : "Gruppert visning"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Delbar lenke</p>
                  <p className="text-xs text-muted-foreground">
                    Opprett offentlig lenke med utløpsdato og maks antall svar.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Utløper</Label>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(event) => setExpiresAt(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Maks svar</Label>
                    <Input
                      value={maxResponses}
                      onChange={(event) => setMaxResponses(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tilgang</Label>
                    <select
                      className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
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
                <Button type="button" className="rounded-xl" onClick={handleCreateLink}>
                  <Link2 className="size-4" />
                  Opprett lenke
                </Button>

                <div className="space-y-2">
                  {(links ?? []).map((link) => (
                    <div
                      key={link._id}
                      className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
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
                      <div className="flex gap-2">
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
                          {link.status === "paused" ? (
                            <>
                              <ExternalLink className="size-4" />
                              Fortsett
                            </>
                          ) : (
                            <>
                              <Trash2 className="size-4" />
                              Pause
                            </>
                          )}
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
                  ))}
                </div>
                <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Svar på dette skjemaet</p>
                      <p className="text-xs text-muted-foreground">
                        Åpne et svar for å se detaljer, auto-generert vurdering og ROS-forslag.
                      </p>
                    </div>
                    <Badge variant="outline">{activeFormResponseRows.length} svar</Badge>
                  </div>
                  {activeFormResponseRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Ingen har sendt inn dette skjemaet ennå.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {activeFormResponseRows.map((submission) => (
                        <button
                          key={submission._id}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/10 p-3 text-left transition hover:bg-muted/20"
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
                          <div>
                            <p className="text-sm font-medium">
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
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Forslag til vurdering</CardTitle>
            <CardDescription>
              Innsendte svar blir liggende her til gjennomgang. Godkjenning oppretter
              vurdering, og ROS er valgfritt hvis skjemaet peker på risiko.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submissions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
                <ClipboardCheck className="mx-auto mb-3 size-6 text-muted-foreground" />
                <p className="font-medium">Ingen forslag ennå</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Når noen sender inn et skjema, vises det her som et forslag til
                  vurdering.
                </p>
              </div>
            ) : (
              submissions.map((submission) => (
                <button
                  key={submission._id}
                  type="button"
                  className="w-full rounded-2xl border border-border/50 bg-card p-4 text-left transition hover:bg-muted/10"
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{submission.generatedAssessmentDraft.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {submission.formTitle} ·{" "}
                        {new Date(submission.submittedAt).toLocaleString("nb-NO")}
                      </p>
                    </div>
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
                </button>
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
            <p className="text-sm text-muted-foreground">
              Skriv spørsmål i klart språk og koble dem til vurdering, ROS og PVV.
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
                    Gjør skjemaet klart for deling
                  </h3>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Start med navn og introduksjon, og finjuster deretter hvordan svareren
                    møter skjemaet.
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
                      <option value="one_per_screen">Ett spørsmål per skjerm</option>
                      <option value="grouped">Gruppert skjema</option>
                    </select>
                  </div>
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
                    .filter((candidate) => candidate.questionType !== "text");
                  const selectedParent = availableParentQuestions.find(
                    (candidate) => candidate.id === question.visibilityRule?.parentQuestionKey,
                  );
                  const isExpanded = expandedQuestionIds.includes(question.id);
                  const mappingCount = question.mappingTargets.length;
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
                            ) : question.questionType !== "text" ? (
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
                            ) : question.questionType === "text" ? (
                              <div className="rounded-xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground">
                                Tekstspørsmål kan ikke styre oppfølgingslogikk. Bruk Ja / Nei,
                                flervalg eller skala hvis dette spørsmålet skal ha oppfølging.
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
                            <div>
                              <Label>Koblinger</Label>
                              <p className="text-xs text-muted-foreground">
                                Velg hvilke felter dette spørsmålet skal fylle ut automatisk.
                              </p>
                            </div>
                            <MappingTargetPicker
                              question={question}
                              onChange={(next) =>
                                updateSingleQuestion(question.id, (item) => ({
                                  ...item,
                                  mappingTargets: next,
                                }))
                              }
                            />
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
                        (submissionDetail.submission.generatedRosSuggestion
                          .shouldCreateRos &&
                          rosTemplates.length > 0)
                      }
                      disabled={(rosTemplates?.length ?? 0) === 0}
                      onChange={(event) => setCreateRos(event.target.checked)}
                    />
                    <span>
                      <span className="font-medium">Opprett ROS-utkast ved godkjenning</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {(rosTemplates?.length ?? 0) > 0
                          ? "Bruker første tilgjengelige ROS-mal i arbeidsområdet."
                          : "Du trenger minst én ROS-mal før dette kan brukes."}
                      </span>
                    </span>
                  </label>
                </section>

                {submissionDetail.submission.status === "approved" &&
                submissionDetail.submission.approvedAssessmentId ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                    <div className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-100">
                      <CheckCircle2 className="size-4" />
                      Forslaget er allerede godkjent
                    </div>
                    <div className="mt-2">
                      <Link
                        href={`/w/${workspaceId}/a/${submissionDetail.submission.approvedAssessmentId}`}
                        className="inline-flex items-center gap-1 font-medium underline"
                      >
                        Åpne opprettet vurdering
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Laster forslag …</p>
            )}
          </DialogBody>
          <DialogFooter className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <Textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Begrunnelse ved avslag"
                className="min-h-24 w-[22rem]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>
                Lukk
              </Button>
              <Button type="button" variant="outline" onClick={handleReject}>
                <XCircle className="size-4" />
                Avslå
              </Button>
              <Button type="button" onClick={handleApprove}>
                <CheckCircle2 className="size-4" />
                Godkjenn og opprett vurdering
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
