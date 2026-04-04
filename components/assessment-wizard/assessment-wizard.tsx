"use client";

import {
  AssessmentObjectHeader,
  type AssessmentEvaluationContext,
} from "@/components/assessment/assessment-object-header";
import { AssessmentCollaborationPanel } from "@/components/assessment-wizard/assessment-collaboration-panel";
import { AssessmentContextCard } from "@/components/assessment-wizard/assessment-context-card";
import { AssessmentExportPanel } from "@/components/assessment-wizard/assessment-export-panel";
import { HfRequirementsSection } from "@/components/assessment-wizard/hf-requirements-section";
import { ProcessProfileSection } from "@/components/assessment-wizard/process-profile-section";
import { AssessmentPortfolioSummarySection } from "@/components/assessment-wizard/assessment-portfolio-summary-section";
import { AssessmentWizardSchemaHelp } from "@/components/assessment-wizard/assessment-wizard-schema-help";
import { AssessmentWizardMeta } from "@/components/assessment-wizard/assessment-wizard-meta";
import { LikertField } from "@/components/rpa-assessment/likert-field";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Progress,
  ProgressLabel,
} from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  normalizePipelineStatus,
  nextStepHint,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import { payloadToSnapshot } from "@/convex/lib/payloadSnapshot";
import {
  ASSESSMENT_WIZARD_STEP_LABELS_FROM_INTAKE,
  ASSESSMENT_WIZARD_STEP_LABELS_WITH_PORTFOLIO,
} from "@/lib/assessment-wizard-steps";
import {
  ASSESSMENT_COLLAB_ROLE_LABEL_NB,
  WORKSPACE_ROLE_LABEL_NB,
} from "@/lib/role-labels-nb";
import { clampLikert5, computeAllResults } from "@/lib/rpa-assessment/scoring";
import { useMutation, useQuery } from "convex/react";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Sparkles,
  Target,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Én kilde til utkast-form — brukes ved første lasting og etter gjenoppretting fra versjon. */
function normalizeDraftPayload(raw: AssessmentPayload): AssessmentPayload {
  const timePerCaseValue = raw.timePerCaseValue ?? raw.minutesPerCase ?? undefined;
  const timePerCaseUnit =
    raw.timePerCaseUnit ?? (raw.minutesPerCase !== undefined ? "minutes" : undefined);
  const caseVolumeValue =
    raw.caseVolumeValue ??
    raw.casesPerWeek ??
    raw.casesPerMonth ??
    undefined;
  const caseVolumeUnit =
    raw.caseVolumeUnit ??
    (raw.casesPerWeek !== undefined
      ? "week"
      : raw.casesPerMonth !== undefined
        ? "month"
        : undefined);
  const workloadInputMode =
    raw.workloadInputMode ??
    (raw.manualFteEstimate !== undefined &&
    timePerCaseValue === undefined &&
    caseVolumeValue === undefined
      ? "fte"
      : "per_case");
  return {
    ...raw,
    processDescription: raw.processDescription ?? "",
    processGoal: raw.processGoal ?? "",
    processActors: raw.processActors ?? "",
    processSystems: raw.processSystems ?? "",
    processFlowSummary: raw.processFlowSummary ?? "",
    processVolumeNotes: raw.processVolumeNotes ?? "",
    processConstraints: raw.processConstraints ?? "",
    processFollowUp: raw.processFollowUp ?? "",
    processScope: raw.processScope ?? "unsure",
    hfOperationsSupportLevel: raw.hfOperationsSupportLevel ?? "unsure",
    hfSecurityInformationNotes: raw.hfSecurityInformationNotes ?? "",
    hfOrganizationalBreadthNotes: raw.hfOrganizationalBreadthNotes ?? "",
    hfEconomicRationaleNotes: raw.hfEconomicRationaleNotes ?? "",
    hfCriticalManualGapNotes: raw.hfCriticalManualGapNotes ?? "",
    hfOperationsSupportNotes: raw.hfOperationsSupportNotes ?? "",
    rpaExpectedBenefitVsEffort: raw.rpaExpectedBenefitVsEffort ?? 3,
    rpaQuickWinPotential: raw.rpaQuickWinPotential ?? 3,
    rpaProcessSpecificity: raw.rpaProcessSpecificity ?? 3,
    rpaImplementationDifficulty: raw.rpaImplementationDifficulty ?? 3,
    rpaBarrierSelfAssessment: raw.rpaBarrierSelfAssessment,
    rpaBarrierNotes: raw.rpaBarrierNotes ?? "",
    rpaLifecycleContact: raw.rpaLifecycleContact ?? "",
    rpaManualFallbackWhenRobotFails: raw.rpaManualFallbackWhenRobotFails ?? "",
    rpaBenefitKindsAndOperationsNotes:
      raw.rpaBenefitKindsAndOperationsNotes ?? "",
    timePerCaseValue,
    timePerCaseUnit,
    caseVolumeValue,
    caseVolumeUnit,
    workloadInputMode,
  };
}

const KPI_DEFAULTS = {
  baselineHours: 800,
  reworkHours: 50,
  auditHours: 40,
  avgCostPerYear: 850000,
  workingDays: 230,
  workingHoursPerDay: 7.5,
  employees: 3,
} as const;

const QUICK_AUTOMATION_PRESETS: Record<
  1 | 2 | 3 | 4 | 5,
  Partial<AssessmentPayload>
> = {
  1: {
    baselineHours: 120,
    reworkHours: 10,
    auditHours: 10,
    structuredInput: 2,
    processVariability: 1,
    digitization: 2,
  },
  2: {
    baselineHours: 300,
    reworkHours: 20,
    auditHours: 20,
    structuredInput: 3,
    processVariability: 2,
    digitization: 3,
  },
  3: {
    baselineHours: 800,
    reworkHours: 50,
    auditHours: 40,
    structuredInput: 3,
    processVariability: 3,
    digitization: 3,
  },
  4: {
    baselineHours: 1400,
    reworkHours: 80,
    auditHours: 60,
    structuredInput: 4,
    processVariability: 4,
    digitization: 4,
  },
  5: {
    baselineHours: 2200,
    reworkHours: 120,
    auditHours: 80,
    structuredInput: 5,
    processVariability: 5,
    digitization: 5,
  },
};

function roundKpiValue(value: number) {
  return Math.round(value * 10) / 10;
}

type TimePerCaseUnit = "minutes" | "hours";
type CaseVolumeUnit = "day" | "week" | "month";

function parseKpiNumber(
  raw: string,
  fallback: number,
  current: number,
): number {
  if (raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : current;
}

function parseOptionalKpiNumber(
  raw: string,
  current?: number,
): number | undefined {
  if (raw.trim() === "") return undefined;
  const normalized = raw.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : current;
}

function effectiveTimePerCaseValue(payload: AssessmentPayload): number | undefined {
  return payload.timePerCaseValue ?? payload.minutesPerCase ?? undefined;
}

function effectiveTimePerCaseUnit(payload: AssessmentPayload): TimePerCaseUnit {
  return payload.timePerCaseUnit ?? "minutes";
}

function effectiveCaseVolumeValue(payload: AssessmentPayload): number | undefined {
  if (payload.caseVolumeValue !== undefined) {
    return payload.caseVolumeValue;
  }
  if (payload.casesPerWeek !== undefined) {
    return payload.casesPerWeek;
  }
  if (payload.casesPerMonth !== undefined) {
    return payload.casesPerMonth;
  }
  return undefined;
}

function effectiveCaseVolumeUnit(payload: AssessmentPayload): CaseVolumeUnit {
  if (payload.caseVolumeUnit) {
    return payload.caseVolumeUnit;
  }
  if (payload.casesPerMonth !== undefined) {
    return "month";
  }
  return "week";
}

function effectiveWorkloadInputMode(
  payload: AssessmentPayload,
): "per_case" | "fte" {
  return payload.workloadInputMode ?? "per_case";
}

function annualCasesFromPayload(payload: AssessmentPayload): number | null {
  const caseVolumeValue = effectiveCaseVolumeValue(payload);
  if (!(typeof caseVolumeValue === "number" && caseVolumeValue > 0)) {
    return null;
  }
  switch (effectiveCaseVolumeUnit(payload)) {
    case "day":
      return caseVolumeValue * 5 * 52;
    case "month":
      return caseVolumeValue * 12;
    case "week":
    default:
      return caseVolumeValue * 52;
  }
}

function derivedBaselineHoursFromPayload(
  payload: AssessmentPayload,
): number | null {
  const annualCases = annualCasesFromPayload(payload);
  const timePerCaseValue = effectiveTimePerCaseValue(payload);
  if (
    typeof timePerCaseValue === "number" &&
    timePerCaseValue > 0 &&
    annualCases !== null
  ) {
    const hoursPerCase =
      effectiveTimePerCaseUnit(payload) === "hours"
        ? timePerCaseValue
        : timePerCaseValue / 60;
    return roundKpiValue(hoursPerCase * annualCases);
  }

  const manualFteEstimate = payload.manualFteEstimate;
  if (typeof manualFteEstimate === "number" && manualFteEstimate > 0) {
    return roundKpiValue(
      manualFteEstimate * payload.workingDays * payload.workingHoursPerDay,
    );
  }
  return null;
}

function workloadSummaryFromPayload(payload: AssessmentPayload): {
  title: string;
  description: string;
} | null {
  const annualCases = annualCasesFromPayload(payload);
  const timePerCaseValue = effectiveTimePerCaseValue(payload);
  if (
    typeof timePerCaseValue === "number" &&
    timePerCaseValue > 0 &&
    annualCases !== null
  ) {
    const caseVolumeValue = effectiveCaseVolumeValue(payload) ?? 0;
    const caseVolumeUnitLabel =
      effectiveCaseVolumeUnit(payload) === "day"
        ? "dag"
        : effectiveCaseVolumeUnit(payload) === "month"
          ? "måned"
          : "uke";
    const timeUnitLabel =
      effectiveTimePerCaseUnit(payload) === "hours" ? "timer" : "min";
    return {
      title: "Tid per runde og hvor ofte",
      description: `Vi regner med ${roundKpiValue(timePerCaseValue)} ${timeUnitLabel} per gang og ${roundKpiValue(caseVolumeValue)} ganger per ${caseVolumeUnitLabel} → omtrent ${Math.round(derivedBaselineHoursFromPayload(payload) ?? 0)} timer med manuelt arbeid i året.`,
    };
  }

  const manualFteEstimate = payload.manualFteEstimate;
  if (typeof manualFteEstimate === "number" && manualFteEstimate > 0) {
    return {
      title: "Årsverk som grunnlag",
      description: `${roundKpiValue(manualFteEstimate)} årsverk (heltidsår), ${roundKpiValue(payload.workingHoursPerDay)} timer per dag og ${Math.round(payload.workingDays)} arbeidsdager i året → omtrent ${Math.round(manualFteEstimate * payload.workingDays * payload.workingHoursPerDay)} timer med manuelt arbeid i året.`,
    };
  }

  return null;
}

function syncWorkloadDerivedFields(
  payload: AssessmentPayload,
): AssessmentPayload {
  const derivedBaselineHours = derivedBaselineHoursFromPayload(payload);
  if (derivedBaselineHours === null) {
    return payload;
  }
  return {
    ...payload,
    baselineHours: derivedBaselineHours,
  };
}

type Props = { assessmentId: Id<"assessments"> };

export function AssessmentWizard({ assessmentId }: Props) {
  const params = useParams();
  const workspaceIdParam = params.workspaceId as Id<"workspaces"> | undefined;
  const data = useQuery(api.assessments.getDraft, { assessmentId });
  const access = useQuery(api.assessments.getMyAccess, { assessmentId });
  const collaborators = useQuery(api.assessments.listCollaborators, {
    assessmentId,
  });
  const versions = useQuery(api.assessments.listVersions, { assessmentId });
  const rosContext = useQuery(api.ros.getRosContextForAssessment, {
    assessmentId,
  });
  const candidates = useQuery(
    api.candidates.listByWorkspace,
    data?.assessment
      ? { workspaceId: data.assessment.workspaceId }
      : "skip",
  );
  const saveDraft = useMutation(api.assessments.saveDraft);
  const updateAssessmentTitle = useMutation(api.assessments.updateAssessmentTitle);
  const deleteAssessment = useMutation(api.assessments.deleteAssessment);

  const [payload, setPayload] = useState<AssessmentPayload | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Synk med serverens utkastrevisjon — kreves for lagring uten stille overskriving */
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [draftConflict, setDraftConflict] = useState<{
    serverRevision: number;
    serverPayload: AssessmentPayload;
    updatedAt: number;
    updatedByUserId: Id<"users">;
    updatedByName: string | null;
  } | null>(null);
  const [leaveWizardOpen, setLeaveWizardOpen] = useState(false);
  /** Eksplisitt lagring før navigasjon (Ferdig / forlat veiviser). */
  const [leavingBusy, setLeavingBusy] = useState(false);
  const router = useRouter();
  const assessmentRow = data?.assessment ?? null;
  const sourcedFromIntake = assessmentRow?.sourcedFromIntake === true;
  const stepLabels = sourcedFromIntake
    ? ASSESSMENT_WIZARD_STEP_LABELS_FROM_INTAKE
    : ASSESSMENT_WIZARD_STEP_LABELS_WITH_PORTFOLIO;
  const detailsSlideIndex = stepLabels.indexOf("Detaljer");

  const goneFromServer =
    data !== undefined &&
    access !== undefined &&
    data === null &&
    access === null;

  useEffect(() => {
    if (goneFromServer && workspaceIdParam) {
      router.replace(`/w/${workspaceIdParam}/vurderinger`);
    }
  }, [goneFromServer, router, workspaceIdParam]);
  const payloadRef = useRef<AssessmentPayload | null>(null);
  const draftRevisionRef = useRef<number | null>(null);
  /** Seriell kø — hindrer to auto-lagre med samme revisjon (falsk «konflikt» mot seg selv) */
  const saveQueueTailRef = useRef(Promise.resolve());
  const canEditRef = useRef(false);
  /** Begrenser hvor ofte musehjul/trackpad kan bytte steg (unngår «hopping»). */
  const lastWheelStepAtRef = useRef(0);
  /** Unngå lagring ved første slide-synk; lagre ved hvert påfølgende stegbytte. */
  const prevSlideForSaveRef = useRef<number | null>(null);
  if (payload) payloadRef.current = payload;
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: false,
    containScroll: "trimSnaps",
    dragFree: false,
    watchDrag: true,
    /** Høyere = roligere animasjon ved stegbytte (standard 25 er veldig kvikk). */
    duration: 68,
    /** Mer horisontal bevegelse før klikk undertrykkes etter drag (mindre uhell). */
    dragThreshold: 22,
  });
  const [slide, setSlide] = useState(0);
  /** Forespørsel fra metaraden: åpne forhåndsvisning av en lagret milepæl. */
  const [versionPreviewRequest, setVersionPreviewRequest] = useState<
    number | null
  >(null);

  useEffect(() => {
    setPayload(null);
    setDraftRevision(null);
    draftRevisionRef.current = null;
    setDraftConflict(null);
    saveQueueTailRef.current = Promise.resolve();
    prevSlideForSaveRef.current = null;
  }, [assessmentId]);

  /** Ikke synk `data.draft` inn etter hver lagring — det overskriver tastatur mens du skriver. */
  useEffect(() => {
    const draftPayload = data?.draft?.payload;
    if (!draftPayload) return;
    setPayload((prev) => {
      if (prev !== null) return prev;
      const r = data?.draft?.revision ?? 0;
      draftRevisionRef.current = r;
      setDraftRevision(r);
      return normalizeDraftPayload(draftPayload as AssessmentPayload);
    });
  }, [data?.draft?.payload, data?.draft?._id, data?.draft?.revision]);

  useEffect(() => {
    if (assessmentRow) {
      setTitleDraft(assessmentRow.title);
    }
  }, [assessmentRow, assessmentId]);

  const computed = useMemo(() => {
    if (!payload) return null;
    return computeAllResults(
      payloadToSnapshot(payload as unknown as Record<string, unknown>),
    );
  }, [payload]);
  const annualCasesEstimate = useMemo(
    () => (payload ? annualCasesFromPayload(payload) : null),
    [payload],
  );
  const derivedBaselineHoursEstimate = useMemo(
    () => (payload ? derivedBaselineHoursFromPayload(payload) : null),
    [payload],
  );
  const workloadSummary = useMemo(
    () => (payload ? workloadSummaryFromPayload(payload) : null),
    [payload],
  );

  const evaluationContext = useMemo((): AssessmentEvaluationContext | undefined => {
    if (!payload) return undefined;
    const cid = payload.candidateId?.trim();
    if (cid) {
      if (candidates === undefined) return { kind: "loading" };
      const c = candidates.find((x) => String(x._id) === cid);
      if (c) {
        return {
          kind: "candidate",
          code: c.code,
          name: c.name,
          githubRepoFullName: c.githubRepoFullName ?? null,
          githubIssueNumber: c.githubIssueNumber ?? null,
          hasGithubProject: Boolean(c.githubProjectItemNodeId?.trim()),
        };
      }
    }
    const pn = payload.processName?.trim();
    if (pn) return { kind: "draft_only", processName: pn };
    return { kind: "unset" };
  }, [payload, candidates]);

  const canEdit = access?.canEdit ?? false;
  canEditRef.current = canEdit;
  const readOnly = !canEdit;

  const serverDraftRevisionLive = data?.draft?.revision ?? 0;
  const isBehindServer =
    canEdit &&
    draftRevision !== null &&
    serverDraftRevisionLive > draftRevision &&
    draftConflict === null;

  const persist = useCallback(
    (p: AssessmentPayload): Promise<void> => {
      if (!canEdit) return Promise.resolve();
      saveQueueTailRef.current = saveQueueTailRef.current
        .catch(() => undefined)
        .then(async () => {
          const rev = draftRevisionRef.current;
          if (rev === null) return;
          try {
            let result = await saveDraft({
              assessmentId,
              expectedRevision: rev,
              payload: p,
            });
            if (
              !result.ok &&
              access?.userId &&
              result.conflict.updatedByUserId === access.userId
            ) {
              result = await saveDraft({
                assessmentId,
                expectedRevision: result.conflict.serverRevision,
                payload: p,
              });
            }
            if (result.ok) {
              draftRevisionRef.current = result.revision;
              setDraftRevision(result.revision);
              setSaveError((prev) =>
                prev?.startsWith("Skjema:") ? null : prev,
              );
              setDraftConflict(null);
            } else {
              setDraftConflict({
                serverRevision: result.conflict.serverRevision,
                serverPayload:
                  result.conflict.serverPayload as AssessmentPayload,
                updatedAt: result.conflict.updatedAt,
                updatedByUserId: result.conflict.updatedByUserId,
                updatedByName: result.conflict.updatedByName,
              });
            }
          } catch (e) {
            setSaveError(
              e instanceof Error
                ? `Skjema: ${e.message}`
                : "Skjema: Kunne ikke lagre. Sjekk nettverket og prøv igjen.",
            );
          }
        });
      return saveQueueTailRef.current;
    },
    [access?.userId, assessmentId, canEdit, saveDraft],
  );

  const applyLiveServerDraft = useCallback(() => {
    const draftPayload = data?.draft?.payload;
    if (!draftPayload) return;
    const r = data?.draft?.revision ?? 0;
    setPayload(normalizeDraftPayload(draftPayload as AssessmentPayload));
    draftRevisionRef.current = r;
    setDraftRevision(r);
  }, [data?.draft?.payload, data?.draft?.revision]);

  const resolveConflictLoadServer = useCallback(() => {
    if (!draftConflict) return;
    setPayload(normalizeDraftPayload(draftConflict.serverPayload));
    draftRevisionRef.current = draftConflict.serverRevision;
    setDraftRevision(draftConflict.serverRevision);
    setDraftConflict(null);
  }, [draftConflict]);

  const resolveConflictOverwrite = useCallback(async () => {
    if (!draftConflict || !payloadRef.current || !canEdit) return;
    try {
      const result = await saveDraft({
        assessmentId,
        expectedRevision: draftConflict.serverRevision,
        payload: payloadRef.current,
      });
      if (result.ok) {
        draftRevisionRef.current = result.revision;
        setDraftRevision(result.revision);
        setDraftConflict(null);
        setSaveError(null);
      } else {
        setDraftConflict({
          serverRevision: result.conflict.serverRevision,
          serverPayload:
            result.conflict.serverPayload as AssessmentPayload,
          updatedAt: result.conflict.updatedAt,
          updatedByUserId: result.conflict.updatedByUserId,
          updatedByName: result.conflict.updatedByName,
        });
      }
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? `Skjema: ${e.message}`
          : "Skjema: Kunne ikke lagre. Sjekk nettverket og prøv igjen.",
      );
    }
  }, [assessmentId, canEdit, draftConflict, saveDraft]);

  useEffect(() => {
    if (!canEdit || !assessmentRow) return;
    const server = assessmentRow.title;
    const trimmed = titleDraft.trim();
    if (trimmed === server || trimmed === "") return;
    const t = setTimeout(() => {
      void updateAssessmentTitle({ assessmentId, title: trimmed })
        .then(() => {
          setSaveError((prev) =>
            prev?.startsWith("Navn:") ? null : prev,
          );
        })
        .catch((e: unknown) => {
          setSaveError(
            e instanceof Error
              ? `Navn: ${e.message}`
              : "Navn: Kunne ikke lagre tittel.",
          );
        });
    }, 550);
    return () => clearTimeout(t);
  }, [
    titleDraft,
    canEdit,
    assessmentRow,
    assessmentId,
    updateAssessmentTitle,
  ]);

  /** Tittel lagres med debounce — tving lagring før vi forlater siden. */
  const flushTitleBeforeLeave = useCallback(async () => {
    if (!canEdit || !data?.assessment) return;
    const server = data.assessment.title;
    const trimmed = titleDraft.trim();
    if (trimmed === "" || trimmed === server) return;
    try {
      await updateAssessmentTitle({ assessmentId, title: trimmed });
    } catch {
      // Ikke-blokkerende: brukeren kan rette tittel senere
    }
  }, [assessmentId, canEdit, data?.assessment, titleDraft, updateAssessmentTitle]);

  useEffect(() => {
    if (!canEditRef.current || !payloadRef.current) return;
    const t = setTimeout(() => {
      void persist(payloadRef.current!);
    }, 700);
    return () => {
      clearTimeout(t);
      if (canEditRef.current && payloadRef.current) {
        void persist(payloadRef.current);
      }
    };
  }, [payload, persist]);

  /** Lagre utkast ved hvert stegbytte (1→2, 2→3, …) slik at arbeid ikke bare ligger i minnet. */
  useEffect(() => {
    if (!canEdit || !payloadRef.current) return;
    if (draftRevisionRef.current === null) return;
    const prev = prevSlideForSaveRef.current;
    prevSlideForSaveRef.current = slide;
    if (prev === null) return;
    void persist(payloadRef.current);
  }, [slide, persist, canEdit]);

  useEffect(() => {
    const flush = () => {
      if (
        document.visibilityState === "hidden" &&
        canEditRef.current &&
        payloadRef.current
      ) {
        void persist(payloadRef.current);
      }
    };
    const onPageHide = () => {
      if (canEditRef.current && payloadRef.current) {
        void persist(payloadRef.current);
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [persist]);

  const openTeamAndVersions = useCallback(() => {
    emblaApi?.scrollTo(detailsSlideIndex);
    requestAnimationFrame(() => {
      document.getElementById("versjoner")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [emblaApi, detailsSlideIndex]);

  const onPickVersionPreview = useCallback(
    (v: number) => {
      setVersionPreviewRequest(v);
      openTeamAndVersions();
    },
    [openTeamAndVersions],
  );

  const onVersionPreviewRequestConsumed = useCallback(() => {
    setVersionPreviewRequest(null);
  }, []);

  const milestoneCount = versions?.length ?? 0;

  const goToVurderingerList = useCallback(async () => {
    setLeavingBusy(true);
    try {
      if (canEdit && payloadRef.current) {
        await persist(payloadRef.current);
      }
      await flushTitleBeforeLeave();
      setLeaveWizardOpen(false);
      const wid = data?.assessment.workspaceId;
      if (!wid) return;
      router.push(`/w/${wid}/vurderinger`);
    } finally {
      setLeavingBusy(false);
    }
  }, [
    canEdit,
    data?.assessment.workspaceId,
    flushTitleBeforeLeave,
    persist,
    router,
  ]);

  const saveDraftAndMaybeOpenLeaveDialog = useCallback(async () => {
    setLeavingBusy(true);
    try {
      if (canEdit && payloadRef.current) {
        await persist(payloadRef.current);
      }
      await flushTitleBeforeLeave();
      if (canEdit && milestoneCount === 0) {
        setLeaveWizardOpen(true);
      } else {
        setLeaveWizardOpen(false);
        const wid = data?.assessment.workspaceId;
        if (wid) router.push(`/w/${wid}/vurderinger`);
      }
    } finally {
      setLeavingBusy(false);
    }
  }, [
    canEdit,
    data?.assessment.workspaceId,
    flushTitleBeforeLeave,
    milestoneCount,
    persist,
    router,
  ]);

  const saveDraftAndGoToMilestones = useCallback(async () => {
    setLeavingBusy(true);
    try {
      if (canEdit && payloadRef.current) {
        await persist(payloadRef.current);
      }
      await flushTitleBeforeLeave();
      setLeaveWizardOpen(false);
      openTeamAndVersions();
    } finally {
      setLeavingBusy(false);
    }
  }, [
    canEdit,
    flushTitleBeforeLeave,
    openTeamAndVersions,
    persist,
  ]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", () => setSlide(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  /** Horisontalt hjul / trackpad (Shift+hjul vertikalt) — tregere og med cooldown. */
  useEffect(() => {
    if (!emblaApi) return;
    const root = emblaApi.rootNode();
    const COOLDOWN_MS = 520;
    const MIN_DELTA = 32;
    const VERT_RATIO = 1.45;
    const onWheel = (e: WheelEvent) => {
      const el = e.target;
      if (
        el instanceof Element &&
        el.closest(
          "input, textarea, select, [contenteditable=true], [data-wizard-no-step-wheel]",
        )
      ) {
        return;
      }
      const now = performance.now();
      if (now - lastWheelStepAtRef.current < COOLDOWN_MS) {
        return;
      }
      const horizontal = e.shiftKey ? e.deltaY : e.deltaX;
      const vertical = e.shiftKey ? e.deltaX : e.deltaY;
      if (Math.abs(horizontal) < MIN_DELTA) return;
      if (!e.shiftKey && Math.abs(horizontal) < Math.abs(vertical) * VERT_RATIO) {
        return;
      }
      if (horizontal > 0) {
        if (!emblaApi.canScrollNext()) return;
        e.preventDefault();
        lastWheelStepAtRef.current = now;
        emblaApi.scrollNext();
      } else {
        if (!emblaApi.canScrollPrev()) return;
        e.preventDefault();
        lastWheelStepAtRef.current = now;
        emblaApi.scrollPrev();
      }
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const go = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash === "#versjoner") {
        emblaApi.scrollTo(detailsSlideIndex);
        requestAnimationFrame(() => {
          document.getElementById("versjoner")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [emblaApi, detailsSlideIndex]);

  const [candidatePickerKey, setCandidatePickerKey] = useState(0);

  function applyPayloadPatch(
    patch: Partial<AssessmentPayload>,
    options?: { manualBaselineOverride?: boolean },
  ) {
    setPayload((prev) => {
      if (!prev) {
        return prev;
      }
      const next = { ...prev, ...patch };
      if (options?.manualBaselineOverride) {
        return {
          ...next,
          timePerCaseValue: undefined,
          timePerCaseUnit: undefined,
          caseVolumeValue: undefined,
          caseVolumeUnit: undefined,
          workloadInputMode: "per_case",
          minutesPerCase: undefined,
          casesPerWeek: undefined,
          casesPerMonth: undefined,
          manualFteEstimate: undefined,
        };
      }
      return syncWorkloadDerivedFields(next);
    });
  }

  function update<K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) {
    applyPayloadPatch({ [key]: value } as Partial<AssessmentPayload>);
  }

  function updateMany(patch: Partial<AssessmentPayload>) {
    applyPayloadPatch(patch);
  }

  if (data === undefined || access === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (goneFromServer) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">
          Vurderingen finnes ikke lenger (slettet). Du sendes til oversikten …
        </p>
      </div>
    );
  }

  if (data === null || !payload) {
    return (
      <p className="text-destructive text-sm">Ingen tilgang eller mangler data.</p>
    );
  }

  const { assessment } = data;

  const pipelineStatusNorm = normalizePipelineStatus(
    assessment.pipelineStatus,
  ) as PipelineStatus;
  const ownerCollab = collaborators?.find((c) => c.role === "owner");
  const ownerDisplayName =
    ownerCollab?.name ?? ownerCollab?.email ?? null;
  const hasRosAnalysisLink =
    rosContext !== undefined && rosContext.length > 0;
  const firstRosAnalysisId =
    rosContext && rosContext.length > 0
      ? rosContext[0]!.rosAnalysisId
      : null;

  const draftConflictIsSelf =
    draftConflict !== null &&
    access?.userId !== undefined &&
    draftConflict.updatedByUserId === access.userId;

  return (
    <div className="space-y-4 pb-24">
      {isBehindServer ? (
        <Alert className="border-amber-500/35 bg-amber-500/[0.06]">
          <AlertTitle className="text-amber-950 dark:text-amber-100">
            Nyere utkast på serveren
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3 text-amber-950/90 sm:flex-row sm:items-center sm:justify-between dark:text-amber-50/90">
            <span>
              Noen andre har lagret mens du redigerer. Last inn siste utkast for
              å se endringene, eller fortsett her og lagre — da får du valg hvis
              det kolliderer.
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={applyLiveServerDraft}
            >
              Last inn siste utkast
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {saveError ? (
        <Alert variant="destructive" className="border-destructive/40">
          <AlertTitle>Lagring feilet</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}

      {rosContext !== undefined ? (
        <AssessmentObjectHeader
          workspaceId={assessment.workspaceId}
          assessmentId={assessment._id}
          pipelineStatus={pipelineStatusNorm}
          ownerName={ownerDisplayName}
          hasRosAnalysisLink={hasRosAnalysisLink}
          nextStepLabel={nextStepHint(pipelineStatusNorm)}
          firstRosAnalysisId={firstRosAnalysisId}
          canEditPipeline={canEdit}
          evaluationContext={evaluationContext}
        />
      ) : (
        <div className="bg-muted/30 h-24 animate-pulse rounded-xl border border-border/50" />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          {canEdit ? (
            <>
              <Label
                htmlFor="assessment-display-title"
                className="text-muted-foreground text-xs font-medium"
              >
                Tittel
              </Label>
              <Input
                id="assessment-display-title"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder="F.eks. Fakturamottak — leverandør"
                autoComplete="off"
                title="Skilles fra prosessnavn under «Prosess»."
                className="font-heading h-auto max-w-2xl border-0 border-b border-border/60 bg-transparent px-0 py-1 text-xl font-semibold shadow-none focus-visible:border-primary focus-visible:ring-0 sm:text-2xl"
              />
            </>
          ) : (
            <>
              <h1 className="font-heading text-xl font-semibold sm:text-2xl">
                {assessment.title}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Kun visning.
                {access?.collaboratorRole
                  ? ` · Rolle på vurdering: ${ASSESSMENT_COLLAB_ROLE_LABEL_NB[access.collaboratorRole] ?? access.collaboratorRole}`
                  : ""}
                {access?.workspaceRole
                  ? ` · Arbeidsområde: ${WORKSPACE_ROLE_LABEL_NB[access.workspaceRole] ?? access.workspaceRole}`
                  : ""}
              </p>
            </>
          )}
          {canEdit ? (
            <p
              className="text-muted-foreground text-[11px] sm:text-xs"
              title="Ved samtidig redigering får du valg om å hente siste utkast eller overskrive."
            >
              Lagrer automatisk
              {access?.collaboratorRole || access?.workspaceRole ? (
                <>
                  {" · "}
                  {access?.collaboratorRole
                    ? ASSESSMENT_COLLAB_ROLE_LABEL_NB[access.collaboratorRole] ??
                      access.collaboratorRole
                    : null}
                  {access?.collaboratorRole && access?.workspaceRole ? " · " : null}
                  {access?.workspaceRole
                    ? WORKSPACE_ROLE_LABEL_NB[access.workspaceRole] ??
                      access.workspaceRole
                    : null}
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {access?.shareWithWorkspace ? (
            <Badge variant="secondary" className="gap-1">
              <Share2 className="size-3" />
              Delt med arbeidsområdet
            </Badge>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (
                  window.confirm(
                    `Slette «${assessment.title}»?\n\nAlle utkast, versjoner, oppgaver, kommentarer og koblinger fjernes permanent.`,
                  )
                ) {
                  void deleteAssessment({ assessmentId }).then(() => {
                    router.replace(`/w/${assessment.workspaceId}/vurderinger`);
                  });
                }
              }}
            >
              <Trash2 className="size-3.5" />
              Slett
            </Button>
          ) : null}
        </div>
      </div>

      <AssessmentWizardMeta
        collaborators={collaborators}
        versions={versions}
        draftUpdatedAt={data?.draft?.updatedAt}
        onOpenTeamAndVersions={openTeamAndVersions}
        onPickVersionPreview={onPickVersionPreview}
      />

      <AssessmentExportPanel
        assessmentId={assessmentId}
        workspaceId={assessment.workspaceId}
        canEdit={canEdit}
      />

      {/* ── Stepper ── */}
      <div className="rounded-2xl bg-muted/15 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-foreground text-sm font-semibold">
              <span className="text-muted-foreground font-normal">
                Steg {slide + 1}/{stepLabels.length}
              </span>
              {" · "}
              {stepLabels[slide]}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {slide === stepLabels.length - 1
                ? "Hele dette steget kan hoppes over — se forklaring øverst på siden."
                : "Fyll ut det du trenger — resten er valgfritt."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AssessmentWizardSchemaHelp />
            <select
              id="wizard-step-jump"
              className="border-input bg-background h-8 rounded-lg border px-2 text-xs shadow-sm"
              value={slide}
              onChange={(e) => emblaApi?.scrollTo(Number(e.target.value))}
              aria-label="Hopp til steg"
            >
              {stepLabels.map((label, i) => (
                <option key={label} value={i}>
                  {i + 1}. {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-1" aria-label="Fremdrift" role="navigation">
          {stepLabels.map((label, i) => (
            <button
              key={label}
              type="button"
              aria-label={`Gå til ${label}`}
              aria-current={slide === i ? "step" : undefined}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "h-1.5 min-w-0 flex-1 rounded-full transition-all duration-200",
                i < slide
                  ? "bg-primary"
                  : i === slide
                    ? "bg-primary scale-y-[1.4]"
                    : "bg-muted-foreground/20 hover:bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      </div>

      <p id="wizard-gesture-hint" className="sr-only">
        Sveip horisontalt med finger, eller dra med mus på steget, for å gå til
        neste eller forrige hovedsteg.
      </p>

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div
          ref={emblaRef}
          className="cursor-grab touch-manipulation active:cursor-grabbing"
          aria-describedby="wizard-gesture-hint"
        >
          <div className="flex">
            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  RPA-kandidat — start
                </h2>
                <p className="text-muted-foreground text-sm">
                  Her kartlegger dere det som vanligvis inngår i en RPA-kandidatvurdering:{" "}
                  <span className="text-foreground/90">
                    forretningsverdi, volum og gjentakelse, og hvor mye manuelt arbeid som kan
                    erstattes
                  </span>{" "}
                  (tilsvarende dimensjoner som i f.eks. UiPath Automation Hub og andre
                  porteføljeverktøy). Dette styrer tallene i resultatet.{" "}
                  {sourcedFromIntake ? (
                    <>
                      Spørsmål om gevinst, risiko og portefølje (for dialog med bestillere) fyller
                      dere inn under <span className="text-foreground/90">Resultat</span> — samme
                      som i inntak, ikke gjentatt som eget steg.
                    </>
                  ) : (
                    <>
                      Spørsmål om gevinst, risiko og portefølje fyller dere inn under steget{" "}
                      <span className="text-foreground/90">Gevinst og drift</span> før dere ser
                      modellresultat.
                    </>
                  )}
                </p>
              </div>
              <div className="space-y-6">
                <div className="space-y-4 rounded-2xl bg-muted/10 p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                  <div className="space-y-2">
                    <Label htmlFor="quick-process-name" className="text-sm font-medium">
                      Kort navn på prosessen
                    </Label>
                    <Input
                      id="quick-process-name"
                      value={payload.processName}
                      onChange={(e) => update("processName", e.target.value)}
                      disabled={!canEdit}
                      placeholder="F.eks. Fakturamottak eller manuell registrering"
                      className="h-11 rounded-xl bg-background shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quick-process-description" className="text-sm font-medium">
                      Kort beskrivelse (valgfritt)
                    </Label>
                    <Textarea
                      id="quick-process-description"
                      value={payload.processDescription ?? ""}
                      onChange={(e) => update("processDescription", e.target.value)}
                      disabled={!canEdit}
                      placeholder="F.eks. Overføring mellom to systemer"
                      rows={3}
                      className="min-h-[6.5rem] resize-y rounded-xl bg-background shadow-sm"
                    />
                  </div>
                </div>
                <div className="space-y-4 rounded-2xl bg-muted/10 p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">
                      Hvor mye tid bruker folk på dette i dag?
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Robot lønner seg når <span className="text-foreground/90">mye</span> av det
                      samme gjøres igjen og igjen. Da trenger vi et enkelt bilde av hvor mye
                      manuelt arbeid som ligger her — dere trenger ikke være økonom for å svare.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-primary/15 bg-background/80 p-4">
                    <p className="text-sm font-medium text-foreground">
                      Hvorfor spør vi?
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Svarene brukes til å regne ut omtrent hvor mange timer i året som kan ligge
                      bak en robot (og dermed prioritering). Tomme felt her erstattes av det
                      grove anslaget i spørsmålet om manuelt arbeid lenger ned på siden.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">Timer per år</Badge>
                      <Badge variant="outline">Arbeidsmengde</Badge>
                      <Badge variant="outline">Prioritering</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Velg én av måtene under — bare den som passer best for dere.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        effectiveWorkloadInputMode(payload) === "per_case"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/50 bg-background/70 hover:bg-background",
                      )}
                      onClick={() =>
                        applyPayloadPatch({
                          workloadInputMode: "per_case",
                          manualFteEstimate: undefined,
                        })
                      }
                      disabled={!canEdit}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        Jeg vet omtrent tid per gang og hvor ofte
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Passer når dere kan si «så mange minutter/timer per oppgave» og «så mange
                        ganger per dag, uke eller måned» — f.eks. journalnotat, bestilling,
                        saksbehandling.
                      </p>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        effectiveWorkloadInputMode(payload) === "fte"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/50 bg-background/70 hover:bg-background",
                      )}
                      onClick={() =>
                        applyPayloadPatch({
                          workloadInputMode: "fte",
                          timePerCaseValue: undefined,
                          timePerCaseUnit: undefined,
                          caseVolumeValue: undefined,
                          caseVolumeUnit: undefined,
                          minutesPerCase: undefined,
                          casesPerWeek: undefined,
                          casesPerMonth: undefined,
                        })
                      }
                      disabled={!canEdit}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        Jeg vet bare omtrent hvor mye stilling som går med
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Passer når dere tenker i «hvor mange heltidsår» eller «én halv stilling»
                        — ikke minutter per oppgave. Vi forklarer årsverk under feltet.
                      </p>
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {effectiveWorkloadInputMode(payload) === "per_case" ? (
                      <>
                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="screening-time-per-case">
                        Hvor lang tid bruker dere vanligvis på én runde av oppgaven?
                      </Label>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
                        <Input
                          id="screening-time-per-case"
                          inputMode="decimal"
                          value={
                            effectiveTimePerCaseValue(payload) === undefined
                              ? ""
                              : String(effectiveTimePerCaseValue(payload))
                          }
                          onChange={(e) =>
                            applyPayloadPatch({
                              timePerCaseValue: parseOptionalKpiNumber(
                                e.target.value,
                                effectiveTimePerCaseValue(payload),
                              ),
                              timePerCaseUnit: effectiveTimePerCaseUnit(payload),
                              minutesPerCase: undefined,
                            })
                          }
                          disabled={!canEdit}
                          placeholder="F.eks. 12"
                          className="h-10 rounded-xl bg-background shadow-sm"
                        />
                        <select
                          className="h-10 rounded-xl border border-input bg-background px-3 text-sm shadow-sm"
                          value={effectiveTimePerCaseUnit(payload)}
                          onChange={(e) =>
                            applyPayloadPatch({
                              timePerCaseValue: effectiveTimePerCaseValue(payload),
                              timePerCaseUnit: e.target.value as TimePerCaseUnit,
                              minutesPerCase: undefined,
                            })
                          }
                          disabled={!canEdit}
                        >
                          <option value="minutes">Minutter</option>
                          <option value="hours">Timer</option>
                        </select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Skriv tallet først — deretter om det er minutter eller timer for én
                        runde.
                      </p>
                    </div>
                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="screening-case-volume">
                        Hvor mange ganger skjer dette i vanlig drift?
                      </Label>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
                        <Input
                          id="screening-case-volume"
                          inputMode="decimal"
                          value={
                            effectiveCaseVolumeValue(payload) === undefined
                              ? ""
                              : String(effectiveCaseVolumeValue(payload))
                          }
                          onChange={(e) =>
                            applyPayloadPatch({
                              caseVolumeValue: parseOptionalKpiNumber(
                                e.target.value,
                                effectiveCaseVolumeValue(payload),
                              ),
                              caseVolumeUnit: effectiveCaseVolumeUnit(payload),
                              casesPerWeek: undefined,
                              casesPerMonth: undefined,
                            })
                          }
                          disabled={!canEdit}
                          placeholder="F.eks. 40"
                          className="h-10 rounded-xl bg-background shadow-sm"
                        />
                        <select
                          className="h-10 rounded-xl border border-input bg-background px-3 text-sm shadow-sm"
                          value={effectiveCaseVolumeUnit(payload)}
                          onChange={(e) =>
                            applyPayloadPatch({
                              caseVolumeValue: effectiveCaseVolumeValue(payload),
                              caseVolumeUnit: e.target.value as CaseVolumeUnit,
                              casesPerWeek: undefined,
                              casesPerMonth: undefined,
                            })
                          }
                          disabled={!canEdit}
                        >
                          <option value="day">Per dag</option>
                          <option value="week">Per uke</option>
                          <option value="month">Per måned</option>
                        </select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Velg om tallet er per dag, per uke eller per måned — slik dere selv
                        tenker på det.
                      </p>
                    </div>
                      </>
                    ) : null}
                    {effectiveWorkloadInputMode(payload) === "fte" ? (
                    <div className="space-y-2">
                      <Label htmlFor="screening-manual-fte">
                        Omtrent hvor mange heltidsstillinger (år) brukes på dette?
                      </Label>
                      <Input
                        id="screening-manual-fte"
                        inputMode="decimal"
                        value={
                          payload.manualFteEstimate === undefined
                            ? ""
                            : String(payload.manualFteEstimate)
                        }
                        onChange={(e) =>
                          applyPayloadPatch({
                            manualFteEstimate: parseOptionalKpiNumber(
                              e.target.value,
                              payload.manualFteEstimate,
                            ),
                          })
                        }
                        disabled={!canEdit}
                        placeholder="F.eks. 1,5 eller 0,25"
                        className="h-10 rounded-xl bg-background shadow-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground/90">Årsverk</span> betyr én heltidsjobb
                        gjennom ett år. 0,25 er én firedel stilling, 1,5 er én og en halv
                        stilling — skriv det som passer.
                      </p>
                    </div>
                    ) : null}
                    {effectiveWorkloadInputMode(payload) === "fte" ? (
                      <>
                    <div className="space-y-2">
                      <Label htmlFor="screening-working-days">
                        Hvor mange arbeidsdager i året regner dere med?
                      </Label>
                      <Input
                        id="screening-working-days"
                        inputMode="decimal"
                        value={String(payload.workingDays)}
                        onChange={(e) =>
                          update(
                            "workingDays",
                            parseKpiNumber(
                              e.target.value,
                              KPI_DEFAULTS.workingDays,
                              payload.workingDays,
                            ),
                          )
                        }
                        disabled={!canEdit}
                        className="h-10 rounded-xl bg-background shadow-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Mange bruker 220–230. Her står 230 som forslag — endre bare hvis dere har
                        avtalt noe annet (f.eks. turnus).
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="screening-working-hours">
                        Hvor mange timer er en vanlig arbeidsdag hos dere?
                      </Label>
                      <Input
                        id="screening-working-hours"
                        inputMode="decimal"
                        value={String(payload.workingHoursPerDay)}
                        onChange={(e) =>
                          update(
                            "workingHoursPerDay",
                            parseKpiNumber(
                              e.target.value,
                              KPI_DEFAULTS.workingHoursPerDay,
                              payload.workingHoursPerDay,
                            ),
                          )
                        }
                        disabled={!canEdit}
                        className="h-10 rounded-xl bg-background shadow-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ofte 7,5 i offentlig sektor. Vi bruker dette sammen med årsverk og
                        arbeidsdager for å finne omtrentlig timeforbruk i året.
                      </p>
                    </div>
                      </>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-background/80 p-4">
                    <p className="text-sm font-medium text-foreground">Oppsummering av tallene</p>
                    {workloadSummary ? (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {workloadSummary.title}.
                        </span>{" "}
                        {workloadSummary.description}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Velg først hvordan dere vil beskrive arbeidsmengden (tid per gang, eller
                        stillingsbruk). Da viser vi bare feltene som trengs.
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Dere trenger ikke perfekte tall — et godt anslag er nok til første
                      vurdering.
                    </p>
                  </div>
                </div>
                <LikertField
                  id="quick-automation"
                  label="Hvor mye manuelt, gjentakende arbeid kan en robot realistisk ta over?"
                  hint="RPA erstatter konkrete tastetrykk og overføringer — jo mer slikt arbeid, jo sterkere kandidat (prosessvolum og -karakter)."
                  value={clampLikert5(
                    payload.baselineHours >= 1800
                      ? 5
                      : payload.baselineHours >= 1200
                        ? 4
                        : payload.baselineHours >= 650
                          ? 3
                          : payload.baselineHours >= 220
                            ? 2
                            : 1,
                  )}
                  onChange={(v) => updateMany(QUICK_AUTOMATION_PRESETS[v])}
                  left="Lite manuelt"
                  right="Svært mye manuelt"
                  scaleLabels={[
                    "Lite",
                    "Noe",
                    "Middels",
                    "Mye",
                    "Svært mye",
                  ]}
                  disabled={readOnly}
                />
                <div className="grid gap-3 sm:grid-cols-4">
                  <ScoreCard
                    label="Saker / år"
                    value={
                      annualCasesEstimate === null
                        ? "—"
                        : String(Math.round(annualCasesEstimate))
                    }
                    sub="Utledet fra volum"
                  />
                  <ScoreCard
                    label="Timer / år"
                    value={String(Math.round(payload.baselineHours))}
                    sub={
                      derivedBaselineHoursEstimate !== null
                        ? "Utledet fra tallgrunnlag"
                        : "Raskt anslag"
                    }
                  />
                  <ScoreCard
                    label="FTE"
                    value={computed ? computed.fte.toFixed(2) : "—"}
                    sub="Beregnet behov"
                  />
                  <ScoreCard
                    label="Datastruktur"
                    value={`${payload.structuredInput}/5`}
                    sub="Justeres automatisk"
                  />
                  <ScoreCard
                    label="Digitalisering"
                    value={`${payload.digitization}/5`}
                    sub="Justeres automatisk"
                  />
                </div>
              </div>
            </Slide>

            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Prosess og systemer (RPA-egnethet)
                </h2>
                <p className="text-muted-foreground text-sm">
                  Her vurderer dere typiske RPA-kriterier:{" "}
                  <span className="text-foreground/90">
                    strukturerte data, forutsigbare regler vs. unntak, stabile systemer og digital
                    flyt
                  </span>{" "}
                  — i tråd med det som brukes i bl.a. UiPath sitt detaljerte vurderingsopplegg og
                  tilsvarende CoE-maler. Formulert for alle roller (ikke IT-språk).
                </p>
              </div>
              <div className="space-y-8">
                <LikertField
                  id="fit-structured-input"
                  label="Dataattributter: kommer opplysningene som strukturerte felt, eller mest fritekst og skjermbilder?"
                  hint="I RPA-vurdering vektlegges strukturerte inndata — ustrukturert tekst krever ofte ekstra løsninger."
                  value={clampLikert5(payload.structuredInput)}
                  onChange={(v) => update("structuredInput", v)}
                  left="Mye fritekst / uklart"
                  right="For det meste faste felt"
                  scaleLabels={["Mye fritekst", "Mest fritekst", "Blanding", "Mest felt", "Nesten bare felt"]}
                  disabled={readOnly}
                />
                <LikertField
                  id="fit-variability"
                  label="Prosessattributter: følger flyten mest faste regler, eller mange unntak og skjønn?"
                  hint="RPA passer best for regelstyrte, repeterbare steg — mange unntak svekker egnetheten."
                  value={clampLikert5(payload.processVariability)}
                  onChange={(v) => update("processVariability", v)}
                  left="Svært ulike"
                  right="Nesten like hver gang"
                  scaleLabels={["Svært ulike", "Ganske ulike", "Blandet", "Ganske like", "Nesten like"]}
                  disabled={readOnly}
                />
                <LikertField
                  id="fit-stability"
                  label="Teknologi og stabilitet: endrer rutiner og systembilder seg ofte, eller er det stabilt?"
                  hint="Ustabile applikasjoner og hyppige UI-endringer øker vedlikehold — vanlig vurderingspunkt i RPA."
                  value={clampLikert5(
                    Math.round((payload.processStability + payload.applicationStability) / 2),
                  )}
                  onChange={(v) =>
                    updateMany({
                      processStability: v,
                      applicationStability: v,
                    })
                  }
                  left="Endrer seg ofte"
                  right="Stabilt"
                  scaleLabels={["Endrer seg ofte", "Noe ustabilt", "Middels", "Ganske stabilt", "Svært stabilt"]}
                  disabled={readOnly}
                />
                <LikertField
                  id="fit-digital"
                  label="Digital modenhet: går arbeidet mest på papir og skanning, eller digitalt?"
                  hint="Digital prosess gir enklere automatisering; papir og skanning er vanlige RPA-begrensninger."
                  value={clampLikert5(payload.digitization)}
                  onChange={(v) => update("digitization", v)}
                  left="Mye papir"
                  right="Helt digitalt"
                  scaleLabels={["Mye papir", "Mest papir", "Blandet", "Mest digitalt", "Helt digitalt"]}
                  disabled={readOnly}
                />
                <div className="rounded-2xl bg-muted/10 p-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="fit-ocr"
                      checked={payload.ocrRequired}
                      onCheckedChange={(c) =>
                        canEdit && update("ocrRequired", c === true)
                      }
                      disabled={!canEdit}
                      className="mt-0.5"
                    />
                    <div>
                      <Label htmlFor="fit-ocr" className="text-sm font-medium">
                        Må tekst leses ut av skannede bilder eller bilder av dokumenter?
                      </Label>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        Hvis ja, er det ofte tyngre enn når alt ligger som tekst og felt fra før.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Slide>

            {!sourcedFromIntake ? (
              <Slide>
                <div className="space-y-1">
                  <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                    Gevinst, kompleksitet og drift
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Tillegg til modellberegningen: forretningskasse, gjennomføring, hindringer og
                    drift — typisk i RPA-porteføljer. Samme type spørsmål som i inntaksskjema.
                    Endrer ikke modellscore automatisk.
                  </p>
                </div>
                <AssessmentPortfolioSummarySection
                  payload={payload}
                  canEdit={canEdit}
                  readOnly={readOnly}
                  update={update}
                />
              </Slide>
            ) : null}

            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Resultat
                </h2>
                <p className="text-muted-foreground text-sm">
                  {sourcedFromIntake ? (
                    <>
                      Først kort beslutningsgrunnlag (samme spørsmål som i inntak) — deretter
                      modellbasert score fra kandidat/volum og prosess/system. Porteføljefeltene
                      endrer ikke modelltallene direkte; de støtter prioritering og dialog med
                      bestillere.
                    </>
                  ) : (
                    <>
                      Modellbasert score fra kandidat/volum og prosess/system. Beslutningsgrunnlag
                      (gevinst, risiko, portefølje) fylte dere inn under «Gevinst og drift».
                    </>
                  )}
                </p>
              </div>
              <div className="space-y-6">
                {sourcedFromIntake ? (
                  <AssessmentPortfolioSummarySection
                    payload={payload}
                    canEdit={canEdit}
                    readOnly={readOnly}
                    update={update}
                  />
                ) : null}
              {computed ? (
                <div className="space-y-6">
                  <QuickResultHero
                    computed={computed}
                    workspaceId={assessment.workspaceId}
                    title={titleDraft.trim() || assessment.title}
                    payload={payload}
                  />
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <ScoreCard
                      label="Kategori"
                      value={
                        computed.priorityScore >= 60
                          ? "Høy"
                          : computed.priorityScore >= 35
                            ? "Middels"
                            : "Lav"
                      }
                      sub="Samlet vurdering"
                    />
                    <ScoreCard
                      label="Automasjon"
                      value={`${computed.ap.toFixed(0)} %`}
                      sub="Volum + prosess/system"
                    />
                    <ScoreCard
                      label="Nytte & risiko"
                      value={`${computed.criticality.toFixed(0)} %`}
                      sub="Gevinst og compliance (modell)"
                    />
                    <ScoreCard
                      label="Anbefaling"
                      value={computed.priorityScore >= 35 ? "Gå til ROS" : "Ikke prioritert"}
                      sub={
                        computed.priorityScore >= 35
                          ? "Verdt å gå videre med"
                          : "Bør vente eller vurderes senere"
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        Gjennomførbarhet (prosesslengde, systemer m.m.)
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {computed.ease.toFixed(1)} % · {computed.easeLabel}
                      </span>
                    </div>
                    <Progress value={computed.ease}>
                      <div className="flex w-full justify-between gap-2 pb-2">
                        <ProgressLabel className="text-muted-foreground">
                          Mindre realistisk
                        </ProgressLabel>
                        <ProgressLabel className="text-muted-foreground">
                          Mer realistisk
                        </ProgressLabel>
                      </div>
                    </Progress>
                  </div>
                </div>
              ) : null}
              </div>
            </Slide>

            <Slide>
              <div className="space-y-2">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Ekstra informasjon
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <span className="text-foreground/90 font-medium">
                    Du trenger ikke fylle ut noe her
                  </span>{" "}
                  for at vurderingen skal være «ferdig»: resultatet bygger på de foregående
                  stegene. Åpne en seksjon under bare når du vil utdype prosessen, finjustere
                  tall i modellen, fylle inn ROS/personvern eller samarbeide med team og milepæler.
                </p>
              </div>
              <div className="space-y-6">
                <Accordion multiple defaultValue={[]} className="space-y-3">
                  <AccordionItem
                    value="details-process"
                    className="rounded-2xl bg-muted/10 px-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                  >
                    <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:no-underline">
                      Prosessdetaljer og kontekst
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-5">
                        {candidates && candidates.length > 0 ? (
                          <div className="space-y-2">
                            <Label htmlFor="pick-candidate-fast">
                              Koble til prosess i registeret
                            </Label>
                            <select
                              key={candidatePickerKey}
                              id="pick-candidate-fast"
                              className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm shadow-xs outline-none"
                              defaultValue=""
                              onChange={(e) => {
                                const id = e.target.value as Id<"candidates">;
                                if (!id) return;
                                const cand = candidates.find((x) => x._id === id);
                                if (cand) {
                                  update("candidateId", cand.code);
                                  update("processName", cand.name);
                                }
                                setCandidatePickerKey((k) => k + 1);
                              }}
                              disabled={!canEdit}
                            >
                              <option value="">Velg fra arbeidsområdet …</option>
                              {candidates.map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.name} ({c.code})
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="candidate-ref-fast">Referanse / ID</Label>
                            <Input
                              id="candidate-ref-fast"
                              value={payload.candidateId}
                              onChange={(e) => update("candidateId", e.target.value)}
                              disabled={!canEdit}
                              className="h-10 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Hvor strekker prosessen seg?</Label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              {(
                                [
                                  ["single", "Én hovedenhet"],
                                  ["multi", "Flere enheter / på tvers"],
                                  ["unsure", "Ikke avklart"],
                                ] as const
                              ).map(([value, label]) => (
                                <Button
                                  key={value}
                                  type="button"
                                  variant={
                                    (payload.processScope ?? "unsure") === value
                                      ? "secondary"
                                      : "outline"
                                  }
                                  size="sm"
                                  className="h-auto min-h-10 justify-start whitespace-normal rounded-xl px-4 py-2.5 text-left"
                                  disabled={!canEdit}
                                  onClick={() => update("processScope", value)}
                                >
                                  {label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <ProcessProfileSection
                          payload={payload}
                          canEdit={canEdit}
                          update={update}
                          compact
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="details-scoring"
                    className="rounded-2xl bg-muted/10 px-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                  >
                    <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:no-underline">
                      Finjuster RPA-modell (valgfritt)
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-8">
                        <LikertField
                          id="detail-reg-risk"
                          label="Compliance: hvor strenge er krav til dokumentasjon og sporbarhet?"
                          hint="Finjustering av compliance-risiko hvis første steg ikke treffer."
                          value={clampLikert5(payload.criticalityRegulatoryRisk)}
                          onChange={(v) => update("criticalityRegulatoryRisk", v)}
                          left="Få krav"
                          right="Svært strenge"
                          scaleLabels={["Lave", "Noe", "Middels", "Strenge", "Svært strenge"]}
                          disabled={readOnly}
                        />
                        <LikertField
                          id="detail-process-length"
                          label="Prosesskompleksitet: hvor lang er arbeidsflyten?"
                          hint="Lengre flyt = ofte høyere RPA-kompleksitet og vedlikehold."
                          value={clampLikert5(payload.processLength)}
                          onChange={(v) => update("processLength", v)}
                          left="Kort"
                          right="Lang"
                          scaleLabels={["Kort", "Noe", "Middels", "Lang", "Svært lang"]}
                          disabled={readOnly}
                        />
                        <LikertField
                          id="detail-app-count"
                          label="Systemlandskap: hvor mange applikasjoner inngår?"
                          hint="Flere systemer øker typisk integrasjons- og RPA-kompleksitet."
                          value={clampLikert5(payload.applicationCount)}
                          onChange={(v) => update("applicationCount", v)}
                          left="Få"
                          right="Mange"
                          scaleLabels={["1", "2", "3–4", "5–6", "7+"]}
                          disabled={readOnly}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="detail-baselineHours">Manuelle timer / år</Label>
                            <Input
                              id="detail-baselineHours"
                              inputMode="decimal"
                              value={String(payload.baselineHours)}
                              onChange={(e) =>
                                applyPayloadPatch(
                                  {
                                    baselineHours: parseKpiNumber(
                                      e.target.value,
                                      KPI_DEFAULTS.baselineHours,
                                      payload.baselineHours,
                                    ),
                                  },
                                  { manualBaselineOverride: true },
                                )
                              }
                              disabled={!canEdit}
                              className="h-10 rounded-xl bg-background shadow-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              Manuell overstyring. Dette nullstiller feltene for per sak, volum
                              og FTE over.
                            </p>
                          </div>
                          {(
                            [
                              ["reworkHours", "Omarbeid / år", KPI_DEFAULTS.reworkHours],
                              ["auditHours", "Kontroll / år", KPI_DEFAULTS.auditHours],
                              ["thinClientPercent", "Tynnklientandel (%)", 30],
                              ["workingDays", "Arbeidsdager / år", KPI_DEFAULTS.workingDays],
                              [
                                "workingHoursPerDay",
                                "Timer per arbeidsdag",
                                KPI_DEFAULTS.workingHoursPerDay,
                              ],
                            ] as const
                          ).map(([k, label, fallback]) => (
                            <div key={k} className="space-y-2">
                              <Label htmlFor={`detail-${k}`}>{label}</Label>
                              <Input
                                id={`detail-${k}`}
                                inputMode="decimal"
                                value={String(payload[k])}
                                onChange={(e) => {
                                  const num = parseKpiNumber(
                                    e.target.value,
                                    fallback,
                                    Number(payload[k]),
                                  );
                                  update(k, num as AssessmentPayload[typeof k]);
                                }}
                                disabled={!canEdit}
                                className="h-10 rounded-xl bg-background shadow-sm"
                              />
                            </div>
                          ))}
                          <div className="space-y-2">
                            <Label htmlFor="detail-manual-fte">FTE / årsverk (anslag)</Label>
                            <Input
                              id="detail-manual-fte"
                              inputMode="decimal"
                              value={
                                payload.manualFteEstimate === undefined
                                  ? ""
                                  : String(payload.manualFteEstimate)
                              }
                              onChange={(e) =>
                                applyPayloadPatch({
                                  manualFteEstimate: parseOptionalKpiNumber(
                                    e.target.value,
                                    payload.manualFteEstimate,
                                  ),
                                })
                              }
                              disabled={!canEdit}
                              className="h-10 rounded-xl bg-background shadow-sm"
                            />
                          </div>
                        </div>
                        <div className="rounded-2xl bg-background/80 p-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="detail-ocr"
                              checked={payload.ocrRequired}
                              onCheckedChange={(c) =>
                                canEdit && update("ocrRequired", c === true)
                              }
                              disabled={!canEdit}
                              className="mt-0.5"
                            />
                            <div>
                              <Label htmlFor="detail-ocr" className="text-sm font-medium">
                                Kreves skanning / OCR?
                              </Label>
                              <p className="text-muted-foreground mt-1 text-xs">
                                Slå dette på hvis input fortsatt er papir, bilder eller PDF uten maskinlesbar tekst.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="details-context"
                    className="rounded-2xl bg-muted/10 px-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                  >
                    <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:no-underline">
                      Organisasjon, ROS og personvern
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <AssessmentContextCard
                        assessmentId={assessmentId}
                        workspaceId={assessment.workspaceId}
                        assessment={assessment}
                        canEdit={canEdit}
                        processScope={payload.processScope ?? "unsure"}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="details-security"
                    className="rounded-2xl bg-muted/10 px-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                  >
                    <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:no-underline">
                      Sikkerhet og utvidet kontekst
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <HfRequirementsSection
                        payload={payload}
                        canEdit={canEdit}
                        update={update}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="space-y-6 rounded-2xl bg-muted/10 p-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">
                      Samarbeid og milepæler
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Invitasjoner, notater, oppfølging og navngitte versjoner — valgfritt.
                    </p>
                  </div>
                  <AssessmentCollaborationPanel
                    assessmentId={assessmentId}
                    workspaceId={assessment.workspaceId}
                    canEdit={canEdit}
                    versionPreviewRequest={versionPreviewRequest}
                    onVersionPreviewRequestConsumed={
                      onVersionPreviewRequestConsumed
                    }
                    onDraftRestored={(p, meta) => {
                      setPayload(normalizeDraftPayload(p));
                      if (meta?.revision !== undefined) {
                        draftRevisionRef.current = meta.revision;
                        setDraftRevision(meta.revision);
                      }
                    }}
                  />
                </div>
              </div>
            </Slide>
          </div>
        </div>
      </div>

      <Dialog
        open={draftConflict !== null}
        onOpenChange={(open) => {
          if (!open) setDraftConflict(null);
        }}
      >
        <DialogContent size="md" titleId="draft-conflict-title">
          <DialogHeader>
            <p
              id="draft-conflict-title"
              className="font-heading text-lg font-semibold"
            >
              {draftConflictIsSelf
                ? "Utkastet rakk å oppdateres på serveren"
                : "Utkastet er endret av noen andre"}
            </p>
          </DialogHeader>
          <DialogBody>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {draftConflictIsSelf ? (
                <>
                  Et tidligere lagringsforsøk fra deg (f.eks. auto-lagring i
                  annen fane eller to lagringer rett etter hverandre) fullførte
                  før dette forsøket, så revisjonen på serveren var allerede
                  nyere. Dette er ikke en annen person med mindre du deler
                  konto.
                </>
              ) : (
                <>
                  {draftConflict?.updatedByName
                    ? `${draftConflict.updatedByName} har lagret en nyere versjon.`
                    : "Det finnes en nyere lagret versjon av utkastet."}{" "}
                  Du kan hente den fra serveren, eller overskrive med det du har
                  åpnet her (siste skriving som lagrer vinner).
                </>
              )}
            </p>
            {draftConflict ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Sist oppdatert på server:{" "}
                {new Date(draftConflict.updatedAt).toLocaleString("nb-NO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraftConflict(null)}
            >
              Lukk
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={resolveConflictLoadServer}
            >
              Last inn fra server
            </Button>
            <Button
              type="button"
              onClick={() => void resolveConflictOverwrite()}
            >
              Overskriv med mine endringer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={leaveWizardOpen}
        onOpenChange={(open) => {
          if (!open) setLeaveWizardOpen(false);
        }}
      >
        <DialogContent size="md" titleId="leave-wizard-title">
          <DialogHeader>
            <p
              id="leave-wizard-title"
              className="font-heading text-lg font-semibold"
            >
              Utkastet er allerede lagret
            </p>
          </DialogHeader>
          <DialogBody>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Alt er lagret. Navngitte milepæler er valgfrie — du finner dem under
              Samarbeid.
            </p>
          </DialogBody>
          <DialogFooter className="flex-wrap sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={leavingBusy}
              onClick={() => void saveDraftAndGoToMilestones()}
            >
              Gå til milepæler først
            </Button>
            <Button
              type="button"
              disabled={leavingBusy}
              onClick={() => void goToVurderingerList()}
            >
              {leavingBusy ? "Lagrer …" : "Gå til vurderingsoversikt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={slide <= 0}
          >
            <ChevronLeft className="size-4" />
            Forrige
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {slide + 1} / {stepLabels.length}
          </span>
          {slide >= stepLabels.length - 1 ? (
            <Button
              type="button"
              className="gap-1.5 rounded-xl px-5 shadow-sm"
              size="sm"
              disabled={leavingBusy}
              onClick={() => void saveDraftAndMaybeOpenLeaveDialog()}
            >
              {leavingBusy ? "Lagrer …" : "Ferdig"}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              className="gap-1.5 rounded-xl px-5 shadow-sm"
              size="sm"
              onClick={() => emblaApi?.scrollNext()}
            >
              Neste
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickResultHero({
  computed,
  workspaceId,
  title,
  payload,
}: {
  computed: NonNullable<ReturnType<typeof computeAllResults>>;
  workspaceId: Id<"workspaces">;
  title: string;
  payload: AssessmentPayload;
}) {
  const tier =
    computed.priorityScore >= 60
      ? {
          label: "Høyt potensial",
          summary:
            "Volum og prosess/system peker på en sterk RPA-kandidat i tråd med vanlige vurderingskriterier.",
          action: "Gå videre til ROS",
          tone:
            "from-emerald-500/[0.14] via-background to-primary/[0.08] ring-emerald-500/20",
        }
      : computed.priorityScore >= 35
        ? {
            label: "Middels potensial",
            summary:
              "Kandidaten kan være aktuell — vurder nærmere mot RPA-kriterier (data, regler, systemer, gevinst).",
            action: "Gå videre til ROS",
            tone:
              "from-amber-500/[0.14] via-background to-primary/[0.06] ring-amber-500/20",
          }
        : {
            label: "Lavt potensial",
            summary:
              "Modellen tilsier lav prioritet: sjekk volum, manuelt arbeid og prosess-/systemegnethet før RPA.",
            action: "Ikke prioritert",
            tone:
              "from-slate-500/[0.12] via-background to-muted/30 ring-black/[0.06] dark:ring-white/[0.06]",
          };

  const summaryLine =
    payload.processDescription?.trim() || payload.processName?.trim() || title;

  return (
    <div
      className={cn(
        "rounded-3xl bg-gradient-to-br p-5 shadow-sm ring-1",
        tier.tone,
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            <Sparkles className="size-3.5 text-primary" />
            Kandidat + prosess/system
          </div>
          <div>
            <p className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              {tier.label}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {tier.summary}
              {!computed.feasible
                ? " Stabilitet virker fortsatt svak, så avklar teknikk og prosess før oppstart."
                : ""}
            </p>
          </div>
          <div className="rounded-2xl bg-background/70 px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Vurdering
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {summaryLine}
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-background/80 px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground">
                  Prioritet
                </p>
              </div>
              <p className="font-heading mt-2 text-2xl font-semibold text-foreground">
                {computed.priorityScore.toFixed(0)}
              </p>
            </div>
            <div className="rounded-2xl bg-background/80 px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
              <div className="flex items-center gap-2">
                <CircleGauge className="size-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground">
                  Gjennomførbarhet
                </p>
              </div>
              <p className="font-heading mt-2 text-2xl font-semibold text-foreground">
                {computed.ease.toFixed(0)} %
              </p>
            </div>
          </div>

          {computed.priorityScore >= 35 ? (
            <Link
              href={`/w/${workspaceId}/ros`}
              className={cn(buttonVariants({ size: "sm" }), "h-11 rounded-xl")}
            >
              {tier.action}
            </Link>
          ) : (
            <div className="rounded-2xl bg-background/80 px-4 py-3 text-sm font-semibold text-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
              {tier.action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Slide({
  children,
  bare,
}: {
  children: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <div className="min-w-0 shrink-0 grow-0 basis-[100%] px-2 pb-12 sm:px-4">
      {bare ? (
        children
      ) : (
        <div className="mx-auto max-w-3xl space-y-6 py-6 sm:py-8">
          {children}
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-heading text-xl font-semibold">{value}</p>
      {sub ? (
        <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
