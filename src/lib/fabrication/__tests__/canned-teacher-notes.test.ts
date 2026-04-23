import { describe, it, expect } from "vitest";
import {
  CANNED_NOTES,
  cannedNotesForAction,
  insertCannedNote,
} from "../canned-teacher-notes";

/**
 * Phase 6-6l tests. Covers the preset list structure, action-to-
 * preset mapping, and the insert-with-append behaviour.
 */

describe("CANNED_NOTES structure", () => {
  it("has presets for all four action kinds", () => {
    expect(CANNED_NOTES.return.length).toBeGreaterThan(0);
    expect(CANNED_NOTES.reject.length).toBeGreaterThan(0);
    expect(CANNED_NOTES.approve.length).toBeGreaterThan(0);
    expect(CANNED_NOTES.note.length).toBeGreaterThan(0);
  });
  it("presets are non-empty strings", () => {
    for (const kind of ["return", "reject", "approve", "note"] as const) {
      for (const entry of CANNED_NOTES[kind]) {
        expect(typeof entry).toBe("string");
        expect(entry.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("cannedNotesForAction", () => {
  it("returns the matching preset list for each action", () => {
    expect(cannedNotesForAction("return")).toEqual(CANNED_NOTES.return);
    expect(cannedNotesForAction("reject")).toEqual(CANNED_NOTES.reject);
    expect(cannedNotesForAction("note")).toEqual(CANNED_NOTES.note);
  });
  it("maps approve-note to the approve preset list (same tone, optional note)", () => {
    expect(cannedNotesForAction("approve-note")).toEqual(CANNED_NOTES.approve);
  });
});

describe("insertCannedNote", () => {
  it("replaces an empty textarea with the preset", () => {
    expect(insertCannedNote("", "New preset text.")).toBe("New preset text.");
  });
  it("treats whitespace-only textarea as empty (replaces)", () => {
    expect(insertCannedNote("   \n  ", "New preset.")).toBe("New preset.");
  });
  it("appends the preset with a blank-line separator when textarea has content", () => {
    expect(insertCannedNote("Existing note.", "Extra preset.")).toBe(
      "Existing note.\n\nExtra preset."
    );
  });
  it("trims trailing whitespace from existing text before appending", () => {
    expect(insertCannedNote("Existing note.  \n", "Preset.")).toBe(
      "Existing note.\n\nPreset."
    );
  });
  it("is stable when the same preset is inserted twice (appends again)", () => {
    const once = insertCannedNote("", "A preset.");
    const twice = insertCannedNote(once, "A preset.");
    expect(twice).toBe("A preset.\n\nA preset.");
  });
});
