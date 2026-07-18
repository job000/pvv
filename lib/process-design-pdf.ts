import { jsPDF } from "jspdf";

import type { ProcessDesignDocumentPayload } from "@/lib/process-design-doc-types";
import { resolvePddDiagramSnapshot } from "@/lib/pdd-diagram-live-cache";
import {
  type PddDiagramRaster,
  rasterizePddDiagramSnapshot,
} from "@/lib/pdd-diagram-rasterize";
import {
  createPdfLayout,
  formatPdfTimestamp,
  type PdfLayout,
} from "@/lib/pdf-layout";
import {
  extractHtmlDataImages,
  htmlToPlainText,
  isEmptyRichText,
} from "@/lib/rich-text";

export type ProcessDesignPdfInput = {
  assessmentTitle: string;
  workspaceName: string | null;
  organizationLine?: string;
  payload: ProcessDesignDocumentPayload;
  generatedAt: Date;
  publishedVersion?: number | null;
  /** Nøkkel for live diagram-cache (typisk assessmentId + revisjon). */
  diagramCacheKey?: string;
};

type DiagramRasters = {
  asIs: PddDiagramRaster[] | null;
  toBe: PddDiagramRaster[] | null;
};

function plainOrEmpty(body: string | undefined): string {
  if (isEmptyRichText(body)) return "";
  return htmlToPlainText(body);
}

function buildProcessDesignPdfDocument(
  data: ProcessDesignPdfInput,
  diagrams: DiagramRasters,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = createPdfLayout(doc);
  const shortTitle = (data.assessmentTitle || "Prosessdesign").trim().slice(0, 60);
  const p = data.payload;
  const isoDate = data.generatedAt.toISOString().slice(0, 10);
  const ver =
    data.publishedVersion != null && data.publishedVersion > 0
      ? ` · v${data.publishedVersion}`
      : "";
  const docRef = `RPA-PDD-${isoDate}${ver}`;

  doc.setProperties({
    title: `RPA prosessdesign: ${data.assessmentTitle}`,
    subject: "Process Design Document (RPA)",
    keywords: "RPA, PDD, prosessdesign, automatisering",
    creator: "PVV",
  });

  const addInlineDataImage = (dataUrl: string) => {
    const maxW = L.contentW();
    const maxH = 70;
    const drawW = Math.min(maxW, 120);
    const drawH = Math.min(maxH, 55);
    L.ensureSpace(drawH + 8);
    try {
      const format = dataUrl.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(dataUrl, format, L.margin, L.getY(), drawW, drawH);
      L.setY(L.getY() + drawH + 6);
    } catch {
      /* bilde hoppes over hvis format ikke støttes */
    }
  };

  /** Feltkort med plain tekst + eventuelle innebygde bilder. Tomme felt vises. */
  const addRichField = (fieldLabel: string, body: string | undefined) => {
    const plain = plainOrEmpty(body);
    const images = extractHtmlDataImages(body ?? "");
    L.addFieldCard(fieldLabel, plain, { showEmpty: true });
    for (const img of images.slice(0, 8)) {
      addInlineDataImage(img.dataUrl);
    }
  };

  const addSingleRasterImage = (raster: PddDiagramRaster) => {
    const maxW = L.contentW();
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
    L.ensureSpace(drawH + 10);
    try {
      doc.addImage(raster.dataUrl, "PNG", L.margin, L.getY(), drawW, drawH);
      L.setY(L.getY() + drawH + 8);
    } catch {
      L.addMutedNote("Kunne ikke legge inn diagram som bilde i PDF.");
    }
  };

  const addRasterDiagram = (
    fieldLabel: string,
    rasters: PddDiagramRaster[] | null,
    snapshotPresent: boolean,
  ) => {
    if (!snapshotPresent) {
      L.addFieldCard(fieldLabel, "", {
        showEmpty: true,
        emptyLabel: "Ingen diagram lagret",
      });
      return;
    }
    L.addHeading(fieldLabel, 10);
    if (!rasters || rasters.length === 0) {
      L.addMutedNote(
        "Diagrammet kunne ikke eksporteres som bilde (nettleser eller tomt diagram). Åpne Prosessdesign i PVV for interaktiv visning.",
      );
      return;
    }
    for (const raster of rasters) {
      if (rasters.length > 1) {
        L.addPara(raster.pageName, 9);
      }
      addSingleRasterImage(raster);
    }
  };

  const addEmptySectionNote = (Lref: PdfLayout, label: string) => {
    Lref.addMutedNote(`${label}: ingen oppføringer.`);
  };

  const toc = [
    "Dokumentkontroll",
    "Formål og anvendelse",
    "1. Prosessoversikt",
    "2. As-Is — nåværende prosess",
    "3. To-Be — fremtidig prosess",
    "4. HUKI — roller og ansvar",
    "5. Risiko og feilhåndtering",
    "6. Tilleggsinformasjon",
  ] as const;

  L.drawFrontPage({
    docTypeLabel: "RPA prosessdesign (PDD)",
    eyebrow: "Process Design Document",
    title: shortTitle,
    subtitle: "As-Is / To-Be, omfang, unntak og feilhåndtering.",
    generatedLabel: formatPdfTimestamp(data.generatedAt),
    documentRef: docRef,
  });

  L.drawTocPage([...toc]);

  L.drawDocumentControlPage({
    organizationLine:
      data.organizationLine?.trim() ||
      data.workspaceName?.trim() ||
      undefined,
    metaRows: [
      ...(data.workspaceName?.trim() && data.organizationLine?.trim()
        ? [{ label: "Arbeidsområde", value: data.workspaceName.trim() }]
        : []),
      {
        label: "Kandidat / vurdering",
        value: data.assessmentTitle.trim() || "—",
      },
      ...(data.publishedVersion != null && data.publishedVersion > 0
        ? [{ label: "Publisert versjon", value: `v${data.publishedVersion}` }]
        : []),
      { label: "Dokumentreferanse", value: docRef },
    ],
  });

  L.addSection(toc[1], 11);
  L.addPara(
    "Dokumentet beskriver hvordan prosessen skal automatiseres med RPA: nåværende flyt (As-Is), ønsket flyt (To-Be), omfang, unntak og feilhåndtering. Egnet for utviklere, forretningseiere, test og revisjon.",
    9.5,
  );

  /* ---- 1. Prosessoversikt ---- */
  L.addSection(toc[2], 12);
  addRichField("Prosesstittel", p.processTitle ?? p.asIsProcessName);
  addRichField("Kort beskrivelse", p.shortDescription);
  addRichField("Detaljert beskrivelse", p.executiveSummary);
  addRichField("Formål", p.purpose);
  addRichField("Mål og forventet nytte", p.objectives);
  addRichField("Forutsetninger", p.prerequisites);
  addRichField("Primær enhet / eierlinje", p.orgPrimaryUnit);
  addRichField("Hvor prosessen kjøres", p.orgOperatingUnits);
  addRichField("ROS gjelder for", p.orgRosCoverage);

  if (p.keyContacts?.length) {
    L.addHeading("Nøkkelkontakter", 10);
    for (const c of p.keyContacts) {
      const line = `${c.role}: ${c.name}${c.contact ? ` — ${c.contact}` : ""}${c.notes ? ` (${c.notes})` : ""}`;
      L.addPara(line, 9);
    }
  } else {
    addEmptySectionNote(L, "Nøkkelkontakter");
  }

  /* ---- 2. As-Is prosess ---- */
  L.addSection(toc[3], 12);
  addRichField("Beskrivelse", p.asIsShortDescription);
  addRichField("Roller", p.asIsRoles);
  addRichField("Volum og frekvens", p.asIsVolume);
  addRichField("Behandlingstid", p.asIsHandleTime);
  addRichField("Ressurs (FTE)", p.asIsFte);

  if (p.asIsApplications?.length) {
    L.addHeading("Applikasjoner", 10);
    for (const app of p.asIsApplications) {
      const block = [
        [app.type, app.env, app.phase].filter(Boolean).join(" · "),
        app.comments,
      ]
        .filter(Boolean)
        .join("\n");
      L.addFieldCard(app.name || "Applikasjon", block || "", {
        showEmpty: true,
      });
    }
  } else {
    addEmptySectionNote(L, "Applikasjoner");
  }

  addRichField("As-Is prosesskart (tekst)", p.asIsProcessMap);
  addRasterDiagram(
    "As-Is prosesskart (diagram)",
    diagrams.asIs,
    Boolean(p.asIsDiagramSnapshot?.trim()),
  );

  if (p.asIsSteps?.length) {
    L.addHeading("Detaljerte As-Is trinn", 10);
    for (const s of p.asIsSteps) {
      const head = s.stepNo ? `Trinn ${s.stepNo}` : "Trinn";
      const desc = htmlToPlainText(s.description);
      const input = htmlToPlainText(s.input);
      const exception = htmlToPlainText(s.exception);
      const body = [
        desc,
        input ? `Inndata: ${input}` : "",
        exception ? `Unntak: ${exception}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      L.addFieldCard(head, body, { showEmpty: true });
    }
  } else {
    addEmptySectionNote(L, "Detaljerte As-Is trinn");
  }

  /* ---- 3. To-Be prosess ---- */
  L.addSection(toc[4], 12);
  addRichField("To-Be prosesskart (tekst)", p.toBeMap);
  addRasterDiagram(
    "To-Be prosesskart (diagram)",
    diagrams.toBe,
    Boolean(p.toBeDiagramSnapshot?.trim()),
  );
  addRichField("To-Be trinn", p.toBeSteps);
  addRichField("I omfang (RPA)", p.inScope);
  addRichField("Utenfor omfang", p.outOfScope);
  addRichField("Parallelle initiativ", p.parallelInitiatives);

  /* ---- 4. HUKI ---- */
  L.addSection(toc[5], 12);
  if (p.hukiRows?.length) {
    L.addMutedNote(
      "H = Høres · U = Utfører · K = Kontrollerer · I = Informeres",
    );
    for (const row of p.hukiRows) {
      L.addRow(
        row.activity?.trim() || "Aktivitet",
        `H: ${row.h || "—"}  ·  U: ${row.u || "—"}  ·  K: ${row.k || "—"}  ·  I: ${row.i || "—"}`,
      );
    }
  } else {
    addEmptySectionNote(L, "HUKI-rader");
  }

  /* ---- 5. Risiko og feilhåndtering ---- */
  L.addSection(toc[6], 12);

  if (p.businessExceptionsKnown?.length) {
    L.addHeading("Kjente forretningsunntak", 10);
    for (const e of p.businessExceptionsKnown) {
      const action = htmlToPlainText(e.action);
      const body = [
        e.step && `Steg: ${e.step}`,
        e.params,
        action ? `Tiltak: ${action}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      L.addFieldCard(e.name || "Unntak", body, { showEmpty: true });
    }
  } else {
    addEmptySectionNote(L, "Kjente forretningsunntak");
  }
  addRichField("Ukjente forretningsunntak", p.businessExceptionsUnknown);

  if (p.appErrorsKnown?.length) {
    L.addHeading("Kjente tekniske feil", 10);
    for (const e of p.appErrorsKnown) {
      const action = htmlToPlainText(e.action);
      const body = [
        e.step && `Steg: ${e.step}`,
        e.params,
        action ? `Handling: ${action}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      L.addFieldCard(e.name || "Feil", body, { showEmpty: true });
    }
  } else {
    addEmptySectionNote(L, "Kjente tekniske feil");
  }
  addRichField("Ukjente tekniske feil", p.appErrorsUnknown);
  addRichField("Rapportering og logging", p.reporting);

  /* ---- 6. Tillegg ---- */
  L.addSection(toc[7], 12);
  addRichField("Andre observasjoner", p.otherObservations);
  addRichField("Tilleggskilder / SOP / video", p.additionalSources);
  addRichField("Tidsplan og milepæler", p.targetTimeline);
  addRichField("Vedlegg", p.appendix);

  if (p.documentHistory?.length) {
    L.addHeading("Dokumenthistorikk", 11);
    for (const h of p.documentHistory) {
      const line = `${h.date} · v${h.version} · ${h.role}: ${h.name}${h.organization ? ` (${h.organization})` : ""}${h.comments ? ` — ${h.comments}` : ""}`;
      L.addPara(line, 9);
    }
  }

  L.addSoftDivider();
  L.addMutedNote(
    "Merknad: Dette er et uttrekk fra PVV på eksporttidspunktet. Diagrammer er rasterisert for PDF; åpne Prosessdesign i appen for interaktiv visning.",
  );

  L.finish({
    shortTitle,
    docTypeLabel: "RPA prosessdesign",
  });
  return doc;
}

async function buildProcessDesignPdfBlob(
  data: ProcessDesignPdfInput,
): Promise<Blob> {
  const cacheKey = data.diagramCacheKey?.trim() || "";
  const asIsSnapshot = cacheKey
    ? resolvePddDiagramSnapshot(
        cacheKey,
        "asIs",
        data.payload.asIsDiagramSnapshot,
      )
    : data.payload.asIsDiagramSnapshot;
  const toBeSnapshot = cacheKey
    ? resolvePddDiagramSnapshot(
        cacheKey,
        "toBe",
        data.payload.toBeDiagramSnapshot,
      )
    : data.payload.toBeDiagramSnapshot;

  const payloadForPdf: ProcessDesignDocumentPayload = {
    ...data.payload,
    asIsDiagramSnapshot: asIsSnapshot,
    toBeDiagramSnapshot: toBeSnapshot,
  };

  const [asIs, toBe] = await Promise.all([
    rasterizePddDiagramSnapshot(asIsSnapshot),
    rasterizePddDiagramSnapshot(toBeSnapshot),
  ]);
  const doc = buildProcessDesignPdfDocument(
    { ...data, payload: payloadForPdf },
    { asIs, toBe },
  );
  return doc.output("blob");
}

/**
 * A4-PDF — RPA Process Design Document. Rasteriserer lagrede tldraw-diagrammer i nettleseren.
 */
export async function downloadProcessDesignPdf(
  data: ProcessDesignPdfInput,
): Promise<void> {
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
