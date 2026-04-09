import type { jsPDF } from "jspdf";

/** Profesjonelt, trykk- og arkiv-vennlig palett (nøytral blå / skifer). */
export const PDF_CORPORATE_THEME = {
  brand: [23, 37, 84] as [number, number, number],
  brandAccent: [37, 99, 235] as [number, number, number],
  slate900: [15, 23, 42] as [number, number, number],
  slate800: [30, 41, 59] as [number, number, number],
  slate700: [51, 65, 85] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  surface: [248, 250, 252] as [number, number, number],
  calloutBg: [239, 246, 255] as [number, number, number],
  calloutBorder: [191, 219, 254] as [number, number, number],
  mutedBg: [241, 245, 249] as [number, number, number],
  mutedBorder: [226, 232, 240] as [number, number, number],
};

export function bodyLineHeightMm(fontSizePt: number): number {
  return fontSizePt * 0.52;
}

export type CorporatePdfFooterOptions = {
  shortTitle: string;
  /** Vises i bunntekst og topplinje, f.eks. «ROS-analyse» eller «PVV-vurdering». */
  docTypeLabel: string;
};

export function applyCorporatePdfFooters(
  doc: jsPDF,
  margin: number,
  opts: CorporatePdfFooterOptions,
): void {
  const pageCount = doc.getNumberOfPages();
  const safe = opts.shortTitle.slice(0, 56) || "Uten tittel";
  const T = PDF_CORPORATE_THEME;
  const [s2, s3, s7] = [T.slate200, T.slate500, T.slate700];
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const landscape = pw > ph;
    const footLineY = ph - 11;
    const footBaseY = ph - 5;

    doc.setDrawColor(s2[0], s2[1], s2[2]);
    doc.setLineWidth(0.25);
    doc.line(margin, footLineY, pw - margin, footLineY);

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(s7[0], s7[1], s7[2]);
    doc.text("PVV", margin, footBaseY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(s3[0], s3[1], s3[2]);
    doc.text(`${opts.docTypeLabel} · ${safe}`, margin + 10, footBaseY, {
      maxWidth: pw - margin * 2 - 42,
    });
    doc.text(`Side ${i} av ${pageCount}`, pw - margin, footBaseY, {
      align: "right",
    });

    if (!landscape && i > 1) {
      doc.setDrawColor(s2[0], s2[1], s2[2]);
      doc.line(margin, 11, pw - margin, 11);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(s3[0], s3[1], s3[2]);
      doc.text(opts.docTypeLabel, margin, 8);
      doc.setFont("helvetica", "normal");
      doc.text(safe, pw - margin, 8, {
        align: "right",
        maxWidth: pw - margin * 2 - 34,
      });
    }

    doc.setTextColor(0);
  }
}
