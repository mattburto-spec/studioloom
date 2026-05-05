/**
 * Tests for the preferred-color v1 helpers.
 *
 * Phase 8.1d-COLORv1 (4 May 2026). v1 is a hardcoded list with a
 * free-text "Other (specify)" escape hatch. v2 is deferred behind
 * FU-COLOR-PREFERENCE — see preferred-color-options.ts header.
 */

import { describe, expect, it } from "vitest";

import {
  PREFERRED_COLOR_MAX_LEN,
  PREFERRED_COLOR_NO_PREFERENCE,
  PREFERRED_COLOR_OPTIONS,
  PREFERRED_COLOR_OTHER_SENTINEL,
  resolveColorChoice,
  validatePreferredColor,
} from "../preferred-color-options";

describe("PREFERRED_COLOR_OPTIONS shape", () => {
  it("starts with the No preference default", () => {
    expect(PREFERRED_COLOR_OPTIONS[0]?.value).toBe(PREFERRED_COLOR_NO_PREFERENCE);
  });

  it("ends with the Other escape hatch", () => {
    const last = PREFERRED_COLOR_OPTIONS[PREFERRED_COLOR_OPTIONS.length - 1];
    expect(last?.value).toBe(PREFERRED_COLOR_OTHER_SENTINEL);
  });

  it("has unique values", () => {
    const values = PREFERRED_COLOR_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("validatePreferredColor", () => {
  it("returns null for null/undefined/empty", () => {
    expect(validatePreferredColor(null)).toEqual({ value: null });
    expect(validatePreferredColor(undefined)).toEqual({ value: null });
    expect(validatePreferredColor("")).toEqual({ value: null });
    expect(validatePreferredColor("   ")).toEqual({ value: null });
  });

  it("canonicalises 'No preference' to null", () => {
    expect(validatePreferredColor(PREFERRED_COLOR_NO_PREFERENCE)).toEqual({
      value: null,
    });
  });

  it("canonicalises bare sentinel to null (defensive — UI should replace)", () => {
    expect(validatePreferredColor(PREFERRED_COLOR_OTHER_SENTINEL)).toEqual({
      value: null,
    });
  });

  it("trims and accepts normal color strings", () => {
    expect(validatePreferredColor("PLA — Black")).toEqual({
      value: "PLA — Black",
    });
    expect(validatePreferredColor("  Other: neon pink  ")).toEqual({
      value: "Other: neon pink",
    });
  });

  it("rejects non-string types", () => {
    const result = validatePreferredColor(42);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
    }
  });

  it("rejects strings over the max length", () => {
    const tooLong = "x".repeat(PREFERRED_COLOR_MAX_LEN + 1);
    const result = validatePreferredColor(tooLong);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
      expect(result.error.message).toContain(String(PREFERRED_COLOR_MAX_LEN));
    }
  });
});

describe("resolveColorChoice", () => {
  it("maps No preference to null", () => {
    expect(resolveColorChoice(PREFERRED_COLOR_NO_PREFERENCE, "")).toBeNull();
  });

  it("passes through a known list value", () => {
    expect(resolveColorChoice("PLA — Black", "")).toBe("PLA — Black");
  });

  it("prefixes Other with 'Other: ' for fab readability", () => {
    expect(resolveColorChoice(PREFERRED_COLOR_OTHER_SENTINEL, "neon pink")).toBe(
      "Other: neon pink"
    );
  });

  it("returns null when Other selected with empty free text", () => {
    expect(resolveColorChoice(PREFERRED_COLOR_OTHER_SENTINEL, "")).toBeNull();
    expect(resolveColorChoice(PREFERRED_COLOR_OTHER_SENTINEL, "   ")).toBeNull();
  });

  it("clamps overlong free text to the max-length budget", () => {
    const giant = "z".repeat(200);
    const result = resolveColorChoice(PREFERRED_COLOR_OTHER_SENTINEL, giant);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(PREFERRED_COLOR_MAX_LEN);
    expect(result!.startsWith("Other: ")).toBe(true);
  });
});
