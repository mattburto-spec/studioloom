import { describe, it, expect } from "vitest";
import {
  extractTilesFromPage,
  tileIdForSection,
  tileProgress,
  tileTitle,
} from "../lesson-tiles";
import type { ActivitySection, UnitPage } from "@/types";

describe("tileIdForSection", () => {
  it("uses 'activity_<id>' format when activityId is present", () => {
    const s = { activityId: "abc12345", prompt: "x" } as ActivitySection;
    expect(tileIdForSection(s, 0)).toBe("activity_abc12345");
  });

  it("falls back to positional 'section_<idx>' when activityId is missing", () => {
    const s = { prompt: "x" } as ActivitySection;
    expect(tileIdForSection(s, 3)).toBe("section_3");
  });

  it("falls back when activityId is empty string", () => {
    const s = { activityId: "", prompt: "x" } as ActivitySection;
    expect(tileIdForSection(s, 2)).toBe("section_2");
  });

  it("matches the canonical response-key format from the student page", () => {
    // Student route at src/app/(student)/unit/[unitId]/[pageId]/page.tsx:277
    // produces these keys; tile_id MUST match for join paths to line up.
    const withId = { activityId: "xy12abcd" } as ActivitySection;
    const withoutId = {} as ActivitySection;
    expect(tileIdForSection(withId, 5)).toBe("activity_xy12abcd");
    expect(tileIdForSection(withoutId, 5)).toBe("section_5");
  });
});

describe("tileTitle", () => {
  it("returns the trimmed prompt for short text", () => {
    expect(tileTitle("Sketch your concept.")).toBe("Sketch your concept.");
  });

  it("trims leading + trailing whitespace", () => {
    expect(tileTitle("   Test prompt   ")).toBe("Test prompt");
  });

  it("returns 'Untitled tile' for null/undefined/empty", () => {
    expect(tileTitle(null)).toBe("Untitled tile");
    expect(tileTitle(undefined)).toBe("Untitled tile");
    expect(tileTitle("")).toBe("Untitled tile");
  });

  it("truncates over the limit and appends ellipsis", () => {
    const long = "a".repeat(100);
    const out = tileTitle(long, 60);
    expect(out.length).toBeLessThanOrEqual(61); // 60 + '…'
    expect(out.endsWith("…")).toBe(true);
  });

  it("cuts on word boundary when a recent space exists", () => {
    const long = "Investigate three different joinery techniques used in furniture making";
    const out = tileTitle(long, 30);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("joinery techniqu…"); // shouldn't cut mid-word
  });
});

describe("extractTilesFromPage", () => {
  function makePage(overrides: Partial<UnitPage> = {}, sections: ActivitySection[] = []): UnitPage {
    return {
      id: "page-1",
      type: "lesson",
      title: "Test page",
      content: { title: "Test page", sections, learningGoal: "" },
      ...overrides,
    } as UnitPage;
  }

  it("returns empty array for missing or empty page", () => {
    expect(extractTilesFromPage(undefined)).toEqual([]);
    expect(extractTilesFromPage(makePage({}, []))).toEqual([]);
  });

  it("extracts one tile per section", () => {
    const page = makePage({}, [
      { prompt: "Q1", activityId: "id1", responseType: "long-text" } as ActivitySection,
      { prompt: "Q2", activityId: "id2", responseType: "long-text" } as ActivitySection,
    ]);
    const tiles = extractTilesFromPage(page);
    expect(tiles).toHaveLength(2);
    expect(tiles[0].tileId).toBe("activity_id1");
    expect(tiles[1].tileId).toBe("activity_id2");
  });

  it("preserves index for stable React keys", () => {
    const page = makePage({}, [
      { prompt: "a", activityId: "a" } as ActivitySection,
      { prompt: "b", activityId: "b" } as ActivitySection,
    ]);
    const tiles = extractTilesFromPage(page);
    expect(tiles[0].index).toBe(0);
    expect(tiles[1].index).toBe(1);
  });

  it("resolves criterion from section.criterionTags[0] when present", () => {
    const page = makePage({}, [
      { prompt: "x", activityId: "i1", criterionTags: ["A", "B"] } as ActivitySection,
    ]);
    const [tile] = extractTilesFromPage(page);
    expect(tile.criterionKey).toBe("A");
    expect(tile.criterionTags).toEqual(["A", "B"]);
  });

  it("falls back to page.criterion when section has no tags", () => {
    const page = makePage({ criterion: "C" }, [
      { prompt: "x", activityId: "i1" } as ActivitySection,
    ]);
    const [tile] = extractTilesFromPage(page);
    expect(tile.criterionKey).toBe("C");
  });

  it("returns null criterion + 'Unmapped' label when neither source has one", () => {
    const page = makePage({}, [
      { prompt: "x", activityId: "i1" } as ActivitySection,
    ]);
    const [tile] = extractTilesFromPage(page);
    expect(tile.criterionKey).toBeNull();
    expect(tile.criterionLabel).toBe("Unmapped");
  });

  it("marks gradeable when responseType OR portfolioCapture is present", () => {
    const page = makePage({}, [
      { prompt: "responsey", activityId: "a", responseType: "long-text" } as ActivitySection,
      { prompt: "porty", activityId: "b", portfolioCapture: true } as ActivitySection,
      { prompt: "neither", activityId: "c" } as ActivitySection,
    ]);
    const tiles = extractTilesFromPage(page);
    expect(tiles[0].isGradeable).toBe(true);
    expect(tiles[1].isGradeable).toBe(true);
    expect(tiles[2].isGradeable).toBe(false);
  });

  it("uses tileTitle to truncate long prompts", () => {
    const long = "a".repeat(200);
    const page = makePage({}, [{ prompt: long, activityId: "i" } as ActivitySection]);
    const [tile] = extractTilesFromPage(page);
    expect(tile.title.length).toBeLessThan(70);
    expect(tile.title.endsWith("…")).toBe(true);
  });
});

describe("tileProgress", () => {
  it("counts confirmed rows for the matching tile_id only", () => {
    const rows = [
      { tile_id: "activity_a", confirmed: true },
      { tile_id: "activity_a", confirmed: true },
      { tile_id: "activity_a", confirmed: false },
      { tile_id: "activity_b", confirmed: true },
    ];
    expect(tileProgress("activity_a", 24, rows)).toEqual({ confirmed: 2, total: 24 });
    expect(tileProgress("activity_b", 24, rows)).toEqual({ confirmed: 1, total: 24 });
  });

  it("returns 0 confirmed when no rows match", () => {
    expect(tileProgress("activity_x", 24, [])).toEqual({ confirmed: 0, total: 24 });
  });

  it("returns total=0 when cohort is empty (avoids divide-by-zero in caller)", () => {
    expect(tileProgress("activity_a", 0, [])).toEqual({ confirmed: 0, total: 0 });
  });
});
