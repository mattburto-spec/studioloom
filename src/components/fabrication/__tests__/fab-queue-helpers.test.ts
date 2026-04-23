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
  it("returns the no-machines message when fabricator has no assignments", () => {
    const msg = fabEmptyMessage("ready", true);
    expect(msg).toContain("No machines assigned");
    expect(msg).toContain("teacher");
  });
  it("returns tab-specific empty copy when assignments exist", () => {
    expect(fabEmptyMessage("ready", false)).toContain("No approved jobs");
    expect(fabEmptyMessage("in_progress", false)).toContain("jobs in progress");
  });
});
