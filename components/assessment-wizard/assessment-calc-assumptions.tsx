"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  annualCostFromHourlyRate,
  CALC_DEFAULTS,
  hourlyRateFromAnnualCost,
  laborCostBasisLabel,
  type LaborCostBasis,
  type WorkspaceCalcDefaults,
} from "@/lib/assessment-calc-config";
import type { AssessmentPayload } from "@/lib/assessment-types";
import { cn } from "@/lib/utils";
import { Calculator } from "lucide-react";

function numOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function AssessmentCalcAssumptions({
  payload,
  canEdit,
  workspaceDefaults,
  update,
  updateMany,
  compact = false,
}: {
  payload: AssessmentPayload;
  canEdit: boolean;
  workspaceDefaults: WorkspaceCalcDefaults;
  update: <K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) => void;
  updateMany: (patch: Partial<AssessmentPayload>) => void;
  compact?: boolean;
}) {
  const basis: LaborCostBasis =
    payload.laborCostBasis === "external" ? "external" : "own_staff";
  const workingDays = numOr(payload.workingDays, workspaceDefaults.workingDays);
  const workingHoursPerDay = numOr(
    payload.workingHoursPerDay,
    workspaceDefaults.workingHoursPerDay,
  );
  const hourly =
    typeof payload.hourlyLaborRate === "number" &&
    Number.isFinite(payload.hourlyLaborRate) &&
    payload.hourlyLaborRate > 0
      ? payload.hourlyLaborRate
      : hourlyRateFromAnnualCost(
          numOr(payload.avgCostPerYear, CALC_DEFAULTS.avgCostPerYearOwn),
          workingDays,
          workingHoursPerDay,
        );
  const annual = annualCostFromHourlyRate(
    hourly,
    workingDays,
    workingHoursPerDay,
  );

  function setBasis(next: LaborCostBasis) {
    if (!canEdit) return;
    const nextHourly =
      next === "external"
        ? workspaceDefaults.hourlyRateExternal
        : workspaceDefaults.hourlyRateOwnStaff;
    updateMany({
      laborCostBasis: next,
      hourlyLaborRate: nextHourly,
      avgCostPerYear: annualCostFromHourlyRate(
        nextHourly,
        workingDays,
        workingHoursPerDay,
      ),
    });
  }

  function setHourly(raw: number) {
    if (!canEdit) return;
    const next = Math.max(0, raw);
    updateMany({
      hourlyLaborRate: next,
      avgCostPerYear: annualCostFromHourlyRate(
        next,
        workingDays,
        workingHoursPerDay,
      ),
    });
  }

  function setCalendar(days: number, hours: number) {
    if (!canEdit) return;
    const d = Math.min(366, Math.max(1, Math.round(days)));
    const h = Math.min(24, Math.max(0.1, hours));
    updateMany({
      workingDays: d,
      workingHoursPerDay: h,
      avgCostPerYear: annualCostFromHourlyRate(hourly, d, h),
    });
  }

  return (
    <section
      className={cn(
        "rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        compact ? "p-4" : "p-5 sm:p-6",
      )}
    >
      <div className="flex items-start gap-2">
        <Calculator
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-foreground text-sm font-semibold">
            Kalkulasjonsforutsetninger
          </h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Besparelse i kroner = automasjonspotensial × (manuelle timer ×
            timepris). Myke gevinster (sikkerhet, at arbeidet blir gjort) er
            egne signaler — ikke oppfunnet i kroner.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
            Hvem utfører arbeidet i dag?
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["own_staff", "Egne ansatte"],
                ["external", "Eksterne / innleid"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={!canEdit}
                aria-pressed={basis === id}
                onClick={() => setBasis(id)}
                className={cn(
                  "h-10 rounded-full px-4 text-sm font-medium transition-colors",
                  basis === id
                    ? "bg-foreground text-background"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  !canEdit && "opacity-60",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            {basis === "own_staff"
              ? "Bruker timepris for egne ansatte (fullkost)."
              : "Bruker høyere timepris typisk for innleid kapasitet."}{" "}
            Standard for området:{" "}
            {laborCostBasisLabel(workspaceDefaults.laborCostBasis).toLowerCase()}
            .
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="calc-hourly">Timepris (kr/t)</Label>
            <Input
              id="calc-hourly"
              type="number"
              min={0}
              step={1}
              disabled={!canEdit}
              value={Number.isFinite(hourly) ? hourly : ""}
              onChange={(e) => setHourly(Number(e.target.value) || 0)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-annual">Årsverkskost (beregnet)</Label>
            <Input
              id="calc-annual"
              type="text"
              readOnly
              value={`${annual.toLocaleString("nb-NO")} kr`}
              className="h-10 rounded-xl bg-muted/30"
            />
            <p className="text-muted-foreground text-[10px]">
              timepris × {workingDays} dager × {workingHoursPerDay} t/dag
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-days">Arbeidsdager / år</Label>
            <Input
              id="calc-days"
              type="number"
              min={1}
              max={366}
              disabled={!canEdit}
              value={workingDays}
              onChange={(e) =>
                setCalendar(Number(e.target.value) || 1, workingHoursPerDay)
              }
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-hours">Timer / dag</Label>
            <Input
              id="calc-hours"
              type="number"
              min={0.1}
              max={24}
              step={0.1}
              disabled={!canEdit}
              value={workingHoursPerDay}
              onChange={(e) =>
                setCalendar(workingDays, Number(e.target.value) || 0.1)
              }
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-build">Byggekostnad (engang)</Label>
            <Input
              id="calc-build"
              type="number"
              min={0}
              disabled={!canEdit}
              value={payload.implementationBuildCost ?? workspaceDefaults.buildCost}
              onChange={(e) =>
                update("implementationBuildCost", Number(e.target.value) || 0)
              }
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-run">Årlig driftskostnad</Label>
            <Input
              id="calc-run"
              type="number"
              min={0}
              disabled={!canEdit}
              value={payload.annualRunCost ?? workspaceDefaults.annualRunCost}
              onChange={(e) =>
                update("annualRunCost", Number(e.target.value) || 0)
              }
              className="h-10 rounded-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
