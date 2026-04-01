"use client";

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
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useMutation, useQuery } from "convex/react";
import {
  Eye,
  History,
  Layers,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

type VersionRow = {
  _id: Id<"rosAnalysisVersions">;
  version: number;
  createdAt: number;
  note?: string | null;
};

type Props = {
  analysisId: Id<"rosAnalyses">;
  versions: VersionRow[] | undefined;
  onRestored?: () => void;
};

function formatTs(ms: number) {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return String(ms);
  }
}

export function RosVersionsPanel({
  analysisId,
  versions,
  onRestored,
}: Props) {
  const createVersion = useMutation(api.ros.createVersion);
  const restoreVersion = useMutation(api.ros.restoreVersion);
  const deleteRosAnalysisVersion = useMutation(api.ros.deleteRosAnalysisVersion);

  const [versionNote, setVersionNote] = useState("");
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const versionOptions = useMemo(() => {
    const list = versions ?? [];
    return [...list].sort((a, b) => b.version - a.version);
  }, [versions]);

  const previewData = useQuery(
    api.ros.getRosAnalysisVersion,
    previewVersion !== null
      ? { analysisId, version: previewVersion }
      : "skip",
  );

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
      return restoreVersion({ analysisId, version })
        .then(() => {
          onRestored?.();
          toast.success(`Analysen er satt til innhold fra v${version}.`);
        })
        .catch((e: unknown) => {
          setActionError(formatUserFacingError(e));
          toast.error(
            e instanceof Error ? e.message : "Gjenoppretting feilet.",
          );
        });
    },
    [analysisId, onRestored, restoreVersion],
  );

  const runDelete = useCallback(
    (version: number) => {
      setActionError(null);
      return deleteRosAnalysisVersion({ analysisId, version })
        .then(() => {
          setPreviewVersion((prev) => (prev === version ? null : prev));
          toast.success(`ROS-versjon v${version} er slettet.`);
        })
        .catch((e: unknown) => {
          setActionError(formatUserFacingError(e));
          toast.error(e instanceof Error ? e.message : "Sletting feilet.");
        });
    },
    [analysisId, deleteRosAnalysisVersion],
  );

  async function onSnapshot() {
    setSnapshotBusy(true);
    setActionError(null);
    try {
      const out = await createVersion({
        analysisId,
        note: versionNote.trim() || undefined,
      });
      setVersionNote("");
      toast.success(`Versjon ${out.version} lagret.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke lagre versjon.",
      );
    } finally {
      setSnapshotBusy(false);
    }
  }

  return (
    <Card id="ros-versjoner" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" aria-hidden />
          Versjonskontroll
        </CardTitle>
        <CardDescription>
          Lagre øyeblikksbilder av matrisen (før/etter). «Lagre endringer» i
          toppen oppretter også en ny versjon; automatisk lagring gjør ikke
          det. Bytt visning, åpne forhåndsvisning, gjenopprett eller slett
          enkeltversjoner.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {actionError ? (
          <p className="text-destructive text-sm">{actionError}</p>
        ) : null}

        {versionOptions.length > 0 ? (
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.05] to-muted/25 p-4 shadow-sm ring-1 ring-primary/10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="text-primary size-4 shrink-0" aria-hidden />
                <Label
                  htmlFor="ros-version-quick-switch"
                  className="text-foreground text-sm font-semibold"
                >
                  Bytt visning (utkast eller lagret versjon)
                </Label>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong className="text-foreground">Aktiv analyse</strong> er det
                du redigerer. Velg en{" "}
                <strong className="text-foreground">lagret versjon</strong> for å
                se snapshot i dialog — derfra kan du gjenopprette eller slette.
              </p>
              <select
                id="ros-version-quick-switch"
                className="border-input bg-background focus-visible:ring-primary/30 h-11 w-full max-w-2xl rounded-xl border px-3 text-sm font-medium shadow-sm outline-none focus-visible:ring-2"
                value={previewVersion === null ? "draft" : String(previewVersion)}
                onChange={(e) => setViewFromSelect(e.target.value)}
              >
                <option value="draft">Aktiv analyse (redigering)</option>
                {versionOptions.map((v) => (
                  <option key={v._id} value={String(v.version)}>
                    v{v.version} · {formatTs(v.createdAt)}
                    {v.note
                      ? ` — ${v.note.length > 56 ? `${v.note.slice(0, 54)}…` : v.note}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="ros-snap-note">Notat til ny versjon (valgfritt)</Label>
            <Input
              id="ros-snap-note"
              value={versionNote}
              onChange={(e) => setVersionNote(e.target.value)}
              placeholder="F.eks. Før endring av akser"
            />
          </div>
          <Button
            type="button"
            disabled={snapshotBusy}
            className="w-full shrink-0 sm:w-auto"
            onClick={() => void onSnapshot()}
          >
            {snapshotBusy ? "Lagrer …" : "Lagre versjon"}
          </Button>
        </div>

        <Separator />

        {versions === undefined ? (
          <p className="text-muted-foreground text-sm">Henter versjoner …</p>
        ) : versions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Ingen lagrede versjoner ennå. Bruk «Lagre versjon» for å fryse
            nåværende stand.
          </p>
        ) : (
          <ul className="max-h-[min(420px,55vh)] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {versionOptions.map((v) => (
              <li
                key={v._id}
                className="border-border/50 bg-card/50 hover:bg-muted/15 flex flex-col gap-3 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="bg-primary/10 text-primary rounded-md px-1.5 py-0.5 font-mono text-sm font-bold tabular-nums">
                      v{v.version}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatTs(v.createdAt)}
                    </span>
                  </div>
                  {v.note ? (
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {v.note}
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
                      setPreviewVersion(v.version);
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
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        !window.confirm(
                          `Gjenopprette versjon ${v.version}? Nåværende matrise og notat overskrives (lagre ny versjon først om du vil beholde dagens stand).`,
                        )
                      ) {
                        return;
                      }
                      void runRestore(v.version);
                    }}
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Bruk som aktiv
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 border-destructive/30 hover:text-destructive h-9 gap-1.5"
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        !window.confirm(
                          `Slette v${v.version} permanent? Kan ikke angres.`,
                        )
                      ) {
                        return;
                      }
                      void runDelete(v.version);
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Slett
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Dialog
          open={previewVersion !== null}
          onOpenChange={(o) => {
            if (!o) setPreviewVersion(null);
          }}
        >
          <DialogContent size="lg" titleId="ros-ver-preview-title">
            <DialogHeader className="relative space-y-4 pr-10">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                <div className="min-w-0">
                  <p
                    id="ros-ver-preview-title"
                    className="font-heading text-lg font-semibold"
                  >
                    ROS v{previewData?.version ?? previewVersion}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {previewData
                      ? new Date(previewData.createdAt).toLocaleString("nb-NO")
                      : null}
                  </p>
                </div>
                {previewVersion !== null && versionOptions.length > 1 ? (
                  <div className="flex w-full min-w-0 flex-col gap-1.5 lg:max-w-[16rem]">
                    <Label
                      htmlFor="ros-ver-preview-switch"
                      className="text-muted-foreground text-xs font-medium"
                    >
                      Annen versjon
                    </Label>
                    <select
                      id="ros-ver-preview-switch"
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
                    <p className="text-muted-foreground border-l-2 border-primary/40 pl-3">
                      {previewData.note}
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 px-3 py-2">
                      <p className="text-muted-foreground text-[11px] font-medium">
                        Akser
                      </p>
                      <p className="mt-0.5 font-medium">
                        {previewData.rowAxisTitle} / {previewData.colAxisTitle}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 px-3 py-2">
                      <p className="text-muted-foreground text-[11px] font-medium">
                        Matrise
                      </p>
                      <p className="mt-0.5 tabular-nums">
                        {previewData.rows} × {previewData.cols} celler
                        {previewData.hasAfterMatrix
                          ? " · inkl. etter-tiltak"
                          : ""}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Dette er et lagret øyeblikksbilde. Bruk «Bruk som aktiv» for
                    å laste innholdet inn i analysen.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Laster …</p>
              )}
            </DialogBody>
            <DialogFooter className="flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                {previewVersion !== null ? (
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
                            `Gjenopprette versjon ${previewVersion}? Nåværende matrise og notat overskrives.`,
                          )
                        ) {
                          return;
                        }
                        void runRestore(previewVersion);
                      }}
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                      Bruk som aktiv analyse
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
                      Slett versjon
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
                  Tilbake til aktiv analyse
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
      </CardContent>
    </Card>
  );
}
