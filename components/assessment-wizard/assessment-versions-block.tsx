"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { Id } from "@/convex/_generated/dataModel";
import type { AssessmentPayload } from "@/lib/assessment-types";
import { labelAssessmentPayloadField } from "@/lib/assessment-payload-field-labels";
import { toast } from "@/lib/app-toast";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useMutation, useQuery } from "convex/react";
import {
  Eye,
  GitCompare,
  History,
  Layers,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type VersionRow = {
  _id: Id<"assessmentVersions">;
  version: number;
  createdAt: number;
  note?: string | null;
  creatorName?: string | null;
};

type Props = {
  assessmentId: Id<"assessments">;
  versions: VersionRow[] | undefined;
  canEdit: boolean;
  /** Ekstern forespørsel (f.eks. metarad): åpne forhåndsvisning av denne versjonen. */
  previewRequestVersion?: number | null;
  onPreviewRequestConsumed?: () => void;
  onDraftRestored?: (
    payload: AssessmentPayload,
    meta?: { revision: number },
  ) => void;
};

export function AssessmentVersionsBlock({
  assessmentId,
  versions,
  canEdit,
  previewRequestVersion,
  onPreviewRequestConsumed,
  onDraftRestored,
}: Props) {
  const createVersion = useMutation(api.assessments.createVersion);
  const restoreDraftFromVersion = useMutation(
    api.assessments.restoreDraftFromVersion,
  );
  const deleteAssessmentVersion = useMutation(
    api.assessments.deleteAssessmentVersion,
  );

  const [versionNote, setVersionNote] = useState("");
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const previewData = useQuery(
    api.assessments.getAssessmentVersion,
    previewVersion !== null
      ? { assessmentId, version: previewVersion }
      : "skip",
  );

  const compareData = useQuery(
    api.assessments.compareAssessmentVersions,
    compareOpen &&
      compareA !== null &&
      compareB !== null &&
      compareA !== compareB
      ? { assessmentId, versionA: compareA, versionB: compareB }
      : "skip",
  );

  const versionOptions = useMemo(() => {
    const list = versions ?? [];
    return [...list].sort((a, b) => b.version - a.version);
  }, [versions]);

  const openCompare = useCallback(() => {
    setActionError(null);
    const list = versionOptions;
    if (list.length >= 2) {
      setCompareA(list[0]!.version);
      setCompareB(list[1]!.version);
    } else {
      setCompareA(null);
      setCompareB(null);
    }
    setCompareOpen(true);
  }, [versionOptions]);

  const setViewFromSelect = useCallback((raw: string) => {
    setActionError(null);
    if (raw === "draft" || raw === "") {
      setPreviewVersion(null);
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      setPreviewVersion(n);
    }
  }, []);

  const runRestore = useCallback(
    (version: number) => {
      setActionError(null);
      setPreviewVersion(null);
      return restoreDraftFromVersion({
        assessmentId,
        version,
      })
        .then((result) => {
          if (result?.payload && onDraftRestored) {
            onDraftRestored(result.payload, {
              revision: result.revision,
            });
          }
          toast.success(`Utkastet er satt til innhold fra v${version}.`);
        })
        .catch((e: unknown) => {
          setActionError(formatUserFacingError(e));
        });
    },
    [assessmentId, onDraftRestored, restoreDraftFromVersion],
  );

  const runDelete = useCallback(
    (version: number) => {
      setActionError(null);
      return deleteAssessmentVersion({
        assessmentId,
        version,
      })
        .then(() => {
          setPreviewVersion((prev) => (prev === version ? null : prev));
          toast.success(`Milepæl v${version} er slettet.`);
        })
        .catch((e: unknown) => {
          setActionError(formatUserFacingError(e));
        });
    },
    [assessmentId, deleteAssessmentVersion],
  );

  useEffect(() => {
    if (
      previewRequestVersion == null ||
      previewRequestVersion <= 0 ||
      !Number.isFinite(previewRequestVersion)
    ) {
      return;
    }
    const v = previewRequestVersion;
    const t = window.setTimeout(() => {
      setActionError(null);
      setPreviewVersion(v);
      onPreviewRequestConsumed?.();
    }, 0);
    return () => clearTimeout(t);
  }, [previewRequestVersion, onPreviewRequestConsumed]);

  return (
    <div id="versjoner" className="scroll-mt-28 space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex items-start gap-2">
          <History className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <h3 className="font-heading text-base font-semibold">
              Milepæler (navngitte versjoner)
            </h3>
            <p className="text-muted-foreground mt-0.5 max-w-prose text-sm leading-snug">
              Her fryser du <strong className="text-foreground">valgfrie</strong>{" "}
              øyeblikk av hele vurderingen (skjema + beregning). Det du skriver
              ellers lagres automatisk som <strong className="text-foreground">utkast</strong>{" "}
              og teller ikke her — bruk «Lagre versjon» når du trenger sporbarhet
              (revisjon, milepæl, før/etter).
            </p>
          </div>
        </div>
      </div>

      {versionOptions.length > 0 ? (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.05] to-muted/25 p-4 shadow-sm ring-1 ring-primary/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="text-primary size-4 shrink-0" aria-hidden />
                <Label
                  htmlFor="version-quick-switch"
                  className="text-foreground text-sm font-semibold"
                >
                  Bytt visning (utkast eller milepæl)
                </Label>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong className="text-foreground">Utkast</strong> er det aktive
                skjemaet. Velg en <strong className="text-foreground">milepæl</strong>{" "}
                for å se et fryst tidspunkt — derfra kan du gjenopprette eller slette.
              </p>
              <select
                id="version-quick-switch"
                className="border-input bg-background focus-visible:ring-primary/30 h-11 w-full max-w-2xl rounded-xl border px-3 text-sm font-medium shadow-sm outline-none focus-visible:ring-2"
                value={previewVersion === null ? "draft" : String(previewVersion)}
                onChange={(e) => setViewFromSelect(e.target.value)}
              >
                <option value="draft">Utkast (gjeldende redigering)</option>
                {versionOptions.map((v) => (
                  <option key={v._id} value={String(v.version)}>
                    v{v.version} ·{" "}
                    {new Date(v.createdAt).toLocaleString("nb-NO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    {v.note
                      ? ` — ${v.note.length > 56 ? `${v.note.slice(0, 54)}…` : v.note}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            {versionOptions.length >= 2 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0 gap-1.5 self-start lg:self-end"
                onClick={openCompare}
              >
                <GitCompare className="size-3.5" aria-hidden />
                Sammenlign to milepæler
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {actionError ? (
        <Alert variant="destructive" className="border-destructive/40 py-2">
          <AlertTitle className="text-sm">Kunne ikke fullføre</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="version-note" className="text-xs">
            Notat til ny versjon (valgfritt)
          </Label>
          <Input
            id="version-note"
            value={versionNote}
            onChange={(e) => setVersionNote(e.target.value)}
            placeholder="F.eks. Etter internkontroll Q2"
            disabled={!canEdit}
            className="h-9"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 w-full sm:w-auto"
          disabled={!canEdit}
          onClick={() => {
            setActionError(null);
            void createVersion({
              assessmentId,
              note: versionNote || undefined,
            })
              .then(() => {
                setVersionNote("");
                toast.success("Ny milepæl er lagret.");
              })
              .catch((e: unknown) =>
                setActionError(formatUserFacingError(e)),
              );
          }}
        >
          Lagre versjon
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/50">
        <div className="text-muted-foreground border-b border-border/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
          Lagrede versjoner
        </div>
        <ul className="divide-border/50 max-h-[min(420px,55vh)] divide-y overflow-y-auto [scrollbar-width:thin]">
          {(versions ?? []).length === 0 ? (
            <li className="text-muted-foreground space-y-2 px-4 py-8 text-center text-sm leading-relaxed">
              <p>
                Ingen navngitte milepæler ennå — det betyr ikke at arbeidet er
                borte. Skjemaet ditt ligger som{" "}
                <strong className="text-foreground">auto-lagret utkast</strong>{" "}
                hele tiden.
              </p>
              <p>
                Trykk «Lagre versjon» over når du vil fryse et tidspunkt (f.eks.
                før workshop, etter internkontroll).
              </p>
            </li>
          ) : (
            versionOptions.map((ver) => (
              <li
                key={ver._id}
                className="border-border/50 bg-card/50 hover:bg-muted/15 flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="bg-primary/10 text-primary font-mono rounded-md px-1.5 py-0.5 text-sm font-bold tabular-nums">
                      v{ver.version}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(ver.createdAt).toLocaleString("nb-NO")}
                    </span>
                    {ver.creatorName ? (
                      <span className="text-muted-foreground text-xs">
                        · {ver.creatorName}
                      </span>
                    ) : null}
                  </div>
                  {ver.note ? (
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {ver.note}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-9 gap-1.5"
                    onClick={() => {
                      setActionError(null);
                      setPreviewVersion(ver.version);
                    }}
                  >
                    <Eye className="size-3.5" aria-hidden />
                    Vis
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5"
                    disabled={!canEdit}
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        window.confirm(
                          `Gjenopprette aktivt utkast fra v${ver.version}? Ulagrede endringer i skjemaet erstattes.`,
                        )
                      ) {
                        void runRestore(ver.version);
                      }
                    }}
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Bruk som utkast
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 border-destructive/30 hover:text-destructive h-9 gap-1.5"
                    disabled={!canEdit}
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        window.confirm(
                          `Slette v${ver.version} permanent? Kan ikke angres.`,
                        )
                      ) {
                        void runDelete(ver.version);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Slett
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Forhåndsvisning */}
      <Dialog
        open={previewVersion !== null}
        onOpenChange={(o) => {
          if (!o) setPreviewVersion(null);
        }}
      >
        <DialogContent size="lg" titleId="ver-preview-title">
          <DialogHeader className="relative space-y-4 pr-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
              <div className="min-w-0">
                <p
                  id="ver-preview-title"
                  className="font-heading text-lg font-semibold"
                >
                  Milepæl v{previewData?.version ?? previewVersion}
                </p>
                <p className="text-muted-foreground text-sm">
                  {previewData
                    ? new Date(previewData.createdAt).toLocaleString("nb-NO")
                    : null}
                  {previewData?.creatorName
                    ? ` · ${previewData.creatorName}`
                    : ""}
                </p>
              </div>
              {previewVersion !== null && versionOptions.length > 1 ? (
                <div className="flex w-full min-w-0 flex-col gap-1.5 lg:max-w-[16rem]">
                  <Label
                    htmlFor="ver-preview-switch"
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Bytt til annen milepæl
                  </Label>
                  <select
                    id="ver-preview-switch"
                    className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
                    value={String(previewVersion)}
                    onChange={(e) => setViewFromSelect(e.target.value)}
                  >
                    {versionOptions.map((v) => (
                      <option key={v._id} value={String(v.version)}>
                        v{v.version}
                        {v.note
                          ? ` — ${v.note.length > 32 ? `${v.note.slice(0, 30)}…` : v.note}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 rounded-full"
              aria-label="Lukk"
              onClick={() => setPreviewVersion(null)}
            >
              <X className="size-4" />
            </Button>
          </DialogHeader>
          <DialogBody className="space-y-3 text-sm">
            {previewData ? (
              <>
                {previewData.note ? (
                  <p className="text-muted-foreground border-l-2 border-primary/40 pl-3 text-sm">
                    {previewData.note}
                  </p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-muted-foreground text-[11px] font-medium">
                      Prosessnavn (snapshot)
                    </p>
                    <p className="mt-0.5 font-medium">
                      {previewData.processName || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-muted-foreground text-[11px] font-medium">
                      Referanse
                    </p>
                    <p className="mt-0.5 font-mono text-xs">
                      {previewData.candidateId || "—"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
                    Beregning (lagret)
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric label="AP" v={`${previewData.computed.ap.toFixed(1)} %`} />
                    <Metric
                      label="Prioritet"
                      v={previewData.computed.priorityScore.toFixed(1)}
                    />
                    <Metric
                      label="Viktighet"
                      v={`${previewData.computed.criticality.toFixed(1)} %`}
                    />
                    <Metric
                      label="Lettgrad"
                      v={previewData.computed.easeLabel}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Laster …</p>
            )}
          </DialogBody>
          <DialogFooter className="flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {canEdit && previewVersion !== null ? (
                <>
                  <Button
                    type="button"
                    variant="default"
                    className="gap-1.5"
                    onClick={() => {
                      if (!previewVersion) return;
                      if (
                        typeof window !== "undefined" &&
                        !window.confirm(
                          `Gjenopprette aktivt utkast fra v${previewVersion}? Ulagrede endringer i skjemaet erstattes.`,
                        )
                      ) {
                        return;
                      }
                      void runRestore(previewVersion);
                    }}
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Bruk som aktivt utkast
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => {
                      if (!previewVersion) return;
                      if (
                        typeof window !== "undefined" &&
                        !window.confirm(
                          `Slette v${previewVersion} permanent? Kan ikke angres.`,
                        )
                      ) {
                        return;
                      }
                      void runDelete(previewVersion);
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Slett milepæl
                  </Button>
                </>
              ) : null}
            </div>
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewFromSelect("draft")}
              >
                Tilbake til utkast
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPreviewVersion(null)}
              >
                Lukk
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sammenlign */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent size="2xl" titleId="ver-cmp-title" className="max-h-[90vh]">
          <DialogHeader>
            <p id="ver-cmp-title" className="font-heading text-lg font-semibold">
              Sammenlign versjoner
            </p>
            <p className="text-muted-foreground text-sm">
              Velg to milepæler. Beregning og endrede felter vises — nyttig ved
              revisjon og dokumentasjonskrav.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Label className="text-muted-foreground w-16 shrink-0 text-xs">
                  Versjon A
                </Label>
                <select
                  className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
                  value={compareA ?? ""}
                  onChange={(e) =>
                    setCompareA(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">Velg …</option>
                  {versionOptions.map((v) => (
                    <option key={v._id} value={v.version}>
                      v{v.version}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Label className="text-muted-foreground w-16 shrink-0 text-xs">
                  Versjon B
                </Label>
                <select
                  className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
                  value={compareB ?? ""}
                  onChange={(e) =>
                    setCompareB(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">Velg …</option>
                  {versionOptions.map((v) => (
                    <option key={`b-${v._id}`} value={v.version}>
                      v{v.version}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {compareA !== null &&
            compareB !== null &&
            compareA === compareB ? (
              <p className="text-muted-foreground text-sm">
                Velg to ulike versjoner.
              </p>
            ) : null}

            {compareData === undefined &&
            compareOpen &&
            compareA !== null &&
            compareB !== null &&
            compareA !== compareB ? (
              <p className="text-muted-foreground text-sm">Laster sammenligning …</p>
            ) : null}

            {compareData === null &&
            compareOpen &&
            compareA !== null &&
            compareB !== null &&
            compareA !== compareB ? (
              <p className="text-destructive text-sm">
                Fant ikke begge versjonene.
              </p>
            ) : null}

            {compareData ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ComputedCol
                    label={`v${compareData.versionA.version}`}
                    c={compareData.versionA.computed}
                    note={compareData.versionA.note}
                    at={compareData.versionA.createdAt}
                  />
                  <ComputedCol
                    label={`v${compareData.versionB.version}`}
                    c={compareData.versionB.computed}
                    note={compareData.versionB.note}
                    at={compareData.versionB.createdAt}
                  />
                </div>
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                    Felter med ulik verdi ({compareData.changedFields.length})
                  </p>
                  {compareData.changedFields.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Ingen forskjell i utfylte skjemafelt — kun metadata/beregning
                      kan variere.
                    </p>
                  ) : (
                    <ul className="max-h-[min(240px,40vh)] space-y-2 overflow-y-auto rounded-lg border bg-muted/15 p-2 text-xs [scrollbar-width:thin]">
                      {compareData.changedFields.map((row) => (
                        <li
                          key={row.key}
                          className="border-border/40 border-b pb-2 last:border-0 last:pb-0"
                        >
                          <p className="font-medium text-foreground">
                            {labelAssessmentPayloadField(row.key)}
                          </p>
                          <div className="mt-1 grid gap-1 sm:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">A: </span>
                              <span className="whitespace-pre-wrap break-words">
                                {row.before}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">B: </span>
                              <span className="whitespace-pre-wrap break-words">
                                {row.after}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCompareOpen(false)}
            >
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-md border bg-background/80 px-2 py-1.5">
      <p className="text-muted-foreground text-[10px] font-medium">{label}</p>
      <p className="text-foreground text-sm font-semibold tabular-nums">{v}</p>
    </div>
  );
}

function ComputedCol({
  label,
  c,
  note,
  at,
}: {
  label: string;
  c: {
    ap: number;
    priorityScore: number;
    criticality: number;
    easeLabel: string;
    feasible: boolean;
  };
  note: string | null | undefined;
  at: number;
}) {
  return (
    <div className="rounded-xl border bg-muted/15 p-3">
      <p className="font-heading text-sm font-semibold">{label}</p>
      <p className="text-muted-foreground text-[11px]">
        {new Date(at).toLocaleString("nb-NO")}
      </p>
      {note ? (
        <p className="text-muted-foreground mt-1 text-xs italic">{note}</p>
      ) : null}
      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">AP</dt>
          <dd className="tabular-nums">{c.ap.toFixed(1)} %</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Prioritet</dt>
          <dd className="tabular-nums">{c.priorityScore.toFixed(1)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Viktighet</dt>
          <dd className="tabular-nums">{c.criticality.toFixed(1)} %</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Lettgrad</dt>
          <dd>{c.easeLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Gjennomførbar</dt>
          <dd>{c.feasible ? "Ja" : "Nei"}</dd>
        </div>
      </dl>
    </div>
  );
}
