import { jsPDF } from "jspdf";

import type { ProcessDesignDocumentPayload } from "@/lib/process-design-doc-types";
import {
  type PddDiagramRaster,
  rasterizePddDiagramSnapshot,
} from "@/lib/pdd-diagram-rasterize";
import {
  applyCorporatePdfFooters,
  bodyLineHeightMm,
  PDF_CORPORATE_THEME,
} from "@/lib/pdf-corporate";

const T = PDF_CORPORATE_THEME;

export type ProcessDesignPdfInput = {
  assessmentTitle: string;
  workspaceName: string | null;
  organizationLine?: string;
  payload: ProcessDesignDocumentPayload;
  generatedAt: Date;
  publishedVersion?: number | null;
};

function formatTs(d: Date) {
  try {
    return d.toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short" });
  } catch {
    return d.toISOString();
  }
}

type DiagramRasters = {
  asIs: PddDiagramRaster[] | null;
  toBe: PddDiagramRaster[] | null;
};

function buildProcessDesignPdfDocument(
  data: ProcessDesignPdfInput,
  diagrams: DiagramRasters,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 16;
  let cursor = margin;
  const pageW = () => doc.internal.pageSize.getWidth();
  const pageH = () => doc.internal.pageSize.getHeight();
  const contentW = () => pageW() - margin * 2;
  const shortTitle = (data.assessmentTitle || "Prosessdesign").trim().slice(0, 60);
  const p = data.payload;

  doc.setProperties({
    title: `RPA prosessdesign: ${data.assessmentTitle}`,
    subject: "Process Design Document (RPA)",
    keywords: "RPA, PDD, prosessdesign, automatisering",
    creator: "PVV",
  });

  const ensureSpace = (needMm: number) => {
    if (cursor + needMm > pageH() - margin) {
      doc.addPage();
      cursor = margin;
    }
  };

  const addHeading = (text: string, size = 13) => {
    ensureSpace(18);
    const barW = 2.8;
    doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
    doc.rect(margin, cursor - size * 0.36, barW, size * 0.72, "F");
    const textX = margin + barW + 3.5;
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
    doc.text(text, textX, cursor);
    cursor += size * 0.55 + 4;
    doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
    doc.setLineWidth(0.35);
    doc.line(textX, cursor, pageW() - margin, cursor);
    cursor += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0);
  };

  const addFieldBlock = (fieldLabel: string, body: string | undefined) => {
    const t = body?.trim();
    if (!t) return;
    ensureSpace(14);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    doc.text(fieldLabel, margin, cursor);
    cursor += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lh = bodyLineHeightMm(10);
    const lines = doc.splitTextToSize(t, contentW());
    ensureSpace(lines.length * lh + 6);
    doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
    doc.text(lines, margin, cursor);
    cursor += lines.length * lh + 4;
    doc.setTextColor(0);
  };

  const addSingleRasterImage = (raster: PddDiagramRaster) => {
    const maxW = contentW();
    const maxH = 115;
    const pxW = Math.max(raster.width, 1);
    const pxH = raster.height;
    const ratio = pxH / pxW;
    let drawW = maxW;
    let drawH = drawW * ratio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH / ratio;
    }
    ensureSpace(drawH + 10);
    try {
      doc.addImage(raster.dataUrl, "PNG", margin, cursor, drawW, drawH);
      cursor += drawH + 8;
    } catch {
      doc.setFontSize(9);
      doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
      const errLines = doc.splitTextToSize(
        "Kunne ikke legge inn diagram som bilde i PDF.",
        contentW(),
      );
      const elh = bodyLineHeightMm(9);
      ensureSpace(errLines.length * elh + 4);
      doc.text(errLines, margin, cursor);
      cursor += errLines.length * elh + 6;
    }
    doc.setTextColor(0);
  };

  const addRasterDiagram = (
    fieldLabel: string,
    rasters: PddDiagramRaster[] | null,
    snapshotPresent: boolean,
  ) => {
    if (!snapshotPresent) return;
    ensureSpace(14);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    doc.text(fieldLabel, margin, cursor);
    cursor += 6;
    doc.setFont("helvetica", "normal");
    if (!rasters || rasters.length === 0) {
      const lh = bodyLineHeightMm(9);
      const msg = doc.splitTextToSize(
        "Diagrammet kunne ikke eksporteres som bilde (nettleser eller tomt diagram). Åpne Prosessdesign i PVV for interaktiv visning.",
        contentW(),
      );
      ensureSpace(msg.length * lh + 4);
      doc.setFontSize(9);
      doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
      doc.text(msg, margin, cursor);
      cursor += msg.length * lh + 6;
      doc.setTextColor(0);
      return;
    }
    for (const raster of rasters) {
      if (rasters.length > 1) {
        ensureSpace(12);
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
        doc.text(raster.pageName, margin, cursor);
        cursor += 5;
        doc.setFont("helvetica", "normal");
      }
      addSingleRasterImage(raster);
    }
  };

  const isoDate = data.generatedAt.toISOString().slice(0, 10);
  const ver =
    data.publishedVersion != null && data.publishedVersion > 0
      ? ` · v${data.publishedVersion}`
      : "";
  const docRef = `RPA-PDD-${isoDate}${ver}`;

  doc.setFillColor(T.brand[0], T.brand[1], T.brand[2]);
  doc.rect(0, 0, pageW(), 30, "F");
  doc.setFillColor(T.brandAccent[0], T.brandAccent[1], T.brandAccent[2]);
  doc.rect(0, 30, pageW(), 0.9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PVV · RPA PROSESSDESIGN (PDD)", margin, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`${formatTs(data.generatedAt)}  ·  ${docRef}`, margin, 16);
  doc.text(
    "Process Design Document — As-Is / To-Be, omfang, unntak og feilhåndtering for RPA-leveranser.",
    margin,
    22,
    { maxWidth: pageW() - margin * 2 },
  );
  doc.setTextColor(0);
  cursor = 36;

  if (data.organizationLine?.trim()) {
    doc.setFontSize(9);
    doc.setTextColor(T.slate500[0], T.slate500[1], T.slate500[2]);
    const ol = doc.splitTextToSize(data.organizationLine.trim(), contentW());
    ensureSpace(ol.length * 4 + 4);
    doc.text(ol, margin, cursor);
    cursor += ol.length * 4 + 6;
    doc.setTextColor(0);
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(T.slate900[0], T.slate900[1], T.slate900[2]);
  const titleLines = doc.splitTextToSize(shortTitle, contentW());
  ensureSpace(titleLines.length * 7 + 6);
  doc.text(titleLines, margin, cursor);
  cursor += titleLines.length * 7 + 8;
  doc.setFont("helvetica", "normal");

  if (data.workspaceName?.trim()) {
    doc.setFontSize(9);
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    doc.text(`Arbeidsområde: ${data.workspaceName.trim()}`, margin, cursor);
    cursor += 6;
    doc.setTextColor(0);
  }

  /* ---- 1. Prosessoversikt ---- */
  addHeading("1. Prosessoversikt", 12);
  addFieldBlock("Prosesstittel", p.processTitle ?? p.asIsProcessName);
  addFieldBlock("Kort beskrivelse", p.shortDescription);
  addFieldBlock("Detaljert beskrivelse", p.executiveSummary);
  addFieldBlock("Formål", p.purpose);
  addFieldBlock("Mål og forventet nytte", p.objectives);
  addFieldBlock("Forutsetninger", p.prerequisites);

  if (p.keyContacts?.length) {
    ensureSpace(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Nøkkelkontakter", margin, cursor);
    cursor += 6;
    doc.setFont("helvetica", "normal");
    for (const c of p.keyContacts) {
      const line = `${c.role}: ${c.name}${c.contact ? ` — ${c.contact}` : ""}${c.notes ? ` (${c.notes})` : ""}`;
      const lines = doc.splitTextToSize(line, contentW());
      ensureSpace(lines.length * bodyLineHeightMm(9) + 2);
      doc.setFontSize(9);
      doc.text(lines, margin, cursor);
      cursor += lines.length * bodyLineHeightMm(9) + 2;
    }
    cursor += 4;
  }

  /* ---- 2. As-Is prosess ---- */
  addHeading("2. As-Is — nåværende prosess", 12);
  addFieldBlock("Beskrivelse", p.asIsShortDescription);
  addFieldBlock("Roller", p.asIsRoles);
  addFieldBlock("Volum og frekvens", p.asIsVolume);
  addFieldBlock("Behandlingstid", p.asIsHandleTime);
  addFieldBlock("Ressurs (FTE)", p.asIsFte);

  if (p.asIsApplications?.length) {
    ensureSpace(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Applikasjoner", margin, cursor);
    cursor += 6;
    doc.setFont("helvetica", "normal");
    for (const app of p.asIsApplications) {
      const block = [
        [app.type, app.env, app.phase].filter(Boolean).join(" · "),
        app.comments,
      ]
        .filter(Boolean)
        .join("\n");
      addFieldBlock(app.name, block || "—");
    }
  }

  addFieldBlock("As-Is prosesskart (tekst)", p.asIsProcessMap);
  addRasterDiagram(
    "As-Is prosesskart (diagram)",
    diagrams.asIs,
    Boolean(p.asIsDiagramSnapshot?.trim()),
  );

  if (p.asIsSteps?.length) {
    ensureSpace(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Detaljerte As-Is trinn", margin, cursor);
    cursor += 6;
    doc.setFont("helvetica", "normal");
    for (const s of p.asIsSteps) {
      const head = s.stepNo ? `Trinn ${s.stepNo}` : "Trinn";
      const body = [
        s.description,
        s.input ? `Inndata: ${s.input}` : "",
        s.exception ? `Unntak: ${s.exception}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      addFieldBlock(head, body);
    }
  }

  /* ---- 3. To-Be prosess ---- */
  addHeading("3. To-Be — fremtidig prosess", 12);
  addFieldBlock("To-Be prosesskart (tekst)", p.toBeMap);
  addRasterDiagram(
    "To-Be prosesskart (diagram)",
    diagrams.toBe,
    Boolean(p.toBeDiagramSnapshot?.trim()),
  );
  addFieldBlock("To-Be trinn", p.toBeSteps);
  addFieldBlock("I omfang (RPA)", p.inScope);
  addFieldBlock("Utenfor omfang", p.outOfScope);
  addFieldBlock("Parallelle initiativ", p.parallelInitiatives);

  /* ---- 4. HUKI ---- */
  if (p.hukiRows?.length) {
    addHeading("4. HUKI — roller og ansvar", 12);
    const hukiHeader = "Aktivitet | H (Høres) | U (Utfører) | K (Kontrollerer) | I (Informeres)";
    ensureSpace(10);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(T.slate700[0], T.slate700[1], T.slate700[2]);
    doc.text(hukiHeader, margin, cursor);
    cursor += 5;
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(T.slate200[0], T.slate200[1], T.slate200[2]);
    doc.line(margin, cursor - 1, pageW() - margin, cursor - 1);
    cursor += 2;
    for (const row of p.hukiRows) {
      const line = `${row.activity || "—"} | ${row.h || "—"} | ${row.u || "—"} | ${row.k || "—"} | ${row.i || "—"}`;
      const lines = doc.splitTextToSize(line, contentW());
      ensureSpace(lines.length * bodyLineHeightMm(9) + 2);
      doc.setFontSize(9);
      doc.setTextColor(T.slate800[0], T.slate800[1], T.slate800[2]);
      doc.text(lines, margin, cursor);
      cursor += lines.length * bodyLineHeightMm(9) + 2;
    }
    cursor += 4;
    doc.setTextColor(0);
  }

  /* ---- 5. Risiko og feilhåndtering ---- */
  addHeading("5. Risiko og feilhåndtering", 12);

  if (p.businessExceptionsKnown?.length) {
    ensureSpace(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Kjente forretningsunntak", margin, cursor);
    cursor += 6;
    doc.setFont("helvetica", "normal");
    for (const e of p.businessExceptionsKnown) {
      const body = [e.step && `Steg: ${e.step}`, e.params, `Tiltak: ${e.action}`]
        .filter(Boolean)
        .join("\n");
      addFieldBlock(e.name, body);
    }
  }
  addFieldBlock("Ukjente forretningsunntak", p.businessExceptionsUnknown);

  if (p.appErrorsKnown?.length) {
    ensureSpace(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Kjente tekniske feil", margin, cursor);
    cursor += 6;
    doc.setFont("helvetica", "normal");
    for (const e of p.appErrorsKnown) {
      const body = [e.step && `Steg: ${e.step}`, e.params, `Handling: ${e.action}`]
        .filter(Boolean)
        .join("\n");
      addFieldBlock(e.name, body);
    }
  }
  addFieldBlock("Ukjente tekniske feil", p.appErrorsUnknown);
  addFieldBlock("Rapportering og logging", p.reporting);

  /* ---- 6. Tillegg ---- */
  addHeading("6. Tilleggsinformasjon", 12);
  addFieldBlock("Andre observasjoner", p.otherObservations);
  addFieldBlock("Tilleggskilder / SOP / video", p.additionalSources);
  addFieldBlock("Tidsplan og milepæler", p.targetTimeline);
  addFieldBlock("Vedlegg", p.appendix);

  if (p.documentHistory?.length) {
    addHeading("Dokumenthistorikk", 11);
    for (const h of p.documentHistory) {
      const line = `${h.date} · v${h.version} · ${h.role}: ${h.name}${h.organization ? ` (${h.organization})` : ""}${h.comments ? ` — ${h.comments}` : ""}`;
      const lines = doc.splitTextToSize(line, contentW());
      ensureSpace(lines.length * bodyLineHeightMm(9) + 2);
      doc.setFontSize(9);
      doc.text(lines, margin, cursor);
      cursor += lines.length * bodyLineHeightMm(9) + 2;
    }
  }

  applyCorporatePdfFooters(doc, margin, {
    shortTitle,
    docTypeLabel: "RPA prosessdesign",
  });
  return doc;
}

async function buildProcessDesignPdfBlob(
  data: ProcessDesignPdfInput,
): Promise<Blob> {
  const [asIs, toBe] = await Promise.all([
    rasterizePddDiagramSnapshot(data.payload.asIsDiagramSnapshot),
    rasterizePddDiagramSnapshot(data.payload.toBeDiagramSnapshot),
  ]);
  const doc = buildProcessDesignPdfDocument(data, { asIs, toBe });
  return doc.output("blob");
}

/**
 * A4-PDF — RPA Process Design Document. Rasteriserer lagrede tldraw-diagrammer i nettleseren.
 */
export async function downloadProcessDesignPdf(data: ProcessDesignPdfInput): Promise<void> {
  const blob = await buildProcessDesignPdfBlob(data);
  const url = URL.createObjectURL(blob);
  try {
    const isoDate = data.generatedAt.toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rpa-prosessdesign-${isoDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function buildProcessDesignPdfPreviewUrl(
  data: ProcessDesignPdfInput,
): Promise<string> {
  const blob = await buildProcessDesignPdfBlob(data);
  return URL.createObjectURL(blob);
}
