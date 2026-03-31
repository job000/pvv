"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { legendItems, cnCell } from "@/lib/ros-risk-colors";
import {
  ROS_CELL_FLAG_REQUIRES_ACTION,
  ROS_CELL_FLAG_WATCH,
  newRosCellItemId,
  type RosCellItem,
  type RosCellItemMatrix,
} from "@/lib/ros-cell-items";
import { RISK_LEVEL_HINTS } from "@/lib/ros-defaults";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Eye,
  Grid3x3,
  Info,
  MousePointerClick,
  Palette,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
};

type PickerTarget = { row: number; col: number };

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
}: Props) {
  const interactive = Boolean(onCellChange) && !readOnly;
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const lastJumpNonce = useRef<number | null>(null);
  const riskLegend = useMemo(() => legendItems(), []);

  const pickerItems =
    picker === null
      ? []
      : (cellItems[picker.row]?.[picker.col] ?? []);


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

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/30 via-card to-card p-4 shadow-sm">
        <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
          <Grid3x3 className="size-3.5 shrink-0" aria-hidden />
          Slik bruker du matrisen
        </p>
        <div className="space-y-2 text-sm leading-relaxed">
          <p>
            <strong>Klikk en celle</strong> for å legge inn risikopunkter og
            sette nivå (0–5). Hvert kryss i matrisen representerer en kombinasjon
            av{" "}
            <span className="font-medium">{rowAxisTitle.toLowerCase()}</span> og{" "}
            <span className="font-medium">{colAxisTitle.toLowerCase()}</span>.
          </p>
          <ul className="text-muted-foreground grid gap-1.5 text-xs sm:grid-cols-2">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold">
                2
              </span>
              <span>
                <strong className="text-foreground">Nivå</strong> = samlet
                risikovurdering for alt i cellen (velg høyeste relevante)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-500" aria-hidden />
              <span>
                <strong className="text-foreground">Krever handling</strong> —
                flagg for oppfølging i oversikten
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Eye className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
              <span>
                <strong className="text-foreground">Varsel</strong> — flagg for
                overvåking uten umiddelbar handling
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/40" />
              <span>
                <strong className="text-foreground">Punkt</strong> — risiko,
                trussel eller begrunnelse (flere per celle)
              </span>
            </li>
          </ul>
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
                  const items = cellItems[i]?.[j] ?? [];
                  const filledItems = items.filter(
                    (it) =>
                      it.text.trim() ||
                      it.flags?.includes(ROS_CELL_FLAG_WATCH) ||
                      it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION),
                  );
                  const hasContent = filledItems.length > 0;
                  const isPicked =
                    picker?.row === i && picker?.col === j && interactive;
                  return (
                    <td key={j} className="p-1 align-top">
                      <button
                        id={`ros-mx-cell-${i}-${j}`}
                        type="button"
                        disabled={!interactive}
                        aria-pressed={isPicked}
                        aria-label={`Celle ${rowLabel}, ${colLabels[j] ?? `kolonne ${j + 1}`}. Nivå ${v} ${RISK_LEVEL_HINTS[v] ?? ""}. ${filledItems.length} punkt${filledItems.length !== 1 ? "er" : ""}. ${interactive ? "Klikk for å redigere." : ""}`}
                        onClick={() => {
                          if (!interactive) return;
                          setPicker({ row: i, col: j });
                        }}
                        className={cn(
                          cnCell(v, interactive),
                          "relative flex w-full flex-col rounded-xl shadow-sm transition-[transform,box-shadow] duration-150",
                          hasContent
                            ? "min-h-[4.5rem] items-stretch gap-0 p-0"
                            : "min-h-[3.5rem] items-center justify-center gap-0.5",
                          interactive &&
                            "hover:scale-[1.01] hover:shadow-md active:scale-[0.99]",
                          !interactive && "cursor-default",
                          isPicked &&
                            "ring-primary ring-offset-background ring-2 ring-offset-2",
                        )}
                      >
                        {hasContent ? (
                          <>
                            <span className="flex items-center gap-1 px-1.5 pt-1 pb-0.5">
                              <span className="inline-flex size-5 items-center justify-center rounded-md bg-black/10 text-[10px] font-bold tabular-nums leading-none dark:bg-white/15">
                                {v}
                              </span>
                              <span className="truncate text-[10px] font-semibold leading-none opacity-80">
                                {riskLegend.find((x) => x.level === v)?.label ?? "—"}
                              </span>
                            </span>
                            <span className="flex flex-1 flex-col gap-0.5 px-1.5 pb-1.5">
                              {filledItems.slice(0, 3).map((it, idx) => {
                                const hasWatch = it.flags?.includes(ROS_CELL_FLAG_WATCH);
                                const hasAction = it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION);
                                return (
                                  <span
                                    key={it.id}
                                    className="flex items-start gap-0.5 text-left"
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
                                    <span className="line-clamp-2 text-[10px] leading-tight">
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
                          </>
                        )}
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
          className="max-h-[min(92vh,40rem)] overflow-y-auto"
        >
          <DialogHeader>
            <p
              id="ros-cell-picker-title"
              className="font-heading flex items-center gap-2 text-lg font-semibold"
            >
              <Palette className="text-primary size-5 shrink-0" aria-hidden />
              {pickerRowLabel} × {pickerColLabel}
              {picker !== null ? (
                <span
                  className={cn(
                    cnCell(matrixValues[picker.row]?.[picker.col] ?? 0, false),
                    "ml-auto inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold tabular-nums shadow-sm",
                  )}
                >
                  Nivå {matrixValues[picker.row]?.[picker.col] ?? 0}
                </span>
              ) : null}
            </p>
            <p
              id="ros-cell-picker-desc"
              className="text-muted-foreground text-sm leading-relaxed"
            >
              Velg samlet risikonivå for dette krysset. Nivået gjelder{" "}
              <strong className="text-foreground">hele cellen</strong> — alle
              punkter vurdert under ett.
            </p>
          </DialogHeader>
          <DialogBody>
            {onCellItemsChange && picker ? (
              <div className="mb-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-foreground text-sm font-semibold">
                    Risikopunkter i denne cellen
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      updateItemAt(picker.row, picker.col, [
                        ...pickerItems,
                        { id: newRosCellItemId(), text: "" },
                      ]);
                    }}
                  >
                    <Plus className="mr-1.5 size-4" />
                    Legg til punkt
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Beskriv hvert risikoforhold, trussel eller scenario som gjelder
                  dette krysset. Du kan legge inn flere punkter — alle vises
                  direkte i matrisen.
                </p>
                {pickerItems.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4">
                    <Info className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <p className="text-muted-foreground text-sm">
                      Ingen punkter ennå — trykk «Legg til punkt» for å starte.
                    </p>
                  </div>
                ) : null}
                <ul className="space-y-3">
                  {pickerItems.map((it, idx) => (
                    <li
                      key={it.id}
                      className="bg-muted/25 space-y-2 rounded-xl border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-muted-foreground text-xs font-medium">
                          Punkt {idx + 1}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive size-8 shrink-0"
                          aria-label="Fjern punkt"
                          onClick={() => {
                            updateItemAt(
                              picker.row,
                              picker.col,
                              pickerItems.filter((x) => x.id !== it.id),
                            );
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={it.text}
                        onChange={(e) =>
                          patchItem(picker.row, picker.col, it.id, {
                            text: e.target.value,
                          })
                        }
                        placeholder="Beskriv risiko, scenario, referanse …"
                        rows={2}
                        className="min-h-[3rem] resize-y text-sm"
                      />
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`ros-watch-${it.id}`}
                            checked={it.flags?.includes(ROS_CELL_FLAG_WATCH) ?? false}
                            onCheckedChange={(c) =>
                              patchItem(picker.row, picker.col, it.id, {
                                flags: toggleFlag(
                                  it.flags,
                                  ROS_CELL_FLAG_WATCH,
                                  Boolean(c),
                                ),
                              })
                            }
                          />
                          <Label
                            htmlFor={`ros-watch-${it.id}`}
                            className="cursor-pointer text-sm font-normal"
                          >
                            <Eye className="mr-1 inline size-3.5 text-amber-500" aria-hidden />
                            Varsel
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`ros-act-${it.id}`}
                            checked={
                              it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION) ??
                              false
                            }
                            onCheckedChange={(c) =>
                              patchItem(picker.row, picker.col, it.id, {
                                flags: toggleFlag(
                                  it.flags,
                                  ROS_CELL_FLAG_REQUIRES_ACTION,
                                  Boolean(c),
                                ),
                              })
                            }
                          />
                          <Label
                            htmlFor={`ros-act-${it.id}`}
                            className="cursor-pointer text-sm font-normal"
                          >
                            <AlertTriangle className="mr-1 inline size-3.5 text-red-500" aria-hidden />
                            Krever handling
                          </Label>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mb-2 space-y-2">
              <Label className="text-foreground text-sm font-semibold">
                Samlet risikonivå for denne cellen
              </Label>
              {pickerItems.length > 1 ? (
                <div className="flex items-start gap-2 rounded-lg border border-blue-500/25 bg-blue-500/[0.06] px-3 py-2">
                  <Info className="text-blue-500 mt-0.5 size-4 shrink-0" aria-hidden />
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    <strong className="text-foreground">
                      {pickerItems.length} punkter i denne cellen.
                    </strong>{" "}
                    Velg nivået for den{" "}
                    <strong className="text-foreground">
                      høyeste relevante risikoen
                    </strong>{" "}
                    (worst case). Nivået gjelder samlet for alle punkter.
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Velg det risikonivået som best beskriver denne cellen. 0 = ikke
                  vurdert, 5 = kritisk.
                </p>
              )}
            </div>
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
              Cellefargen oppdateres med en gang lokalt. «Lagre endringer» sender
              matrise og punkter til server og loggfører nivåendringer.
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
            ? "Verdiene er veiledende for prioritering og må dokumenteres i tråd med deres metode."
            : "Matrise i visningsmodus."}
        </span>
      </p>
    </div>
  );
}
