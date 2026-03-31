"use client";

import { AssessmentCollaborationPanel } from "@/components/assessment-wizard/assessment-collaboration-panel";
import { AssessmentContextCard } from "@/components/assessment-wizard/assessment-context-card";
import { AssessmentExportPanel } from "@/components/assessment-wizard/assessment-export-panel";
import { ProcessProfileSection } from "@/components/assessment-wizard/process-profile-section";
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
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import { payloadToSnapshot } from "@/convex/lib/payloadSnapshot";
import { clampLikert5, computeAllResults } from "@/lib/rpa-assessment/scoring";
import { useMutation, useQuery } from "convex/react";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Share2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const SLIDE_LABELS = [
  "Prosess",
  "Organisasjon",
  "Viktighet",
  "Trygghet",
  "Automatisering",
  "Omfang og teknikk",
  "Tall og kost",
  "Samarbeid",
  "Oppsummering",
] as const;

const SAMARBEID_SLIDE_INDEX = SLIDE_LABELS.indexOf("Samarbeid");

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
  const data = useQuery(api.assessments.getDraft, { assessmentId });
  const access = useQuery(api.assessments.getMyAccess, { assessmentId });
  const collaborators = useQuery(api.assessments.listCollaborators, {
    assessmentId,
  });
  const candidates = useQuery(
    api.candidates.listByWorkspace,
    data?.assessment
      ? { workspaceId: data.assessment.workspaceId }
      : "skip",
  );
  const saveDraft = useMutation(api.assessments.saveDraft);

  const [payload, setPayload] = useState<AssessmentPayload | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: false,
    containScroll: "trimSnaps",
    dragFree: false,
  });
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (data?.draft?.payload) {
      const raw = data.draft.payload as AssessmentPayload;
      setPayload({
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
      });
    }
  }, [data?.draft?.payload, data?.draft?._id]);

  const computed = useMemo(() => {
    if (!payload) return null;
    return computeAllResults(
      payloadToSnapshot(payload as unknown as Record<string, unknown>),
    );
  }, [payload]);

  const canEdit = access?.canEdit ?? false;
  const readOnly = !canEdit;

  const persist = useCallback(
    async (p: AssessmentPayload) => {
      if (!canEdit) return;
      await saveDraft({ assessmentId, payload: p });
    },
    [assessmentId, canEdit, saveDraft],
  );

  useEffect(() => {
    if (!payload || !canEdit) return;
    const t = setTimeout(() => {
      void persist(payload);
    }, 700);
    return () => clearTimeout(t);
  }, [payload, persist, canEdit]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", () => setSlide(emblaApi.selectedScrollSnap()));
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

  if (data === null || !payload) {
    return (
      <p className="text-destructive text-sm">Ingen tilgang eller mangler data.</p>
    );
  }

  const { assessment } = data;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold sm:text-2xl">
            {assessment.title}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {canEdit ? "Endringer lagres automatisk." : "Kun visning."}
            {access?.collaboratorRole
              ? ` · Rolle: ${access.collaboratorRole}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="size-3" />
            {collaborators?.length ?? 0} personer
          </Badge>
          {access?.shareWithWorkspace ? (
            <Badge variant="secondary" className="gap-1">
              <Share2 className="size-3" />
              Delt med workspace
            </Badge>
          ) : null}
        </div>
      </div>

      <AssessmentExportPanel
        assessmentId={assessmentId}
        workspaceId={assessment.workspaceId}
        canEdit={canEdit}
      />

      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-muted/40 via-card to-muted/30 p-1.5 shadow-sm">
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {SLIDE_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                slide === i
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
              }`}
            >
              <span className="tabular-nums text-[10px] opacity-80">
                {i + 1}
              </span>{" "}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/50 shadow-md backdrop-blur-[2px]">
        <div ref={emblaRef} className="touch-pan-y">
          <div className="flex">
            <Slide>
              <CardHeader className="space-y-2 pb-2">
                <CardTitle className="text-xl sm:text-2xl">Prosess</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Koble til kandidat, fyll ut prosessprofilen og angi
                  organisatorisk omfang. Neste steg er organisasjon og ROS/PDD —
                  da ligger konteksten klar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="rounded-xl border border-dashed border-primary/25 bg-muted/20 p-4 sm:p-5">
                  <p className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-wide">
                    Kandidat og referanse
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {candidates && candidates.length > 0 ? (
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="pick-candidate">
                          Registrert kandidat
                        </Label>
                        <select
                          key={candidatePickerKey}
                          id="pick-candidate"
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
                        <p className="text-muted-foreground text-xs">
                          Administreres under arbeidsområdet — eller fyll inn
                          manuelt under.
                        </p>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label>Prosessnavn</Label>
                      <Input
                        value={payload.processName}
                        onChange={(e) =>
                          update("processName", e.target.value)
                        }
                        disabled={!canEdit}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="candidate-ref">Referanse / ID</Label>
                      <Input
                        id="candidate-ref"
                        value={payload.candidateId}
                        onChange={(e) =>
                          update("candidateId", e.target.value)
                        }
                        disabled={!canEdit}
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
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
                          className="h-auto min-h-10 justify-start whitespace-normal px-4 py-2.5 text-left"
                          disabled={!canEdit}
                          onClick={() => update("processScope", value)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Styrer veiledning i neste steg — ikke i poengberegning.
                    </p>
                  </div>
                </div>

                <ProcessProfileSection
                  payload={payload}
                  canEdit={canEdit}
                  update={update}
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
                <div className="border-border/50 border-b px-6 py-8 sm:px-8 last:border-b-0">
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
                <div className="border-border/50 border-b px-6 py-8 sm:px-8 last:border-b-0">
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
                <div className="border-border/50 border-b px-6 py-8 sm:px-8 last:border-b-0">
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
                <div className="border-border/50 border-b px-6 py-8 sm:px-8 last:border-b-0">
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
                <div className="border-border/50 border-b px-6 py-8 sm:px-8 last:border-b-0">
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
                <div className="border-border/50 border-b px-6 py-8 sm:px-8 last:border-b-0">
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
                <div className="border-border/50 border-b px-6 py-8 sm:px-8 last:border-b-0">
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
                <div className="border-border/50 border-b px-6 py-8 sm:px-8 last:border-b-0">
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
                <div className="border-border/50 border-b px-6 py-8 sm:px-8 last:border-b-0">
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
                <div className="space-y-10 px-6 py-8 sm:px-8">
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
                <CardTitle>Tall for ett år — grunnlag for beregning</CardTitle>
                <CardDescription className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                  Konkrete tall for tidsbruk og kost — brukes i beregningen.
                  Anslag er nok; dere kan justere senere.
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
                />
              </CardContent>
            </Slide>

            <Slide>
              <CardHeader>
                <CardTitle>Oppsummering</CardTitle>
                <CardDescription className="leading-relaxed">
                  Dette er siste steg — det finnes ikke flere sider etter denne.
                  Alt er lagret underveis. Bruk «Forrige» for å endre svar, eller
                  «Ferdig» nederst for å gå tilbake til vurderingsoversikten.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
              Steg {slide + 1} av {SLIDE_LABELS.length}
            </span>
            {slide >= SLIDE_LABELS.length - 1 ? (
              <span className="text-muted-foreground text-[11px] font-medium">
                Siste steg
              </span>
            ) : null}
          </div>
          <div className="flex justify-end">
            {slide >= SLIDE_LABELS.length - 1 ? (
              <Link
                href={`/w/${assessment.workspaceId}/vurderinger`}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "gap-1",
                )}
              >
                Ferdig
                <ChevronRight className="size-4" aria-hidden />
              </Link>
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
