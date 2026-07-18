/**
 * GFM task list helpers: `- [ ]` / `- [x]` (also `*`, `+`, ordered lists).
 */

const TASK_ITEM_RE = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\](.*)$/;

export function normalizeMarkdownNewlines(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isCheckedMarker(mark: string): boolean {
  return mark === "x" || mark === "X";
}

/** Count GFM task-list checkboxes in markdown source (document order). */
export function countMarkdownTasks(markdown: string): number {
  let count = 0;
  for (const line of normalizeMarkdownNewlines(markdown).split("\n")) {
    if (TASK_ITEM_RE.test(line)) count += 1;
  }
  return count;
}

/**
 * Toggle the task checkbox at `taskIndex` (0-based, document order).
 * Returns the original string if the index is out of range.
 */
export function toggleMarkdownTaskAtIndex(
  markdown: string,
  taskIndex: number,
): string {
  if (taskIndex < 0) return markdown;

  let seen = 0;
  const lines = normalizeMarkdownNewlines(markdown).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = TASK_ITEM_RE.exec(line);
    if (!match) continue;
    if (seen === taskIndex) {
      const nextMarker = match[2] === " " ? "x" : " ";
      lines[i] = `${match[1]}[${nextMarker}]${match[3]}`;
      return lines.join("\n");
    }
    seen += 1;
  }
  return markdown;
}

/**
 * Toggle a task by its visible label text + current checked state.
 * More reliable than index when remark render order can drift.
 */
export function toggleMarkdownTaskByLabel(
  markdown: string,
  itemText: string,
  currentlyChecked: boolean,
): string {
  const needle = itemText.replace(/\s+/g, " ").trim();
  if (!needle) return markdown;

  const lines = normalizeMarkdownNewlines(markdown).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = TASK_ITEM_RE.exec(line);
    if (!match) continue;
    const lineText = match[3].replace(/\s+/g, " ").trim();
    if (lineText !== needle) continue;
    if (isCheckedMarker(match[2]!) !== currentlyChecked) continue;
    const nextMarker = currentlyChecked ? " " : "x";
    lines[i] = `${match[1]}[${nextMarker}]${match[3]}`;
    return lines.join("\n");
  }

  // Fallback: match on text only (state may already be stale in UI)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = TASK_ITEM_RE.exec(line);
    if (!match) continue;
    const lineText = match[3].replace(/\s+/g, " ").trim();
    if (lineText !== needle) continue;
    const nextMarker = isCheckedMarker(match[2]!) ? " " : "x";
    lines[i] = `${match[1]}[${nextMarker}]${match[3]}`;
    return lines.join("\n");
  }

  return markdown;
}

/**
 * Toggle task on a 1-based source line (from mdast/hast position).
 */
export function toggleMarkdownTaskAtLine(
  markdown: string,
  lineNumber1Based: number,
): string {
  if (lineNumber1Based < 1) return markdown;
  const lines = normalizeMarkdownNewlines(markdown).split("\n");
  const i = lineNumber1Based - 1;
  const line = lines[i];
  if (line === undefined) return markdown;
  const match = TASK_ITEM_RE.exec(line);
  if (!match) return markdown;
  const nextMarker = match[2] === " " ? "x" : " ";
  lines[i] = `${match[1]}[${nextMarker}]${match[3]}`;
  return lines.join("\n");
}
