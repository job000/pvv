"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { legendItems, cnCell, cellRiskGhostClass } from "@/lib/ros-risk-colors";
import {
  ROS_CELL_FLAG_REQUIRES_ACTION,
  ROS_CELL_FLAG_WATCH,
  cellHasFilledRosItems,
  newRosCellItemId,
  type RosCellItem,
  type RosCellItemMatrix,
} from "@/lib/ros-cell-items";
import { RISK_LEVEL_HINTS, positionRiskLevel } from "@/lib/ros-defaults";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRightLeft,
  Copy,
  Eye,
  Lightbulb,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Props = {
  rowAxisTitle: string;
  colAxisTitle: string;
  rowLabels: string[];
  colLabels: string[];
  matrixValues: number[][];
  /** Flere risiko-/begrunnelse-punkter per celle */
  cellItems: RosCellItemMatrix;
  onCellItemsChange?: (row: number, col: number, items: RosCellItem[]) => void;
  onCellChange?: (row: number, col: number, next: number) => void;
  readOnly?: boolean;
  jumpRequest?: { row: number; col: number; nonce: number } | null;
  onJumpHandled?: () => void;
  /** Den andre fasens matrisenivåer for kryssreferanse-badge (valgfri) */
  otherPhaseValues?: number[][];
  /** Den andre fasens cellepunkter for referanse i popup */
  otherPhaseCellItems?: RosCellItemMatrix;
  /** "before" | "after" — hvilken fase denne matrisen representerer */
  currentPhase?: "before" | "after";
  /** Callback for å bytte til den andre fasen og åpne en celle der */
  onSwitchPhase?: (row: number, col: number) => void;
  /** After-matrisens rad/kolonne-etiketter (for destinasjonsvelger) */
  afterRowLabels?: string[];
  afterColLabels?: string[];
  /** Plasserer et før-tiltak punkt i etter-tiltak matrisen */
  onPlaceInAfter?: (
    itemId: string,
    itemText: string,
    itemFlags: string[] | undefined,
    afterRow: number,
    afterCol: number,
  ) => void;
  /** Fjerner etter-tiltak plassering fra et før-tiltak punkt */
  onRemoveAfterPlacement?: (itemId: string) => void;
  /** Før-fasens rad/kol-labels (for å vise kilde i after-popup) */
  beforeRowLabels?: string[];
  beforeColLabels?: string[];
  /** Tilordner et umappet før-tiltak punkt til denne etter-cellen */
  onAssignBeforeItem?: (
    itemId: string,
    sourceRow: number,
    sourceCol: number,
    afterRow: number,
    afterCol: number,
  ) => void;
  /** Flytt alle punkter fra én celle til en annen (samme fase som matrisen) */
  onMoveCellContents?: (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
  ) => void;
};

type PickerTarget = { row: number; col: number };

const PLACEHOLDER_EXAMPLES = [
  "F.eks: Datatap ved systemfeil uten backup",
  "F.eks: Uautorisert tilgang til personopplysninger",
  "F.eks: Nedetid på kritisk system i produksjonstid",
  "F.eks: Feil i automatisert prosess uten varsel",
  "F.eks: Leverandør mister tilgang eller går konkurs",
  "F.eks: Manglende opplæring fører til feilbruk",
  "F.eks: Brudd på GDPR ved deling av data",
];

function toggleFlag(
  flags: string[] | undefined,
  flag: string,
  on: boolean,
): string[] | undefined {
  const s = new Set(flags ?? []);
  if (on) s.add(flag);
  else s.delete(flag);
  const a = [...s];
  return a.length ? a : undefined;
}

/** Typisk «4 — Katastrofal» → rang + bildetekst; brukes til kompakt mobilvisning. */
function splitAxisLabel(label: string): { rank: string; caption: string } {
  const t = label.trim();
  const m = t.match(/^(\d+)\s*[—–-]\s*(.+)$/);
  if (m) return { rank: m[1]!, caption: m[2]!.trim() };
  return { rank: t.slice(0, 3), caption: t.length > 3 ? t : "" };
}

export function RosMatrix({
  rowAxisTitle,
  colAxisTitle,
  rowLabels,
  colLabels,
  matrixValues,
  cellItems,
  onCellItemsChange,
  onCellChange,
  readOnly = false,
  jumpRequest,
  onJumpHandled,
  otherPhaseValues,
  otherPhaseCellItems,
  currentPhase = "before",
  onSwitchPhase,
  afterRowLabels,
  afterColLabels,
  onPlaceInAfter,
  onRemoveAfterPlacement,
  beforeRowLabels,
  beforeColLabels,
  onAssignBeforeItem,
  onMoveCellContents,
}: Props) {
  const interactive = Boolean(onCellChange) && !readOnly;
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [destPickerItemId, setDestPickerItemId] = useState<string | null>(null);
  const lastJumpNonce = useRef<number | null>(null);
  const riskLegend = useMemo(() => legendItems(), []);

  const pickerItems =
    picker === null
      ? []
      : (cellItems[picker.row]?.[picker.col] ?? []);

  const totalRows = rowLabels.length;
  const totalCols = colLabels.length;

  const matrixStats = useMemo(() => {
    let highRisk = 0;
    let critical = 0;
    let needsAction = 0;
    let filledCells = 0;
    for (let i = 0; i < totalRows; i++) {
      for (let j = 0; j < totalCols; j++) {
        const stored = matrixValues[i]?.[j] ?? 0;
        const auto = positionRiskLevel(i, j, totalRows, totalCols);
        const items = cellItems[i]?.[j] ?? [];
        if (!cellHasFilledRosItems(items)) continue;
        filledCells++;
        const level = stored > 0 ? stored : auto;
        if (level >= 4) highRisk++;
        if (level >= 5) critical++;
        const hasFlag = items.some((it) =>
          it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION),
        );
        if (level >= 4 && !hasFlag) needsAction++;
      }
    }
    return { highRisk, critical, needsAction, filledCells };
  }, [matrixValues, cellItems, totalRows, totalCols]);

  type BeforeItemRef = {
    id: string;
    text: string;
    flags?: string[];
    sourceRow: number;
    sourceCol: number;
    rowLabel: string;
    colLabel: string;
    afterRow?: number;
    afterCol?: number;
  };

  const { unmappedBeforeItems, mappedElsewhereItems } = useMemo(() => {
    if (currentPhase !== "after" || !otherPhaseCellItems) {
      return { unmappedBeforeItems: [] as BeforeItemRef[], mappedElsewhereItems: [] as BeforeItemRef[] };
    }
    const unmapped: BeforeItemRef[] = [];
    const elsewhere: BeforeItemRef[] = [];
    for (let i = 0; i < otherPhaseCellItems.length; i++) {
      const row = otherPhaseCellItems[i];
      if (!row) continue;
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (!cell) continue;
        for (const it of cell) {
          if (!it.text.trim()) continue;
          const ref: BeforeItemRef = {
            id: it.id,
            text: it.text,
            flags: it.flags,
            sourceRow: i,
            sourceCol: j,
            rowLabel: beforeRowLabels?.[i] ?? `Rad ${i + 1}`,
            colLabel: beforeColLabels?.[j] ?? `Kol ${j + 1}`,
            afterRow: it.afterRow,
            afterCol: it.afterCol,
          };
          if (it.afterRow == null || it.afterCol == null) {
            unmapped.push(ref);
          } else if (picker && (it.afterRow !== picker.row || it.afterCol !== picker.col)) {
            elsewhere.push(ref);
          }
        }
      }
    }
    return { unmappedBeforeItems: unmapped, mappedElsewhereItems: elsewhere };
  }, [currentPhase, otherPhaseCellItems, beforeRowLabels, beforeColLabels, picker]);

  const pickerAutoLevel =
    picker !== null
      ? positionRiskLevel(picker.row, picker.col, totalRows, totalCols)
      : 0;
  const pickerCurrentLevel =
    picker !== null
      ? (matrixValues[picker.row]?.[picker.col] ?? 0)
      : 0;
  const pickerIsOverridden =
    pickerCurrentLevel > 0 && pickerCurrentLevel !== pickerAutoLevel;

  const otherPhaseLevel =
    picker !== null ? (otherPhaseValues?.[picker.row]?.[picker.col] ?? 0) : 0;
  const otherPhaseItems =
    picker !== null
      ? (otherPhaseCellItems?.[picker.row]?.[picker.col] ?? [])
      : [];
  const otherPhaseFilledItems = otherPhaseItems.filter(
    (it) =>
      it.text.trim() ||
      it.flags?.includes(ROS_CELL_FLAG_WATCH) ||
      it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION),
  );
  const hasOtherPhaseData = otherPhaseLevel > 0 || otherPhaseFilledItems.length > 0;

  useEffect(() => {
    if (!jumpRequest) {
      lastJumpNonce.current = null;
      return;
    }
    if (!interactive) return;
    if (lastJumpNonce.current === jumpRequest.nonce) return;
    const { row, col } = jumpRequest;
    if (
      row < 0 ||
      col < 0 ||
      row >= rowLabels.length ||
      col >= colLabels.length
    ) {
      onJumpHandled?.();
      return;
    }
    lastJumpNonce.current = jumpRequest.nonce;
    const el = document.getElementById(`ros-mx-cell-${row}-${col}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = window.setTimeout(() => {
      setPicker({ row, col });
      onJumpHandled?.();
    }, 0);
    return () => window.clearTimeout(t);
  }, [jumpRequest, interactive, rowLabels.length, colLabels.length, onJumpHandled]);

  const closePicker = useCallback(() => {
    setPicker(null);
  }, []);

  useEffect(() => {
    if (!picker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePicker();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [picker, closePicker]);

  useEffect(() => {
    if (!picker || !interactive || !onCellItemsChange) return;
    /** Etter-tiltak-punkter skal kun komme fra «Før tiltak» (plassering / kobling), ikke nye frie kort. */
    if (currentPhase === "after") return;
    const items = cellItems[picker.row]?.[picker.col] ?? [];
    if (items.length > 0) return;
    const newId = newRosCellItemId();
    onCellItemsChange(picker.row, picker.col, [{ id: newId, text: "" }]);
    if (onCellChange && (matrixValues[picker.row]?.[picker.col] ?? 0) === 0) {
      onCellChange(picker.row, picker.col, positionRiskLevel(picker.row, picker.col, totalRows, totalCols));
    }
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        `[data-ros-item-id="${newId}"]`,
      );
      el?.focus();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker?.row, picker?.col, currentPhase]);

  function selectLevel(level: number) {
    if (!picker || !onCellChange) return;
    onCellChange(picker.row, picker.col, level);
  }

  function updateItemAt(
    row: number,
    col: number,
    next: RosCellItem[],
  ) {
    onCellItemsChange?.(row, col, next);
    const currentLevel = matrixValues[row]?.[col] ?? 0;
    const hadItems = (cellItems[row]?.[col] ?? []).length > 0;
    const hasItemsNow = next.length > 0;
    if (hasItemsNow && !hadItems && currentLevel === 0 && onCellChange) {
      onCellChange(row, col, positionRiskLevel(row, col, totalRows, totalCols));
    }
  }

  function patchItem(
    row: number,
    col: number,
    id: string,
    patch: Partial<RosCellItem>,
  ) {
    const items = cellItems[row]?.[col] ?? [];
    updateItemAt(
      row,
      col,
      items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }

  const pickerRowLabel =
    picker !== null ? rowLabels[picker.row] ?? `Rad ${picker.row + 1}` : "";
  const pickerColLabel =
    picker !== null ? colLabels[picker.col] ?? `Kolonne ${picker.col + 1}` : "";

  const isEmpty = matrixStats.filledCells === 0;

  return (
    <div className="space-y-4">
      {isEmpty && interactive ? (
        <details className="rounded-2xl border border-border/50 bg-muted/20 text-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden hover:bg-muted/35">
            <Lightbulb className="text-primary size-4 shrink-0" aria-hidden />
            <span>Kort hjelp om matrisen</span>
            <span className="text-muted-foreground font-normal">— trykk for å utvide</span>
          </summary>
          <div className="text-muted-foreground space-y-2 border-t border-border/40 px-4 pb-3 pt-2 text-xs leading-relaxed">
            <p>
              Punkter du legger inn <strong className="text-foreground">over matrisen</strong>, vises her
              automatisk. Du kan også klikke i en celle for å legge til eller flytte risiko.
            </p>
            <p>
              <strong className="text-foreground">↑ Rader</strong> = sannsynlighet (ofte øverst).{" "}
              <strong className="text-foreground">→ Kolonner</strong> = konsekvens (alvorlig høyre).
            </p>
          </div>
        </details>
      ) : null}

      <div className="relative -mx-1 touch-pan-x overflow-x-auto px-1 sm:mx-0 sm:px-0 rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <table className="w-full min-w-full table-fixed border-collapse text-left text-sm md:min-w-[min(100%,56rem)]">
          <thead>
            <tr className="border-b border-border/20">
              <th
                scope="col"
                className="sticky top-0 left-0 z-20 w-[4.75rem] border-r border-border/20 bg-card/95 px-1.5 py-2 text-xs backdrop-blur-md sm:w-[9rem] sm:px-3 sm:py-3.5"
              >
                <span className="text-muted-foreground flex flex-col gap-0.5 text-[9px] font-bold uppercase tracking-wider sm:flex-row sm:items-center sm:gap-1 sm:text-[10px]">
                  <span className="leading-tight">↑ {rowAxisTitle}</span>
                  <span className="leading-tight">→ {colAxisTitle}</span>
                </span>
              </th>
              {colLabels.map((label, j) => (
                <th
                  key={j}
                  scope="col"
                  className="sticky top-0 z-10 bg-card/95 px-1 py-2 text-center text-[10px] font-bold leading-tight text-foreground/80 backdrop-blur-md sm:px-2 sm:py-3.5 sm:text-[11px] sm:leading-snug"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rowLabels].map((_, _ri, _arr) => {
              const i = rowLabels.length - 1 - _ri;
              const rowLabel = rowLabels[i] ?? `Rad ${i + 1}`;
              return (
              <tr key={i} className="border-b border-border/10 last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-[4.75rem] overflow-hidden border-r border-border/20 bg-card/95 px-1.5 py-2 text-left text-[10px] font-bold leading-tight text-foreground/80 backdrop-blur-md sm:w-[9rem] sm:px-3 sm:py-3 sm:text-[11px] sm:leading-snug"
                >
                  <span className="line-clamp-3 sm:line-clamp-2">{rowLabel}</span>
                </th>
                {colLabels.map((_, j) => {
                  const storedLevel = matrixValues[i]?.[j] ?? 0;
                  const autoLevel = positionRiskLevel(i, j, totalRows, totalCols);
                  const items = cellItems[i]?.[j] ?? [];
                  const filledItems = items.filter(
                    (it) =>
                      it.text.trim() ||
                      it.flags?.includes(ROS_CELL_FLAG_WATCH) ||
                      it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION),
                  );
                  const hasContent = filledItems.length > 0;
                  const displayLevel = hasContent
                    ? (storedLevel > 0 ? storedLevel : autoLevel)
                    : storedLevel;
                  const isPicked =
                    picker?.row === i && picker?.col === j && interactive;
                  const isHighRisk = displayLevel >= 4 && hasContent;
                  const hasActionFlag = filledItems.some(
                    (it) => it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION),
                  );
                  const otherLevel = otherPhaseValues?.[i]?.[j] ?? 0;
                  const showCrossRef = hasContent && otherLevel > 0 && otherLevel !== displayLevel;
                  return (
                    <td
                      key={j}
                      className="overflow-hidden p-0.5 align-top sm:p-1.5"
                    >
                      <button
                        id={`ros-mx-cell-${i}-${j}`}
                        type="button"
                        disabled={!interactive}
                        aria-pressed={isPicked}
                        aria-label={`Celle ${rowLabel}, ${colLabels[j] ?? `kolonne ${j + 1}`}. Nivå ${displayLevel} ${RISK_LEVEL_HINTS[displayLevel] ?? ""}. ${filledItems.length} punkt${filledItems.length !== 1 ? "er" : ""}. ${isHighRisk ? "Høy risiko. " : ""}${interactive ? "Klikk for å redigere." : ""}`}
                        onClick={() => {
                          if (!interactive) return;
                          setPicker({ row: i, col: j });
                        }}
                        className={cn(
                          hasContent
                            ? cnCell(displayLevel, interactive)
                            : cn(
                                "min-h-[3.25rem] min-w-0 border px-0.5 py-2 text-center text-sm font-semibold tabular-nums transition-colors sm:min-h-[4rem] sm:min-w-[4.5rem] sm:px-1 sm:py-2.5",
                                cellRiskGhostClass(autoLevel),
                                interactive && "cursor-pointer focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                              ),
                          "group/cell relative flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl transition-[transform,box-shadow] duration-150",
                          hasContent
                            ? "min-h-[4rem] items-stretch gap-0 p-0 shadow-sm sm:min-h-[5.5rem]"
                            : "items-center justify-center gap-0.5",
                          "max-md:!min-w-0",
                          interactive &&
                            "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                          !interactive && "cursor-default",
                          isPicked &&
                            "ring-primary ring-offset-background ring-2 ring-offset-2",
                          isHighRisk && !isPicked && "ring-2 ring-red-500/40 ring-offset-1",
                        )}
                      >
                        {hasContent ? (
                          <>
                            <span className="flex min-w-0 flex-col gap-1 overflow-hidden px-1.5 pt-1 pb-0.5 sm:flex-row sm:items-center sm:gap-1 sm:pb-0.5">
                              <span className="flex min-w-0 shrink-0 items-center gap-1">
                                {isHighRisk && !hasActionFlag ? (
                                  <AlertTriangle
                                    className="size-3.5 shrink-0 text-red-600 dark:text-red-400"
                                    aria-label="Høy risiko uten behandling"
                                  />
                                ) : null}
                                <span className="inline-flex size-5 items-center justify-center rounded-md bg-black/10 text-[10px] font-bold tabular-nums leading-none dark:bg-white/15">
                                  {displayLevel}
                                </span>
                                {showCrossRef ? (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-semibold tabular-nums leading-none",
                                      otherLevel < displayLevel
                                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                        : otherLevel > displayLevel
                                          ? "bg-red-500/15 text-red-700 dark:text-red-300"
                                          : "bg-muted text-muted-foreground",
                                    )}
                                    title={currentPhase === "before"
                                      ? `Etter tiltak: nivå ${otherLevel}`
                                      : `Før tiltak: nivå ${otherLevel}`}
                                  >
                                    {otherLevel < displayLevel ? "→↓" : "→↑"}{otherLevel}
                                  </span>
                                ) : null}
                              </span>
                              <span className="min-w-0 text-[9px] font-semibold leading-snug opacity-80 sm:truncate sm:text-[10px] sm:leading-none">
                                {riskLegend.find((x) => x.level === displayLevel)?.label ?? "—"}
                              </span>
                            </span>
                            <span className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-hidden px-1.5 pb-1.5 pt-0.5 sm:pt-0">
                              {filledItems.slice(0, 3).map((it, idx) => {
                                const hasWatch = it.flags?.includes(ROS_CELL_FLAG_WATCH);
                                const hasAction = it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION);
                                return (
                                  <span
                                    key={it.id}
                                    className="flex min-w-0 items-start gap-0.5 text-left"
                                  >
                                    {hasAction ? (
                                      <AlertTriangle
                                        className="mt-px size-2.5 shrink-0 text-red-700 dark:text-red-300"
                                        aria-label="Krever handling"
                                      />
                                    ) : hasWatch ? (
                                      <Eye
                                        className="mt-px size-2.5 shrink-0 text-amber-700 dark:text-amber-300"
                                        aria-label="Varsel"
                                      />
                                    ) : (
                                      <span className="mt-[3px] size-1.5 shrink-0 rounded-full bg-current opacity-40" />
                                    )}
                                    <span className="min-w-0 truncate text-[10px] leading-tight">
                                      {it.text.trim() || `Punkt ${idx + 1}`}
                                    </span>
                                  </span>
                                );
                              })}
                              {filledItems.length > 3 ? (
                                <span className="text-[9px] font-medium opacity-60">
                                  +{filledItems.length - 3} til
                                </span>
                              ) : null}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-muted-foreground/40 text-xs tabular-nums font-bold leading-none">
                              {autoLevel}
                            </span>
                            {interactive ? (
                              <Plus className="text-muted-foreground/0 group-hover/cell:text-muted-foreground/50 size-3.5 transition-colors" aria-hidden />
                            ) : (
                              <span className="text-muted-foreground/30 max-w-full truncate px-0.5 text-[9px] font-medium leading-none">
                                {riskLegend.find((x) => x.level === autoLevel)?.label ?? "—"}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {matrixStats.filledCells > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/15 px-4 py-3 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-xs font-bold tabular-nums text-foreground">
              {matrixStats.filledCells}
            </span>
            <span className="text-muted-foreground text-xs font-medium">
              celle{matrixStats.filledCells !== 1 ? "r" : ""} med risiko
            </span>
          </div>
          <span className="h-4 w-px bg-border/60" />
          {matrixStats.highRisk > 0 ? (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="size-4 text-red-500" aria-hidden />
              <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                {matrixStats.highRisk} høy/kritisk
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15">
                <span className="size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Ingen høy risiko
              </span>
            </div>
          )}
          {matrixStats.needsAction > 0 ? (
            <>
              <span className="h-4 w-px bg-border/60" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {matrixStats.needsAction} uten handling
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={Boolean(picker && interactive)}
        onOpenChange={(open) => {
          if (!open) closePicker();
        }}
      >
        <DialogContent
          size="2xl"
          titleId="ros-cell-picker-title"
          descriptionId="ros-cell-picker-desc"
          className="max-h-[min(92vh,40rem)] overflow-y-auto"
        >
          <DialogHeader>
            <p
              id="ros-cell-picker-title"
              className="font-heading flex items-center gap-2 text-base font-semibold"
            >
              <span
                className={cn(
                  cnCell(pickerCurrentLevel > 0 ? pickerCurrentLevel : pickerAutoLevel, false),
                  "inline-flex size-8 items-center justify-center rounded-lg text-sm font-bold tabular-nums shadow-sm",
                )}
              >
                {pickerCurrentLevel > 0 ? pickerCurrentLevel : pickerAutoLevel}
              </span>
              <span className="min-w-0">
                <span className="block">{pickerRowLabel} × {pickerColLabel}</span>
                <span className="text-muted-foreground block text-xs font-normal">
                  {riskLegend.find(
                    (x) => x.level === (pickerCurrentLevel > 0 ? pickerCurrentLevel : pickerAutoLevel),
                  )?.label ?? ""}{" "}
                  risiko — hva kan gå galt her?
                </span>
              </span>
            </p>
            <p id="ros-cell-picker-desc" className="sr-only">
              Legg inn risikopunkter for denne cellen.
            </p>
          </DialogHeader>
          {interactive &&
          onMoveCellContents &&
          picker &&
          pickerItems.length > 0 ? (
            <div className="border-border/50 bg-muted/15 -mt-1 mb-4 space-y-2 rounded-xl border px-3 py-3 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
              <p className="text-foreground w-full text-xs font-semibold">
                Plassering i matrisen
              </p>
              <div className="min-w-0 flex-1 space-y-1 sm:max-w-[min(100%,14rem)]">
                <Label
                  htmlFor="ros-cell-move-row"
                  className="text-muted-foreground text-[10px] font-medium"
                >
                  {rowAxisTitle}
                </Label>
                <select
                  id="ros-cell-move-row"
                  className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-xs shadow-sm"
                  value={picker.row}
                  onChange={(e) => {
                    const nr = Number(e.target.value);
                    if (Number.isNaN(nr) || nr === picker.row) return;
                    onMoveCellContents(picker.row, picker.col, nr, picker.col);
                    setPicker({ row: nr, col: picker.col });
                  }}
                >
                  {rowLabels.map((label, i) => (
                    <option key={i} value={i}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 flex-1 space-y-1 sm:max-w-[min(100%,14rem)]">
                <Label
                  htmlFor="ros-cell-move-col"
                  className="text-muted-foreground text-[10px] font-medium"
                >
                  {colAxisTitle}
                </Label>
                <select
                  id="ros-cell-move-col"
                  className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-xs shadow-sm"
                  value={picker.col}
                  onChange={(e) => {
                    const nc = Number(e.target.value);
                    if (Number.isNaN(nc) || nc === picker.col) return;
                    onMoveCellContents(picker.row, picker.col, picker.row, nc);
                    setPicker({ row: picker.row, col: nc });
                  }}
                >
                  {colLabels.map((label, j) => (
                    <option key={j} value={j}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-muted-foreground w-full text-[10px] leading-relaxed">
                Alle punkter i cellen flyttes til valgt rad og kolonne. Du kan også
                klikke en annen celle i matrisen.
              </p>
            </div>
          ) : null}
          <DialogBody>
            {(() => {
              const effLevel = pickerCurrentLevel > 0 ? pickerCurrentLevel : pickerAutoLevel;
              const hasAnyActionFlag = pickerItems.some(
                (it) => it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION),
              );
              if (effLevel >= 4 && !hasAnyActionFlag && pickerItems.length > 0) {
                return (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                    <div className="space-y-1 text-xs">
                      <p className="text-foreground font-semibold">
                        Nivå {effLevel} — høy risiko
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        Denne cellen har høyt risikonivå. Vurder å sette{" "}
                        <strong className="text-foreground">«Krever handling»</strong>-flagget
                        på minst ett punkt, slik at det fanges opp i oppfølgingsoversikten.
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            {currentPhase === "after" && hasOtherPhaseData && picker ? (
              <div className="mb-4 space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                <span className="text-xs font-semibold text-foreground">
                  Før tiltak (denne cellen)
                  {otherPhaseLevel > 0 ? (
                    <span
                      className={cn(
                        "ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded px-1 py-px text-[10px] font-bold tabular-nums",
                        otherPhaseLevel >= 4
                          ? "bg-red-500/20 text-red-700 dark:text-red-300"
                          : otherPhaseLevel >= 3
                            ? "bg-amber-400/20 text-amber-700 dark:text-amber-300"
                            : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
                      )}
                    >
                      Nivå {otherPhaseLevel}
                    </span>
                  ) : null}
                </span>
                {otherPhaseFilledItems.length > 0 ? (
                  <ul className="space-y-1">
                    {otherPhaseFilledItems.map((it, idx) => (
                      <li
                        key={it.id || idx}
                        className="flex items-start gap-1 text-xs text-muted-foreground"
                      >
                        {it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION) ? (
                          <AlertTriangle className="mt-px size-3 shrink-0 text-red-500/70" />
                        ) : it.flags?.includes(ROS_CELL_FLAG_WATCH) ? (
                          <Eye className="mt-px size-3 shrink-0 text-amber-500/70" />
                        ) : (
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                        )}
                        <span className="leading-relaxed">{it.text.trim() || `Punkt ${idx + 1}`}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground/70 text-xs italic">
                    Kun nivå — ingen tekstpunkter
                  </p>
                )}
              </div>
            ) : null}
            {currentPhase === "after" && picker && onAssignBeforeItem && (unmappedBeforeItems.length > 0 || mappedElsewhereItems.length > 0) ? (
              <div className="mb-4 space-y-3 rounded-xl border border-blue-500/25 bg-blue-500/[0.04] p-3">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  Koble risiko fra «Før tiltak»
                </p>
                {unmappedBeforeItems.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground text-[10px] font-medium">
                      Ikke plassert ennå:
                    </p>
                    <ul className="space-y-1.5">
                      {unmappedBeforeItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start gap-2 rounded-lg border border-border/50 bg-card px-2.5 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground truncate text-xs font-medium">
                              {item.text}
                            </p>
                            <p className="text-muted-foreground text-[10px]">
                              Fra: {item.rowLabel} × {item.colLabel}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 shrink-0 text-[10px] font-semibold"
                            onClick={() => {
                              onAssignBeforeItem(
                                item.id,
                                item.sourceRow,
                                item.sourceCol,
                                picker.row,
                                picker.col,
                              );
                            }}
                          >
                            Plasser her
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {mappedElsewhereItems.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground text-[10px] font-medium">
                      Allerede plassert i annen celle (flytt hit?):
                    </p>
                    <ul className="space-y-1.5">
                      {mappedElsewhereItems.map((item) => {
                        const curAfterLabel = item.afterRow != null && item.afterCol != null
                          ? `${rowLabels[item.afterRow] ?? `R${item.afterRow + 1}`} × ${colLabels[item.afterCol] ?? `K${item.afterCol + 1}`}`
                          : "";
                        return (
                          <li
                            key={item.id}
                            className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] px-2.5 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground truncate text-xs font-medium">
                                {item.text}
                              </p>
                              <p className="text-muted-foreground text-[10px]">
                                Fra: {item.rowLabel} × {item.colLabel}
                                {curAfterLabel ? <> — nå i: <strong className="text-foreground">{curAfterLabel}</strong></> : null}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 shrink-0 border-amber-500/30 text-[10px] font-semibold"
                              onClick={() => {
                                onAssignBeforeItem(
                                  item.id,
                                  item.sourceRow,
                                  item.sourceCol,
                                  picker.row,
                                  picker.col,
                                );
                              }}
                            >
                              Flytt hit
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {onCellItemsChange && picker ? (
              <div className="mb-5 space-y-3">
                {currentPhase === "after" &&
                pickerItems.length === 0 &&
                unmappedBeforeItems.length === 0 &&
                mappedElsewhereItems.length === 0 ? (
                  <div className="border-border/60 bg-muted/15 text-muted-foreground rounded-xl border px-3 py-3 text-xs leading-relaxed">
                    <p className="text-foreground font-medium">
                      Ingen risiko knyttet til denne cellen etter tiltak
                    </p>
                    <p className="mt-1.5">
                      Opprett eller rediger risiko under «Før tiltak». Bruk deretter{" "}
                      <strong className="text-foreground">«Plasser i etter»</strong> på
                      punktet, eller bruk «Plasser her» når uplasserte risikoer vises over.
                    </p>
                  </div>
                ) : null}
                {currentPhase === "before" || pickerItems.length > 0 ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-foreground text-sm font-semibold">
                        Risikopunkter
                        {pickerItems.length > 1 ? (
                          <span className="text-muted-foreground ml-1 text-xs font-normal">
                            ({pickerItems.length})
                          </span>
                        ) : null}
                      </Label>
                      {currentPhase === "before" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const newId = newRosCellItemId();
                            updateItemAt(picker.row, picker.col, [
                              ...pickerItems,
                              { id: newId, text: "" },
                            ]);
                            requestAnimationFrame(() => {
                              document
                                .querySelector<HTMLTextAreaElement>(
                                  `[data-ros-item-id="${newId}"]`,
                                )
                                ?.focus();
                            });
                          }}
                        >
                          <Plus className="mr-1.5 size-4" />
                          Legg til punkt
                        </Button>
                      ) : null}
                    </div>
                    <ul className="space-y-3">
                  {pickerItems.map((it, idx) => {
                    const canPlaceAfter = currentPhase === "before" && onPlaceInAfter && afterRowLabels && afterColLabels;
                    const hasPlacement = it.afterRow != null && it.afterCol != null;
                    const showDestGrid = destPickerItemId === it.id;
                    const afterAutoLvl = hasPlacement
                      ? positionRiskLevel(it.afterRow!, it.afterCol!, afterRowLabels?.length ?? 0, afterColLabels?.length ?? 0)
                      : 0;

                    return (
                    <li
                      key={it.id}
                      className="space-y-0 overflow-hidden rounded-xl border"
                    >
                      <div className="bg-muted/25 space-y-2 p-3">
                        <div className="flex items-center justify-between gap-2">
                          {pickerItems.length > 1 ? (
                            <span className="text-muted-foreground text-[10px] font-medium">
                              {idx + 1} av {pickerItems.length}
                            </span>
                          ) : <span />}
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive size-7 shrink-0"
                              aria-label="Fjern punkt"
                              onClick={() => {
                                if (hasPlacement) {
                                  onRemoveAfterPlacement?.(it.id);
                                }
                                updateItemAt(
                                  picker.row,
                                  picker.col,
                                  pickerItems.filter((x) => x.id !== it.id),
                                );
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          data-ros-item-id={it.id}
                          value={it.text}
                          onChange={(e) =>
                            patchItem(picker.row, picker.col, it.id, {
                              text: e.target.value,
                            })
                          }
                          placeholder={PLACEHOLDER_EXAMPLES[idx % PLACEHOLDER_EXAMPLES.length]}
                          rows={2}
                          className="min-h-[3rem] resize-y text-sm"
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-muted-foreground text-[10px]">
                              Økonomi (valgfritt)
                            </Label>
                            <Input
                              value={it.economicBand ?? ""}
                              onChange={(e) =>
                                patchItem(picker.row, picker.col, it.id, {
                                  economicBand: e.target.value,
                                })
                              }
                              className="h-8 text-xs"
                              placeholder="Størrelsesorden"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-muted-foreground text-[10px]">
                              Frekvens (valgfritt)
                            </Label>
                            <Input
                              value={it.frequencyBand ?? ""}
                              onChange={(e) =>
                                patchItem(picker.row, picker.col, it.id, {
                                  frequencyBand: e.target.value,
                                })
                              }
                              className="h-8 text-xs"
                              placeholder="F.eks. daglig, årlig"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              patchItem(picker.row, picker.col, it.id, {
                                flags: toggleFlag(
                                  it.flags,
                                  ROS_CELL_FLAG_REQUIRES_ACTION,
                                  !(it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION) ?? false),
                                ),
                              })
                            }
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                              it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION)
                                ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
                                : "border-border/60 text-muted-foreground hover:border-red-500/30 hover:text-red-600",
                            )}
                          >
                            <AlertTriangle className="size-3.5" aria-hidden />
                            Må håndteres
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              patchItem(picker.row, picker.col, it.id, {
                                flags: toggleFlag(
                                  it.flags,
                                  ROS_CELL_FLAG_WATCH,
                                  !(it.flags?.includes(ROS_CELL_FLAG_WATCH) ?? false),
                                ),
                              })
                            }
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                              it.flags?.includes(ROS_CELL_FLAG_WATCH)
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "border-border/60 text-muted-foreground hover:border-amber-500/30 hover:text-amber-600",
                            )}
                          >
                            <Eye className="size-3.5" aria-hidden />
                            Følg med
                          </button>
                        </div>
                        {currentPhase === "after" ? (
                          <div className="border-border/40 space-y-1 border-t pt-2">
                            <Label
                              htmlFor={`ros-after-change-${it.id}`}
                              className="text-foreground text-xs font-semibold"
                            >
                              Begrunnelse for endring
                            </Label>
                            <Textarea
                              id={`ros-after-change-${it.id}`}
                              value={it.afterChangeNote ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                patchItem(picker.row, picker.col, it.id, {
                                  afterChangeNote:
                                    v.length === 0 ? undefined : v,
                                });
                              }}
                              placeholder="Hvilke tiltak reduserer risikoen? F.eks. kryptering, backup, opplæring …"
                              rows={2}
                              className="min-h-[2.75rem] resize-y text-sm"
                            />
                          </div>
                        ) : null}
                      </div>

                      {canPlaceAfter ? (
                        <div className={cn(
                          "border-t px-3 py-2.5",
                          hasPlacement
                            ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                            : "border-blue-500/20 bg-blue-500/[0.04]",
                        )}>
                          {hasPlacement ? (
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                Etter tiltak:
                              </span>
                              <span
                                className={cn(
                                  "inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums",
                                  afterAutoLvl >= 4
                                    ? "bg-red-500/15 text-red-700 dark:text-red-300"
                                    : afterAutoLvl >= 3
                                      ? "bg-amber-400/20 text-amber-700 dark:text-amber-300"
                                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                                )}
                                title={`${afterRowLabels![it.afterRow!]} × ${afterColLabels![it.afterCol!]} — nivå ${afterAutoLvl}`}
                              >
                                <span className="min-w-0 break-words text-left leading-snug">
                                  {afterRowLabels![it.afterRow!]} × {afterColLabels![it.afterCol!]}
                                </span>
                                <span className="opacity-80 font-semibold">(nivå {afterAutoLvl})</span>
                              </span>
                              <div className="flex shrink-0 gap-1 sm:ml-auto">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 min-h-11 min-w-[4.5rem] px-3 text-xs sm:min-h-8"
                                  onClick={() => setDestPickerItemId(showDestGrid ? null : it.id)}
                                >
                                  Endre
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-destructive h-8 min-h-11 px-3 text-xs sm:min-h-8"
                                  onClick={() => {
                                    onRemoveAfterPlacement?.(it.id);
                                    patchItem(picker.row, picker.col, it.id, {
                                      afterRow: undefined,
                                      afterCol: undefined,
                                    });
                                  }}
                                >
                                  Fjern
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDestPickerItemId(showDestGrid ? null : it.id)}
                              className="flex w-full items-center gap-2 text-left"
                            >
                              <ArrowRightLeft className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                Hvor havner risikoen etter tiltak?
                              </span>
                              <span className="text-muted-foreground ml-auto text-[10px]">
                                Velg celle →
                              </span>
                            </button>
                          )}

                          {showDestGrid ? (
                            <div className="mt-3 space-y-3 rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 to-card/60 p-3 shadow-sm sm:p-4">
                              <div className="space-y-1">
                                <p className="text-foreground text-xs font-semibold">
                                  Velg celle etter tiltak
                                </p>
                                <p className="text-muted-foreground text-[11px] leading-relaxed sm:text-xs">
                                  Klikk ruten der du mener restrisikoen havner. På små skjermer er
                                  aksene forkortet til tall — trykk lenge eller hold pekeren over en
                                  celle for full beskrivelse.
                                </p>
                              </div>
                              <div className="border-border/50 bg-background/40 -mx-0.5 px-0.5 sm:mx-0">
                                {(() => {
                                  const nRows = afterRowLabels!.length;
                                  const nCols = afterColLabels!.length;
                                  const gridCols = `minmax(0,4.5rem) repeat(${nCols}, minmax(2.75rem, 1fr))`;
                                  return (
                                    <div
                                      className="grid w-full gap-1 sm:gap-1.5"
                                      style={{ gridTemplateColumns: gridCols }}
                                    >
                                      {/* Tomt hjørne + kolonneoverskrifter */}
                                      <div className="min-h-2" aria-hidden />
                                      {afterColLabels!.map((cl, cj) => {
                                        const { rank, caption } = splitAxisLabel(cl);
                                        return (
                                          <div
                                            key={cj}
                                            className="flex min-h-[2.75rem] flex-col items-center justify-end gap-0.5 px-0.5 pb-0.5 text-center"
                                          >
                                            <span
                                              className="text-foreground text-[11px] font-bold tabular-nums sm:text-xs"
                                              title={cl}
                                            >
                                              {rank}
                                            </span>
                                            {caption ? (
                                              <span
                                                className="text-muted-foreground hidden w-full max-w-[5.5rem] text-[9px] leading-snug sm:line-clamp-2 sm:block sm:text-[10px]"
                                                title={cl}
                                              >
                                                {caption}
                                              </span>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                      {[...afterRowLabels!].map((_, _ri) => {
                                        const ri = nRows - 1 - _ri;
                                        const rl = afterRowLabels![ri] ?? `Rad ${ri + 1}`;
                                        const { rank, caption } = splitAxisLabel(rl);
                                        return (
                                          <div
                                            key={ri}
                                            className="contents"
                                          >
                                            <div
                                              className="flex min-h-11 min-w-0 flex-col items-end justify-center gap-0.5 pr-1 text-right sm:min-h-10"
                                              title={rl}
                                            >
                                              <span className="text-foreground text-[11px] font-bold tabular-nums sm:text-xs">
                                                {rank}
                                              </span>
                                              {caption ? (
                                                <span className="text-muted-foreground hidden max-w-[5rem] text-[9px] leading-snug sm:line-clamp-2 sm:block sm:text-[10px]">
                                                  {caption}
                                                </span>
                                              ) : null}
                                            </div>
                                            {afterColLabels!.map((_, cj) => {
                                              const isSelected =
                                                it.afterRow === ri && it.afterCol === cj;
                                              const autoLvl = positionRiskLevel(
                                                ri,
                                                cj,
                                                nRows,
                                                nCols,
                                              );
                                              const cellLabel = `${rl} × ${afterColLabels![cj]}`;
                                              return (
                                                <div
                                                  key={cj}
                                                  className="flex aspect-square min-h-11 min-w-0 items-stretch sm:min-h-10"
                                                >
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      onPlaceInAfter!(
                                                        it.id,
                                                        it.text,
                                                        it.flags,
                                                        ri,
                                                        cj,
                                                      );
                                                      patchItem(
                                                        picker.row,
                                                        picker.col,
                                                        it.id,
                                                        {
                                                          afterRow: ri,
                                                          afterCol: cj,
                                                        },
                                                      );
                                                      setDestPickerItemId(null);
                                                    }}
                                                    title={`${cellLabel} — nivå ${autoLvl}`}
                                                    aria-label={`Velg ${cellLabel}, nivå ${autoLvl}`}
                                                    aria-pressed={isSelected}
                                                    className={cn(
                                                      "flex touch-manipulation flex-1 items-center justify-center rounded-lg border text-sm font-bold tabular-nums transition-all active:scale-[0.97]",
                                                      isSelected
                                                        ? "ring-primary bg-primary text-primary-foreground shadow-md ring-2 ring-offset-2 ring-offset-background"
                                                        : cellRiskGhostClass(autoLvl),
                                                      "hover:z-10 hover:shadow-md hover:ring-2 hover:ring-primary/40",
                                                    )}
                                                  >
                                                    {autoLvl}
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                              <details className="border-border/50 bg-muted/25 sm:hidden rounded-lg border text-[10px]">
                                <summary className="cursor-pointer list-none px-3 py-2 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                                  <span className="text-muted-foreground font-normal">
                                    Full akseliste
                                  </span>
                                </summary>
                                <div className="text-muted-foreground space-y-2 border-t border-border/40 px-3 pb-3 pt-2 leading-relaxed">
                                  <p>
                                    <span className="font-medium text-foreground/90">
                                      {colAxisTitle}
                                    </span>
                                    <br />
                                    {afterColLabels!.join(" · ")}
                                  </p>
                                  <p>
                                    <span className="font-medium text-foreground/90">
                                      {rowAxisTitle}
                                    </span>
                                    <br />
                                    {afterRowLabels!.join(" · ")}
                                  </p>
                                </div>
                              </details>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {currentPhase === "after" && it.sourceItemId ? (
                        <div className="border-t border-blue-500/20 bg-blue-500/[0.04] px-3 py-1.5">
                          <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                            Plassert hit fra før tiltak
                          </p>
                        </div>
                      ) : null}
                    </li>
                    );
                  })}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}

            {pickerIsOverridden ? (
              <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Nivå overstyrt til {pickerCurrentLevel} (auto var {pickerAutoLevel})
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => selectLevel(pickerAutoLevel)}
                  >
                    Tilbakestill
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
            {onSwitchPhase && picker ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="font-semibold"
                onClick={() => {
                  const { row, col } = picker;
                  closePicker();
                  onSwitchPhase(row, col);
                }}
              >
                <ArrowRightLeft className="mr-1.5 size-4" />
                {currentPhase === "before"
                  ? "Gå til etter tiltak"
                  : "Gå til før tiltak"}
              </Button>
            ) : <span />}
            <Button type="button" variant="outline" onClick={closePicker}>
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        className="flex flex-wrap items-center gap-1.5"
        role="list"
      >
        <span className="text-muted-foreground mr-1 text-[10px] font-medium">
          Nivå:
        </span>
        {riskLegend.slice(1).map(({ level, label }) => (
          <span
            key={level}
            role="listitem"
            className={cn(
              cnCell(level, false),
              "inline-flex min-h-0 items-center rounded-lg px-2 py-1 text-[10px] font-semibold",
            )}
          >
            {level} {label}
          </span>
        ))}
      </div>
    </div>
  );
}
