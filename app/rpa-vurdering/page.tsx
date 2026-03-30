"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  automationPotentialPercent,
  clampLikert5,
  costPerYearAsIs,
  easeDifficultyLabel,
  easeOfImplementationBasePercent,
  easeOfImplementationFinalPercent,
  estimatedBenefitCurrencyPerYear,
  estimatedBenefitFte,
  estimatedBenefitHoursPerYear,
  feasibilityFeasible,
  fteRequired,
  perEmployee,
  totalHoursPerYear,
  type Likert5,
} from "@/lib/rpa-assessment/scoring";

function LikertRow({
  label,
  hint,
  value,
  onChange,
  left,
  right,
}: {
  label: string;
  hint?: string;
  value: Likert5;
  onChange: (v: Likert5) => void;
  left: string;
  right: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-zinc-200 py-4 dark:border-zinc-800 last:border-0">
      <div>
        <p className="font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
        {hint ? (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-24 shrink-0 text-xs text-zinc-500">{left}</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(clampLikert5(Number(e.target.value)))}
          className="h-2 flex-1 min-w-[8rem] accent-[#e31c24]"
        />
        <span className="w-24 shrink-0 text-right text-xs text-zinc-500">
          {right}
        </span>
        <span className="w-8 text-center font-mono text-sm tabular-nums text-zinc-800 dark:text-zinc-200">
          {value}
        </span>
      </div>
    </div>
  );
}

export default function RpaVurderingPage() {
  const [processName, setProcessName] = useState("");
  const [candidateId, setCandidateId] = useState("");

  const [processStability, setProcessStability] = useState<Likert5>(3);
  const [applicationStability, setApplicationStability] = useState<Likert5>(3);
  const [structuredInput, setStructuredInput] = useState<Likert5>(3);
  const [processVariability, setProcessVariability] = useState<Likert5>(3);
  const [digitization, setDigitization] = useState<Likert5>(3);
  const [processLength, setProcessLength] = useState<Likert5>(3);
  const [applicationCount, setApplicationCount] = useState<Likert5>(3);

  const [ocrRequired, setOcrRequired] = useState(false);
  const [thinClientPercent, setThinClientPercent] = useState(30);

  const [baselineHours, setBaselineHours] = useState(800);
  const [reworkHours, setReworkHours] = useState(50);
  const [auditHours, setAuditHours] = useState(40);
  const [avgCostPerYear, setAvgCostPerYear] = useState(850000);
  const [workingDays, setWorkingDays] = useState(230);
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState(7.5);
  const [employees, setEmployees] = useState(3);

  const results = useMemo(() => {
    const ap = automationPotentialPercent({
      structuredInput,
      processVariability,
      digitization,
    });
    const feasible = feasibilityFeasible({
      processStability,
      applicationStability,
    });
    const easeBase = easeOfImplementationBasePercent({
      processStability,
      applicationStability,
      structuredInput,
      processVariability,
      processLength,
      applicationCount,
    });
    const ease = easeOfImplementationFinalPercent({
      basePercent: easeBase,
      ocrRequired,
      thinClientPercent,
    });
    const hoursY = totalHoursPerYear({
      baselineHoursPerYear: baselineHours,
      reworkHoursPerYear: reworkHours,
      auditHoursPerYear: auditHours,
    });
    const fte = fteRequired({
      totalHoursPerYear: hoursY,
      workingDaysPerYear: workingDays,
      workingHoursPerDay: workingHoursPerDay,
    });
    const costY = costPerYearAsIs({
      averageEmployeeFullCostPerYear: avgCostPerYear,
      fteRequired: fte,
    });
    const benH = estimatedBenefitHoursPerYear({
      automationPotentialPercent: ap,
      totalHoursPerYear: hoursY,
    });
    const benC = estimatedBenefitCurrencyPerYear({
      automationPotentialPercent: ap,
      costPerYearAsIs: costY,
    });
    const benFte = estimatedBenefitFte({
      automationPotentialPercent: ap,
      fteRequired: fte,
    });
    return {
      ap,
      feasible,
      easeBase,
      ease,
      easeLabel: easeDifficultyLabel(ease),
      hoursY,
      fte,
      costY,
      benH,
      benC,
      benFte,
      benHPerEmp: perEmployee(benH, employees),
      benCPerEmp: perEmployee(benC, employees),
      benFtePerEmp: perEmployee(benFte, employees),
    };
  }, [
    processStability,
    applicationStability,
    structuredInput,
    processVariability,
    digitization,
    processLength,
    applicationCount,
    ocrRequired,
    thinClientPercent,
    baselineHours,
    reworkHours,
    auditHours,
    avgCostPerYear,
    workingDays,
    workingHoursPerDay,
    employees,
  ]);

  return (
    <div className="min-h-full bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-wide text-[#e31c24]">
            UiPath-stil · RPA-kandidat
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Prosessvurdering (RPA)
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Beregninger følger prinsippene i UiPath Automation Hub «Detailed Assessment»:
            automatiseringspotensial, gjennomførbarhet, implementasjonsgrad og årlige nytte-KPI-er.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Excel-malen «Process Vurdering Verktøy_Prod_MedMacro.xlsm» var ikke i repoet.
            Juster vekter i koden ved behov for å matche makroen nøyaktig.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-[#0067c6] underline hover:no-underline dark:text-sky-400"
          >
            ← Til forsiden
          </Link>
        </header>

        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Kandidat</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Prosessnavn
              </span>
              <input
                value={processName}
                onChange={(e) => setProcessName(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="F.eks. fakturamatching"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Prosess-ID / referanse
              </span>
              <input
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="Valgfritt"
              />
            </label>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Feasibility (gjennomførbarhet)</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Vurdering av prosess- og applikasjonsstabilitet.
          </p>
          <LikertRow
            label="Prosessstabilitet"
            hint="Endres prosessen sjelden?"
            value={processStability}
            onChange={setProcessStability}
            left="Ustabil"
            right="Stabil"
          />
          <LikertRow
            label="Applikasjonsstabilitet"
            hint="Oppdateringer og endringer i UI/API?"
            value={applicationStability}
            onChange={setApplicationStability}
            left="Ustabil"
            right="Stabil"
          />
          <p className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 font-medium dark:bg-zinc-800">
            {results.feasible
              ? "Feasibility: Ja"
              : "Feasibility: Nei (én eller begge stabiliteter under terskel)"}
          </p>
        </section>

        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Automation Potential</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Hvor stor del av prosessen kan forventes automatisert (0–100 %).
          </p>
          <LikertRow
            label="Struktur på inndata"
            value={structuredInput}
            onChange={setStructuredInput}
            left="Ustrukturert"
            right="Strukturert"
          />
          <LikertRow
            label="Prosessvariasjon"
            value={processVariability}
            onChange={setProcessVariability}
            left="Få varianter"
            right="Mange varianter"
          />
          <LikertRow
            label="Digitaliseringsgrad"
            value={digitization}
            onChange={setDigitization}
            left="Papir / manuelt"
            right="Digitalt"
          />
          <p className="mt-4 text-2xl font-semibold tabular-nums text-[#e31c24]">
            {results.ap.toFixed(1)} %
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            AP = 100 × (⅓·S_struct + ⅓·(1−V_var) + ⅓·S_dig) der S er 0–1 fra skala 1–5
          </p>
        </section>

        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Ease of Implementation</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Seks faktorer (gjennomsnitt), deretter OCR- og tynnklient-multiplikatorer.
          </p>
          <LikertRow
            label="Prosessstabilitet"
            value={processStability}
            onChange={setProcessStability}
            left="Ustabil"
            right="Stabil"
          />
          <LikertRow
            label="Applikasjonsstabilitet"
            value={applicationStability}
            onChange={setApplicationStability}
            left="Ustabil"
            right="Stabil"
          />
          <LikertRow
            label="Struktur på inndata"
            value={structuredInput}
            onChange={setStructuredInput}
            left="Ustrukturert"
            right="Strukturert"
          />
          <LikertRow
            label="Prosessvariasjon"
            value={processVariability}
            onChange={setProcessVariability}
            left="Få varianter"
            right="Mange varianter"
          />
          <LikertRow
            label="Prosesslengde"
            value={processLength}
            onChange={setProcessLength}
            left="Kort"
            right="Lang"
          />
          <LikertRow
            label="Antall applikasjoner"
            value={applicationCount}
            onChange={setApplicationCount}
            left="Få"
            right="Mange"
          />

          <div className="mt-6 flex flex-col gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={ocrRequired}
                onChange={(e) => setOcrRequired(e.target.checked)}
                className="size-4 accent-[#e31c24]"
              />
              <span>OCR nødvendig (skannede dokumenter)</span>
            </label>
            <div>
              <div className="flex justify-between text-sm">
                <span>Tynnklient-andel (%)</span>
                <span className="font-mono tabular-nums">{thinClientPercent}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={thinClientPercent}
                onChange={(e) => setThinClientPercent(Number(e.target.value))}
                className="mt-2 h-2 w-full accent-[#e31c24]"
              />
            </div>
          </div>

          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Grunnlag: {results.easeBase.toFixed(1)} % → endelig:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {results.ease.toFixed(1)} %
            </span>{" "}
            ({results.easeLabel}) — 65–100 % enkel, 35–65 % middels, 0–35 % vanskelig.
          </p>
          <p className="mt-2 font-mono text-xs text-zinc-500">
            Ease = Ease_base × m_OCR × m_tynnklient; m_OCR = 0,82 hvis OCR, ellers 1;
            m_tynnklient = 1 − 0,35·(p/100)
          </p>
        </section>

        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">KPI (1 år)</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Timer og kostnad som As-Is; nytte = Automation Potential × As-Is (jf. UiPath).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600">Grunnlag timer/år</span>
              <input
                type="number"
                min={0}
                value={baselineHours}
                onChange={(e) => setBaselineHours(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600">Omarbeid timer/år</span>
              <input
                type="number"
                min={0}
                value={reworkHours}
                onChange={(e) => setReworkHours(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600">Revisjon/audit timer/år</span>
              <input
                type="number"
                min={0}
                value={auditHours}
                onChange={(e) => setAuditHours(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600">
                Gj.snitt full kostnad ansatt/år (NOK)
              </span>
              <input
                type="number"
                min={0}
                value={avgCostPerYear}
                onChange={(e) => setAvgCostPerYear(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600">Arbeidsdager/år</span>
              <input
                type="number"
                min={1}
                value={workingDays}
                onChange={(e) => setWorkingDays(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600">Timer per dag</span>
              <input
                type="number"
                min={0.1}
                step={0.25}
                value={workingHoursPerDay}
                onChange={(e) => setWorkingHoursPerDay(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm text-zinc-600">
                Antall ansatte (fordeling av nytte)
              </span>
              <input
                type="number"
                min={1}
                value={employees}
                onChange={(e) => setEmployees(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
          </div>

          <dl className="mt-6 space-y-3 border-t border-zinc-200 pt-6 font-mono text-sm dark:border-zinc-800">
            <div className="flex justify-between gap-4">
              <dt>Totale timer As-Is /år</dt>
              <dd className="tabular-nums">{results.hoursY.toFixed(1)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>FTE (beregnet)</dt>
              <dd className="tabular-nums">{results.fte.toFixed(3)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Kostnad As-Is /år</dt>
              <dd className="tabular-nums">
                {Math.round(results.costY).toLocaleString("nb-NO")} NOK
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              <dt>Nytte timer/år</dt>
              <dd className="tabular-nums">{results.benH.toFixed(1)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              <dt>Nytte NOK/år</dt>
              <dd className="tabular-nums">
                {Math.round(results.benC).toLocaleString("nb-NO")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Nytte FTE</dt>
              <dd className="tabular-nums">{results.benFte.toFixed(4)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <dt>Nytte timer per ansatt</dt>
              <dd className="tabular-nums">{results.benHPerEmp.toFixed(1)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Nytte NOK per ansatt</dt>
              <dd className="tabular-nums">
                {Math.round(results.benCPerEmp).toLocaleString("nb-NO")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Nytte FTE per ansatt</dt>
              <dd className="tabular-nums">{results.benFtePerEmp.toFixed(4)}</dd>
            </div>
          </dl>
          <p className="mt-4 font-mono text-xs text-zinc-500">
            Timer_nytt = (AP/100) × T_total; NOK_nytt = (AP/100) × (kostnad_ansatt × FTE);
            FTE = T_total / (dager × timer_per_dag)
          </p>
        </section>

        <footer className="text-center text-xs text-zinc-500">
          Inspirert av UiPath Automation Hub. Ingen offisiell UiPath-endorsering.
        </footer>
      </div>
    </div>
  );
}
