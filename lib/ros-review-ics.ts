function icsEscapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function formatIcsUtc(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  const h = String(dt.getUTCHours()).padStart(2, "0");
  const min = String(dt.getUTCMinutes()).padStart(2, "0");
  const sec = String(dt.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${sec}Z`;
}

/**
 * Minimal RFC 5545 VEVENT for én revisjon — lastes ned som .ics (Google/Outlook/Apple).
 */
export function buildRosReviewIcs(opts: {
  uid: string;
  title: string;
  startMs: number;
  durationMinutes?: number;
  description?: string;
  url?: string;
}): string {
  const start = new Date(opts.startMs);
  const dur = Math.max(15, opts.durationMinutes ?? 60);
  const end = new Date(start.getTime() + dur * 60 * 1000);
  const descParts: string[] = [];
  if (opts.description?.trim()) descParts.push(opts.description.trim());
  if (opts.url?.trim()) descParts.push(opts.url.trim());
  const desc = descParts.length > 0 ? icsEscapeText(descParts.join("\\n\\n")) : "";
  const summary = icsEscapeText(opts.title.slice(0, 200));
  const stamp = formatIcsUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PVV//ROS revisjon//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsEscapeText(opts.uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${summary}`,
    ...(desc ? [`DESCRIPTION:${desc}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

export function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
