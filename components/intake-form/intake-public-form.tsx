"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Moon,
  ShieldAlert,
  Sparkles,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type AnswerState = Record<string, string | number | boolean>;
type SubmissionAnswer =
  | { questionId: string; kind: "text"; value: string }
  | { questionId: string; kind: "number"; value: number }
  | { questionId: string; kind: "multiple_choice"; optionId: string; label: string }
  | { questionId: string; kind: "scale"; value: number }
  | { questionId: string; kind: "yes_no"; value: boolean };
type StoredDraft = {
  answers: AnswerState;
  name: string;
  email: string;
  step: number;
};
type PublicTheme = "light" | "dark";

type PublicQuestion = {
  _id: string;
  questionKey: string;
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
};

function matchesVisibilityRule(
  question: PublicQuestion,
  answers: AnswerState,
  questionIdByKey: Map<string, string>,
) {
  const rule = question.visibilityRule;
  if (!rule) {
    return true;
  }
  const parentQuestionId = questionIdByKey.get(rule.parentQuestionKey);
  if (!parentQuestionId) {
    return false;
  }
  const parentValue = answers[parentQuestionId];
  switch (rule.match.kind) {
    case "yes_no":
      return parentValue === rule.match.value;
    case "multiple_choice":
      return parentValue === rule.match.optionId;
    case "scale":
      return parentValue === rule.match.value;
  }
}

function getVisibleQuestions(questions: PublicQuestion[], answers: AnswerState) {
  const questionIdByKey = new Map(questions.map((question) => [question.questionKey, question._id]));
  const visibleQuestionKeys = new Set<string>();

  return questions.filter((question) => {
    const visible = matchesVisibilityRule(question, answers, questionIdByKey);
    if (visible) {
      visibleQuestionKeys.add(question.questionKey);
      return !question.visibilityRule || visibleQuestionKeys.has(question.visibilityRule.parentQuestionKey);
    }
    return false;
  });
}

function chunkQuestionPages<T>(items: T[], pageSize: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const size = Math.max(1, Math.min(25, Math.floor(pageSize)));
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

function storageKey(token: string) {
  return `intake-public-draft:${token}`;
}

function readStoredDraft(token: string): StoredDraft | null {
  if (typeof window === "undefined" || !token) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(token));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    return {
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
      name: typeof parsed.name === "string" ? parsed.name : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      step: typeof parsed.step === "number" && Number.isFinite(parsed.step) ? parsed.step : 0,
    };
  } catch {
    return null;
  }
}

function clearStoredDraft(token: string) {
  if (typeof window === "undefined" || !token) {
    return;
  }
  window.localStorage.removeItem(storageKey(token));
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function parseNumberAnswer(value: string | number | boolean | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readPublicTheme(): PublicTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem("intake-public-theme");
  return stored === "dark" ? "dark" : "light";
}

function PublicThemeToggle({
  theme,
  onChange,
}: {
  theme: PublicTheme;
  onChange: (theme: PublicTheme) => void;
}) {
  const isClient = useIsClient();
  const activeTheme = isClient ? theme : "light";

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/85 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/85">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "size-10 rounded-full text-muted-foreground",
          activeTheme === "light" && "bg-foreground text-background hover:bg-foreground/90",
        )}
        onClick={() => onChange("light")}
        aria-label="Bruk lyst tema"
        title="Lyst tema"
      >
        <Sun className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "size-10 rounded-full text-muted-foreground",
          activeTheme === "dark" && "bg-foreground text-background hover:bg-foreground/90",
        )}
        onClick={() => onChange("dark")}
        aria-label="Bruk mørkt tema"
        title="Mørkt tema"
      >
        <Moon className="size-4" />
      </Button>
    </div>
  );
}

export function IntakePublicForm({ token }: { token: string }) {
  const data = useQuery(api.intakeLinks.getPublicForm, { token });
  const submitPublic = useMutation(api.intakeSubmissions.submitPublic);
  const initialDraft = readStoredDraft(token);
  const [publicTheme, setPublicTheme] = useState<PublicTheme>(() => readPublicTheme());

  const [step, setStep] = useState(initialDraft?.step ?? 0);
  const [answers, setAnswers] = useState<AnswerState>(initialDraft?.answers ?? {});
  const [name, setName] = useState(initialDraft?.name ?? "");
  const [email, setEmail] = useState(initialDraft?.email ?? "");
  const [submitted, setSubmitted] = useState<{
    title: string;
    shouldCreateRos: boolean;
    confirmationMode?: "none" | "email_copy";
  } | null>(null);
  const openData =
    data && data.kind === "open"
      ? (data as {
          kind: "open";
          form: {
            title: string;
            description?: string;
            layoutMode: "one_per_screen" | "grouped";
            questionsPerPage?: number;
            confirmationMode: "none" | "email_copy";
          };
          link: {
            restrictedAccessMode: "anonymous" | "email_required";
          };
          questions: PublicQuestion[];
        })
      : null;
  const questions = useMemo<PublicQuestion[]>(
    () => openData?.questions ?? [],
    [openData],
  );
  const visibleQuestions = useMemo(
    () => getVisibleQuestions(questions, answers),
    [answers, questions],
  );
  const groupedMode = openData?.form.layoutMode === "grouped";
  const steppedPageSize = useMemo(() => {
    if (!openData || openData.form.layoutMode === "grouped") {
      return 1;
    }
    const raw = openData.form.questionsPerPage;
    const n = raw === undefined || raw === null ? 1 : Math.floor(raw);
    return Math.min(25, Math.max(1, Number.isFinite(n) ? n : 1));
  }, [openData]);

  const questionPages = useMemo(() => {
    if (!openData || groupedMode) {
      return [];
    }
    return chunkQuestionPages(visibleQuestions, steppedPageSize);
  }, [groupedMode, openData, steppedPageSize, visibleQuestions]);

  const pageCount = questionPages.length;
  const stepIndex = groupedMode ? 0 : Math.min(step, pageCount);
  const totalSteps = groupedMode ? 1 : Math.max(1, pageCount + 1);
  const progressValue = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;
  const isFinalStep = !groupedMode && (pageCount === 0 || stepIndex === pageCount);
  const showContactSection = groupedMode || isFinalStep;

  const currentPageQuestions = useMemo(() => {
    if (groupedMode || isFinalStep) {
      return [];
    }
    return questionPages[stepIndex] ?? [];
  }, [groupedMode, isFinalStep, questionPages, stepIndex]);

  useEffect(() => {
    if (typeof window === "undefined" || !token || submitted || !openData) {
      return;
    }
    window.localStorage.setItem(
      storageKey(token),
      JSON.stringify({
        answers,
        name,
        email,
        step: stepIndex,
      } satisfies StoredDraft),
    );
  }, [answers, email, name, openData, stepIndex, submitted, token]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("intake-public-theme", publicTheme);
  }, [publicTheme]);

  function isAnswered(questionId: string) {
    const value = answers[questionId];
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "boolean") return true;
    return false;
  }

  function validateCurrentStep() {
    if (groupedMode || isFinalStep) return true;
    for (const currentQuestion of currentPageQuestions) {
      if (!currentQuestion.required) {
        continue;
      }
      if (!isAnswered(currentQuestion._id)) {
        toast.error("Svar på alle obligatoriske felt før du går videre.");
        return false;
      }
      if (
        currentQuestion.questionType === "number" &&
        parseNumberAnswer(answers[currentQuestion._id]) === null
      ) {
        toast.error(`Skriv inn et gyldig tall for «${currentQuestion.label}».`);
        return false;
      }
    }
    return true;
  }

  function updateAnswer(questionId: string, value: string | number | boolean) {
    setAnswers((prev) => {
      const nextAnswers = { ...prev, [questionId]: value };
      const nextVisibleQuestionIds = new Set(
        getVisibleQuestions(questions, nextAnswers).map((question) => question._id),
      );
      return Object.fromEntries(
        Object.entries(nextAnswers).filter(([key]) => nextVisibleQuestionIds.has(key)),
      );
    });
  }

  async function handleSubmit() {
    if (!openData) return;
    for (const question of visibleQuestions) {
      if (question.required && !isAnswered(question._id)) {
        toast.error(`Svar mangler for «${question.label}».`);
        return;
      }
      if (
        question.questionType === "number" &&
        isAnswered(question._id) &&
        parseNumberAnswer(answers[question._id]) === null
      ) {
        toast.error(`Skriv inn et gyldig tall for «${question.label}».`);
        return;
      }
    }
    const preparedAnswers: SubmissionAnswer[] = visibleQuestions.flatMap(
      (question: PublicQuestion): SubmissionAnswer[] => {
        const value = answers[question._id];
        if (!isAnswered(question._id)) {
          return [];
        }
        if (question.questionType === "text") {
          return [
            {
              questionId: question._id,
              kind: "text" as const,
              value: String(value ?? ""),
            },
          ];
        }
        if (question.questionType === "number") {
          const numericValue = parseNumberAnswer(value);
          return numericValue === null
            ? []
            : [
                {
                  questionId: question._id,
                  kind: "number" as const,
                  value: numericValue,
                },
              ];
        }
        if (question.questionType === "multiple_choice") {
          const option = question.options.find(
            (item: { id: string; label: string }) => item.id === value,
          );
          return [
            {
              questionId: question._id,
              kind: "multiple_choice" as const,
              optionId: String(value ?? ""),
              label: option?.label ?? "",
            },
          ];
        }
        if (question.questionType === "scale") {
          return [
            {
              questionId: question._id,
              kind: "scale" as const,
              value: Number(value ?? 3),
            },
          ];
        }
        return [
          {
            questionId: question._id,
            kind: "yes_no" as const,
            value: Boolean(value),
          },
        ];
      },
    );
    try {
      const result = await submitPublic({
        token,
        submitterMeta: {
          name: name.trim() || undefined,
          email: email.trim() || undefined,
        },
        answers: preparedAnswers,
      });
      clearStoredDraft(token);
      setSubmitted(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke sende inn skjema.");
    }
  }

  if (data === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <ShieldAlert className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="font-heading text-xl font-semibold">Skjemaet er ikke tilgjengelig</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Lenken kan være utløpt eller trukket tilbake.
        </p>
      </div>
    );
  }

  if (data.kind === "closed") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Clock3 className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="font-heading text-xl font-semibold">
          {data.reason === "paused" ? "Skjemaet er pauset" : "Skjemaet er stengt"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.reason === "paused"
            ? "Lenken er midlertidig pauset og kan ikke vises eller besvares akkurat nå."
            : "Dette skjemaet tar ikke imot flere svar akkurat nå."}
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className={cn(publicTheme === "dark" ? "dark" : undefined)}
        style={{ colorScheme: publicTheme }}
      >
        <div className="min-h-screen bg-zinc-50 text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-50">
        <div className="bg-[radial-gradient(circle_at_top,_rgba(120,120,120,0.10),_transparent_40%),linear-gradient(to_bottom,_transparent,_rgba(120,120,120,0.04))] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto flex max-w-3xl justify-end">
          <PublicThemeToggle theme={publicTheme} onChange={setPublicTheme} />
        </div>
        <div className="mx-auto max-w-2xl py-6">
        <Card className="rounded-[2rem] border-border/60 bg-background/85 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur transition-colors dark:border-white/10 dark:bg-zinc-900/85">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="size-7 text-emerald-600" />
            </div>
            <CardTitle>Takk for innsendingen</CardTitle>
            <CardDescription>
              Forslaget er sendt inn til gjennomgang før det eventuelt blir opprettet
              vurdering og ROS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center text-sm text-muted-foreground">
            <p>Foreslått sak: {submitted.title}</p>
            <p>
              {submitted.shouldCreateRos
                ? "Svarene peker på mulig behov for ROS."
                : "Svarene er registrert som forslag til vurdering."}
            </p>
            {submitted.confirmationMode === "email_copy" ? (
              <p>En kopi av svarene dine blir sendt til e-posten du oppga.</p>
            ) : null}
          </CardContent>
        </Card>
        </div>
        </div>
        </div>
      </div>
    );
  }

  if (!openData) {
    return null;
  }

  return (
    <div
      className={publicTheme === "dark" ? "dark" : undefined}
      style={{ colorScheme: publicTheme }}
    >
      <div className="min-h-screen bg-zinc-50 text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-50">
      <div className="bg-[radial-gradient(circle_at_top,_rgba(120,120,120,0.10),_transparent_40%),linear-gradient(to_bottom,_transparent,_rgba(120,120,120,0.04))] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5" />
              Skjema
            </div>
            <div className="space-y-1">
              <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                {openData.form.title}
              </h1>
              {openData.form.description ? (
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {openData.form.description}
                </p>
              ) : null}
            </div>
          </div>
          <PublicThemeToggle theme={publicTheme} onChange={setPublicTheme} />
        </div>

        <div className="mb-6 rounded-[1.75rem] border border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur sm:p-5 dark:border-white/10 dark:bg-zinc-900/70">
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {isFinalStep
                ? `Til slutt ${pageCount + 1} av ${totalSteps}`
                : pageCount > 0
                  ? `Side ${stepIndex + 1} av ${pageCount}`
                  : ""}
            </span>
            <span className="font-medium">{Math.round(progressValue)} %</span>
          </div>
          <Progress value={progressValue} className="h-2.5 rounded-full" />
        </div>

        <Card className="rounded-[2rem] border-border/60 bg-background/85 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur transition-colors dark:border-white/10 dark:bg-zinc-900/85">
        <CardContent className="space-y-8 p-6 sm:p-10">
          {groupedMode ? (
            <div className="space-y-8">
              {visibleQuestions.map((question, index) => (
                <QuestionRenderer
                  key={question._id}
                  question={question}
                  index={index}
                  value={answers[question._id]}
                  onChange={(value) => updateAnswer(question._id, value)}
                />
              ))}
            </div>
          ) : currentPageQuestions.length > 0 ? (
            <div className="space-y-10">
              {currentPageQuestions.map((question) => {
                const globalIndex = visibleQuestions.findIndex((q) => q._id === question._id);
                return (
                  <QuestionRenderer
                    key={question._id}
                    question={question}
                    index={globalIndex >= 0 ? globalIndex : stepIndex}
                    value={answers[question._id]}
                    onChange={(value) => updateAnswer(question._id, value)}
                  />
                );
              })}
            </div>
          ) : null}

          {showContactSection ? (
            <div className="space-y-4 rounded-[1.5rem] border border-border/60 bg-muted/20 p-5 sm:p-6 dark:border-white/10 dark:bg-zinc-900/60">
              <div className="space-y-1">
                <p className="text-base font-semibold">Til slutt</p>
                <p className="text-sm text-muted-foreground">
                  Legg igjen navn og e-post hvis du vil at vi skal kunne følge opp eller
                  sende deg kopi av svarene.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Navn (valgfritt)</Label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-12 rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    E-post{" "}
                    {openData.link.restrictedAccessMode === "email_required" ||
                    openData.form.confirmationMode === "email_copy"
                      ? "(påkrevd)"
                      : "(valgfritt)"}
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 rounded-2xl"
                  />
                </div>
              </div>
              {openData.form.confirmationMode === "email_copy" ? (
                <p className="text-xs text-muted-foreground">
                  Dette skjemaet sender en bekreftelse med kopi av svarene dine til
                  e-posten du oppgir.
                </p>
              ) : null}
            </div>
          ) : null}

          {!groupedMode ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={stepIndex === 0}
                onClick={() => setStep((prev) => Math.max(Math.min(prev, pageCount) - 1, 0))}
              >
                <ArrowLeft className="size-4" />
                Tilbake
              </Button>
              {!isFinalStep ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (!validateCurrentStep()) return;
                    setStep((prev) => Math.min(Math.min(prev, pageCount) + 1, pageCount));
                  }}
                  className="h-12 rounded-2xl px-6"
                >
                  {pageCount > 0 && stepIndex === pageCount - 1 ? "Til slutt" : "Neste"}
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} className="h-12 rounded-2xl px-6">
                  Send inn
                </Button>
              )}
            </div>
          ) : (
            <Button type="button" className="h-12 w-full rounded-2xl" onClick={handleSubmit}>
              Send inn
            </Button>
          )}
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
    </div>
  );
}

function QuestionRenderer({
  question,
  index,
  value,
  onChange,
}: {
  question: {
    _id: string;
    label: string;
    helpText?: string;
    questionType: "text" | "number" | "multiple_choice" | "scale" | "yes_no";
    required: boolean;
    options: Array<{ id: string; label: string }>;
  };
  index: number;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Spørsmål {index + 1}
        </p>
        <h2 className="font-heading text-2xl font-semibold leading-tight sm:text-3xl">
          {question.label}
        </h2>
        {question.helpText ? (
          <p className="text-base leading-relaxed text-muted-foreground">
            {question.helpText}
          </p>
        ) : null}
      </div>

      {question.questionType === "text" ? (
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-40 rounded-[1.5rem] border-border/60 bg-background/80 p-5 text-base shadow-sm dark:border-white/10 dark:bg-zinc-900/80"
        />
      ) : null}

      {question.questionType === "number" ? (
        <Input
          type="number"
          inputMode="decimal"
          value={typeof value === "string" || typeof value === "number" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className="h-14 rounded-[1.35rem] border-border/60 bg-background/80 px-5 text-base shadow-sm dark:border-white/10 dark:bg-zinc-900/80"
        />
      ) : null}

      {question.questionType === "multiple_choice" ? (
        <div className="grid gap-3">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`rounded-[1.35rem] border px-5 py-4 text-left text-base transition ${
                value === option.id
                  ? "border-primary bg-primary/8 shadow-sm dark:bg-zinc-800"
                  : "border-border/50 bg-background/70 hover:bg-muted/10 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:bg-zinc-800/80"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {question.questionType === "scale" ? (
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={`rounded-[1.2rem] border px-3 py-4 text-center text-lg font-semibold transition ${
                value === item
                  ? "border-primary bg-primary/8 shadow-sm dark:bg-zinc-800"
                  : "border-border/50 bg-background/70 hover:bg-muted/10 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:bg-zinc-800/80"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {question.questionType === "yes_no" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[true, false].map((option) => (
            <button
              key={String(option)}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-[1.35rem] border px-5 py-4 text-left text-base transition ${
                value === option
                  ? "border-primary bg-primary/8 shadow-sm dark:bg-zinc-800"
                  : "border-border/50 bg-background/70 hover:bg-muted/10 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:bg-zinc-800/80"
              }`}
            >
              {option ? "Ja" : "Nei"}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
