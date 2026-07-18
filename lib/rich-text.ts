/**
 * Helpers for PDD/rich-text fields stored as HTML strings (plain text still supported).
 */

export function isLikelyHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/**
 * Gjenkjenn Markdown (spesielt GitHub-issue body: sjekklister, lister, lenker).
 * Brukes for å åpne Markdown-fane og rendere med remark-gfm i stedet for rik tekst.
 */
export function isLikelyMarkdown(value: string): boolean {
  const t = value.trim();
  if (!t) return false;

  // GFM task lists: - [ ] / - [x] (vinner også ved blandet innhold)
  if (/^[\t ]*[-*+]\s+\[[ xX]\]\s+\S/m.test(t)) return true;

  if (isLikelyHtml(t)) return false;

  // ATX-overskrifter
  if (/^#{1,6}\s+\S/m.test(t)) return true;
  // Fenced code
  if (/^```/m.test(t)) return true;
  // Lenker / bilder
  if (/\[[^\]]*\]\([^)\s]+\)/.test(t)) return true;
  // Horisontal linje (ofte før metadata ved import)
  if (/^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/m.test(t)) return true;
  // Flere punkt-/nummerlister
  const bullets = t.match(/^[\t ]*[-*+]\s+\S/gm);
  if (bullets && bullets.length >= 2) return true;
  const ordered = t.match(/^[\t ]*\d+\.\s+\S/gm);
  if (ordered && ordered.length >= 2) return true;
  // Fet/kursiv
  if (/\*\*[^*\n]+\*\*/.test(t) || /__[^_\n]+__/.test(t)) return true;
  if (/(^|[^*])\*[^*\n]+\*([^*]|$)/.test(t)) return true;
  return false;
}

/** Convert stored HTML (or plain text) to plain text for PDF/search. */
export function htmlToPlainText(value: string | undefined | null): string {
  if (!value?.trim()) return "";
  if (!isLikelyHtml(value)) return value;

  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = value;
    // Replace images with a short marker so PDF readers know something was there.
    el.querySelectorAll("img").forEach((img) => {
      const alt = img.getAttribute("alt")?.trim() || "bilde";
      const marker = document.createTextNode(`[${alt}]`);
      img.replaceWith(marker);
    });
    el.querySelectorAll("br").forEach((br) => {
      br.replaceWith(document.createTextNode("\n"));
    });
    el.querySelectorAll("p, li, div, h1, h2, h3, h4").forEach((node) => {
      if (!node.textContent?.endsWith("\n")) {
        node.appendChild(document.createTextNode("\n"));
      }
    });
    return (el.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
  }

  // SSR / Node fallback
  return value
    .replace(/<img[^>]*>/gi, "[bilde]")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract data-URL images from HTML for PDF embedding. */
export function extractHtmlDataImages(html: string): {
  dataUrl: string;
  alt: string;
}[] {
  if (!html || !isLikelyHtml(html)) return [];
  const out: { dataUrl: string; alt: string }[] = [];
  const re =
    /<img[^>]+src=["'](data:image\/(?:png|jpeg|jpg|webp|gif);base64,[^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    const dataUrl = match[1];
    if (!dataUrl) continue;
    const altMatch = /alt=["']([^"']*)["']/i.exec(tag);
    out.push({ dataUrl, alt: altMatch?.[1]?.trim() || "Bilde" });
  }
  return out;
}

/** Normalize editor value: wrap plain text in a paragraph for TipTap. */
export function toEditorHtml(value: string): string {
  if (!value) return "";
  if (isLikelyHtml(value)) return value;
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** True when HTML is empty / only empty paragraphs. */
export function isEmptyRichText(value: string | undefined | null): boolean {
  if (!value?.trim()) return true;
  return htmlToPlainText(value).trim().length === 0;
}

const MAX_IMAGE_EDGE = 1200;
const JPEG_QUALITY = 0.72;

/** Resize/compress an image file to a JPEG data URL suitable for inline HTML. */
export async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Kun bildefiler er støttet");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Kunne ikke lese bildet");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
