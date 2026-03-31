"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ROS_CELL_FLAG_REQUIRES_ACTION,
  ROS_CELL_FLAG_WATCH,
  newRosCellItemId,
  type RosCellItem,
  type RosCellItemMatrix,
} from "@/lib/ros-cell-items";
import { positionRiskLevel, RISK_LEVEL_HINTS } from "@/lib/ros-defaults";
import { cellRiskClass } from "@/lib/ros-risk-colors";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Equal,
  Eye,
  Plus,
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
};

function levelBadge(level: number) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 text-xs font-bold tabular-nums",
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
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAfter, setShowAfter] = useState<Record<string, boolean>>({});

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Identifiserte risikoer</h3>
          <p className="text-muted-foreground text-xs">
            Legg til risiko, velg sannsynlighet og konsekvens — matrisen oppdateres automatisk.
          </p>
        </div>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleAdd}
          >
            <Plus className="size-3.5" />
            Legg til risiko
          </Button>
        )}
      </div>

      {sortedRisks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-primary/25 bg-primary/[0.02] p-8 text-center">
          <div className="bg-primary/10 flex size-12 items-center justify-center rounded-full">
            <Plus className="text-primary size-6" />
          </div>
          <div>
            <p className="text-foreground text-sm font-medium">
              Ingen risikoer ennå
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Klikk «Legg til risiko» for å identifisere din første risiko.
              <br />
              Velg sannsynlighet og konsekvens — matrisen fylles ut automatisk.
            </p>
          </div>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              className="mt-1 gap-1.5"
            >
              <Plus className="size-3.5" />
              Legg til første risiko
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedRisks.map((risk) => {
            const bLvl = beforeLevel(risk.beforeRow, risk.beforeCol);
            const aLvl = afterLevel(risk.afterRow, risk.afterCol);
            const expanded = expandedId === risk.id;
            const afterOpen = showAfter[risk.id] ?? (risk.afterRow !== risk.beforeRow || risk.afterCol !== risk.beforeCol);
            const highlighted = isHighlighted(risk);

            return (
              <div
                key={risk.id}
                data-risk-id={risk.id}
                className={cn(
                  "rounded-xl border bg-card transition-all",
                  highlighted && "ring-2 ring-primary/40",
                  expanded && "shadow-md",
                )}
              >
                {/* Compact header row */}
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedId(expanded ? null : risk.id)}
                >
                  <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
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
                  <div className="shrink-0 pt-1">
                    {expanded ? (
                      <ChevronUp className="text-muted-foreground size-4" />
                    ) : (
                      <ChevronDown className="text-muted-foreground size-4" />
                    )}
                  </div>
                </button>

                {/* Expanded editor */}
                {expanded && !readOnly && (
                  <div className="space-y-4 border-t px-4 pb-4 pt-3">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
