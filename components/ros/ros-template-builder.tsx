"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { RosLabelLevelsEditor } from "@/components/ros/ros-label-levels-editor";
import { cellRiskClass } from "@/lib/ros-risk-colors";
import {
  DEFAULT_ROS_COL_AXIS,
  DEFAULT_ROS_COL_LABELS,
  DEFAULT_ROS_ROW_AXIS,
  DEFAULT_ROS_ROW_LABELS,
  positionRiskLevel,
  RISK_LEVEL_HINTS,
} from "@/lib/ros-defaults";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Check,
  Copy,
  Grid3x3,
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type PresetId = "standard5" | "compact4";

const PRESETS: { id: PresetId; rows: number; label: string; desc: string }[] = [
  { id: "standard5", rows: 5, label: "5 × 5", desc: "Anbefalt — standard risikomatrise" },
  { id: "compact4", rows: 4, label: "4 × 4", desc: "Kompakt for rask oversikt" },
];

const COMPACT_ROW = ["1 — Lav", "2 — Middels", "3 — Høy", "4 — Svært høy"];
const COMPACT_COL = ["1 — Ubetydelig", "2 — Moderat", "3 — Alvorlig", "4 — Katastrofal"];

function getPresetLabels(id: PresetId) {
  if (id === "compact4") {
    return {
      rowLabels: COMPACT_ROW,
      colLabels: COMPACT_COL,
      rowAxis: DEFAULT_ROS_ROW_AXIS,
      colAxis: DEFAULT_ROS_COL_AXIS,
    };
  }
  return {
    rowLabels: [...DEFAULT_ROS_ROW_LABELS],
    colLabels: [...DEFAULT_ROS_COL_LABELS],
    rowAxis: DEFAULT_ROS_ROW_AXIS,
    colAxis: DEFAULT_ROS_COL_AXIS,
  };
}

/* ------------------------------------------------------------------ */
/*  Live matrix preview                                                */
/* ------------------------------------------------------------------ */

function LiveMatrixPreview({
  rowLabels,
  colLabels,
  rowAxis,
  colAxis,
  customValues,
}: {
  rowLabels: string[];
  colLabels: string[];
  rowAxis: string;
  colAxis: string;
  customValues: number[][] | null;
}) {
  const rows = rowLabels.length;
  const cols = colLabels.length;

  const matrix = useMemo(() => {
    if (customValues) {
      return Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => customValues[r]?.[c] ?? positionRiskLevel(r, c, rows, cols)),
      );
    }
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => positionRiskLevel(r, c, rows, cols)),
    );
  }, [rows, cols, customValues]);

  if (rows < 2 || cols < 2) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-dashed bg-muted/10 text-muted-foreground text-sm">
        Definer minst 2 nivåer for å se forhåndsvisning
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl bg-card p-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-20 rounded-tl-xl bg-muted/40 p-2 text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {rowAxis}
                <br />
                <span className="font-normal normal-case text-muted-foreground/60">↓ {colAxis} →</span>
              </th>
              {colLabels.map((l, j) => (
                <th
                  key={j}
                  className="bg-muted/30 px-1 py-2 text-center text-[9px] font-medium text-muted-foreground"
                  title={l}
                >
                  <span className="block font-bold">{j + 1}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, displayIdx) => {
              const r = rows - 1 - displayIdx;
              return (
                <tr key={r}>
                  <td className="bg-muted/25 px-2 py-1 text-right text-[9px] font-medium text-muted-foreground">
                    <span className="font-bold">{r + 1}</span>
                  </td>
                  {colLabels.map((_, c) => {
                    const v = matrix[r]?.[c] ?? 0;
                    return (
                      <td key={c} className="p-0.5">
                        <div
                          className={cn(
                            "flex aspect-square items-center justify-center rounded-lg border text-[10px] font-bold tabular-nums transition-all",
                            cellRiskClass(v),
                          )}
                        >
                          {v}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((level) => (
          <div key={level} className="flex items-center gap-1">
            <div className={cn("size-3 rounded-sm border", cellRiskClass(level))} />
            <span className="text-[9px] text-muted-foreground">{RISK_LEVEL_HINTS[level]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom matrix values editor                                        */
/* ------------------------------------------------------------------ */

function MatrixValuesEditor({
  rowLabels,
  colLabels,
  values,
  onChange,
}: {
  rowLabels: string[];
  colLabels: string[];
  values: number[][] | null;
  onChange: (v: number[][] | null) => void;
}) {
  const rows = rowLabels.length;
  const cols = colLabels.length;

  const matrix = useMemo(() => {
    if (!values) return null;
    const m: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(values[r]?.[c] ?? 0);
      }
      m.push(row);
    }
    return m;
  }, [values, rows, cols]);

  const initMatrix = useCallback(() => {
    const m: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(positionRiskLevel(r, c, rows, cols));
      }
      m.push(row);
    }
    onChange(m);
  }, [rows, cols, onChange]);

  const cycleCell = useCallback(
    (r: number, c: number) => {
      if (!matrix) return;
      const next = matrix.map((row) => [...row]);
      next[r]![c] = ((next[r]![c]! % 5) + 1);
      onChange(next);
    },
    [matrix, onChange],
  );

  if (!matrix) {
    return (
      <div className="rounded-2xl bg-muted/10 px-4 py-3 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium">Egne risikoverdier</p>
            <p className="text-[10px] text-muted-foreground">Standard: beregnes automatisk fra celleposisjon</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="rounded-xl text-xs" onClick={initMatrix}>
            Tilpass verdier
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Egne risikoverdier
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl text-[10px] text-muted-foreground"
          onClick={() => onChange(null)}
        >
          Tilbakestill til auto
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-center text-xs">
          <thead>
            <tr>
              <th />
              {colLabels.map((_, c) => (
                <th key={c} className="pb-0.5 font-medium text-muted-foreground text-[9px]">
                  {c + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, displayIdx) => {
              const r = rows - 1 - displayIdx;
              return (
                <tr key={r}>
                  <td className="pr-1 text-right font-medium text-muted-foreground text-[9px]">
                    {r + 1}
                  </td>
                  {[...Array(cols)].map((_, c) => {
                    const val = matrix[r]?.[c] ?? 0;
                    return (
                      <td key={c}>
                        <button
                          type="button"
                          className={cn(
                            "flex size-7 items-center justify-center rounded-md border text-[10px] font-bold transition-all hover:scale-110",
                            cellRiskClass(val),
                          )}
                          onClick={() => cycleCell(r, c)}
                          title={`Rad ${r + 1}, Kol ${c + 1}: ${val}. Klikk for å endre.`}
                        >
                          {val}
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
      <p className="text-[9px] text-muted-foreground">Klikk en celle for å bla gjennom 1–5</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main builder dialog                                                */
/* ------------------------------------------------------------------ */

export type TemplateBuilderMode = "create" | "edit" | "duplicate";

export type TemplateBuilderProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TemplateBuilderMode;
  initialData?: {
    id?: Id<"rosTemplates">;
    name: string;
    description: string;
    rowAxis: string;
    colAxis: string;
    rowLabels: string[];
    colLabels: string[];
    rowDescs: string[];
    colDescs: string[];
    matrixValues: number[][] | null;
  };
  onSubmit: (data: {
    editingId: Id<"rosTemplates"> | null;
    name: string;
    description: string;
    rowAxis: string;
    colAxis: string;
    rowLabelsRaw: string;
    colLabelsRaw: string;
    rowDescs: string[];
    colDescs: string[];
    matrixValues: number[][] | null;
  }) => Promise<void>;
  busy: boolean;
};

export function RosTemplateBuilder({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  busy,
}: TemplateBuilderProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(null);
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [rowAxis, setRowAxis] = useState(initialData?.rowAxis ?? DEFAULT_ROS_ROW_AXIS);
  const [colAxis, setColAxis] = useState(initialData?.colAxis ?? DEFAULT_ROS_COL_AXIS);
  const [rowLabelsRaw, setRowLabelsRaw] = useState(initialData?.rowLabels.join("\n") ?? "");
  const [colLabelsRaw, setColLabelsRaw] = useState(initialData?.colLabels.join("\n") ?? "");
  const [rowDescs, setRowDescs] = useState<string[]>(initialData?.rowDescs ?? []);
  const [colDescs, setColDescs] = useState<string[]>(initialData?.colDescs ?? []);
  const [matrixValues, setMatrixValues] = useState<number[][] | null>(initialData?.matrixValues ?? null);

  useEffect(() => {
    if (!open) return;
    setSelectedPreset(null);
    setName(initialData?.name ?? "");
    setDescription(initialData?.description ?? "");
    setRowAxis(initialData?.rowAxis ?? DEFAULT_ROS_ROW_AXIS);
    setColAxis(initialData?.colAxis ?? DEFAULT_ROS_COL_AXIS);
    setRowLabelsRaw(initialData?.rowLabels.join("\n") ?? "");
    setColLabelsRaw(initialData?.colLabels.join("\n") ?? "");
    setRowDescs(initialData?.rowDescs ?? []);
    setColDescs(initialData?.colDescs ?? []);
    setMatrixValues(initialData?.matrixValues ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initialData]);

  const resetToDefaults = useCallback(() => {
    setSelectedPreset(null);
    setName(initialData?.name ?? "");
    setDescription(initialData?.description ?? "");
    setRowAxis(initialData?.rowAxis ?? DEFAULT_ROS_ROW_AXIS);
    setColAxis(initialData?.colAxis ?? DEFAULT_ROS_COL_AXIS);
    setRowLabelsRaw(initialData?.rowLabels.join("\n") ?? "");
    setColLabelsRaw(initialData?.colLabels.join("\n") ?? "");
    setRowDescs(initialData?.rowDescs ?? []);
    setColDescs(initialData?.colDescs ?? []);
    setMatrixValues(initialData?.matrixValues ?? null);
  }, [initialData]);

  const applyPreset = useCallback((id: PresetId) => {
    setSelectedPreset(id);
    const p = getPresetLabels(id);
    setRowAxis(p.rowAxis);
    setColAxis(p.colAxis);
    setRowLabelsRaw(p.rowLabels.join("\n"));
    setColLabelsRaw(p.colLabels.join("\n"));
    setRowDescs([]);
    setColDescs([]);
    setMatrixValues(null);
  }, []);

  const previewRowLabels = useMemo(() => {
    const labels = rowLabelsRaw.split("\n").map((s) => s.trim()).filter(Boolean);
    return labels.length >= 2 ? labels : [...DEFAULT_ROS_ROW_LABELS];
  }, [rowLabelsRaw]);

  const previewColLabels = useMemo(() => {
    const labels = colLabelsRaw.split("\n").map((s) => s.trim()).filter(Boolean);
    return labels.length >= 2 ? labels : [...DEFAULT_ROS_COL_LABELS];
  }, [colLabelsRaw]);

  const matrixSize = `${previewRowLabels.length}×${previewColLabels.length}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      editingId: mode === "edit" ? (initialData?.id ?? null) : null,
      name,
      description,
      rowAxis,
      colAxis,
      rowLabelsRaw,
      colLabelsRaw,
      rowDescs,
      colDescs,
      matrixValues,
    });
  };

  const dialogTitle =
    mode === "edit"
      ? "Rediger mal"
      : mode === "duplicate"
        ? "Dupliser mal"
        : "Ny mal";

  const dialogSubtitle =
    mode === "edit"
      ? "Endre innstillinger for denne malen. Eksisterende analyser beholder sin kopi."
      : mode === "duplicate"
        ? "Opprett en kopi av malen som du kan tilpasse."
        : "Velg et utgangspunkt og tilpass til ditt behov.";

  const submitLabel =
    mode === "edit"
      ? "Lagre endringer"
      : mode === "duplicate"
        ? "Opprett kopi"
        : "Opprett mal";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetToDefaults();
      }}
    >
      <DialogContent
        size="2xl"
        titleId="ros-tpl-builder-title"
        descriptionId="ros-tpl-builder-desc"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              {mode === "duplicate" ? (
                <Copy className="size-5 text-primary" />
              ) : (
                <LayoutGrid className="size-5 text-primary" />
              )}
            </div>
            <div>
              <p id="ros-tpl-builder-title" className="font-heading text-lg font-semibold">
                {dialogTitle}
              </p>
              <p id="ros-tpl-builder-desc" className="text-muted-foreground text-sm">
                {dialogSubtitle}
              </p>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          <form
            id="ros-template-builder-form"
            onSubmit={(e) => void handleSubmit(e)}
            className="space-y-6"
          >
            {/* Section A: Presets (only in create mode) */}
            {mode === "create" && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Velg utgangspunkt
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-200 ring-1",
                        selectedPreset === p.id
                          ? "bg-primary/5 ring-primary/40 shadow-md"
                          : "bg-card ring-black/[0.04] hover:ring-primary/20 hover:shadow-sm dark:ring-white/[0.06]",
                      )}
                    >
                      <div className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                        selectedPreset === p.id ? "bg-primary/15" : "bg-muted/50",
                      )}>
                        {selectedPreset === p.id ? (
                          <Check className="size-4 text-primary" />
                        ) : (
                          <Grid3x3 className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{p.label}</p>
                        <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section B + C + Preview in two-column layout */}
            <div className="grid gap-6 lg:grid-cols-[1fr,280px]">
              {/* Left: Settings */}
              <div className="space-y-5">
                {/* Section B: Basic info */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Grunnleggende
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-b-name" className="text-xs">Navn på mal</Label>
                    <Input
                      id="tpl-b-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="F.eks. Standard ROS 5×5"
                      required
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-b-desc" className="text-xs">Beskrivelse (valgfritt)</Label>
                    <Textarea
                      id="tpl-b-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="min-h-0 resize-y rounded-xl"
                      placeholder="Kort beskrivelse av når denne malen brukes"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="tpl-b-raxis" className="text-xs">Akse rader</Label>
                      <Input
                        id="tpl-b-raxis"
                        value={rowAxis}
                        onChange={(e) => setRowAxis(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tpl-b-caxis" className="text-xs">Akse kolonner</Label>
                      <Input
                        id="tpl-b-caxis"
                        value={colAxis}
                        onChange={(e) => setColAxis(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Section C: Axis levels */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Nivådefinisjoner
                    </p>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
                      {matrixSize}
                    </span>
                  </div>
                  <RosLabelLevelsEditor
                    id="tpl-b-rows"
                    title={`${rowAxis} — nivåer`}
                    intro=""
                    value={rowLabelsRaw}
                    onChange={setRowLabelsRaw}
                    defaultLabels={DEFAULT_ROS_ROW_LABELS}
                    lowEndHint="lavest"
                    highEndHint="høyest"
                    descriptions={rowDescs}
                    onDescriptionsChange={setRowDescs}
                  />
                  <RosLabelLevelsEditor
                    id="tpl-b-cols"
                    title={`${colAxis} — nivåer`}
                    intro=""
                    value={colLabelsRaw}
                    onChange={setColLabelsRaw}
                    defaultLabels={DEFAULT_ROS_COL_LABELS}
                    lowEndHint="lavest"
                    highEndHint="høyest"
                    descriptions={colDescs}
                    onDescriptionsChange={setColDescs}
                  />
                </div>

                {/* Section D: Custom risk values */}
                <MatrixValuesEditor
                  rowLabels={previewRowLabels}
                  colLabels={previewColLabels}
                  values={matrixValues}
                  onChange={setMatrixValues}
                />
              </div>

              {/* Right: Live preview (sticky) */}
              <div className="lg:sticky lg:top-0 lg:self-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-3.5 text-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Forhåndsvisning
                    </p>
                  </div>
                  <LiveMatrixPreview
                    rowLabels={previewRowLabels}
                    colLabels={previewColLabels}
                    rowAxis={rowAxis}
                    colAxis={colAxis}
                    customValues={matrixValues}
                  />
                  <div className="rounded-xl bg-muted/15 px-3 py-2 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Mal</strong> definerer rammeverket.{" "}
                      <strong className="text-foreground">Analyse</strong> bruker malen for å plassere risikoer i rutenettet.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Avbryt
          </Button>
          {mode === "edit" && (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                void onSubmit({
                  editingId: null,
                  name: name ? `${name} (kopi)` : "Kopi",
                  description,
                  rowAxis,
                  colAxis,
                  rowLabelsRaw,
                  colLabelsRaw,
                  rowDescs,
                  colDescs,
                  matrixValues,
                });
              }}
              disabled={busy}
            >
              <Copy className="mr-1.5 size-3.5" />
              Lagre som kopi
            </Button>
          )}
          <Button
            type="submit"
            form="ros-template-builder-form"
            className="rounded-xl"
            disabled={busy || !name.trim()}
          >
            {busy ? "Lagrer …" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
