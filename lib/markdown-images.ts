/**
 * Markdown-bilder: `![alt](url)` — inkl. data-URL og vanlige lenker.
 */

export type MarkdownImageRef = {
  /** Full `![alt](src)` match */
  match: string;
  alt: string;
  src: string;
  index: number;
  isDataUrl: boolean;
};

const IMAGE_MD_RE = /!\[([^\]]*)\]\((data:image\/[^)\s]+|https?:\/\/[^)\s]+)\)/g;

export function extractMarkdownImages(markdown: string): MarkdownImageRef[] {
  const out: MarkdownImageRef[] = [];
  const re = new RegExp(IMAGE_MD_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const src = m[2] ?? "";
    out.push({
      match: m[0],
      alt: m[1] ?? "",
      src,
      index: m.index,
      isDataUrl: src.startsWith("data:image/"),
    });
  }
  return out;
}

/** Erstatt lange data-URL-er med korte plassholdere i redigeringsvisning. */
export function collapseDataUrlImages(markdown: string): {
  display: string;
  dataUrls: string[];
} {
  const dataUrls: string[] = [];
  const display = markdown.replace(
    /!\[([^\]]*)\]\((data:image\/[^)\s]+)\)/g,
    (_full, alt: string, src: string) => {
      const i = dataUrls.length;
      dataUrls.push(src);
      const label = (alt || "bilde").trim() || "bilde";
      return `![${label}](puls-img:${i})`;
    },
  );
  return { display, dataUrls };
}

/** Utvid plassholdere tilbake til data-URL-er før lagring. */
export function expandDataUrlImages(
  display: string,
  dataUrls: string[],
): string {
  return display.replace(
    /!\[([^\]]*)\]\(puls-img:(\d+)\)/g,
    (full, alt: string, idxStr: string) => {
      const src = dataUrls[Number(idxStr)];
      if (!src) return full;
      return `![${alt}](${src})`;
    },
  );
}

export function removeMarkdownImageAt(
  markdown: string,
  imageIndex: number,
): string {
  const images = extractMarkdownImages(markdown);
  const target = images[imageIndex];
  if (!target) return markdown;
  return (
    markdown.slice(0, target.index) +
    markdown.slice(target.index + target.match.length)
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
