"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "@/lib/app-toast";
import {
  ROS_CELL_FLAG_REQUIRES_ACTION,
  ROS_CELL_FLAG_WATCH,
  newRosCellItemId,
  type RosCellItemMatrix,
} from "@/lib/ros-cell-items";
import { positionRiskLevel, RISK_LEVEL_HINTS } from "@/lib/ros-defaults";
import { cellRiskClass } from "@/lib/ros-risk-colors";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  BookMarked,
  ChevronDown,
  ChevronUp,
  Equal,
  Eye,
  FolderInput,
  Library,
  ListTodo,
  Plus,
  Search,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export type FlatRisk = {
  id: string;
  text: string;
  flags?: string[];
  beforeRow: number;
  beforeCol: number;
  afterRow: number;
  afterCol: number;
  /** Begrunnelse for hvorfor nivået endret seg etter tiltak */
  afterChangeNote?: string;
};

type Props = {
  rowLabels: string[];
  colLabels: string[];
  rowAxisTitle: string;
  colAxisTitle: string;
  /** All before-phase cell items (source of truth) */
  cellItemsMatrix: RosCellItemMatrix;
  /** Before-phase matrix levels */
  matrixValues: number[][];
  /** After-phase matrix levels */
  matrixAfter: number[][];
  /** After-phase cell items */
  cellItemsAfterMatrix: RosCellItemMatrix;
  afterRowLabels: string[];
  afterColLabels: string[];
  onAddRisk: (risk: FlatRisk) => void;
  onUpdateRisk: (risk: FlatRisk) => void;
  onDeleteRisk: (riskId: string, beforeRow: number, beforeCol: number) => void;
  /** Highlighted cell from matrix click — [row, col] */
  highlightCell?: [number, number] | null;
  readOnly?: boolean;
  /** Når satt: vis «Fra bibliotek» og «Lagre til bibliotek» for gjenbruk i arbeidsområdet */
  workspaceId?: Id<"workspaces">;
  /** Oppgaver for denne analysen (for å vise koblinger til dette risikopunktet) */
  rosTasks?: Array<{
    _id: Id<"rosTasks">;
    title: string;
    status: "open" | "done";
    linkedCellItemId?: string;
  }>;
  /** Hopp til Oppgaver-fanen (samme ROS-analyse) */
  onGoToTasks?: () => void;
};

function levelBadge(level: number) {
  return (
    <span
      className={cn(
        "inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border px-2 text-xs font-bold tabular-nums shadow-sm",
        cellRiskClass(level),
      )}
    >
      {level}
    </span>
  );
}

function DeltaArrow({ before, after }: { before: number; after: number }) {
  if (after < before)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        <ArrowDown className="size-3" />
        {before - after}
      </span>
    );
  if (after > before)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
        <ArrowDown className="size-3 rotate-180" />
        +{after - before}
      </span>
    );
  return (
    <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]">
      <Equal className="size-3" />
    </span>
  );
}

export function RosRiskList({
  rowLabels,
  colLabels,
  rowAxisTitle,
  colAxisTitle,
  cellItemsMatrix,
  matrixValues,
  matrixAfter,
  cellItemsAfterMatrix,
  afterRowLabels,
  afterColLabels,
  onAddRisk,
  onUpdateRisk,
  onDeleteRisk,
  highlightCell,
  readOnly,
  workspaceId,
  rosTasks,
  onGoToTasks,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAfter, setShowAfter] = useState<Record<string, boolean>>({});
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveLibraryOpen, setSaveLibraryOpen] = useState(false);
  const [saveRiskTitle, setSaveRiskTitle] = useState("");
  const [saveTiltak, setSaveTiltak] = useState("");
  const [saveVisibility, setSaveVisibility] = useState<"workspace" | "shared">(
    "workspace",
  );
  const [saveBusy, setSaveBusy] = useState(false);
  const [riskToSave, setRiskToSave] = useState<FlatRisk | null>(null);
  const [saveCategoryId, setSaveCategoryId] = useState<
    Id<"rosLibraryCategories"> | ""
  >("");
  const [libSearch, setLibSearch] = useState("");
  const [libFilterCategory, setLibFilterCategory] = useState<
    "all" | "none" | Id<"rosLibraryCategories">
  >("all");

  const libraryItems = useQuery(
    api.rosLibrary.listLibraryItems,
    workspaceId ? { workspaceId, sortBy: "category" } : "skip",
  );
  const libraryCategories = useQuery(
    api.rosLibrary.listLibraryCategories,
    workspaceId ? { workspaceId } : "skip",
  );
  const createLibraryItem = useMutation(api.rosLibrary.createLibraryItem);

  const filteredLibraryItems = useMemo(() => {
    if (!libraryItems) return [];
    const q = libSearch.trim().toLowerCase();
    return libraryItems.filter((it) => {
      if (libFilterCategory === "all") {
        /* ok */
      } else if (libFilterCategory === "none") {
        if (it.categoryId) return false;
      } else if (it.categoryId !== libFilterCategory) {
        return false;
      }
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        it.riskText.toLowerCase().includes(q) ||
        (it.tiltakText?.toLowerCase().includes(q) ?? false) ||
        (it.categoryName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [libraryItems, libFilterCategory, libSearch]);

  const flatRisks = useMemo(() => {
    const risks: FlatRisk[] = [];
    for (let r = 0; r < cellItemsMatrix.length; r++) {
      const row = cellItemsMatrix[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        for (const item of cell) {
          /* Alle cell-elementer er bevisst risiko-rader (inkl. nye uten tekst etter «Legg til risiko»). */
          risks.push({
            id: item.id,
            text: item.text,
            flags: item.flags,
            beforeRow: r,
            beforeCol: c,
            afterRow: item.afterRow ?? r,
            afterCol: item.afterCol ?? c,
            afterChangeNote: item.afterChangeNote,
          });
        }
      }
    }
    return risks;
  }, [cellItemsMatrix]);

  const handleAdd = useCallback(() => {
    const id = newRosCellItemId();
    const risk: FlatRisk = {
      id,
      text: "",
      beforeRow: 0,
      beforeCol: 0,
      afterRow: 0,
      afterCol: 0,
    };
    onAddRisk(risk);
    setExpandedId(id);
  }, [onAddRisk]);

  const insertFromLibrary = useCallback(
    (item: {
      riskText: string;
      tiltakText?: string;
      flags?: string[];
    }) => {
      const base = {
        beforeRow: 0,
        beforeCol: 0,
        afterRow: 0,
        afterCol: 0,
      };
      const id1 = newRosCellItemId();
      onAddRisk({
        id: id1,
        text: item.riskText,
        flags: item.flags,
        ...base,
      });
      if (item.tiltakText?.trim()) {
        const id2 = newRosCellItemId();
        onAddRisk({
          id: id2,
          text: item.tiltakText.trim(),
          flags: [ROS_CELL_FLAG_REQUIRES_ACTION],
          ...base,
        });
      }
      setLibraryOpen(false);
      setExpandedId(id1);
      toast.success("Oppføringer lagt inn fra biblioteket.");
    },
    [onAddRisk],
  );

  const beforeLevel = useCallback(
    (r: number, c: number) =>
      positionRiskLevel(r, c, rowLabels.length, colLabels.length),
    [rowLabels.length, colLabels.length],
  );

  const afterLevel = useCallback(
    (r: number, c: number) =>
      positionRiskLevel(r, c, afterRowLabels.length, afterColLabels.length),
    [afterRowLabels.length, afterColLabels.length],
  );

  const isHighlighted = useCallback(
    (risk: FlatRisk) => {
      if (!highlightCell) return false;
      return (
        risk.beforeRow === highlightCell[0] &&
        risk.beforeCol === highlightCell[1]
      );
    },
    [highlightCell],
  );

  const sortedRisks = useMemo(() => {
    return [...flatRisks].sort((a, b) => {
      const la = beforeLevel(a.beforeRow, a.beforeCol);
      const lb = beforeLevel(b.beforeRow, b.beforeCol);
      if (lb !== la) return lb - la;
      return a.text.localeCompare(b.text, "nb");
    });
  }, [flatRisks, beforeLevel]);

  if (!rowLabels.length || !colLabels.length) return null;

  return (
    <div
      className="space-y-4"
      role="region"
      aria-labelledby="ros-risk-list-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1.5">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
            Register
          </p>
          <h3
            id="ros-risk-list-heading"
            className="font-heading text-base font-semibold tracking-tight text-foreground"
          >
            Identifiserte risikoer
          </h3>
          <p className="text-muted-foreground max-w-prose text-[13px] leading-relaxed">
            Punkter først — matrisen oppdateres automatisk.
          </p>
        </div>
        {!readOnly && (
          /* Primær til venstre på mobil (tommel-sone), sekundær under; skrivebord: sekundær | primær */
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-2">
            {workspaceId ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-[44px] w-full gap-2 px-4 text-[13px] font-medium sm:h-10 sm:min-h-0 sm:w-auto"
                onClick={() => setLibraryOpen(true)}
              >
                <Library className="size-4 shrink-0" aria-hidden />
                Fra bibliotek
              </Button>
            ) : null}
            <Button
              type="button"
              className="h-11 min-h-[44px] w-full gap-2 px-4 text-[13px] font-semibold shadow-sm sm:h-10 sm:min-h-0 sm:w-auto"
              onClick={handleAdd}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              Legg til risiko
            </Button>
          </div>
        )}
      </div>

      {sortedRisks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-primary/20 bg-gradient-to-b from-primary/[0.03] to-transparent p-10 text-center ring-1 ring-primary/10">
          <div className="bg-primary/12 flex size-14 items-center justify-center rounded-2xl ring-1 ring-primary/15">
            <Plus className="text-primary size-7" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-foreground text-sm font-medium">
              Ingen risikoer ennå
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Bruk «Legg til risiko» for å komme i gang.
            </p>
          </div>
          {!readOnly && (
            <Button
              type="button"
              onClick={handleAdd}
              className="mt-1 h-11 min-h-[44px] gap-2 px-6 text-[13px] font-semibold shadow-sm sm:h-10 sm:min-h-0"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              Legg til første risiko
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Liste over risikoer">
          {sortedRisks.map((risk) => {
            const bLvl = beforeLevel(risk.beforeRow, risk.beforeCol);
            const aLvl = afterLevel(risk.afterRow, risk.afterCol);
            const expanded = expandedId === risk.id;
            const afterOpen = showAfter[risk.id] ?? (risk.afterRow !== risk.beforeRow || risk.afterCol !== risk.beforeCol);
            const highlighted = isHighlighted(risk);
            const linkedRosTasksForRisk =
              rosTasks?.filter((t) => t.linkedCellItemId === risk.id) ?? [];

            return (
              <li
                key={risk.id}
                data-risk-id={risk.id}
                className={cn(
                  "list-none rounded-2xl border border-border/45 bg-card shadow-sm transition-[box-shadow,ring] duration-200 ring-1 ring-black/[0.02] hover:shadow-md dark:ring-white/[0.04]",
                  highlighted && "ring-2 ring-primary/35 shadow-md",
                  expanded && "shadow-md ring-1 ring-black/[0.05] dark:ring-white/[0.08]",
                )}
              >
                {/* Kompakt rad: min. 44px touch-mål (WCAG 2.5.5 / M3 / Fluent) */}
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`ros-risk-expand-${risk.id}`}
                  id={`ros-risk-trigger-${risk.id}`}
                  className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left sm:min-h-[44px] sm:items-start sm:py-3.5"
                  onClick={() => setExpandedId(expanded ? null : risk.id)}
                >
                  <div className="flex shrink-0 items-center gap-1.5 self-center sm:pt-0.5">
                    {levelBadge(bLvl)}
                    {(afterOpen || risk.afterRow !== risk.beforeRow || risk.afterCol !== risk.beforeCol) && (
                      <>
                        <ArrowRight className="text-muted-foreground size-3" />
                        {levelBadge(aLvl)}
                        <DeltaArrow before={bLvl} after={aLvl} />
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm",
                        risk.text.trim()
                          ? "text-foreground font-medium"
                          : "text-muted-foreground italic",
                      )}
                    >
                      {risk.text.trim() || "Ny risiko — klikk for å beskrive"}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      <span className="text-muted-foreground text-[10px]">
                        {rowLabels[risk.beforeRow]} × {colLabels[risk.beforeCol]}
                      </span>
                      {risk.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION) && (
                        <Badge variant="outline" className="h-4 gap-0.5 border-orange-500/30 px-1 text-[9px] text-orange-600 dark:text-orange-400">
                          <AlertTriangle className="size-2.5" />
                          Tiltak
                        </Badge>
                      )}
                      {risk.flags?.includes(ROS_CELL_FLAG_WATCH) && (
                        <Badge variant="outline" className="h-4 gap-0.5 border-blue-500/30 px-1 text-[9px] text-blue-600 dark:text-blue-400">
                          <Eye className="size-2.5" />
                          Følg
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-lg sm:size-10"
                    aria-hidden
                  >
                    {expanded ? (
                      <ChevronUp className="size-5" />
                    ) : (
                      <ChevronDown className="size-5" />
                    )}
                  </span>
                </button>

                {/* Expanded editor */}
                {expanded && !readOnly && (
                  <div
                    id={`ros-risk-expand-${risk.id}`}
                    role="region"
                    aria-labelledby={`ros-risk-trigger-${risk.id}`}
                    className="space-y-4 border-t border-border/50 px-4 pb-4 pt-4"
                  >
                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Beskrivelse</label>
                      <Textarea
                        value={risk.text}
                        onChange={(e) =>
                          onUpdateRisk({ ...risk, text: e.target.value })
                        }
                        placeholder="Beskriv risikoen — hva kan gå galt?"
                        rows={2}
                        className="min-h-0 text-sm"
                        autoFocus
                      />
                    </div>

                    {/* Flags */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          risk.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION)
                            ? "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
                            : "text-muted-foreground hover:text-foreground border-border hover:bg-muted/50",
                        )}
                        onClick={() => {
                          const has = risk.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION);
                          const next = has
                            ? (risk.flags ?? []).filter((f) => f !== ROS_CELL_FLAG_REQUIRES_ACTION)
                            : [...(risk.flags ?? []), ROS_CELL_FLAG_REQUIRES_ACTION];
                          onUpdateRisk({ ...risk, flags: next.length ? next : undefined });
                        }}
                      >
                        <AlertTriangle className="size-3" />
                        Må håndteres
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          risk.flags?.includes(ROS_CELL_FLAG_WATCH)
                            ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                            : "text-muted-foreground hover:text-foreground border-border hover:bg-muted/50",
                        )}
                        onClick={() => {
                          const has = risk.flags?.includes(ROS_CELL_FLAG_WATCH);
                          const next = has
                            ? (risk.flags ?? []).filter((f) => f !== ROS_CELL_FLAG_WATCH)
                            : [...(risk.flags ?? []), ROS_CELL_FLAG_WATCH];
                          onUpdateRisk({ ...risk, flags: next.length ? next : undefined });
                        }}
                      >
                        <Eye className="size-3" />
                        Følg med
                      </button>
                    </div>

                    {/* Before values */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">Før tiltak</span>
                        {levelBadge(bLvl)}
                        <span className="text-muted-foreground text-[10px]">
                          {RISK_LEVEL_HINTS[bLvl] ?? ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-muted-foreground text-[10px] font-medium">
                            {rowAxisTitle}
                          </label>
                          <select
                            className="border-input bg-background flex h-8 w-full rounded-lg border px-2 text-xs"
                            value={risk.beforeRow}
                            onChange={(e) => {
                              const newRow = Number(e.target.value);
                              onUpdateRisk({
                                ...risk,
                                beforeRow: newRow,
                                afterRow: risk.afterRow === risk.beforeRow ? newRow : risk.afterRow,
                                afterCol: risk.afterCol === risk.beforeCol ? risk.beforeCol : risk.afterCol,
                              });
                            }}
                          >
                            {rowLabels.map((label, i) => (
                              <option key={i} value={i}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground text-[10px] font-medium">
                            {colAxisTitle}
                          </label>
                          <select
                            className="border-input bg-background flex h-8 w-full rounded-lg border px-2 text-xs"
                            value={risk.beforeCol}
                            onChange={(e) => {
                              const newCol = Number(e.target.value);
                              onUpdateRisk({
                                ...risk,
                                beforeCol: newCol,
                                afterRow: risk.afterRow === risk.beforeRow ? risk.beforeRow : risk.afterRow,
                                afterCol: risk.afterCol === risk.beforeCol ? newCol : risk.afterCol,
                              });
                            }}
                          >
                            {colLabels.map((label, i) => (
                              <option key={i} value={i}>{label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* After values */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        className="flex items-center gap-2"
                        onClick={() =>
                          setShowAfter((prev) => ({
                            ...prev,
                            [risk.id]: !afterOpen,
                          }))
                        }
                      >
                        <span className="text-xs font-semibold">Etter tiltak</span>
                        {levelBadge(aLvl)}
                        <DeltaArrow before={bLvl} after={aLvl} />
                        {afterOpen ? (
                          <ChevronUp className="text-muted-foreground size-3" />
                        ) : (
                          <ChevronDown className="text-muted-foreground size-3" />
                        )}
                      </button>
                      {afterOpen && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-muted-foreground text-[10px] font-medium">
                              {rowAxisTitle} etter
                            </label>
                            <select
                              className="border-input bg-background flex h-8 w-full rounded-lg border px-2 text-xs"
                              value={risk.afterRow}
                              onChange={(e) => onUpdateRisk({ ...risk, afterRow: Number(e.target.value) })}
                            >
                              {afterRowLabels.map((label, i) => (
                                <option key={i} value={i}>{label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-muted-foreground text-[10px] font-medium">
                              {colAxisTitle} etter
                            </label>
                            <select
                              className="border-input bg-background flex h-8 w-full rounded-lg border px-2 text-xs"
                              value={risk.afterCol}
                              onChange={(e) => onUpdateRisk({ ...risk, afterCol: Number(e.target.value) })}
                            >
                              {afterColLabels.map((label, i) => (
                                <option key={i} value={i}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">
                        Begrunnelse for endring (før → etter tiltak)
                      </label>
                      <p className="text-muted-foreground text-[10px] leading-relaxed">
                        Forklar hvorfor nivået endret seg (planlagte tiltak, nye forutsetninger) — eller
                        hvorfor det er uendret. «Etter tiltak» er mål-nivå etter planlagte tiltak; konkrete
                        gjennomføringsoppgaver knytter du under{" "}
                        <span className="text-foreground font-medium">Oppgaver</span>.
                      </p>
                      <Textarea
                        value={risk.afterChangeNote ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          onUpdateRisk({
                            ...risk,
                            afterChangeNote: v.length === 0 ? undefined : v,
                          });
                        }}
                        placeholder="F.eks.: planlagt kryptering reduserer sannsynlighet; konsekvens uendret fordi …"
                        rows={2}
                        className="min-h-0 text-sm"
                      />
                    </div>

                    {linkedRosTasksForRisk.length > 0 && onGoToTasks ? (
                      <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold">
                            Oppgaver knyttet til dette punktet
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-[11px]"
                            onClick={onGoToTasks}
                          >
                            <SquareArrowOutUpRight className="size-3" />
                            Gå til oppgaver
                          </Button>
                        </div>
                        <ul className="space-y-1.5">
                          {linkedRosTasksForRisk.map((t) => (
                            <li
                              key={t._id}
                              className="text-muted-foreground flex items-start gap-2 text-[11px]"
                            >
                              <ListTodo className="mt-0.5 size-3.5 shrink-0" />
                              <span className="min-w-0 flex-1">
                                <span className="text-foreground font-medium">
                                  {t.title}
                                </span>
                                <span className="ml-1.5">
                                  (
                                  {t.status === "done"
                                    ? "Fullført"
                                    : "Åpen"}
                                  )
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {/* Save to library */}
                    {workspaceId ? (
                      <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => {
                            setRiskToSave(risk);
                            const firstLine = risk.text.trim().split("\n")[0] ?? "";
                            setSaveRiskTitle(
                              firstLine.slice(0, 80) ||
                                `Risiko ${risk.beforeRow + 1}×${risk.beforeCol + 1}`,
                            );
                            setSaveTiltak("");
                            setSaveVisibility("workspace");
                            setSaveCategoryId("");
                            setSaveLibraryOpen(true);
                          }}
                        >
                          <BookMarked className="size-3.5" />
                          Lagre til bibliotek
                        </Button>
                      </div>
                    ) : null}

                    {/* Delete */}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive gap-1.5 text-xs"
                        onClick={() =>
                          onDeleteRisk(risk.id, risk.beforeRow, risk.beforeCol)
                        }
                      >
                        <Trash2 className="size-3.5" />
                        Slett risiko
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {workspaceId ? (
        <>
          <Dialog
            open={libraryOpen}
            onOpenChange={(open) => {
              setLibraryOpen(open);
              if (open) {
                setLibSearch("");
                setLibFilterCategory("all");
              }
            }}
          >
            <DialogContent size="lg" titleId="ros-lib-pick-title">
              <DialogHeader>
                <h2 id="ros-lib-pick-title" className="font-heading text-lg font-semibold">
                  Velg fra bibliotek
                </h2>
                <p className="text-muted-foreground text-sm">
                  Teksten settes inn i matrisen (først nederst til venstre — du kan flytte celle under).
                </p>
              </DialogHeader>
              <DialogBody className="space-y-4">
                {libraryItems === undefined || libraryCategories === undefined ? (
                  <p className="text-muted-foreground text-sm">Henter …</p>
                ) : libraryItems.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Ingen elementer i biblioteket ennå. Gå til ROS → Bibliotek, eller lagre en risiko herfra.
                  </p>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                      <Input
                        value={libSearch}
                        onChange={(e) => setLibSearch(e.target.value)}
                        placeholder="Søk …"
                        className="pl-9"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setLibFilterCategory("all")}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                          libFilterCategory === "all"
                            ? "border-primary bg-primary/10"
                            : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60",
                        )}
                      >
                        Alle
                      </button>
                      <button
                        type="button"
                        onClick={() => setLibFilterCategory("none")}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                          libFilterCategory === "none"
                            ? "border-primary bg-primary/10"
                            : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60",
                        )}
                      >
                        Uten kategori
                      </button>
                      {libraryCategories.map((c) => (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => setLibFilterCategory(c._id)}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                            libFilterCategory === c._id
                              ? "border-primary bg-primary/10"
                              : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60",
                          )}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                    {filteredLibraryItems.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        Ingen treff — prøv annet søk eller filter.
                      </p>
                    ) : (
                      <ul className="max-h-[min(60vh,24rem)] space-y-2 overflow-y-auto pr-1">
                        {filteredLibraryItems.map((item) => (
                          <li key={item._id}>
                            <button
                              type="button"
                              className="hover:bg-muted/50 w-full rounded-xl border border-border/60 bg-card px-3 py-3 text-left text-sm transition-colors"
                              onClick={() =>
                                insertFromLibrary({
                                  riskText: item.riskText,
                                  tiltakText: item.tiltakText,
                                  flags: item.flags,
                                })
                              }
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                {item.categoryName ? (
                                  <span className="bg-muted text-muted-foreground inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium">
                                    <FolderInput className="size-2.5" />
                                    {item.categoryName}
                                  </span>
                                ) : null}
                                {item.isFromOtherWorkspace ? (
                                  <span className="text-muted-foreground text-[10px]">
                                    {item.sourceWorkspaceName ?? "Annet rom"}
                                  </span>
                                ) : null}
                              </div>
                              <span className="mt-1 block font-medium">{item.title}</span>
                              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                                {item.riskText}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLibraryOpen(false)}
                >
                  Lukk
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={saveLibraryOpen} onOpenChange={setSaveLibraryOpen}>
            <DialogContent size="md" titleId="ros-lib-save-title">
              <DialogHeader>
                <h2 id="ros-lib-save-title" className="font-heading text-lg font-semibold">
                  Lagre i bibliotek
                </h2>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ros-save-lib-title">Tittel</Label>
                    <Input
                      id="ros-save-lib-title"
                      value={saveRiskTitle}
                      onChange={(e) => setSaveRiskTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ros-save-lib-tiltak">Tiltak (valgfritt)</Label>
                    <Textarea
                      id="ros-save-lib-tiltak"
                      value={saveTiltak}
                      onChange={(e) => setSaveTiltak(e.target.value)}
                      rows={2}
                      placeholder="Legg ved foreslått tiltak …"
                      className="min-h-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ros-save-lib-cat">Kategori (valgfritt)</Label>
                    <select
                      id="ros-save-lib-cat"
                      className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                      value={saveCategoryId}
                      onChange={(e) =>
                        setSaveCategoryId(
                          (e.target.value || "") as Id<"rosLibraryCategories"> | "",
                        )
                      }
                    >
                      <option value="">— Ingen —</option>
                      {(libraryCategories ?? []).map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ros-save-lib-vis">Synlighet</Label>
                    <select
                      id="ros-save-lib-vis"
                      className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                      value={saveVisibility}
                      onChange={(e) =>
                        setSaveVisibility(
                          e.target.value as "workspace" | "shared",
                        )
                      }
                    >
                      <option value="workspace">Kun dette arbeidsområdet</option>
                      <option value="shared">Delt — alle mine arbeidsområder</option>
                    </select>
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSaveLibraryOpen(false)}
                >
                  Avbryt
                </Button>
                <Button
                  type="button"
                  disabled={saveBusy || !saveRiskTitle.trim() || !riskToSave?.text.trim()}
                  onClick={() => {
                    if (!workspaceId || !riskToSave) return;
                    setSaveBusy(true);
                    void createLibraryItem({
                      workspaceId,
                      title: saveRiskTitle.trim(),
                      riskText: riskToSave.text.trim(),
                      tiltakText: saveTiltak.trim() || undefined,
                      flags: riskToSave.flags,
                      visibility: saveVisibility,
                      categoryId:
                        saveCategoryId === "" ? undefined : saveCategoryId,
                    })
                      .then(() => {
                        toast.success("Lagret i biblioteket.");
                        setSaveLibraryOpen(false);
                        setRiskToSave(null);
                      })
                      .catch((e) =>
                        toast.error(
                          e instanceof Error ? e.message : "Kunne ikke lagre.",
                        ),
                      )
                      .finally(() => setSaveBusy(false));
                  }}
                >
                  {saveBusy ? "Lagrer …" : "Lagre"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
