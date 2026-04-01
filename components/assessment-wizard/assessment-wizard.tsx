"use client";

import {
  AssessmentObjectHeader,
  type AssessmentEvaluationContext,
} from "@/components/assessment/assessment-object-header";
import { AssessmentCollaborationPanel } from "@/components/assessment-wizard/assessment-collaboration-panel";
import { AssessmentContextCard } from "@/components/assessment-wizard/assessment-context-card";
import { AssessmentExportPanel } from "@/components/assessment-wizard/assessment-export-panel";
import { AssessmentProcessSlide } from "@/components/assessment-wizard/assessment-process-slide";
import { AssessmentWizardSchemaHelp } from "@/components/assessment-wizard/assessment-wizard-schema-help";
import { AssessmentWizardMeta } from "@/components/assessment-wizard/assessment-wizard-meta";
import { LikertField } from "@/components/rpa-assessment/likert-field";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Progress,
  ProgressLabel,
} from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buildAssessmentContextForAi } from "@/lib/ai/buildAssessmentContextForAi";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  PIPELINE_STATUS_LABELS,
  normalizePipelineStatus,
  nextStepHint,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import { payloadToSnapshot } from "@/convex/lib/payloadSnapshot";
import { ASSESSMENT_WIZARD_STEP_LABELS } from "@/lib/assessment-wizard-steps";
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
  ClipboardCopy,
  History,
  Share2,
  Trash2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SAMARBEID_SLIDE_INDEX =
  ASSESSMENT_WIZARD_STEP_LABELS.indexOf("Samarbeid");
const SAMARBEID_STEP_NUMBER = SAMARBEID_SLIDE_INDEX + 1;

/** Én kilde til utkast-form — brukes ved første lasting og etter gjenoppretting fra versjon. */
function normalizeDraftPayload(raw: AssessmentPayload): AssessmentPayload {
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

function parseKpiNumber(
  raw: string,
  fallback: number,
  current: number,
): number {
  if (raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : current;
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
    if (data?.assessment) {
      setTitleDraft(data.assessment.title);
    }
  }, [data?.assessment?.title, assessmentId]);

  const computed = useMemo(() => {
    if (!payload) return null;
    return computeAllResults(
      payloadToSnapshot(payload as unknown as Record<string, unknown>),
    );
  }, [payload]);

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
    if (!canEdit || !data?.assessment) return;
    const server = data.assessment.title;
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
    data?.assessment?._id,
    data?.assessment?.title,
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
    emblaApi?.scrollTo(SAMARBEID_SLIDE_INDEX);
    requestAnimationFrame(() => {
      document.getElementById("versjoner")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [emblaApi]);

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
        emblaApi.scrollTo(SAMARBEID_SLIDE_INDEX);
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
  }, [emblaApi]);

  const [candidatePickerKey, setCandidatePickerKey] = useState(0);

  function update<K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) {
    setPayload((prev) => (prev ? { ...prev, [key]: value } : prev));
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
                Tittel (vises på kort og i rapporter)
              </Label>
              <Input
                id="assessment-display-title"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder="F.eks. Fakturamottak — leverandør"
                autoComplete="off"
                className="font-heading h-auto max-w-2xl border-0 border-b border-border/60 bg-transparent px-0 py-1 text-xl font-semibold shadow-none focus-visible:border-primary focus-visible:ring-0 sm:text-2xl"
              />
              <p className="text-muted-foreground max-w-2xl text-[11px] leading-snug">
                Prosessnavn i steget «Prosess» er eget felt og oppdaterer ikke
                tittelen automatisk.
              </p>
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
            <p className="text-muted-foreground text-xs sm:text-sm">
              Lagres automatisk. Ved samtidig redigering får du valg om å hente
              siste utkast eller overskrive.
              {access?.collaboratorRole
                ? ` · Rolle: ${ASSESSMENT_COLLAB_ROLE_LABEL_NB[access.collaboratorRole] ?? access.collaboratorRole}`
                : ""}
              {access?.workspaceRole
                ? ` · ${WORKSPACE_ROLE_LABEL_NB[access.workspaceRole] ?? access.workspaceRole} i arbeidsområdet`
                : ""}
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
      <div className="rounded-2xl bg-muted/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-foreground text-sm font-semibold">
            <span className="text-muted-foreground font-normal">
              Steg {slide + 1}/{ASSESSMENT_WIZARD_STEP_LABELS.length}
            </span>
            {" · "}
            {ASSESSMENT_WIZARD_STEP_LABELS[slide]}
          </p>
          <div className="flex items-center gap-2">
            <AssessmentWizardSchemaHelp />
            <select
              id="wizard-step-jump"
              className="border-input bg-background h-8 rounded-lg border px-2 text-xs shadow-sm"
              value={slide}
              onChange={(e) => emblaApi?.scrollTo(Number(e.target.value))}
              aria-label="Hopp til steg"
            >
              {ASSESSMENT_WIZARD_STEP_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {i + 1}. {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-1" aria-label="Fremdrift" role="navigation">
          {ASSESSMENT_WIZARD_STEP_LABELS.map((label, i) => (
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
                  Prosess
                </h2>
                <p className="text-muted-foreground text-sm">
                  Beskriv prosessen som skal vurderes.
                </p>
              </div>
              <AssessmentProcessSlide
                payload={payload}
                canEdit={canEdit}
                update={update}
                candidates={candidates}
                candidatePickerKey={candidatePickerKey}
                bumpCandidatePickerKey={() =>
                  setCandidatePickerKey((k) => k + 1)
                }
              />
            </Slide>

            <Slide bare>
              <AssessmentContextCard
                assessmentId={assessmentId}
                workspaceId={assessment.workspaceId}
                assessment={assessment}
                canEdit={canEdit}
                processScope={payload.processScope ?? "unsure"}
              />
            </Slide>

            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Hvor viktig er dette for virksomheten?
                </h2>
                <p className="text-muted-foreground text-sm">
                  Konsekvens for virksomheten — brukes til prioritering.
                </p>
              </div>
              <div className="space-y-8">
                <LikertField
                  id="cbi"
                  label="Hvor stort er konsekvensen om prosessen svikter?"
                  hint="Tenk på tap av inntekt, pasientsikkerhet, kundetillit, omdømme og driftsstans."
                  value={clampLikert5(payload.criticalityBusinessImpact)}
                  onChange={(v) => update("criticalityBusinessImpact", v)}
                  left="Minimal"
                  right="Svært alvorlig"
                  scaleLabels={["Ubetydelig", "Liten", "Moderat", "Stor", "Kritisk"]}
                  disabled={readOnly}
                />
                <LikertField
                  id="crr"
                  label="Hvor strenge er regulatoriske krav?"
                  hint="GDPR, helselovgivning, arkivplikt, tilsyn, sertifiseringskrav."
                  value={clampLikert5(payload.criticalityRegulatoryRisk)}
                  onChange={(v) => update("criticalityRegulatoryRisk", v)}
                  left="Få krav"
                  right="Svært strenge"
                  scaleLabels={["Minimalt", "Noe", "Moderate", "Strenge", "Svært strenge"]}
                  disabled={readOnly}
                />
              </div>
            </Slide>

            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Er prosessen og systemene forutsigbare?
                </h2>
                <p className="text-muted-foreground text-sm">
                  Robot trenger stabile regler og forutsigbare systemer.
                </p>
              </div>
              <div className="space-y-8">
                <LikertField
                  id="ps"
                  label="Hvor stabil er arbeidsmåten?"
                  hint="Hyppige endringer i skjema, policy eller unntak betyr mer vedlikehold."
                  value={clampLikert5(payload.processStability)}
                  onChange={(v) => update("processStability", v)}
                  left="Endrer seg ofte"
                  right="Svært stabil"
                  scaleLabels={["Ukentlig", "Månedlig", "Kvartalsvis", "Halvårlig", "Sjelden/aldri"]}
                  disabled={readOnly}
                />
                <LikertField
                  id="as"
                  label="Er IT-systemene stabile?"
                  hint="Hyppige oppgraderinger, popup-vinduer eller treghet gjør at roboten feiler."
                  value={clampLikert5(payload.applicationStability)}
                  onChange={(v) => update("applicationStability", v)}
                  left="Uforutsigbart"
                  right="Svært stabilt"
                  scaleLabels={["Ofte feil", "Noe ustabilt", "OK", "Forutsigbart", "Solid og stabilt"]}
                  disabled={readOnly}
                />
              </div>
            </Slide>

            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Hvor mye kan automatiseres?
                </h2>
                <p className="text-muted-foreground text-sm">
                  Datastruktur, variasjon og digitaliseringsgrad.
                </p>
              </div>
              <div className="space-y-8">
                <LikertField
                  id="si"
                  label="Hvor strukturert er input-dataene?"
                  hint="Faste felt og tall er enkle. Fritekst og skannede dokumenter krever AI/OCR."
                  value={clampLikert5(payload.structuredInput)}
                  onChange={(v) => update("structuredInput", v)}
                  left="Ustrukturert"
                  right="Fullt strukturert"
                  scaleLabels={["Fritekst/PDF", "Mest fritekst", "Blanding", "Mest felt", "Kun faste felt"]}
                  disabled={readOnly}
                />
                <LikertField
                  id="pv"
                  label="Hvor mye varierer sakene?"
                  hint="Mange unntak og spesialtilfeller betyr mer manuelt arbeid."
                  value={clampLikert5(payload.processVariability)}
                  onChange={(v) => update("processVariability", v)}
                  left="Nesten identiske"
                  right="Svært ulike"
                  scaleLabels={["< 5 % unntak", "5–15 %", "15–30 %", "30–50 %", "> 50 % unntak"]}
                  disabled={readOnly}
                />
                <LikertField
                  id="dg"
                  label="Hvor digitalisert er prosessen?"
                  hint="Papir og fysiske signaturer må digitaliseres først."
                  value={clampLikert5(payload.digitization)}
                  onChange={(v) => update("digitization", v)}
                  left="Mye papir"
                  right="Heldigitalt"
                  scaleLabels={["Papirbasert", "Mest papir", "Halvt/halvt", "Mest digitalt", "100 % digitalt"]}
                  disabled={readOnly}
                />
              </div>
            </Slide>

            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Omfang og arbeidsmiljø
                </h2>
                <p className="text-muted-foreground text-sm">
                  Flytlengde, antall systemer og teknisk miljø.
                </p>
              </div>
              <div className="space-y-8">
                <LikertField
                  id="processLength"
                  label="Hvor lang er arbeidsflyten?"
                  hint="Tell alle steg fra start til slutt: klikk, navigeringer, kopier/lim."
                  value={clampLikert5(payload.processLength)}
                  onChange={(v) => update("processLength", v)}
                  left="Svært kort"
                  right="Svært lang"
                  scaleLabels={["1–5 steg", "6–15", "16–30", "31–60", "60+"]}
                  disabled={readOnly}
                />
                <LikertField
                  id="applicationCount"
                  label="Hvor mange systemer brukes?"
                  hint="Alt som åpnes: fagapplikasjoner, e-post, Excel, intranett osv."
                  value={clampLikert5(payload.applicationCount)}
                  onChange={(v) => update("applicationCount", v)}
                  left="1 system"
                  right="Mange systemer"
                  scaleLabels={["1", "2", "3–4", "5–6", "7+"]}
                  disabled={readOnly}
                />
                <div className="space-y-5 rounded-2xl bg-muted/15 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="ocr"
                      checked={payload.ocrRequired}
                      onCheckedChange={(c) =>
                        canEdit && update("ocrRequired", c === true)
                      }
                      disabled={!canEdit}
                      className="mt-0.5"
                    />
                    <div>
                      <Label htmlFor="ocr" className="text-sm font-medium">
                        Kreves skanning/OCR?
                      </Label>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Bilder, papir eller PDF uten maskinlesbar tekst.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label
                        htmlFor="thin-client"
                        className="text-sm font-medium"
                      >
                        Andel tynnklient (Citrix/fjernskrivebord)
                      </Label>
                      <Badge variant="outline" className="shrink-0 tabular-nums">
                        {payload.thinClientPercent} %
                      </Badge>
                    </div>
                    <Slider
                      id="thin-client"
                      min={0}
                      max={100}
                      step={1}
                      value={[payload.thinClientPercent]}
                      onValueChange={(v) => {
                        const raw = Array.isArray(v) ? v[0] : v;
                        update(
                          "thinClientPercent",
                          Math.min(100, Math.max(0, Math.round(Number(raw)))),
                        );
                      }}
                      disabled={!canEdit}
                    />
                    <p className="text-muted-foreground text-[11px]">
                      0 % = nettleser / lokalt · 100 % = alt i tynnklient
                    </p>
                  </div>
                </div>
              </div>
            </Slide>

            <Slide>
              <div className="flex items-center gap-2">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Tall og kostnader
                </h2>
                <Badge className="bg-amber-600 text-[10px] text-white hover:bg-amber-600/90 dark:bg-amber-700">
                  Merkantilt
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Tidsbruk og kostnader per år. Anslag er nok.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {(
                  [
                    [
                      "baselineHours",
                      "Manuelle timer på prosessen per år",
                      "Omtrent hvor mange timer brukes totalt på denne typen arbeid i året (alle som deltar).",
                    ],
                    [
                      "reworkHours",
                      "Timer til retting og omarbeid",
                      "Tid brukt på feil, korrigering og gjøre om arbeid.",
                    ],
                    [
                      "auditHours",
                      "Timer til kontroll og revisjon",
                      "Intern kontroll, kvalitetssjekk, revisjon som følger prosessen.",
                    ],
                    [
                      "avgCostPerYear",
                      "Full kostnad per årsverk (kroner)",
                      "Lønn + overhead + sosiale kostnader — et snitt for dem som gjør jobben.",
                    ],
                    [
                      "workingDays",
                      "Arbeidsdager per år",
                      "Vanligvis rundt 220–260 avhengig av avtale.",
                    ],
                    [
                      "workingHoursPerDay",
                      "Timer per arbeidsdag",
                      "F.eks. 7,5 dersom dere bruker ordinær dag.",
                    ],
                    [
                      "employees",
                      "Antall som jobber med denne prosessen",
                      "Hvor mange årsverk er involvert (kan være desimal, f.eks. 2,5).",
                    ],
                  ] as const
                ).map(([key, title, hint]) => (
                  <div key={key} className="space-y-1.5 rounded-xl bg-muted/15 p-4">
                    <Label htmlFor={`kpi-${key}`} className="text-sm font-medium">
                      {title}
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      {hint}
                    </p>
                    <Input
                      id={`kpi-${key}`}
                      type="number"
                      value={payload[key]}
                      onChange={(e) => {
                        const k = key as keyof typeof KPI_DEFAULTS;
                        update(
                          k,
                          parseKpiNumber(
                            e.target.value,
                            KPI_DEFAULTS[k],
                            payload[k] as number,
                          ) as AssessmentPayload[typeof k],
                        );
                      }}
                      disabled={!canEdit}
                      className="h-10 rounded-xl bg-background shadow-sm"
                    />
                  </div>
                ))}
              </div>
            </Slide>

            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Samarbeid
                </h2>
                <p className="text-muted-foreground text-sm">
                  Team, oppgaver og versjoner.
                </p>
              </div>
              <div className="space-y-6">
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
            </Slide>

            <Slide>
              <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold sm:text-2xl">
                  Oppsummering
                </h2>
                <p className="text-muted-foreground text-sm">
                  Siste steg — alt lagres fortløpende. Trykk «Ferdig» for å avslutte.
                </p>
              </div>
              <div className="space-y-6">
                {canEdit ? (
                  <Alert className="border-primary/25 bg-primary/[0.04]">
                    <AlertTitle className="flex flex-wrap items-center gap-2">
                      <History
                        className="text-primary size-4 shrink-0"
                        aria-hidden
                      />
                      Utkast er lagret — slik bruker du milepæler
                    </AlertTitle>
                    <AlertDescription className="space-y-3 text-foreground/90">
                      <p className="leading-relaxed">
                        Alt du har fylt inn, lagres automatisk som{" "}
                        <strong className="text-foreground">utkast</strong>.
                        Navngitte milepæler i loggen (nå:{" "}
                        <strong className="text-foreground tabular-nums">
                          {milestoneCount}
                        </strong>
                        ) opprettes når du trykker{" "}
                        <strong className="text-foreground">«Lagre versjon»</strong>{" "}
                        under Samarbeid — valgfritt for sporbarhet, anbefales før
                        revisjon eller viktige beslutninger.
                      </p>
                      <ul className="text-foreground/95 list-inside list-disc space-y-1.5 text-sm leading-relaxed">
                        <li>
                          Gå til{" "}
                          <strong className="text-foreground">
                            steg {SAMARBEID_STEP_NUMBER} · Samarbeid
                          </strong>{" "}
                          (nedtrekket «Hopp til steg» eller knappen under). Der
                          ligger blokken{" "}
                          <strong className="text-foreground">
                            Milepæler (navngitte versjoner)
                          </strong>
                          .
                        </li>
                        <li>
                          Øverst på siden:{" "}
                          <strong className="text-foreground">
                            Velg milepæl
                          </strong>{" "}
                          og{" "}
                          <strong className="text-foreground">
                            Team, milepæler, deling
                          </strong>
                          .
                        </li>
                      </ul>
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="gap-1.5"
                          onClick={openTeamAndVersions}
                        >
                          <History className="size-3.5" aria-hidden />
                          Åpne versjonsoversikt (steg {SAMARBEID_STEP_NUMBER}{" "}
                          · Samarbeid)
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}
                {computed ? (
                  <>
                    <ProcessSummaryBlocks payload={payload} />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          const text = buildAssessmentContextForAi({
                            title: assessment.title,
                            processName: payload.processName,
                            candidateId: payload.candidateId,
                            processDescription: payload.processDescription,
                            processGoal: payload.processGoal,
                            processActors: payload.processActors,
                            processSystems: payload.processSystems,
                            processFlowSummary: payload.processFlowSummary,
                            processVolumeNotes: payload.processVolumeNotes,
                            processConstraints: payload.processConstraints,
                            processFollowUp: payload.processFollowUp,
                            processScope: payload.processScope,
                            hfOperationsSupportLevel:
                              payload.hfOperationsSupportLevel,
                            hfSecurityInformationNotes:
                              payload.hfSecurityInformationNotes,
                            hfOrganizationalBreadthNotes:
                              payload.hfOrganizationalBreadthNotes,
                            hfEconomicRationaleNotes:
                              payload.hfEconomicRationaleNotes,
                            hfCriticalManualGapNotes:
                              payload.hfCriticalManualGapNotes,
                            hfOperationsSupportNotes:
                              payload.hfOperationsSupportNotes,
                            priorityScore: computed.priorityScore,
                            pipelineLabel:
                              PIPELINE_STATUS_LABELS[
                                normalizePipelineStatus(
                                  assessment.pipelineStatus,
                                )
                              ],
                          });
                          void navigator.clipboard.writeText(text);
                        }}
                      >
                        <ClipboardCopy className="size-3.5" aria-hidden />
                        Kopier kontekst for KI
                      </Button>
                      <span className="text-muted-foreground self-center text-xs">
                        Lim inn i eget KI-verktøy for sortering eller oppsummering.
                      </span>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Samlet anbefaling</p>
                      <p className="font-heading mt-1 text-lg font-semibold">
                        {computed.priorityScore >= 60
                          ? "Sterk kandidat for automatisering"
                          : computed.priorityScore >= 35
                            ? "Moderat kandidat — vurder nærmere"
                            : "Lav prioritet — andre prosesser bør vurderes først"}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {computed.priorityScore >= 60
                          ? "Høyt potensial og viktig prosess. Anbefales prioritert i porteføljen."
                          : computed.priorityScore >= 35
                            ? "Kan ha verdi, men vurder om det finnes enklere eller viktigere prosesser."
                            : "Enten lavt automatiseringspotensial, lav viktighet, eller begge deler."}
                        {!computed.feasible
                          ? " OBS: Prosess- eller systemstabilitet er for lav — avklar dette før oppstart."
                          : ""}
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ScoreCard
                        label="Automatiseringspotensial"
                        value={`${computed.ap.toFixed(1)} %`}
                        sub="Andel av prosessen som kan automatiseres, basert på datastruktur, saksvariasjon, digitalisering og volum."
                      />
                      <ScoreCard
                        label="Viktighet og konsekvens"
                        value={`${computed.criticality.toFixed(1)} %`}
                        sub="Kombinasjon av forretningskonsekvens, regulatorisk risiko og tidsbruk."
                      />
                      <ScoreCard
                        label="Porteføljeprioritet"
                        value={`${computed.priorityScore.toFixed(1)} / 100`}
                        sub="Geometrisk snitt av potensial og viktighet — krever at begge er høye for toppscore."
                      />
                      <ScoreCard
                        label={computed.feasible ? "Stabil nok for robot" : "Stabilitet: Advarsel"}
                        value={computed.feasible ? "Ja" : "Nei — ustabil"}
                        sub={computed.feasible
                          ? "Prosess og systemer er vurdert som tilstrekkelig forutsigbare."
                          : "Prosess eller systemer endrer seg for ofte. Stabiliser før automatisering."}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">
                          Gjennomførbarhet — hvor enkelt er det å bygge?
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {computed.ease.toFixed(1)} % · {computed.easeLabel}
                        </span>
                      </div>
                      <Progress value={computed.ease}>
                        <div className="flex w-full justify-between gap-2 pb-2">
                          <ProgressLabel className="text-muted-foreground">
                            Vanskeligere
                          </ProgressLabel>
                          <ProgressLabel className="text-muted-foreground">
                            Enklere
                          </ProgressLabel>
                        </div>
                      </Progress>
                    </div>
                    <Separator />
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Estimert gevinst</p>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="flex justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2">
                        <dt className="text-muted-foreground">Timer spart / år</dt>
                        <dd className="font-mono font-semibold">{computed.benH.toFixed(0)}</dd>
                      </div>
                      <div className="flex justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2">
                        <dt className="text-muted-foreground">Besparelse / år</dt>
                        <dd className="font-mono font-semibold">
                          {Math.round(computed.benC).toLocaleString("nb-NO")} kr
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2">
                        <dt className="text-muted-foreground">Årsverk frigitt</dt>
                        <dd className="font-mono font-semibold">{computed.benFte.toFixed(2)}</dd>
                      </div>
                      <div className="flex justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2">
                        <dt className="text-muted-foreground">Totale timer / år</dt>
                        <dd className="font-mono font-semibold">{computed.hoursY.toFixed(0)}</dd>
                      </div>
                    </dl>
                  </>
                ) : null}
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
              Siste endringer er nettopp lagret til serveren før du går videre.
              Du har ikke opprettet navngitte milepæler ennå (0 i loggen). Det er
              helt normalt: utkastet lagres også fortløpende mens du jobber.
              Milepæler er valgfrie «frys» av hele vurderingen — bruk dem når du
              trenger spor i revisjon eller dokumentasjon.
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
            {slide + 1} / {ASSESSMENT_WIZARD_STEP_LABELS.length}
          </span>
          {slide >= ASSESSMENT_WIZARD_STEP_LABELS.length - 1 ? (
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

function ProcessSummaryBlocks({ payload }: { payload: AssessmentPayload }) {
  const rows: Array<[string, string | undefined]> = [
    ["Helhetlig beskrivelse", payload.processDescription],
    ["Mål og verdi", payload.processGoal],
    ["Flyt og hovedtrinn", payload.processFlowSummary],
    ["Roller og ansvar", payload.processActors],
    ["Systemer og data", payload.processSystems],
    ["Volum og mønster", payload.processVolumeNotes],
    ["Begrensninger og risiko", payload.processConstraints],
    ["Videre og oppfølging", payload.processFollowUp],
  ];
  const filled = rows.filter(([, v]) => (v ?? "").trim().length > 0);

  if (filled.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
        Ingen utfyllt prosessprofil ennå — gå til steget «Prosess» for å legge
        inn kontekst.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {filled.map(([label, value]) => (
        <div
          key={label}
          className="rounded-xl border border-border/70 bg-gradient-to-br from-muted/30 to-card px-4 py-3"
        >
          <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
            {label}
          </p>
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {value}
          </p>
        </div>
      ))}
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
