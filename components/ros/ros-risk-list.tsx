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
import { SearchInput } from "@/components/ui/search-input";
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
  Equal,
  Eye,
  FolderInput,
  Library,
  ListTodo,
  Plus,
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

function levelBadge(level: number, size: "sm" | "md" = "md") {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-bold tabular-nums shadow-sm",
        cellRiskClass(level),
        size === "sm" ? "size-6 text-[10px]" : "size-8 border text-xs",
      )}
    >
      {level}
    </span>
  );
}

function riskLevelLabel(level: number): string {
  switch (level) {
    case 1: return "Lav";
    case 2: return "Moderat";
    case 3: return "Middels";
    case 4: return "Høy";
    case 5: return "Kritisk";
    default: return "";
  }
}

function riskBorderClass(level: number): string {
  switch (level) {
    case 1: return "border-l-emerald-500";
    case 2: return "border-l-lime-500";
    case 3: return "border-l-amber-400";
    case 4: return "border-l-orange-500";
    case 5: return "border-l-red-500";
    default: return "border-l-border";
  }
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3
            id="ros-risk-list-heading"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            Identifiserte risikoer
            {flatRisks.length > 0 && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                ({flatRisks.length})
              </span>
            )}
          </h3>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {workspaceId ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 gap-1.5 rounded-xl text-xs"
                onClick={() => setLibraryOpen(true)}
              >
                <Library className="size-3.5" aria-hidden />
                Bibliotek
              </Button>
            ) : null}
            <Button
              type="button"
              className="h-9 gap-1.5 rounded-xl text-xs font-semibold shadow-sm"
              onClick={handleAdd}
            >
              <Plus className="size-3.5" aria-hidden />
              Legg til
            </Button>
          </div>
        )}
      </div>

      {sortedRisks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-muted/15 px-6 py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <Plus className="text-primary size-7" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-foreground text-sm font-semibold">
              Ingen risikoer ennå
            </p>
            <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-relaxed">
              Legg til risikoer for å bygge risikomatrisen. Bruk biblioteket for raskere start.
            </p>
          </div>
          {!readOnly && (
            <Button
              type="button"
              onClick={handleAdd}
              className="mt-1 h-10 gap-2 rounded-xl px-6 text-sm font-semibold shadow-sm"
            >
              <Plus className="size-4" aria-hidden />
              Legg til risiko
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Liste over risikoer">
          {sortedRisks.map((risk) => {
            const bLvl = beforeLevel(risk.beforeRow, risk.beforeCol);
            const aLvl = afterLevel(risk.afterRow, risk.afterCol);
            const expanded = expandedId === risk.id;
            const highlighted = isHighlighted(risk);
            const linkedRosTasksForRisk =
              rosTasks?.filter((t) => t.linkedCellItemId === risk.id) ?? [];

            return (
              <li
                key={risk.id}
                data-risk-id={risk.id}
                className={cn(
                  "list-none overflow-hidden rounded-2xl border-l-[3px] bg-card shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md dark:ring-white/[0.06]",
                  riskBorderClass(bLvl),
                  highlighted && "ring-2 ring-primary/35 shadow-md",
                  expanded && "shadow-md ring-1 ring-black/[0.06] dark:ring-white/[0.08]",
                )}
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`ros-risk-expand-${risk.id}`}
                  id={`ros-risk-trigger-${risk.id}`}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:gap-4"
                  onClick={() => setExpandedId(expanded ? null : risk.id)}
                >
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    {levelBadge(bLvl)}
                    {(risk.afterRow !== risk.beforeRow || risk.afterCol !== risk.beforeCol) ? (
                      <div className="flex flex-col items-center">
                        <span className={cn(
                          "text-[9px] font-bold",
                          aLvl < bLvl ? "text-emerald-600 dark:text-emerald-400" : aLvl > bLvl ? "text-red-500" : "text-muted-foreground",
                        )}>↓</span>
                        {levelBadge(aLvl, "sm")}
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm leading-snug",
                        risk.text.trim()
                          ? "text-foreground font-medium"
                          : "text-muted-foreground italic",
                      )}
                    >
                      {risk.text.trim() || "Ny risiko — klikk for å beskrive"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-muted-foreground text-[10px]">
                        {riskLevelLabel(bLvl)} risiko
                      </span>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="text-muted-foreground text-[10px]">
                        {rowLabels[risk.beforeRow]} × {colLabels[risk.beforeCol]}
                      </span>
                      {risk.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION) && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:text-red-400">
                          <AlertTriangle className="size-2.5" />
                          Tiltak
                        </span>
                      )}
                      {risk.flags?.includes(ROS_CELL_FLAG_WATCH) && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                          <Eye className="size-2.5" />
                          Følg
                        </span>
                      )}
                      {linkedRosTasksForRisk.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                          <ListTodo className="size-2.5" />
                          {linkedRosTasksForRisk.length} oppgave{linkedRosTasksForRisk.length !== 1 ? "r" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "text-muted-foreground/50 size-5 shrink-0 transition-transform duration-200",
                      expanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                {/* Expanded editor */}
                {expanded && !readOnly && (
                  <div
                    id={`ros-risk-expand-${risk.id}`}
                    role="region"
                    aria-labelledby={`ros-risk-trigger-${risk.id}`}
                    className="space-y-5 border-t border-border/30 px-4 pb-5 pt-5 sm:px-5"
                  >
                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Hva kan gå galt?</label>
                      <Textarea
                        value={risk.text}
                        onChange={(e) =>
                          onUpdateRisk({ ...risk, text: e.target.value })
                        }
                        placeholder="Beskriv risikoen kort og tydelig …"
                        rows={2}
                        className="min-h-0 rounded-xl text-sm"
                        autoFocus
                      />
                    </div>

                    {/* Flags */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                          risk.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION)
                            ? "border-red-500/40 bg-red-500/10 text-red-700 shadow-sm dark:text-red-300"
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
                        <AlertTriangle className="size-3.5" />
                        Må håndteres
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                          risk.flags?.includes(ROS_CELL_FLAG_WATCH)
                            ? "border-blue-500/40 bg-blue-500/10 text-blue-700 shadow-sm dark:text-blue-300"
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
                        <Eye className="size-3.5" />
                        Følg med
                      </button>
                    </div>

                    {/* Before → After side-by-side */}
                    <div className="grid gap-3 sm:grid-cols-[1fr,auto,1fr]">
                      {/* BEFORE */}
                      <div className="space-y-3 rounded-xl bg-muted/15 p-3 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Før tiltak</span>
                          {levelBadge(bLvl, "sm")}
                          <span className="text-muted-foreground text-[10px]">
                            {riskLevelLabel(bLvl)}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <label className="text-muted-foreground text-[10px] font-medium">{rowAxisTitle}</label>
                            <select
                              className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-xs"
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
                            <label className="text-muted-foreground text-[10px] font-medium">{colAxisTitle}</label>
                            <select
                              className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-xs"
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

                      {/* Arrow */}
                      <div className="hidden items-center justify-center sm:flex">
                        <div className="flex flex-col items-center gap-1">
                          <ArrowRight className={cn(
                            "size-5",
                            aLvl < bLvl ? "text-emerald-500" : aLvl > bLvl ? "text-red-500" : "text-muted-foreground/40",
                          )} />
                          {aLvl !== bLvl && (
                            <DeltaArrow before={bLvl} after={aLvl} />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-center sm:hidden">
                        <ArrowDown className={cn(
                          "size-5",
                          aLvl < bLvl ? "text-emerald-500" : aLvl > bLvl ? "text-red-500" : "text-muted-foreground/40",
                        )} />
                      </div>

                      {/* AFTER */}
                      <div className={cn(
                        "space-y-3 rounded-xl p-3 ring-1",
                        aLvl < bLvl
                          ? "bg-emerald-500/[0.06] ring-emerald-500/20"
                          : aLvl > bLvl
                            ? "bg-red-500/[0.06] ring-red-500/20"
                            : "bg-blue-500/[0.04] ring-blue-500/15",
                      )}>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            aLvl < bLvl ? "text-emerald-700 dark:text-emerald-400"
                              : aLvl > bLvl ? "text-red-700 dark:text-red-400"
                              : "text-blue-700 dark:text-blue-400",
                          )}>Etter tiltak</span>
                          {levelBadge(aLvl, "sm")}
                          <span className={cn(
                            "text-[10px] font-medium",
                            aLvl < bLvl ? "text-emerald-600 dark:text-emerald-400"
                              : aLvl > bLvl ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground",
                          )}>
                            {riskLevelLabel(aLvl)}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <label className="text-muted-foreground text-[10px] font-medium">
                              {rowAxisTitle} — mål etter tiltak
                            </label>
                            <select
                              className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-xs shadow-sm"
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
                              {colAxisTitle} — mål etter tiltak
                            </label>
                            <select
                              className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-xs shadow-sm"
                              value={risk.afterCol}
                              onChange={(e) => onUpdateRisk({ ...risk, afterCol: Number(e.target.value) })}
                            >
                              {afterColLabels.map((label, i) => (
                                <option key={i} value={i}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {aLvl === bLvl && (
                          <p className="text-[10px] leading-relaxed text-blue-600 dark:text-blue-400">
                            Endre verdiene over for å sette forventet nivå etter tiltak.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* After change note */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">
                        Begrunnelse for endring
                      </label>
                      <Textarea
                        value={risk.afterChangeNote ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          onUpdateRisk({
                            ...risk,
                            afterChangeNote: v.length === 0 ? undefined : v,
                          });
                        }}
                        placeholder="Hvilke tiltak reduserer risikoen? F.eks. kryptering, backup, opplæring …"
                        rows={2}
                        className="min-h-0 rounded-xl text-sm"
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
                    <SearchInput
                      value={libSearch}
                      onChange={(e) => setLibSearch(e.target.value)}
                      placeholder="Søk i biblioteket …"
                      aria-label="Søk i bibliotek"
                    />
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
