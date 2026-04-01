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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ProgressValue,
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
  Share2,
  Trash2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SAMARBEID_SLIDE_INDEX =
  ASSESSMENT_WIZARD_STEP_LABELS.indexOf("Samarbeid");

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
    (p: AssessmentPayload) => {
      if (!canEdit) return;
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

  const goToVurderingerList = useCallback(() => {
    setLeaveWizardOpen(false);
    const wid = data?.assessment.workspaceId;
    if (!wid) return;
    router.push(`/w/${wid}/vurderinger`);
  }, [router, data?.assessment.workspaceId]);

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

      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-gradient-to-r from-muted/40 via-card to-muted/30 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <nav
          className="flex flex-1 flex-wrap items-center justify-center gap-2 sm:justify-start"
          aria-label="Hovedsteg i veiviseren"
        >
          {ASSESSMENT_WIZARD_STEP_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              aria-label={`Gå til ${label}`}
              aria-current={slide === i ? "step" : undefined}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "size-2.5 rounded-full transition-all",
                slide === i
                  ? "bg-primary ring-primary ring-offset-background scale-125 ring-2 ring-offset-2"
                  : i < slide
                    ? "bg-primary/45 hover:bg-primary/60"
                    : "bg-muted-foreground/25 hover:bg-muted-foreground/40",
              )}
            />
          ))}
        </nav>
        <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-2">
          <p className="text-foreground text-center text-sm font-medium sm:min-w-0 sm:flex-1 sm:text-left">
            <span className="text-muted-foreground font-normal">
              Steg {slide + 1} av {ASSESSMENT_WIZARD_STEP_LABELS.length} ·{" "}
            </span>
            <span className="break-words">
              {ASSESSMENT_WIZARD_STEP_LABELS[slide]}
            </span>
          </p>
          <AssessmentWizardSchemaHelp />
          <label htmlFor="wizard-step-jump" className="sr-only">
            Hopp til steg
          </label>
          <select
            id="wizard-step-jump"
            className="border-input bg-background h-9 w-full min-w-0 shrink-0 rounded-lg border px-2 text-sm shadow-xs sm:w-[min(100%,14rem)]"
            value={slide}
            onChange={(e) => emblaApi?.scrollTo(Number(e.target.value))}
          >
            {ASSESSMENT_WIZARD_STEP_LABELS.map((label, i) => (
              <option key={label} value={i}>
                {i + 1}. {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p id="wizard-gesture-hint" className="sr-only">
        Sveip horisontalt med finger, eller dra med mus på steget, for å gå til
        neste eller forrige hovedsteg. På desktop kan du bruke horisontalt
        musehjul eller holde Shift og bruke hjulet vertikalt.
      </p>
      <p
        className="text-muted-foreground px-1 text-center text-[11px] leading-snug sm:hidden"
        aria-hidden
      >
        Sveip ← → mellom steg · eller bruk knappene under
      </p>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/50 shadow-md backdrop-blur-[2px]">
        <div
          ref={emblaRef}
          className="cursor-grab touch-manipulation active:cursor-grabbing"
          aria-describedby="wizard-gesture-hint"
        >
          <div className="flex">
            <Slide>
              <CardHeader className="space-y-2 pb-2">
                <CardTitle className="text-xl sm:text-2xl">Prosess</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Grunnlag, beskrivelse og valgfrie kravtekster i faner — mindre
                  scrolling. Deretter: organisasjon og ROS/PDD.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
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
              </CardContent>
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
              <CardHeader className="space-y-3 px-4 pb-2 pt-6 sm:px-8">
                <CardTitle>Hvor viktig er dette for virksomheten?</CardTitle>
                <CardDescription className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                  Konsekvens for virksomheten — ikke teknisk detalj. Brukes til
                  prioritering. Timer regnes inn under «Tall og kost».
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-4">
                <div className="border-border/50 border-b px-6 py-5 sm:px-8 last:border-b-0">
                  <LikertField
                    id="cbi"
                    label="Hvor stort er tapet hvis denne prosessen stopper eller feiler?"
                    hint="Kunder, pasienter, økonomi eller omdømme."
                    value={clampLikert5(payload.criticalityBusinessImpact)}
                    onChange={(v) => update("criticalityBusinessImpact", v)}
                    left="Lite merkbart"
                    right="Svært alvorlig"
                    disabled={readOnly}
                  />
                </div>
                <div className="border-border/50 border-b px-6 py-5 sm:px-8 last:border-b-0">
                  <LikertField
                    id="crr"
                    label="Hvor strengt må dere følge regler og dokumentasjon?"
                    hint="Personvern, helse, arkiv, offentlige krav."
                    value={clampLikert5(payload.criticalityRegulatoryRisk)}
                    onChange={(v) => update("criticalityRegulatoryRisk", v)}
                    left="Slakk krav"
                    right="Strenge krav"
                    disabled={readOnly}
                  />
                </div>
              </CardContent>
            </Slide>

            <Slide>
              <CardHeader className="space-y-3 px-4 pb-2 pt-6 sm:px-8">
                <CardTitle>Er prosessen og systemene forutsigbare?</CardTitle>
                <CardDescription className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                  Robot trenger at reglene er stabile og at systemene oppfører
                  seg likt fra uke til uke.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-4">
                <div className="border-border/50 border-b px-6 py-5 sm:px-8 last:border-b-0">
                  <LikertField
                    id="ps"
                    label="Hvor ofte endrer dere måten dere jobber på i denne prosessen?"
                    hint="Ofte endrede rutiner og unntak gjør automatisering vanskeligere."
                    value={clampLikert5(payload.processStability)}
                    onChange={(v) => update("processStability", v)}
                    left="Endrer seg ofte"
                    right="Sjeldent endring"
                    disabled={readOnly}
                  />
                </div>
                <div className="border-border/50 border-b px-6 py-5 sm:px-8 last:border-b-0">
                  <LikertField
                    id="as"
                    label="Kan dere stole på at IT-systemene oppfører seg likt fra dag til dag?"
                    hint="Skjermbilder, felt og meldinger — forutsigbar opplevelse."
                    value={clampLikert5(payload.applicationStability)}
                    onChange={(v) => update("applicationStability", v)}
                    left="Uforutsigbart"
                    right="Forutsigbart"
                    disabled={readOnly}
                  />
                </div>
              </CardContent>
            </Slide>

            <Slide>
              <CardHeader className="space-y-3 px-4 pb-2 pt-6 sm:px-8">
                <CardTitle>Hvor mye av jobben kan en robot ta over?</CardTitle>
                <CardDescription className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                  Struktur på data, hvor like sakene er, og hvor digitalt det er
                  — sier noe om hvor mye som er realistisk å automatisere.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-4">
                <div className="border-border/50 border-b px-6 py-5 sm:px-8 last:border-b-0">
                  <LikertField
                    id="si"
                    label="Kommer opplysningene inn i faste felt, eller som fritekst, e-post og vedlegg?"
                    hint="Faste felt og lister er enklere enn fri tekst og tunge PDF-er."
                    value={clampLikert5(payload.structuredInput)}
                    onChange={(v) => update("structuredInput", v)}
                    left="Mye rot og varianter"
                    right="Ryddige felt og regler"
                    disabled={readOnly}
                  />
                </div>
                <div className="border-border/50 border-b px-6 py-5 sm:px-8 last:border-b-0">
                  <LikertField
                    id="pv"
                    label="Er sakene stort sett like, eller nesten unike hver gang?"
                    hint="Svært ulike saker krever mer skjønn — vanskeligere å automatisere."
                    value={clampLikert5(payload.processVariability)}
                    onChange={(v) => update("processVariability", v)}
                    left="Ganske like"
                    right="Svært ulike"
                    disabled={readOnly}
                  />
                </div>
                <div className="border-border/50 border-b px-6 py-5 sm:px-8 last:border-b-0">
                  <LikertField
                    id="dg"
                    label="Skjer det meste digitalt, eller mye på papir og manuell flytting?"
                    hint="Mer i systemer gir ofte enklere automatisering."
                    value={clampLikert5(payload.digitization)}
                    onChange={(v) => update("digitization", v)}
                    left="Mye papir/manuelt"
                    right="Mest digitalt"
                    disabled={readOnly}
                  />
                </div>
              </CardContent>
            </Slide>

            <Slide>
              <CardHeader className="space-y-3 px-4 pb-2 pt-6 sm:px-8">
                <CardTitle>Hvor omfattende er prosessen — og arbeidsmiljøet?</CardTitle>
                <CardDescription className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                  Lengde på flyt, antall systemer, skanning og fjernskrivebord —
                  påvirker hvor krevende det er å bygge.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-4">
                <div className="border-border/50 border-b px-6 py-5 sm:px-8 last:border-b-0">
                  <LikertField
                    id="processLength"
                    label="Hvor mange steg og håndgrep er det fra start til ferdig?"
                    hint="Kort flyt: færre feilkilder. Lang flyt: mer å kartlegge."
                    value={clampLikert5(payload.processLength)}
                    onChange={(v) => update("processLength", v)}
                    left="Få steg"
                    right="Mange steg"
                    disabled={readOnly}
                  />
                </div>
                <div className="border-border/50 border-b px-6 py-5 sm:px-8 last:border-b-0">
                  <LikertField
                    id="applicationCount"
                    label="Hvor mange ulike systemer må man inn i underveis?"
                    hint="Flere vinduer og pålogginger øker kompleksitet."
                    value={clampLikert5(payload.applicationCount)}
                    onChange={(v) => update("applicationCount", v)}
                    left="Ett–få"
                    right="Mange"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-6 px-6 py-5 sm:px-8">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="ocr"
                        checked={payload.ocrRequired}
                        onCheckedChange={(c) =>
                          canEdit && update("ocrRequired", c === true)
                        }
                        disabled={!canEdit}
                        className="mt-1"
                      />
                      <div className="space-y-2">
                        <Label htmlFor="ocr" className="text-base leading-snug">
                          Må dere lese tekst ut fra skannede dokumenter eller
                          bilder?
                        </Label>
                        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                          Huk av ved skanning, foto av papir eller PDF uten
                          maskinlesbar tekst — krever OCR og øker ofte kost.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <Label
                        htmlFor="thin-client"
                        className="max-w-md text-base leading-snug"
                      >
                        Hvor stor del av jobben skjer i tynnklient (Citrix,
                        fjernskrivebord)?
                      </Label>
                      <Badge variant="outline" className="shrink-0">
                        {payload.thinClientPercent}%
                      </Badge>
                    </div>
                    <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                      Mye tynnklient gjør ofte robot vanskeligere — høyere risiko
                      og kost.
                    </p>
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
                      className="pt-1"
                    />
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      0 % = nettleser / lokale programmer. 100 % = alt i
                      tynnklient.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Slide>

            <Slide>
              <CardHeader className="space-y-3 px-4 pb-2 pt-6 sm:px-8">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Tall for ett år — grunnlag for beregning</CardTitle>
                  <Badge className="bg-amber-600 text-[10px] text-white hover:bg-amber-600/90 dark:bg-amber-700">
                    Merkantilt
                  </Badge>
                </div>
                <CardDescription className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                  Konkrete tall for tidsbruk og kost — brukes i beregningen av
                  besparelse og porteføljeprioritet. Uten disse blir ikke
                  kroner/timer i modellen meningsfulle. Anslag er nok; dere kan
                  justere senere.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-7 sm:grid-cols-2 sm:px-8">
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
                  <div key={key} className="space-y-2.5">
                    <Label htmlFor={`kpi-${key}`} className="text-base">
                      {title}
                    </Label>
                    <p className="text-muted-foreground text-sm leading-relaxed">
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
                    />
                  </div>
                ))}
              </CardContent>
            </Slide>

            <Slide>
              <CardHeader>
                <CardTitle>Samarbeid</CardTitle>
                <CardDescription>
                  Team, oppgaver med tildeling og frist, notater og
                  versjonspunkter — samlet slik at alle ser hvem som gjør hva.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
              </CardContent>
            </Slide>

            <Slide>
              <CardHeader>
                <CardTitle>Oppsummering</CardTitle>
                <CardDescription className="leading-relaxed">
                  Dette er siste steg — det finnes ikke flere sider etter denne.
                  Skjemaet lagres fortløpende som utkast. Bruk «Forrige» for å
                  endre svar, eller «Ferdig» nederst for å gå tilbake til
                  vurderingsoversikten.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {canEdit ? (
                  <Alert className="border-primary/25 bg-primary/[0.04]">
                    <AlertTitle>Utkast er lagret — milepæler er noe annet</AlertTitle>
                    <AlertDescription className="space-y-3 text-foreground/90">
                      <p className="leading-relaxed">
                        Alt du har fylt inn, lagres automatisk som{" "}
                        <strong className="text-foreground">utkast</strong>.
                        Navngitte milepæler i loggen (nå:{" "}
                        <strong className="text-foreground tabular-nums">
                          {milestoneCount}
                        </strong>
                        ) opprettes bare når du trykker{" "}
                        <strong className="text-foreground">«Lagre versjon»</strong>{" "}
                        under Samarbeid — valgfritt for sporbarhet, anbefales før
                        revisjon eller viktige beslutninger.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={openTeamAndVersions}
                      >
                        Gå til milepæler og «Lagre versjon»
                      </Button>
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
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ScoreCard
                        label="Hvor mye som kan automatiseres (modell)"
                        value={`${computed.ap.toFixed(1)} %`}
                      />
                      <ScoreCard
                        label="Viktighet / konsekvens (modell)"
                        value={`${computed.criticality.toFixed(1)} %`}
                      />
                      <ScoreCard
                        label="Foreslått porteføljeprioritet"
                        value={computed.priorityScore.toFixed(1)}
                        sub="Kombinasjon av automasjonspotensial og viktighet (√ AP × viktighet, 0–100)."
                      />
                      <ScoreCard
                        label="Trygg nok prosess og systemer?"
                        value={
                          computed.feasible
                            ? "Ja — innenfor akseptabelt nivå"
                            : "Trenger avklaring først"
                        }
                      />
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      «Trygg nok» betyr at både arbeidsmåten og systemene er vurdert
                      som minst middels forutsigbare (steg «Trygghet»).
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-muted-foreground max-w-[min(100%,18rem)]">
                          Gjennomførbarhet (høyere % = enklere å bygge og drift)
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {computed.ease.toFixed(1)} % · {computed.easeLabel}
                        </span>
                      </div>
                      <Progress value={computed.ease}>
                        <div className="flex w-full justify-between gap-2 pb-2">
                          <ProgressLabel className="text-muted-foreground">
                            Enklere mot høyre
                          </ProgressLabel>
                          <ProgressValue />
                        </div>
                      </Progress>
                    </div>
                    <Separator />
                    <dl className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Timer spart /år</dt>
                        <dd className="font-mono">{computed.benH.toFixed(1)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">NOK /år</dt>
                        <dd className="font-mono">
                          {Math.round(computed.benC).toLocaleString("nb-NO")}
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : null}
              </CardContent>
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
              Du har ikke opprettet navngitte milepæler ennå (0 i loggen). Det er
              helt normalt: skjemaet lagres fortløpende som{" "}
              <strong className="text-foreground">utkast</strong>. Milepæler er
              valgfrie «frys» av hele vurderingen — bruk dem når du trenger spor
              i revisjon eller dokumentasjon.
            </p>
          </DialogBody>
          <DialogFooter className="flex-wrap sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLeaveWizardOpen(false);
                openTeamAndVersions();
              }}
            >
              Gå til milepæler først
            </Button>
            <Button type="button" onClick={() => void goToVurderingerList()}>
              Gå til vurderingsoversikt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-3 px-4">
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={slide <= 0}
            >
              <ChevronLeft className="size-4" />
              Forrige
            </Button>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-center">
            <span className="text-muted-foreground text-xs tabular-nums">
              Steg {slide + 1} av {ASSESSMENT_WIZARD_STEP_LABELS.length}
            </span>
            {slide >= ASSESSMENT_WIZARD_STEP_LABELS.length - 1 ? (
              <span className="text-muted-foreground text-[11px] font-medium">
                Siste steg
              </span>
            ) : null}
          </div>
          <div className="flex justify-end">
            {slide >= ASSESSMENT_WIZARD_STEP_LABELS.length - 1 ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-1"
                onClick={() => {
                  if (canEdit && milestoneCount === 0) {
                    setLeaveWizardOpen(true);
                  } else {
                    void goToVurderingerList();
                  }
                }}
              >
                Ferdig
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => emblaApi?.scrollNext()}
              >
                Neste
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
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
  /** Eget kortinnhold (f.eks. organisasjonskort) */
  bare?: boolean;
}) {
  return (
    <div className="min-w-0 shrink-0 grow-0 basis-[100%] px-2 pb-12 sm:px-3">
      {bare ? (
        children
      ) : (
        <Card className="gap-6 border-0 py-5 shadow-none sm:border sm:shadow-sm sm:py-6">
          {children}
        </Card>
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
