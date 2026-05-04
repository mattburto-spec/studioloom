import { describe, it, expect } from "vitest";
import {
  formatFileSize,
  machineCategoryLabel,
  fabTabLabel,
  fabEmptyMessage,
} from "../fab-queue-helpers";

/**
 * Phase 7-3 fab-queue helper tests. Pure functions.
 */

describe("formatFileSize", () => {
  it("returns em-dash for null / undefined", () => {
    expect(formatFileSize(null)).toBe("—");
    expect(formatFileSize(undefined)).toBe("—");
  });
  it("returns em-dash for negative / NaN / Infinity", () => {
    expect(formatFileSize(-1)).toBe("—");
    expect(formatFileSize(NaN)).toBe("—");
    expect(formatFileSize(Infinity)).toBe("—");
  });
  it("bytes below 1024", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });
  it("KB range", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(102400)).toBe("100 KB");
    expect(formatFileSize(1024 * 1024 - 1)).toMatch(/KB$/);
  });
  it("MB range — one decimal below 10 MB, none above", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
    expect(formatFileSize(50 * 1024 * 1024)).toBe("50 MB");
  });
  it("GB range", () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });
});

describe("machineCategoryLabel", () => {
  it("maps 3d_printer → 3D printer", () => {
    expect(machineCategoryLabel("3d_printer")).toBe("3D printer");
  });
  it("maps laser_cutter → Laser cutter", () => {
    expect(machineCategoryLabel("laser_cutter")).toBe("Laser cutter");
  });
  it("returns Unknown for null / undefined", () => {
    expect(machineCategoryLabel(null)).toBe("Unknown");
    expect(machineCategoryLabel(undefined)).toBe("Unknown");
  });
});

describe("fabTabLabel", () => {
  it("returns Ready to pick up", () => {
    expect(fabTabLabel("ready")).toBe("Ready to pick up");
  });
  it("returns In progress", () => {
    expect(fabTabLabel("in_progress")).toBe("In progress");
  });
});

describe("fabEmptyMessage", () => {
  it("returns the school-scoped message when no jobs are visible to the fabricator (8.1d-9 + Phase 8-1)", () => {
    // Phase 8.1d-9 dropped per-machine assignments — fabricators now
    // see ALL their school's jobs (Phase 8-1 flat membership). The
    // empty-state copy shifted accordingly; "no machines assigned"
    // is no longer the right mental model and "inviting teacher" was
    // narrowed-then-corrected to "school" by the 4 May fab-machines
    // school-scoping fix.
    const msg = fabEmptyMessage("ready", true);
    expect(msg).toContain("school");
  });
  it("returns tab-specific empty copy when jobs do exist on this teacher", () => {
    expect(fabEmptyMessage("ready", false)).toContain("No approved jobs");
    // 8.1d-20 reframed in_progress empty state to nudge action ("Pick
    // a job from a lane") rather than just describing the empty set.
    expect(fabEmptyMessage("in_progress", false)).toMatch(
      /currently picked up|Pick a job/
    );
  });
  it("returns a done-today empty message for the new 8.1d-20 tab", () => {
    expect(fabEmptyMessage("done_today", false)).toContain("today");
  });
});
