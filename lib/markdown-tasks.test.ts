import { describe, expect, test } from "vitest";
import {
  countMarkdownTasks,
  toggleMarkdownTaskAtIndex,
} from "./markdown-tasks";

describe("markdown tasks", () => {
  const sample = [
    "Intro",
    "- [ ] RPAbruker (PMA)",
    "- [x] Utviklings-VM",
    "- [ ] Tilgang til MV test og prod",
    "",
    "https://example.com",
  ].join("\n");

  test("counts GFM task checkboxes", () => {
    expect(countMarkdownTasks(sample)).toBe(3);
  });

  test("checks an unchecked task", () => {
    expect(toggleMarkdownTaskAtIndex(sample, 0)).toBe(
      [
        "Intro",
        "- [x] RPAbruker (PMA)",
        "- [x] Utviklings-VM",
        "- [ ] Tilgang til MV test og prod",
        "",
        "https://example.com",
      ].join("\n"),
    );
  });

  test("unchecks a checked task", () => {
    expect(toggleMarkdownTaskAtIndex(sample, 1)).toBe(
      [
        "Intro",
        "- [ ] RPAbruker (PMA)",
        "- [ ] Utviklings-VM",
        "- [ ] Tilgang til MV test og prod",
        "",
        "https://example.com",
      ].join("\n"),
    );
  });

  test("supports nested and ordered task lists", () => {
    const nested = ["1. [ ] A", "  - [X] B", "* [ ] C"].join("\n");
    expect(countMarkdownTasks(nested)).toBe(3);
    expect(toggleMarkdownTaskAtIndex(nested, 1)).toBe(
      ["1. [ ] A", "  - [ ] B", "* [ ] C"].join("\n"),
    );
  });

  test("returns original markdown when index is out of range", () => {
    expect(toggleMarkdownTaskAtIndex(sample, 99)).toBe(sample);
    expect(toggleMarkdownTaskAtIndex(sample, -1)).toBe(sample);
  });
});
