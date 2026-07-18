/**
 * GFM task list helpers: `- [ ]` / `- [x]` (also `*`, `+`, ordered lists).
 */

const TASK_ITEM_RE = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\](.*)$/;

/** Count GFM task-list checkboxes in markdown source (document order). */
export function countMarkdownTasks(markdown: string): number {
  let count = 0;
  for (const line of markdown.split("\n")) {
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
  const lines = markdown.split("\n");
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
