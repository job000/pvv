/**
 * Automatisk oppsummering før/etter tiltak (ROS-matriser).
 * Brukes i Convex getAnalysis og i UI.
 */

export type RosSummary = {
  /** Samme rad×kol-dimensjon og kan sammenlignes celle-for-celle */
  sameLayout: boolean;
  maxBefore: number;
  maxAfter: number;
  /** Antall celler der nivå gikk ned (risiko redusert), kun ved sameLayout */
  cellsImproved: number;
  /** Antall celler der nivå gikk opp */
  cellsWorse: number;
  /** Antall celler med samme nivå (begge > 0 eller begge 0) */
  cellsUnchangedNonZero: number;
  cellsHighRiskBefore: number;
  cellsHighRiskAfter: number;
  /** Korte linjer til visning / PVV */
  summaryLines: string[];
  /** Forslag til flagg på PVV-kobling (kan overstyres manuelt) */
  suggestedLinkFlags: string[];
};

function countHigh(m: number[][], threshold = 4): number {
  let n = 0;
  for (const row of m) {
    for (const v of row) {
      if (v >= threshold) n++;
    }
  }
  return n;
}

export function computeRosSummary(input: {
  matrixBefore: number[][];
  matrixAfter: number[][];
}): RosSummary {
  const a = input.matrixBefore;
  const b = input.matrixAfter;
  const rows = a.length;
  const cols = a[0]?.length ?? 0;
  const sameLayout =
    rows > 0 &&
    b.length === rows &&
    (b[0]?.length ?? 0) === cols &&
    b.every((row, i) => row.length === (a[i]?.length ?? 0));

  let maxBefore = 0;
  let maxAfter = 0;
  for (const row of a) {
    for (const v of row) {
      if (v > maxBefore) maxBefore = v;
    }
  }
  for (const row of b) {
    for (const v of row) {
      if (v > maxAfter) maxAfter = v;
    }
  }

  const cellsHighRiskBefore = countHigh(a);
  const cellsHighRiskAfter = countHigh(b);

  let cellsImproved = 0;
  let cellsWorse = 0;
  let cellsUnchangedNonZero = 0;

  if (sameLayout) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < (a[i]?.length ?? 0); j++) {
        const x = a[i]![j] ?? 0;
        const y = b[i]![j] ?? 0;
        if (y < x) cellsImproved++;
        else if (y > x) cellsWorse++;
        else if (x === y && x > 0) cellsUnchangedNonZero++;
      }
    }
  }

  const summaryLines: string[] = [];
  summaryLines.push(
    `Høyeste nivå: før tiltak ${maxBefore}, etter tiltak ${maxAfter}.`,
  );
  if (sameLayout) {
    summaryLines.push(
      `Celleendringer: ${cellsImproved} redusert, ${cellsWorse} økt, ${cellsUnchangedNonZero} uendret (med nivå > 0).`,
    );
    summaryLines.push(
      `Høy/kritisk (nivå 4–5): ${cellsHighRiskBefore} celler før → ${cellsHighRiskAfter} etter.`,
    );
  } else {
    summaryLines.push(
      "Før- og etter-matrisen har ulike akser eller dimensjoner — detaljert celle-for-celle-sammenligning er ikke utført.",
    );
    summaryLines.push(
      `Høy/kritisk (nivå 4–5): ${cellsHighRiskBefore} celler før → ${cellsHighRiskAfter} etter (per matrise).`,
    );
  }

  const suggestedLinkFlags: string[] = [];
  if (maxAfter >= 4) suggestedLinkFlags.push("rest_risk_elevated");
  if (sameLayout && cellsWorse > cellsImproved)
    suggestedLinkFlags.push("risk_increased_in_cells");
  if (cellsHighRiskAfter > 0) suggestedLinkFlags.push("residual_high_or_critical");
  if (sameLayout && cellsImproved > 0 && maxAfter < maxBefore)
    suggestedLinkFlags.push("tiltak_documented_reduction");

  return {
    sameLayout,
    maxBefore,
    maxAfter,
    cellsImproved,
    cellsWorse,
    cellsUnchangedNonZero,
    cellsHighRiskBefore,
    cellsHighRiskAfter,
    summaryLines,
    suggestedLinkFlags,
  };
}
