/**
 * GalleryCanvasView — pure-function tests
 *
 * The project's vitest setup does NOT include a DOM environment, so we test
 * the extracted pure functions (resolvePosition, displayName) + exported
 * layout constants. Interactive behaviour (drag, debounced onLayoutChange)
 * is exercised separately through the API route tests for the PATCH endpoint.
 */

import { describe, it, expect } from "vitest";
import {
  resolvePosition,
  displayName,
  CARD_WIDTH,
  CARD_HEIGHT,
  AUTO_LAYOUT_STEP,
  AUTO_LAYOUT_ROW_STEP,
  AUTO_LAYOUT_COLS,
  DEBOUNCE_MS,
  type CanvasSubmission,
} from "../gallery-canvas-helpers";

function baseSubmission(
  overrides: Partial<CanvasSubmission> = {}
): CanvasSubmission {
  // Spread overrides over defaults so explicit null/0 values survive (nullish
  // coalescing in a per-field mapping would have silently swapped them out).
  const defaults: CanvasSubmission = {
    id: "sub-1",
    studentId: "student-1",
    studentName: "Alice",
    contextNote: null,
    canvasX: null,
    canvasY: null,
  };
  return { ...defaults, ...overrides };
}

describe("GalleryCanvasView — layout constants", () => {
  it("card dimensions match spec (240×180)", () => {
    expect(CARD_WIDTH).toBe(240);
    expect(CARD_HEIGHT).toBe(180);
  });

  it("auto-layout uses 4 columns", () => {
    expect(AUTO_LAYOUT_COLS).toBe(4);
  });

  it("auto-layout step is card width + gap + margin", () => {
    // 240 + 24 gap + 20 margin = 284
    expect(AUTO_LAYOUT_STEP).toBe(284);
  });

  it("auto-layout row step is card height + gap + margin", () => {
    // 180 + 24 gap + 20 margin = 224
    expect(AUTO_LAYOUT_ROW_STEP).toBe(224);
  });

  it("debounce is 600ms", () => {
    expect(DEBOUNCE_MS).toBe(600);
  });
});

describe("GalleryCanvasView — resolvePosition", () => {
  it("uses explicit canvas_x/y when both are set (non-null)", () => {
    const sub = baseSubmission({ canvasX: 777, canvasY: 1234 });
    expect(resolvePosition(sub, 0)).toEqual({ x: 777, y: 1234 });
  });

  it("honors explicit zero coordinates (treats them as positioned, not null-equivalent)", () => {
    const sub = baseSubmission({ canvasX: 0, canvasY: 0 });
    // index 5 would otherwise auto-place at column 1 row 1 = (284, 224)
    expect(resolvePosition(sub, 5)).toEqual({ x: 0, y: 0 });
  });

  it("auto-positions first null-position card at origin (0, 0)", () => {
    const sub = baseSubmission({ canvasX: null, canvasY: null });
    expect(resolvePosition(sub, 0)).toEqual({ x: 0, y: 0 });
  });

  it("auto-positions second null-position card at (AUTO_LAYOUT_STEP, 0)", () => {
    const sub = baseSubmission({ canvasX: null, canvasY: null });
    expect(resolvePosition(sub, 1)).toEqual({ x: AUTO_LAYOUT_STEP, y: 0 });
  });

  it("wraps to the next row after 4 columns", () => {
    const sub = baseSubmission({ canvasX: null, canvasY: null });
    // index 4 starts row 2 (0 % 4 = col 0, floor(4 / 4) = row 1)
    expect(resolvePosition(sub, 4)).toEqual({ x: 0, y: AUTO_LAYOUT_ROW_STEP });
    // index 5 is col 1 of row 2
    expect(resolvePosition(sub, 5)).toEqual({
      x: AUTO_LAYOUT_STEP,
      y: AUTO_LAYOUT_ROW_STEP,
    });
  });

  it("falls back to auto-layout if only one axis is null", () => {
    // Partial positioning is treated as "not yet positioned" — both must be set.
    const halfX = baseSubmission({ canvasX: 500, canvasY: null });
    const halfY = baseSubmission({ canvasX: null, canvasY: 500 });
    expect(resolvePosition(halfX, 0)).toEqual({ x: 0, y: 0 });
    expect(resolvePosition(halfY, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("GalleryCanvasView — displayName", () => {
  it("returns 'Classmate N' (1-indexed) when anonymous=true, ignoring studentName", () => {
    const sub = baseSubmission({ studentName: "Alice" });
    expect(displayName(sub, 0, true)).toBe("Classmate 1");
    expect(displayName(sub, 4, true)).toBe("Classmate 5");
  });

  it("returns studentName when anonymous=false and name is set", () => {
    const sub = baseSubmission({ studentName: "Alice" });
    expect(displayName(sub, 0, false)).toBe("Alice");
  });

  it("falls back to 'Classmate' (no number) when anonymous=false and studentName is null", () => {
    const sub = baseSubmission({ studentName: null });
    expect(displayName(sub, 2, false)).toBe("Classmate");
  });
});
