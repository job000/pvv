"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { legendItems, cnCell } from "@/lib/ros-risk-colors";
import { RISK_LEVEL_HINTS } from "@/lib/ros-defaults";
import { cn } from "@/lib/utils";
import { Grid3x3, MousePointerClick, Palette } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  rowAxisTitle: string;
  colAxisTitle: string;
  rowLabels: string[];
  colLabels: string[];
  matrixValues: number[][];
  onCellChange?: (row: number, col: number, next: number) => void;
  readOnly?: boolean;
};

type PickerTarget = { row: number; col: number };

export function RosMatrix({
  rowAxisTitle,
  colAxisTitle,
  rowLabels,
  colLabels,
  matrixValues,
  onCellChange,
  readOnly = false,
}: Props) {
  const interactive = Boolean(onCellChange) && !readOnly;
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const riskLegend = useMemo(() => legendItems(), []);

  const closePicker = useCallback(() => setPicker(null), []);

  useEffect(() => {
    if (!picker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePicker();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [picker, closePicker]);

  function selectLevel(level: number) {
    if (!picker || !onCellChange) return;
    onCellChange(picker.row, picker.col, level);
    setPicker(null);
  }

  const pickerRowLabel =
    picker !== null ? rowLabels[picker.row] ?? `Rad ${picker.row + 1}` : "";
  const pickerColLabel =
    picker !== null ? colLabels[picker.col] ?? `Kolonne ${picker.col + 1}` : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-gradient-to-br from-muted/30 via-card to-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <Grid3x3 className="size-3.5 shrink-0" aria-hidden />
            Slik bruker du matrisen
          </p>
          <p className="text-foreground text-sm leading-relaxed">
            <strong>Klikk på en celle</strong>. Da åpnes en{" "}
            <span className="text-muted-foreground">
              popup med fargekodet nivåvelger (0 = ikke vurdert, 1–5 = lav →
              kritisk). Velg nivå én gang — raskere enn å «spole» gjennom
              verdier med mange klikk.
            </span>
          </p>
        </div>
        <div
          className="relative h-20 w-full shrink-0 overflow-hidden rounded-xl border border-border/50 shadow-inner sm:h-24 sm:w-36"
          aria-hidden
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/90 via-amber-300/90 to-red-500/95" />
          <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1.5 py-0.5 text-[9px] font-medium text-foreground shadow-sm">
            Lav
          </span>
          <span className="absolute top-1 right-1 rounded bg-background/85 px-1.5 py-0.5 text-[9px] font-medium text-foreground shadow-sm">
            Typisk høyere fokus
          </span>
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-border/70 bg-card/50 shadow-sm">
        <table className="w-full min-w-[min(100%,48rem)] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th
                scope="col"
                className="bg-muted/90 sticky top-0 left-0 z-20 min-w-[7.5rem] border-r border-border/50 px-2 py-3 text-xs font-semibold uppercase tracking-wide"
              >
                <span className="text-muted-foreground block font-normal normal-case">
                  {rowAxisTitle}
                </span>
                <span className="text-foreground">× {colAxisTitle}</span>
              </th>
              {colLabels.map((label, j) => (
                <th
                  key={j}
                  scope="col"
                  className="bg-muted/90 sticky top-0 z-10 max-w-[8rem] min-w-[5rem] border-b border-border/50 px-2 py-2 text-center text-xs font-medium leading-snug"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((rowLabel, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                <th
                  scope="row"
                  className="bg-card/95 sticky left-0 z-10 max-w-[10rem] border-r border-border/50 px-2 py-2 text-left text-xs font-medium leading-snug"
                >
                  {rowLabel}
                </th>
                {colLabels.map((_, j) => {
                  const v = matrixValues[i]?.[j] ?? 0;
                  const isPicked =
                    picker?.row === i && picker?.col === j && interactive;
                  return (
                    <td key={j} className="p-1.5 align-middle">
                      <button
                        type="button"
                        disabled={!interactive}
                        aria-pressed={isPicked}
                        aria-label={`Celle ${rowLabel}, ${colLabels[j] ?? `kolonne ${j + 1}`}. Nåværende nivå ${v}, ${RISK_LEVEL_HINTS[v] ?? ""}. ${interactive ? "Åpne fargevelger (popup)." : ""}`}
                        onClick={() => {
                          if (!interactive) return;
                          setPicker({ row: i, col: j });
                        }}
                        className={cn(
                          cnCell(v, interactive),
                          "flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-0.5 rounded-xl shadow-sm transition-[transform,box-shadow] duration-150",
                          interactive &&
                            "hover:scale-[1.02] hover:shadow-md active:scale-[0.98]",
                          !interactive && "cursor-default",
                          isPicked &&
                            "ring-primary ring-offset-background ring-2 ring-offset-2",
                        )}
                      >
                        <span className="text-lg font-bold tabular-nums leading-none tracking-tight">
                          {v}
                        </span>
                        <span
                          className={cn(
                            "max-w-full truncate px-0.5 text-[10px] font-medium leading-none",
                            v === 0
                              ? "text-muted-foreground/80"
                              : "opacity-90",
                          )}
                        >
                          {riskLegend.find((x) => x.level === v)?.label ?? "—"}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
          className="max-h-[min(90vh,32rem)]"
        >
          <DialogHeader>
            <p
              id="ros-cell-picker-title"
              className="font-heading flex items-center gap-2 text-lg font-semibold"
            >
              <Palette className="text-primary size-5 shrink-0" aria-hidden />
              Nivå for denne cellen
            </p>
            <p
              id="ros-cell-picker-desc"
              className="text-muted-foreground text-sm leading-relaxed"
            >
              Velg risikonivå med farge. Gjelder krysset{" "}
              <strong className="text-foreground">{pickerRowLabel}</strong>
              <span className="text-muted-foreground/80"> × </span>
              <strong className="text-foreground">{pickerColLabel}</strong>.
            </p>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-wrap gap-2 sm:gap-2.5">
              {([0, 1, 2, 3, 4, 5] as const).map((level) => {
                const current =
                  picker !== null
                    ? (matrixValues[picker.row]?.[picker.col] ?? 0)
                    : 0;
                const isActive = current === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => selectLevel(level)}
                    className={cn(
                      cnCell(level, true),
                      "flex min-h-[3.25rem] min-w-[5rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98] sm:min-w-[5.5rem]",
                      isActive &&
                        "ring-primary ring-offset-background ring-2 ring-offset-2",
                    )}
                  >
                    <span className="text-lg font-bold tabular-nums leading-none">
                      {level}
                    </span>
                    <span className="max-w-[6rem] truncate text-[10px] font-semibold leading-tight">
                      {riskLegend.find((x) => x.level === level)?.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-muted-foreground mt-4 text-[11px] leading-relaxed">
              Cellefargen i matrisen oppdateres med en gang. Bruk «Lagre
              endringer» øverst på siden for å lagre hele analysen til server.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePicker}>
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium">
          Risikonivå (skala)
        </p>
        <div
          className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-muted/20 p-2"
          role="list"
        >
          {riskLegend.map(({ level, label }) => (
            <span
              key={level}
              role="listitem"
              className={cn(
                cnCell(level, false),
                "inline-flex min-h-0 items-center rounded-lg px-2.5 py-1.5 text-[11px] font-medium shadow-sm",
              )}
            >
              <span className="tabular-nums font-bold">{level}</span>
              <span className="text-muted-foreground mx-1">·</span>
              {label}
            </span>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
        <MousePointerClick
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70"
          aria-hidden
        />
        <span>
          {interactive
            ? "Verdiene er veiledende for prioritering og må dokumenteres i notat eller rapport i tråd med deres metode."
            : "Matrise i visningsmodus."}
        </span>
      </p>
    </div>
  );
}
