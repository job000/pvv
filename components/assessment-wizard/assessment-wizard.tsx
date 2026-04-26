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
import { AssessmentProcessSimpleStep } from "@/components/assessment-wizard/assessment-process-simple-step";
import { AssessmentValueImpactStep } from "@/components/assessment-wizard/assessment-value-impact-step";
import { AssessmentWizardSchemaHelp } from "@/components/assessment-wizard/assessment-wizard-schema-help";
import { AssessmentWizardMeta } from "@/components/assessment-wizard/assessment-wizard-meta";
import { LikertField } from "@/components/rpa-assessment/likert-field";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  buildGovernanceReadinessSummary,
  readinessLabelFromScore,
  type DecisionReadinessStatus,
} from "@/lib/assessment-governance";
import {
  derivedBaselineHoursFromPayload,
  syncWorkloadDerivedFields,
} from "@/lib/assessment-workload-sync";
import {
  normalizePipelineStatus,
  nextStepHint,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import { payloadToSnapshot } from "@/convex/lib/payloadSnapshot";
import { ASSESSMENT_WIZARD_STEP_LABELS } from "@/lib/assessment-wizard-steps";
import { ASSESSMENT_COLLAB_ROLE_LABEL_NB } from "@/lib/role-labels-nb";
import { clampLikert5, computeAllResults } from "@/lib/rpa-assessment/scoring";
import { useMutation, useQuery } from "convex/react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStickyState } from "@/lib/use-sticky-state";

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
    implementationBuildCost: raw.implementationBuildCost ?? 350000,
    annualRunCost: raw.annualRunCost ?? 75000,
    rpaBenefitKindsAndOperationsNotes:
      raw.rpaBenefitKindsAndOperationsNotes ?? "",
    valuePainPointIds: raw.valuePainPointIds ?? [],
    valueGainIds: raw.valueGainIds ?? [],
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

/** Lokalt format som lar brukere skrive «1,5» — vi viser komma, og bytter til
 *  punktum kun for parsing internt. Returnerer kort tekst uten unødige nuller. */
function formatLocaleNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value * 1000) / 1000).replace(".", ",");
}

/** Streng tolking — brukes mens brukeren skriver, så «1,» / «1.» / «-» ikke
 *  forstyrrer (returnerer null så den lokale råstrengen beholdes urørt). */
function tryParseLocaleNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (/[,.]$/.test(trimmed)) return null;
  if (trimmed === "-" || trimmed === "+") return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Talloppføring som beholder brukerens råstreng under fokus.
 * Fikser ergonomi-bug der man ikke kunne skrive «1,5» fordi `String(parsed)`
 * fjerner trailing komma/punktum mellom hver tastetrykk.
 */
function NumericInput({
  value,
  onValueChange,
  required = false,
  min,
  max,
  className,
  ...inputProps
}: {
  value: number | undefined;
  onValueChange: (next: number | undefined) => void;
  required?: boolean;
  min?: number;
  max?: number;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min" | "max"
>) {
  const [isFocused, setIsFocused] = useState(false);
  const [lastSyncedValue, setLastSyncedValue] = useState<number | undefined>(
    value,
  );
  const [raw, setRaw] = useState<string>(
    value === undefined || value === null ? "" : formatLocaleNumber(value),
  );
  // Synk eksternt `value` inn til lokal råstreng — kun når feltet ikke er
  // fokusert. Beholder bruker-skrevet «1,» / «1.» mens man taster.
  if (!isFocused && value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setRaw(value === undefined || value === null ? "" : formatLocaleNumber(value));
  }

  return (
    <Input
      {...inputProps}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={raw}
      className={className}
      onFocus={(e) => {
        setIsFocused(true);
        inputProps.onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        const parsed = tryParseLocaleNumber(raw);
        if (parsed === null) {
          if (raw.trim() === "") {
            if (required && value !== undefined) {
              setRaw(formatLocaleNumber(value));
            } else if (!required) {
              onValueChange(undefined);
              setRaw("");
            }
          } else {
            setRaw(value === undefined ? "" : formatLocaleNumber(value));
          }
        } else {
          let next = parsed;
          if (typeof min === "number" && next < min) next = min;
          if (typeof max === "number" && next > max) next = max;
          onValueChange(next);
          setRaw(formatLocaleNumber(next));
        }
        inputProps.onBlur?.(e);
      }}
      onChange={(e) => {
        const v = e.target.value;
        setRaw(v);
        if (v.trim() === "") {
          if (!required) onValueChange(undefined);
          return;
        }
        const parsed = tryParseLocaleNumber(v);
        if (parsed !== null) {
          onValueChange(parsed);
        }
      }}
    />
  );
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
  const processDesignData = useQuery(api.processDesignDocs.getForAssessment, {
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
  const stepLabels = ASSESSMENT_WIZARD_STEP_LABELS;
  const detailsSlideIndex = stepLabels.indexOf("Valgfritt mer");

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
  const [slide, setSlide] = useStickyState(`wizard:${assessmentId}:slide`, 0);
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
      return syncWorkloadDerivedFields(
        normalizeDraftPayload(draftPayload as AssessmentPayload),
      );
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
              payload: syncWorkloadDerivedFields(p),
            });
            if (
              !result.ok &&
              access?.userId &&
              result.conflict.updatedByUserId === access.userId
            ) {
              result = await saveDraft({
                assessmentId,
                expectedRevision: result.conflict.serverRevision,
                payload: syncWorkloadDerivedFields(p),
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
    setPayload(
      syncWorkloadDerivedFields(
        normalizeDraftPayload(draftPayload as AssessmentPayload),
      ),
    );
    draftRevisionRef.current = r;
    setDraftRevision(r);
  }, [data?.draft?.payload, data?.draft?.revision]);

  const resolveConflictLoadServer = useCallback(() => {
    if (!draftConflict) return;
    setPayload(
      syncWorkloadDerivedFields(
        normalizeDraftPayload(draftConflict.serverPayload),
      ),
    );
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
        payload: syncWorkloadDerivedFields(payloadRef.current),
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
    if (slide > 0) emblaApi.scrollTo(slide, true);
    emblaApi.on("select", () => setSlide(emblaApi.selectedScrollSnap()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="space-y-4 pb-28 sm:pb-[7.5rem]">
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

      {/* Hero: tittel + lett meta-strimmel i ett luftig kort.
          Subtilt gradient-bakgrunn for å gi siden et moderne anker øverst,
          uten ekstra knapper eller badges som drukner det viktigste. */}
      <div className="rounded-3xl border border-border/40 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 shadow-sm sm:p-6">
        {canEdit ? (
          <Input
            id="assessment-display-title"
            aria-label="Tittel på vurderingen"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder="F.eks. Fakturamottak — leverandør"
            autoComplete="off"
            title="Skilles fra prosessnavn under «Prosess»."
            className="font-heading h-auto border-0 bg-transparent px-0 py-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0 sm:text-3xl"
          />
        ) : (
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {assessment.title}
          </h1>
        )}
        <p
          className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs"
          title="Endringer lagres automatisk."
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-card/70 px-2 py-0.5 ring-1 ring-border/40">
            {canEdit ? "Lagrer automatisk" : "Kun visning"}
          </span>
          {access?.shareWithWorkspace ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-card/70 px-2 py-0.5 ring-1 ring-border/40">
              <Share2 className="size-3" aria-hidden /> Delt
            </span>
          ) : null}
          {access?.collaboratorRole ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-card/70 px-2 py-0.5 ring-1 ring-border/40">
              {ASSESSMENT_COLLAB_ROLE_LABEL_NB[access.collaboratorRole] ??
                access.collaboratorRole}
            </span>
          ) : null}
        </p>
      </div>

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
        <div className="bg-muted/30 h-12 animate-pulse rounded-xl border border-border/50" />
      )}

      {/* Sekundær-info samlet i én lukket disclosure. Tidligere lå dette
          alltid synlig som to tunge kort («MED I VURDERINGEN» + «Eksport og
          deling»), som dyttet selve vurderingen langt ned på siden. */}
      <details className="group overflow-hidden rounded-2xl bg-card/40 ring-1 ring-border/40">
        <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden sm:px-4">
          <span className="inline-flex items-center gap-2">
            Team, milepæler og deling
            {ownerDisplayName ? (
              <span className="text-muted-foreground text-xs font-normal">
                · Eier: {ownerDisplayName}
              </span>
            ) : null}
          </span>
          <ChevronRight
            className="text-muted-foreground size-4 transition-transform group-open:rotate-90"
            aria-hidden
          />
        </summary>
        <div className="border-border/40 space-y-3 border-t px-3 py-3 sm:px-4">
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
          {canEdit ? (
            <div className="flex justify-end pt-1">
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
                Slett vurdering
              </Button>
            </div>
          ) : null}
        </div>
      </details>

      <p id="wizard-gesture-hint" className="sr-only">
        Sveip horisontalt med finger, eller dra med mus på steget, for å gå til
        neste eller forrige hovedsteg.
      </p>

      <section
        className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        aria-labelledby="wizard-step-heading"
      >
        {/* Slim steg-strimmel: kun et progress-spor + diskret hjelpe-ikon.
            Tidligere hadde vi en eyebrow («Vurdering · X steg»), en H2
            («Steg X av Y: …»), en lang forklaringssetning og en separat
            «Hopp til steg»-nedtrekksmeny. Alt er nå representert i selve
            stegnavet (knappene under) + bunn-navigasjonen «Forrige/Neste»,
            så vi kunne fjerne all duplisering. */}
        <header className="border-border/40 bg-card/60 border-b px-3 py-2.5 backdrop-blur-sm sm:px-4 sm:py-3">
          <div className="flex items-center gap-2">
            <h2 id="wizard-step-heading" className="sr-only">
              Steg {slide + 1} av {stepLabels.length}: {stepLabels[slide]}
            </h2>
            <nav
              className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
              aria-label="Hovedsteg i vurderingen"
            >
              {stepLabels.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  aria-label={`Steg ${i + 1}: ${label}`}
                  aria-current={slide === i ? "step" : undefined}
                  onClick={() => emblaApi?.scrollTo(i)}
                  className={cn(
                    "flex min-w-[calc(50%-0.25rem)] shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-left transition sm:min-w-0 sm:flex-1 sm:basis-0",
                    i === slide
                      ? "bg-primary/12 ring-2 ring-primary/30 shadow-sm"
                      : i < slide
                        ? "bg-primary/[0.06] hover:bg-primary/12"
                        : "bg-muted/40 hover:bg-muted/70",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums sm:size-7 sm:text-xs",
                      i === slide
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : i < slide
                          ? "bg-primary/25 text-primary"
                          : "bg-card text-muted-foreground ring-1 ring-border/50",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="text-foreground min-w-0 text-xs font-medium leading-snug">
                    {label}
                  </span>
                </button>
              ))}
            </nav>
            <div className="hidden shrink-0 sm:block">
              <AssessmentWizardSchemaHelp />
            </div>
          </div>
        </header>

        <div
          ref={emblaRef}
          className="cursor-grab touch-manipulation active:cursor-grabbing"
          aria-describedby="wizard-gesture-hint"
        >
          {/** items-start: unngå at korteste steg får lik høyde som det lengste (tomt rom). */}
          <div className="flex items-start">
            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Hva og hvor mye
                </h2>
                <p className="text-muted-foreground text-sm">
                  Navn på jobben + omtrent hvor mye tid den tar i året. Grove anslag er nok.
                </p>
              </div>
              <div className="space-y-5">
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

                <div className="space-y-4 rounded-2xl bg-muted/10 p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="text-foreground text-sm font-semibold">
                        Volum og tid i dag
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        Brukes til å regne timer manuelt arbeid per år.
                      </p>
                    </div>
                    <div
                      className="bg-card/80 inline-flex shrink-0 gap-1 rounded-full border border-border/50 p-1 text-xs ring-1 ring-black/[0.03]"
                      role="tablist"
                      aria-label="Hvordan beskrive arbeidsmengde"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={effectiveWorkloadInputMode(payload) === "per_case"}
                        disabled={!canEdit}
                        onClick={() =>
                          applyPayloadPatch({
                            workloadInputMode: "per_case",
                            manualFteEstimate: undefined,
                          })
                        }
                        className={cn(
                          "rounded-full px-3 py-1.5 font-medium transition",
                          effectiveWorkloadInputMode(payload) === "per_case"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Tid + volum
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={effectiveWorkloadInputMode(payload) === "fte"}
                        disabled={!canEdit}
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
                        className={cn(
                          "rounded-full px-3 py-1.5 font-medium transition",
                          effectiveWorkloadInputMode(payload) === "fte"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Årsverk
                      </button>
                    </div>
                  </div>

                  {effectiveWorkloadInputMode(payload) === "per_case" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="screening-time-per-case" className="text-xs font-medium">
                          Tid per gang
                        </Label>
                        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                          <NumericInput
                            id="screening-time-per-case"
                            value={effectiveTimePerCaseValue(payload)}
                            min={0}
                            onValueChange={(v) =>
                              applyPayloadPatch({
                                timePerCaseValue: v,
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
                            aria-label="Enhet for tid per gang"
                          >
                            <option value="minutes">Minutter</option>
                            <option value="hours">Timer</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="screening-case-volume" className="text-xs font-medium">
                          Hvor ofte
                        </Label>
                        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                          <NumericInput
                            id="screening-case-volume"
                            value={effectiveCaseVolumeValue(payload)}
                            min={0}
                            onValueChange={(v) =>
                              applyPayloadPatch({
                                caseVolumeValue: v,
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
                            aria-label="Frekvens"
                          >
                            <option value="day">Per dag</option>
                            <option value="week">Per uke</option>
                            <option value="month">Per måned</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="screening-manual-fte" className="text-xs font-medium">
                        Årsverk på dette i dag
                      </Label>
                      <NumericInput
                        id="screening-manual-fte"
                        value={payload.manualFteEstimate}
                        min={0}
                        onValueChange={(v) =>
                          applyPayloadPatch({ manualFteEstimate: v })
                        }
                        disabled={!canEdit}
                        placeholder="F.eks. 0,5 eller 1,5"
                        className="h-10 max-w-xs rounded-xl bg-background shadow-sm"
                      />
                      <p className="text-muted-foreground text-xs">
                        Ett årsverk = én heltidsjobb i ett år. 0,5 = halv stilling.
                      </p>
                    </div>
                  )}

                  {/* Inline summary — én linje, ingen ekstra kort. */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/[0.05] px-3 py-2 text-sm">
                    <span
                      className="bg-primary/15 text-primary inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold"
                      aria-hidden
                    >
                      Σ
                    </span>
                    {workloadSummary ? (
                      <span className="text-foreground/90">
                        ≈ <span className="font-semibold">{Math.round(derivedBaselineHoursFromPayload(payload) ?? 0)} timer/år</span> manuelt arbeid
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Fyll inn feltene over for å se omtrentlige timer/år.
                      </span>
                    )}
                  </div>

                  {effectiveWorkloadInputMode(payload) === "fte" ? (
                    <details className="group rounded-xl bg-card/40 ring-1 ring-border/40">
                      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors [&::-webkit-details-marker]:hidden">
                        <span>Avansert · arbeidsdager og timer per dag</span>
                        <ChevronRight
                          className="size-3.5 transition-transform group-open:rotate-90"
                          aria-hidden
                        />
                      </summary>
                      <div className="grid gap-3 border-t border-border/40 px-3 py-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="screening-working-days"
                            className="text-xs font-medium"
                          >
                            Arbeidsdager i året
                          </Label>
                          <NumericInput
                            id="screening-working-days"
                            value={payload.workingDays}
                            required
                            min={1}
                            max={366}
                            onValueChange={(v) =>
                              update(
                                "workingDays",
                                v ?? KPI_DEFAULTS.workingDays,
                              )
                            }
                            disabled={!canEdit}
                            className="h-10 rounded-xl bg-background shadow-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="screening-working-hours"
                            className="text-xs font-medium"
                          >
                            Timer per arbeidsdag
                          </Label>
                          <NumericInput
                            id="screening-working-hours"
                            value={payload.workingHoursPerDay}
                            required
                            min={1}
                            max={24}
                            onValueChange={(v) =>
                              update(
                                "workingHoursPerDay",
                                v ?? KPI_DEFAULTS.workingHoursPerDay,
                              )
                            }
                            disabled={!canEdit}
                            className="h-10 rounded-xl bg-background shadow-sm"
                          />
                        </div>
                      </div>
                    </details>
                  ) : null}
                </div>
              </div>
            </Slide>

            <Slide>
              <AssessmentProcessSimpleStep
                payload={payload}
                canEdit={canEdit}
                readOnly={readOnly}
                update={update}
                updateMany={updateMany}
              />
            </Slide>

            <Slide>
              <AssessmentValueImpactStep
                payload={payload}
                canEdit={canEdit}
                readOnly={readOnly}
                update={update}
              />
            </Slide>

            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Resultat
                </h2>
                <p className="text-muted-foreground text-sm">
                  En enkel oppsummering. Tallene under er fra det dere har svart — ikke en
                  fasit.
                </p>
              </div>
              <div className="space-y-6">
                {computed ? (
                  <QuickResultHero
                    computed={computed}
                    workspaceId={assessment.workspaceId}
                    title={titleDraft.trim() || assessment.title}
                    payload={payload}
                  />
                ) : null}
                <AssessmentDecisionReadinessPanel
                  payload={payload}
                  assessment={assessment}
                  hasProcessDesignDocument={Boolean(processDesignData?.document)}
                />
              </div>
            </Slide>

            <Slide>
              <div className="space-y-2">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Valgfritt mer
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <span className="text-foreground/90 font-medium">Alt her er valgfritt.</span>{" "}
                  Bruk det når dere vil utdype, justere tall eller samarbeide tettere.
                </p>
              </div>
              <div className="space-y-6">
                <Accordion multiple defaultValue={[]} className="space-y-3">
                  <AccordionItem
                    value="details-portfolio-extra"
                    className="rounded-2xl bg-muted/10 px-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                  >
                    <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:no-underline">
                      Utdypende beslutningsspørsmål (valgfritt)
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <p className="text-muted-foreground mb-4 text-xs">
                        Samme type spørsmål som i inntak — for portefølje og dialog. Påvirker ikke
                        hovedtallene direkte.
                      </p>
                      <AssessmentPortfolioSummarySection
                        payload={payload}
                        canEdit={canEdit}
                        readOnly={readOnly}
                        update={update}
                        omitCoreValueLikerts
                      />
                    </AccordionContent>
                  </AccordionItem>

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
      </section>

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

function riskLevelLabel(criticality: number): "Høy" | "Middels" | "Lav" {
  if (criticality >= 60) return "Høy";
  if (criticality >= 38) return "Middels";
  return "Lav";
}

function readinessTone(status: DecisionReadinessStatus): string {
  switch (status) {
    case "ready":
      return "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    case "in_progress":
      return "bg-amber-500/10 text-amber-950 dark:text-amber-100";
    case "missing":
      return "bg-muted text-foreground";
  }
}

function formatCurrencyShort(value: number): string {
  return `${Math.round(value).toLocaleString("nb-NO")} kr`;
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
  const potensialBand: "Høy" | "Middels" | "Lav" =
    computed.priorityScore >= 60 ? "Høy" : computed.priorityScore >= 35 ? "Middels" : "Lav";

  const tier =
    potensialBand === "Høy"
      ? {
          headline: "Høy prioritet",
          hint: "Mye manuelt arbeid og/eller sterk nytte i forhold til hvor enkel jobben er å automatisere.",
          action: "Gå videre til ROS",
          tone:
            "from-emerald-500/[0.14] via-background to-primary/[0.08] ring-emerald-500/20",
        }
      : potensialBand === "Middels"
        ? {
            headline: "Middels prioritet",
            hint: "Kan være verdt å se nærmere på — avklar gjerne volum og hvor stabilt opplegget er.",
            action: "Gå videre til ROS",
            tone:
              "from-amber-500/[0.14] via-background to-primary/[0.06] ring-amber-500/20",
          }
        : {
            headline: "Lav prioritet",
            hint: "Ifølge det dere har svart, ligger andre saker ofte foran i køen.",
            action: "Vent eller vurder på nytt senere",
            tone:
              "from-slate-500/[0.12] via-background to-muted/30 ring-black/[0.06] dark:ring-white/[0.06]",
          };

  const summaryLine =
    payload.processDescription?.trim() || payload.processName?.trim() || title;
  const hoursSaved = Math.max(0, Math.round(computed.benH));
  const risk = riskLevelLabel(computed.criticality);
  const readinessSummary = buildGovernanceReadinessSummary({
    payload,
    rosStatus: undefined,
    pddStatus: undefined,
    hasProcessDesignDocument: false,
  });

  return (
    <div
      className={cn(
        "rounded-3xl bg-gradient-to-br p-5 shadow-sm ring-1 sm:p-6",
        tier.tone,
      )}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {tier.headline}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {tier.hint}
            {!computed.feasible ? " Stabilitet i prosess/system bør avklares før dere starter." : ""}
          </p>
          <p className="text-foreground/90 text-sm font-medium">{summaryLine}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-background/85 px-4 py-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            <p className="text-muted-foreground text-xs font-semibold">Potensial</p>
            <p className="font-heading mt-1 text-2xl font-semibold text-foreground">
              {potensialBand}
            </p>
          </div>
          <div className="rounded-2xl bg-background/85 px-4 py-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            <p className="text-muted-foreground text-xs font-semibold">Timer spart (ca.)</p>
            <p className="font-heading mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {hoursSaved} <span className="text-base font-medium">t/år</span>
            </p>
          </div>
          <div className="rounded-2xl bg-background/85 px-4 py-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            <p className="text-muted-foreground text-xs font-semibold">Risiko og viktighet</p>
            <p className="font-heading mt-1 text-2xl font-semibold text-foreground">{risk}</p>
            <p className="text-muted-foreground mt-1 text-[11px]">Fra gevinst og konsekvens av feil</p>
          </div>
          <div className="rounded-2xl bg-background/85 px-4 py-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            <p className="text-muted-foreground text-xs font-semibold">Automasjonspotensial</p>
            <p className="font-heading mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {computed.ap.toFixed(0)}%
            </p>
            <p className="text-muted-foreground mt-1 text-[11px]">Hvor mye som kan automatiseres av dagens manuelle tid</p>
          </div>
          <div className="rounded-2xl bg-background/85 px-4 py-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            <p className="text-muted-foreground text-xs font-semibold">Økonomisk case</p>
            <p className="font-heading mt-1 text-2xl font-semibold text-foreground">
              {readinessLabelFromScore(computed.economicCaseScore)}
            </p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Netto {formatCurrencyShort(computed.netBenefitAnnual)} per år
            </p>
          </div>
          <div className="rounded-2xl bg-background/85 px-4 py-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            <p className="text-muted-foreground text-xs font-semibold">Leveranse</p>
            <p className="font-heading mt-1 text-2xl font-semibold text-foreground">
              {readinessLabelFromScore(computed.deliveryConfidence)}
            </p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Gjennomføring og trygg drift
            </p>
          </div>
          <div className="rounded-2xl bg-background/85 px-4 py-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            <p className="text-muted-foreground text-xs font-semibold">Beslutningsklarhet</p>
            <p className="font-heading mt-1 text-2xl font-semibold text-foreground">
              {readinessSummary.readyCount}/{readinessSummary.totalCount}
            </p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {readinessSummary.readinessLabel} readiness
            </p>
          </div>
        </div>

        <p className="text-muted-foreground text-[11px]">
          Prioritetsscore (internt): {computed.priorityScore.toFixed(0)} av 100 — brukes til
          sortering, ikke som eneste beslutning.
        </p>

        {computed.priorityScore >= 35 ? (
          <Link
            href={`/w/${workspaceId}/ros`}
            className={cn(
              buttonVariants({ size: "default" }),
              "h-12 w-full rounded-xl text-base sm:w-auto",
            )}
          >
            {tier.action}
          </Link>
        ) : (
          <div className="rounded-2xl bg-background/85 px-4 py-3 text-center text-sm font-semibold text-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            {tier.action}
          </div>
        )}
      </div>
    </div>
  );
}

function AssessmentDecisionReadinessPanel({
  payload,
  assessment,
  hasProcessDesignDocument,
}: {
  payload: AssessmentPayload;
  assessment: {
    rosStatus?: string | null;
    pddStatus?: string | null;
  };
  hasProcessDesignDocument: boolean;
}) {
  const summary = buildGovernanceReadinessSummary({
    payload,
    rosStatus: assessment.rosStatus,
    pddStatus: assessment.pddStatus,
    hasProcessDesignDocument,
  });

  return (
    <div className="space-y-4 rounded-2xl bg-muted/10 p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Beslutningsklarhet</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ett samlet bilde av hva som mangler før saken er klar for prioritering,
          styring og videre leveranse.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-background/85 px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
          <p className="text-xs font-semibold text-muted-foreground">Readiness</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{summary.readinessLabel}</p>
        </div>
        <div className="rounded-xl bg-background/85 px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
          <p className="text-xs font-semibold text-muted-foreground">Score</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{summary.readinessScore}</p>
        </div>
        <div className="rounded-xl bg-background/85 px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
          <p className="text-xs font-semibold text-muted-foreground">Klare områder</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {summary.readyCount}/{summary.totalCount}
          </p>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {summary.requirements.map((item) => (
          <li
            key={item.key}
            className="rounded-xl border border-border/50 bg-background/75 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                  readinessTone(item.status),
                )}
              >
                {item.status === "ready"
                  ? "Klar"
                  : item.status === "in_progress"
                    ? "Pågår"
                    : "Mangler"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ul>
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
    <div className="min-w-0 shrink-0 grow-0 basis-[100%] self-start px-2 pb-10 sm:px-4">
      {bare ? (
        children
      ) : (
        <div className="mx-auto max-w-3xl space-y-6 py-5 sm:py-6">
          {children}
        </div>
      )}
    </div>
  );
}

