import { PdfDocumentationPreview } from "@/components/documentation/pdf-documentation-preview";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF-forhåndsvisning",
  description:
    "Se eksempel på eksporterte PDF-er for ROS, PVV-vurderinger og prosessdesign (PDD) i FRO.",
};

export default function PdfForhandsvisningPage() {
  return <PdfDocumentationPreview />;
}
