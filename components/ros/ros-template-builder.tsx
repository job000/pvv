"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
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
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  LayoutGrid,
} from "lucide-react";
import { useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Presets — valg, ikke fritekst                                       */
/* ------------------------------------------------------------------ */

type MatrixSize = 3 | 4 | 5;

type LabelScheme = {
  id: string;
  name: string;
  hint: string;
  labels: string[];
};

const SIZE_OPTIONS: {
  size: MatrixSize;
  label: string;
  desc: string;
  recommended?: boolean;
}[] = [
  { size: 5, label: "5 × 5", desc: "Standard risikomatrise", recommended: true },
  { size: 4, label: "4 × 4", desc: "Kompakt oversikt" },
  { size: 3, label: "3 × 3", desc: "Enkel triage" },
];

const PROB_SCHEMES: Record<MatrixSize, LabelScheme[]> = {
  5: [
    {
      id: "standard",
      name: "Standard",
      hint: "Svært lav → svært høy",
      labels: [...DEFAULT_ROS_ROW_LABELS],
    },
    {
      id: "frequency",
      name: "Frekvens",
      hint: "Hvor ofte det kan skje",
      labels: [
        "1 — Sjeldnere enn hvert 5. år",
        "2 — Omtrent årlig",
        "3 — Flere ganger i året",
        "4 — Månedlig eller ukentlig",
        "5 — Daglig eller nesten kontinuerlig",
      ],
    },
    {
      id: "simple",
      name: "Enkel",
      hint: "Korte etiketter",
      labels: [
        "1 — Lav",
        "2 — Middels",
        "3 — Høy",
        "4 — Svært høy",
        "5 — Nesten sikker",
      ],
    },
  ],
  4: [
    {
      id: "standard",
      name: "Standard",
      hint: "Lav → svært høy",
      labels: ["1 — Lav", "2 — Middels", "3 — Høy", "4 — Svært høy"],
    },
    {
      id: "frequency",
      name: "Frekvens",
      hint: "Hvor ofte det kan skje",
      labels: [
        "1 — Sjeldent",
        "2 — Av og til",
        "3 — Ofte",
        "4 — Svært ofte",
      ],
    },
    {
      id: "simple",
      name: "Enkel",
      hint: "Korte etiketter",
      labels: ["1 — Lav", "2 — Middels", "3 — Høy", "4 — Kritisk"],
    },
  ],
  3: [
    {
      id: "standard",
      name: "Standard",
      hint: "Lav → høy",
      labels: ["1 — Lav", "2 — Middels", "3 — Høy"],
    },
    {
      id: "frequency",
      name: "Frekvens",
      hint: "Sjelden → ofte",
      labels: ["1 — Sjelden", "2 — Mulig", "3 — Sannsynlig"],
    },
    {
      id: "simple",
      name: "Enkel",
      hint: "Korte etiketter",
      labels: ["1 — Lav", "2 — Middels", "3 — Kritisk"],
    },
  ],
};

const CONS_SCHEMES: Record<MatrixSize, LabelScheme[]> = {
  5: [
    {
      id: "standard",
      name: "Standard",
      hint: "Ubetydelig → kritisk",
      labels: [...DEFAULT_ROS_COL_LABELS],
    },
    {
      id: "ops",
      name: "Drift og tjeneste",
      hint: "Påvirkning på drift",
      labels: [
        "1 — Ubetydelig",
        "2 — Begrenset",
        "3 — Betydelig",
        "4 — Alvorlig",
        "5 — Katastrofal",
      ],
    },
    {
      id: "simple",
      name: "Enkel",
      hint: "Korte etiketter",
      labels: [
        "1 — Lav",
        "2 — Middels",
        "3 — Høy",
        "4 — Svært høy",
        "5 — Kritisk",
      ],
    },
  ],
  4: [
    {
      id: "standard",
      name: "Standard",
      hint: "Ubetydelig → katastrofal",
      labels: [
        "1 — Ubetydelig",
        "2 — Moderat",
        "3 — Alvorlig",
        "4 — Katastrofal",
      ],
    },
    {
      id: "ops",
      name: "Drift og tjeneste",
      hint: "Påvirkning på drift",
      labels: [
        "1 — Begrenset",
        "2 — Betydelig",
        "3 — Alvorlig",
        "4 — Kritisk",
      ],
    },
    {
      id: "simple",
      name: "Enkel",
      hint: "Korte etiketter",
      labels: ["1 — Lav", "2 — Middels", "3 — Høy", "4 — Kritisk"],
    },
  ],
  3: [
    {
      id: "standard",
      name: "Standard",
      hint: "Lav → kritisk",
      labels: ["1 — Lav", "2 — Middels", "3 — Kritisk"],
    },
    {
      id: "ops",
      name: "Drift og tjeneste",
      hint: "Påvirkning på drift",
      labels: ["1 — Begrenset", "2 — Alvorlig", "3 — Katastrofal"],
    },
    {
      id: "simple",
      name: "Enkel",
      hint: "Korte etiketter",
      labels: ["1 — Lav", "2 — Middels", "3 — Høy"],
    },
  ],
};

const NAME_SUGGESTIONS: Record<MatrixSize, string[]> = {
  5: ["Standard ROS 5×5", "Avdelings-ROS", "Grovanalyse 5×5"],
  4: ["Kompakt ROS 4×4", "Rask oversikt 4×4", "Team-ROS 4×4"],
  3: ["Enkel ROS 3×3", "Triage 3×3", "Hurtigvurdering"],
};

const DESC_CHIPS = [
  "Standard for arbeidsområdet",
  "Til daglig bruk i teamet",
  "For raske gjennomganger",
  "Tilpasset grove analyser",
] as const;

type BuilderStep = "size" | "levels" | "colors" | "name";

function buildAutoMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => positionRiskLevel(r, c, rows, cols)),
  );
}

function MiniMatrix({ size }: { size: MatrixSize }) {
  const cells = useMemo(() => buildAutoMatrix(size, size), [size]);
  return (
    <div
      className="grid gap-0.5"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {[...Array(size)].map((_, displayIdx) => {
        const r = size - 1 - displayIdx;
        return [...Array(size)].map((_, c) => (
          <div
            key={`${r}-${c}`}
            className={cn(
              "aspect-square rounded-[3px] border",
              cellRiskClass(cells[r]?.[c] ?? 1),
            )}
          />
        ));
      })}
    </div>
  );
}

function SchemePicker({
  title,
  schemes,
  selectedId,
  onSelect,
}: {
  title: string;
  schemes: LabelScheme[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected = schemes.find((s) => s.id === selectedId) ?? schemes[0]!;
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {schemes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              selectedId === s.id
                ? "bg-foreground text-background"
                : "bg-muted/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{selected.hint}</p>
      <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50">
        {selected.labels.map((label, i) => (
          <li
            key={label}
            className="flex items-center gap-2 px-3 py-2 text-xs"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0 truncate text-foreground">
              {label.replace(/^\d+\s*[—–-]\s*/, "")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tekst + mønster i tillegg til farge — lesbart uten å skille grønn/rød. */
const RISK_LEVEL_A11Y: Record<
  number,
  { short: string; label: string; colorName: string; pattern: string }
> = {
  1: {
    short: "L",
    label: "Lav",
    colorName: "grønn",
    pattern: "bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgb(0_0_0/0.06)_3px,rgb(0_0_0/0.06)_4px)]",
  },
  2: {
    short: "ML",
    label: "Moderat lav",
    colorName: "lime",
    pattern: "bg-[repeating-linear-gradient(90deg,transparent,transparent_3px,rgb(0_0_0/0.06)_3px,rgb(0_0_0/0.06)_4px)]",
  },
  3: {
    short: "M",
    label: "Middels",
    colorName: "gul",
    pattern: "bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(0_0_0/0.07)_3px,rgb(0_0_0/0.07)_5px)]",
  },
  4: {
    short: "H",
    label: "Høy",
    colorName: "oransje",
    pattern: "bg-[repeating-linear-gradient(-45deg,transparent,transparent_2px,rgb(0_0_0/0.08)_2px,rgb(0_0_0/0.08)_4px)]",
  },
  5: {
    short: "K",
    label: "Kritisk",
    colorName: "rød",
    pattern: "bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgb(0_0_0/0.1)_2px,rgb(0_0_0/0.1)_4px)]",
  },
};

function riskLevelMeta(level: number) {
  return (
    RISK_LEVEL_A11Y[level] ?? {
      short: String(level),
      label: RISK_LEVEL_HINTS[level] ?? `Nivå ${level}`,
      colorName: "ukjent",
      pattern: "",
    }
  );
}

function InteractiveRiskMatrix({
  rowLabels,
  colLabels,
  values,
  onChange,
}: {
  rowLabels: string[];
  colLabels: string[];
  values: number[][];
  onChange: (next: number[][]) => void;
}) {
  const rows = rowLabels.length;
  const cols = colLabels.length;
  const [focused, setFocused] = useState<{ r: number; c: number } | null>(null);

  const cycleCell = (r: number, c: number) => {
    const next = values.map((row) => [...row]);
    const cur = next[r]?.[c] ?? 1;
    next[r]![c] = cur >= 5 ? 1 : cur + 1;
    onChange(next);
  };

  const focusedLevel =
    focused != null ? (values[focused.r]?.[focused.c] ?? 1) : null;
  const focusedMeta =
    focusedLevel != null ? riskLevelMeta(focusedLevel) : null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card p-3">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-16 p-1.5 text-left text-[10px] font-medium text-muted-foreground">
                <span className="block">Sannsynl.</span>
                <span className="font-normal text-muted-foreground/70">
                  ↓ Kons. →
                </span>
              </th>
              {colLabels.map((_, j) => (
                <th
                  key={j}
                  className="px-0.5 py-1 text-center text-[10px] font-semibold tabular-nums text-muted-foreground"
                >
                  {j + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, displayIdx) => {
              const r = rows - 1 - displayIdx;
              return (
                <tr key={r}>
                  <td className="pr-2 text-right text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {r + 1}
                  </td>
                  {colLabels.map((_, c) => {
                    const v = values[r]?.[c] ?? 1;
                    const meta = riskLevelMeta(v);
                    const isActive =
                      focused?.r === r && focused?.c === c;
                    return (
                      <td key={c} className="relative p-0.5">
                        <button
                          type="button"
                          onClick={() => cycleCell(r, c)}
                          onMouseEnter={() => setFocused({ r, c })}
                          onMouseLeave={() =>
                            setFocused((prev) =>
                              prev?.r === r && prev?.c === c ? null : prev,
                            )
                          }
                          onFocus={() => setFocused({ r, c })}
                          onBlur={() =>
                            setFocused((prev) =>
                              prev?.r === r && prev?.c === c ? null : prev,
                            )
                          }
                          className={cn(
                            "group relative flex aspect-square w-full min-w-[2.25rem] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border text-xs font-bold transition-[transform,box-shadow] hover:z-10 hover:scale-105 hover:shadow-md focus-visible:z-10 focus-visible:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground active:scale-95",
                            cellRiskClass(v),
                            meta.pattern,
                            isActive && "ring-2 ring-foreground/70 ring-offset-1",
                          )}
                          title={`Nivå ${v} — ${meta.label} (${meta.colorName}). Klikk for å endre.`}
                          aria-label={`Rad ${r + 1}, kolonne ${c + 1}: nivå ${v}, ${meta.label}, farge ${meta.colorName}. Klikk for å endre.`}
                        >
                          <span className="relative z-[1] tabular-nums leading-none">
                            {v}
                          </span>
                          <span className="relative z-[1] text-[9px] font-semibold uppercase tracking-wide opacity-80">
                            {meta.short}
                          </span>
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

      {/* Live forklaring ved hover/fokus — ikke bare farge */}
      <div
        className={cn(
          "flex min-h-[2.75rem] items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
          focusedMeta
            ? "border-border/60 bg-muted/30"
            : "border-dashed border-border/40 bg-transparent",
        )}
        aria-live="polite"
      >
        {focusedMeta && focusedLevel != null && focused ? (
          <>
            <div
              className={cn(
                "flex size-9 shrink-0 flex-col items-center justify-center rounded-lg border text-[10px] font-bold",
                cellRiskClass(focusedLevel),
                focusedMeta.pattern,
              )}
              aria-hidden
            >
              <span className="tabular-nums leading-none">{focusedLevel}</span>
              <span className="uppercase opacity-80">{focusedMeta.short}</span>
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-foreground">
                Nivå {focusedLevel} — {focusedMeta.label}
              </p>
              <p className="text-xs text-muted-foreground">
                Farge: {focusedMeta.colorName}
                {" · "}
                Celle S{focused.r + 1}×K{focused.c + 1}
                {" · "}
                Klikk for neste nivå
              </p>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Hold over eller fokuser en celle for å se nivå, fargenavn og bokstavkode
            (L / ML / M / H / K).
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Risikonivåer">
        {[1, 2, 3, 4, 5].map((level) => {
          const meta = riskLevelMeta(level);
          return (
            <div
              key={level}
              role="listitem"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2 py-1 text-[10px]",
                cellRiskClass(level),
              )}
              title={`Nivå ${level}: ${meta.label} (${meta.colorName})`}
            >
              <span className="font-bold tabular-nums">{level}</span>
              <span className="font-semibold uppercase">{meta.short}</span>
              <span className="font-medium">{meta.label}</span>
              <span className="opacity-70">· {meta.colorName}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tall + bokstavkode fungerer uten fargesyn. Nivå 4–5 (H/K) telles som
        høy/kritisk.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main builder                                                       */
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

function inferSize(labels: string[] | undefined): MatrixSize {
  const n = labels?.length ?? 5;
  if (n <= 3) return 3;
  if (n === 4) return 4;
  return 5;
}

function matchSchemeId(
  schemes: LabelScheme[],
  labels: string[] | undefined,
): string {
  if (!labels?.length) return schemes[0]!.id;
  const joined = labels.join("\n");
  const hit = schemes.find((s) => s.labels.join("\n") === joined);
  return hit?.id ?? schemes[0]!.id;
}

function initBuilderState(
  mode: TemplateBuilderMode,
  initialData: TemplateBuilderProps["initialData"],
) {
  const nextSize = inferSize(initialData?.rowLabels);
  const probSchemes = PROB_SCHEMES[nextSize];
  const consSchemes = CONS_SCHEMES[nextSize];
  const pId = matchSchemeId(probSchemes, initialData?.rowLabels);
  const cId = matchSchemeId(consSchemes, initialData?.colLabels);
  const rows =
    initialData?.rowLabels?.length && initialData.rowLabels.length >= 2
      ? initialData.rowLabels
      : [...(probSchemes.find((s) => s.id === pId) ?? probSchemes[0]!).labels];
  const cols =
    initialData?.colLabels?.length && initialData.colLabels.length >= 2
      ? initialData.colLabels
      : [...(consSchemes.find((s) => s.id === cId) ?? consSchemes[0]!).labels];

  return {
    size: nextSize,
    probSchemeId: pId,
    consSchemeId: cId,
    rowLabels: rows,
    colLabels: cols,
    matrixValues:
      initialData?.matrixValues ?? buildAutoMatrix(rows.length, cols.length),
    name:
      initialData?.name?.trim() ||
      (mode === "create" ? (NAME_SUGGESTIONS[nextSize][0] ?? "") : ""),
    description: initialData?.description ?? "",
    customName: mode !== "create",
    step: (mode === "create" ? "size" : "levels") as BuilderStep,
  };
}

export function RosTemplateBuilder({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  busy,
}: TemplateBuilderProps) {
  const sessionKey = `${mode}:${initialData?.id ?? "new"}:${open ? "open" : "closed"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <RosTemplateBuilderForm
          key={sessionKey}
          mode={mode}
          initialData={initialData}
          onSubmit={onSubmit}
          busy={busy}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function RosTemplateBuilderForm({
  mode,
  initialData,
  onSubmit,
  busy,
  onClose,
}: {
  mode: TemplateBuilderMode;
  initialData: TemplateBuilderProps["initialData"];
  onSubmit: TemplateBuilderProps["onSubmit"];
  busy: boolean;
  onClose: () => void;
}) {
  const createFlow = mode === "create";
  const steps = useMemo<BuilderStep[]>(
    () =>
      createFlow
        ? ["size", "levels", "colors", "name"]
        : ["levels", "colors", "name"],
    [createFlow],
  );

  const initial = useMemo(
    () => initBuilderState(mode, initialData),
    [mode, initialData],
  );

  const [step, setStep] = useState<BuilderStep>(initial.step);
  const [size, setSize] = useState<MatrixSize>(initial.size);
  const [probSchemeId, setProbSchemeId] = useState(initial.probSchemeId);
  const [consSchemeId, setConsSchemeId] = useState(initial.consSchemeId);
  const [rowLabels, setRowLabels] = useState<string[]>(initial.rowLabels);
  const [colLabels, setColLabels] = useState<string[]>(initial.colLabels);
  const [matrixValues, setMatrixValues] = useState<number[][]>(
    initial.matrixValues,
  );
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [customName, setCustomName] = useState(initial.customName);

  const applySize = (next: MatrixSize) => {
    setSize(next);
    const prob = PROB_SCHEMES[next][0]!;
    const cons = CONS_SCHEMES[next][0]!;
    setProbSchemeId(prob.id);
    setConsSchemeId(cons.id);
    setRowLabels([...prob.labels]);
    setColLabels([...cons.labels]);
    setMatrixValues(buildAutoMatrix(next, next));
    if (!customName) {
      setName(NAME_SUGGESTIONS[next][0] ?? `ROS ${next}×${next}`);
    }
  };

  const applyProbScheme = (id: string) => {
    setProbSchemeId(id);
    const scheme = PROB_SCHEMES[size].find((s) => s.id === id);
    if (!scheme) return;
    setRowLabels([...scheme.labels]);
    setMatrixValues(buildAutoMatrix(scheme.labels.length, colLabels.length));
  };

  const applyConsScheme = (id: string) => {
    setConsSchemeId(id);
    const scheme = CONS_SCHEMES[size].find((s) => s.id === id);
    if (!scheme) return;
    setColLabels([...scheme.labels]);
    setMatrixValues(buildAutoMatrix(rowLabels.length, scheme.labels.length));
  };

  const stepIndex = steps.indexOf(step);
  const canGoNext = step !== "name";
  const canGoBack = stepIndex > 0;

  const goNext = () => {
    if (stepIndex < steps.length - 1) setStep(steps[stepIndex + 1]!);
  };
  const goBack = () => {
    if (stepIndex > 0) setStep(steps[stepIndex - 1]!);
  };

  const handleSubmit = async () => {
    const finalName =
      name.trim() ||
      NAME_SUGGESTIONS[size][0] ||
      `ROS ${rowLabels.length}×${colLabels.length}`;
    await onSubmit({
      editingId: mode === "edit" ? (initialData?.id ?? null) : null,
      name: finalName,
      description,
      rowAxis: DEFAULT_ROS_ROW_AXIS,
      colAxis: DEFAULT_ROS_COL_AXIS,
      rowLabelsRaw: rowLabels.join("\n"),
      colLabelsRaw: colLabels.join("\n"),
      rowDescs: [],
      colDescs: [],
      matrixValues,
    });
  };

  const dialogTitle =
    mode === "edit"
      ? "Rediger mal"
      : mode === "duplicate"
        ? "Dupliser mal"
        : "Ny ROS-mal";

  const stepLabels: Record<BuilderStep, string> = {
    size: "Matrise",
    levels: "Nivåer",
    colors: "Farger",
    name: "Navn",
  };

  return (
      <DialogContent
        size="2xl"
        titleId="ros-tpl-builder-title"
        descriptionId="ros-tpl-builder-desc"
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              {mode === "duplicate" ? (
                <Copy className="size-5 text-foreground" />
              ) : (
                <LayoutGrid className="size-5 text-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p
                  id="ros-tpl-builder-title"
                  className="font-heading text-lg font-semibold"
                >
                  {dialogTitle}
                </p>
                <p
                  id="ros-tpl-builder-desc"
                  className="text-sm text-muted-foreground"
                >
                  Sannsynlighet × konsekvens med farger og kritisk nivå.
                </p>
              </div>
              <ol className="flex flex-wrap gap-1.5" aria-label="Steg">
                {steps.map((s, i) => {
                  const active = s === step;
                  const done = i < stepIndex;
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => {
                          if (i <= stepIndex || done) setStep(s);
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                          active
                            ? "bg-foreground text-background"
                            : done
                              ? "bg-muted text-foreground"
                              : "bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {done ? (
                          <Check className="size-3" aria-hidden />
                        ) : (
                          <span className="tabular-nums">{i + 1}</span>
                        )}
                        {stepLabels[s]}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {step === "size" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Velg størrelse på risikomatrisen.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {SIZE_OPTIONS.map((opt) => {
                  const active = size === opt.size;
                  return (
                    <button
                      key={opt.size}
                      type="button"
                      onClick={() => applySize(opt.size)}
                      className={cn(
                        "flex flex-col gap-3 rounded-2xl border p-4 text-left transition-colors",
                        active
                          ? "border-foreground bg-muted/30"
                          : "border-border/50 hover:border-border hover:bg-muted/20",
                      )}
                    >
                      <div className="mx-auto w-full max-w-[7rem]">
                        <MiniMatrix size={opt.size} />
                      </div>
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          {opt.label}
                          {opt.recommended ? (
                            <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
                              Anbefalt
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === "levels" ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <SchemePicker
                title="Sannsynlighet"
                schemes={PROB_SCHEMES[size]}
                selectedId={probSchemeId}
                onSelect={applyProbScheme}
              />
              <SchemePicker
                title="Konsekvens"
                schemes={CONS_SCHEMES[size]}
                selectedId={consSchemeId}
                onSelect={applyConsScheme}
              />
            </div>
          ) : null}

          {step === "colors" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Sett risikonivå per celle. Tall, bokstav og fargenavn — ikke bare farge.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full"
                  onClick={() =>
                    setMatrixValues(
                      buildAutoMatrix(rowLabels.length, colLabels.length),
                    )
                  }
                >
                  Standard heatmap
                </Button>
              </div>
              <InteractiveRiskMatrix
                rowLabels={rowLabels}
                colLabels={colLabels}
                values={matrixValues}
                onChange={setMatrixValues}
              />
            </div>
          ) : null}

          {step === "name" ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Velg eller skriv navn
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {NAME_SUGGESTIONS[size].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setName(suggestion);
                        setCustomName(false);
                      }}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                        name === suggestion && !customName
                          ? "bg-foreground text-background"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setCustomName(true);
                  }}
                  placeholder="Eget navn på malen"
                  className="h-11 rounded-full"
                  aria-label="Navn på mal"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Beskrivelse{" "}
                  <span className="font-normal text-muted-foreground">
                    (valgfritt)
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DESC_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() =>
                        setDescription((prev) => (prev === chip ? "" : chip))
                      }
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                        description === chip
                          ? "bg-foreground text-background"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-border/50 px-4 py-3 text-sm">
                <div className="flex items-baseline gap-2">
                  <dt className="text-muted-foreground">Matrise</dt>
                  <dd className="font-semibold tabular-nums">
                    {rowLabels.length}×{colLabels.length}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="text-muted-foreground">Sannsynlighet</dt>
                  <dd className="font-medium">
                    {PROB_SCHEMES[size].find((s) => s.id === probSchemeId)
                      ?.name ?? "Standard"}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="text-muted-foreground">Konsekvens</dt>
                  <dd className="font-medium">
                    {CONS_SCHEMES[size].find((s) => s.id === consSchemeId)
                      ?.name ?? "Standard"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {canGoBack ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={goBack}
              >
                <ArrowLeft className="mr-1.5 size-3.5" aria-hidden />
                Tilbake
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={onClose}
              >
                Avbryt
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {canGoNext ? (
              <Button
                type="button"
                className="rounded-full bg-foreground px-5 text-background hover:opacity-90"
                onClick={goNext}
              >
                Neste
                <ArrowRight className="ml-1.5 size-3.5" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-full bg-foreground px-5 text-background hover:opacity-90"
                disabled={busy || !name.trim()}
                onClick={() => void handleSubmit()}
              >
                {busy
                  ? "Lagrer …"
                  : mode === "edit"
                    ? "Lagre endringer"
                    : mode === "duplicate"
                      ? "Opprett kopi"
                      : "Opprett mal"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
  );
}
