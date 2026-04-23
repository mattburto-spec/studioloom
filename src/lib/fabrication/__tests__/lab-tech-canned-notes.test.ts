import { describe, it, expect } from "vitest";
import {
  FAB_CANNED_NOTES,
  fabCannedNotesForAction,
  insertFabCannedNote,
} from "../lab-tech-canned-notes";

/** Phase 7-4 lab-tech preset tests. Pure functions. */

describe("FAB_CANNED_NOTES structure", () => {
  it("has non-empty preset lists for both complete + fail", () => {
    expect(FAB_CANNED_NOTES.complete.length).toBeGreaterThan(0);
    expect(FAB_CANNED_NOTES.fail.length).toBeGreaterThan(0);
  });
  it("every preset is a non-empty string", () => {
    for (const kind of ["complete", "fail"] as const) {
      for (const entry of FAB_CANNED_NOTES[kind]) {
        expect(typeof entry).toBe("string");
        expect(entry.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("fabCannedNotesForAction", () => {
  it("returns complete presets for 'complete'", () => {
    expect(fabCannedNotesForAction("complete")).toEqual(FAB_CANNED_NOTES.complete);
  });
  it("returns fail presets for 'fail'", () => {
    expect(fabCannedNotesForAction("fail")).toEqual(FAB_CANNED_NOTES.fail);
  });
});

describe("insertFabCannedNote", () => {
  it("replaces empty textarea with the preset", () => {
    expect(insertFabCannedNote("", "Preset.")).toBe("Preset.");
  });
  it("treats whitespace-only as empty", () => {
    expect(insertFabCannedNote("   \n  ", "Preset.")).toBe("Preset.");
  });
  it("appends with a blank-line separator when textarea has content", () => {
    expect(insertFabCannedNote("Existing.", "Extra.")).toBe(
      "Existing.\n\nExtra."
    );
  });
  it("trims trailing whitespace before appending", () => {
    expect(insertFabCannedNote("Existing.  \n", "Preset.")).toBe(
      "Existing.\n\nPreset."
    );
  });
});
