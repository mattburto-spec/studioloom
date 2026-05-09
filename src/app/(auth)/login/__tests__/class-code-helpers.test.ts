import { describe, it, expect } from "vitest";
import { normalizeClassCodeFromUrl } from "../class-code-helpers";

describe("normalizeClassCodeFromUrl", () => {
  it("uppercases lowercase URL segments to match server normalisation", () => {
    expect(normalizeClassCodeFromUrl("abc123")).toBe("ABC123");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeClassCodeFromUrl("  abc123  ")).toBe("ABC123");
  });

  it("slices overlong segments to the form's 6-char maxLength", () => {
    expect(normalizeClassCodeFromUrl("ABCDEFGH")).toBe("ABCDEF");
  });

  it("passes through valid 6-char codes unchanged", () => {
    expect(normalizeClassCodeFromUrl("ABC123")).toBe("ABC123");
  });

  it("returns empty string for empty input (lets the form's length>=4 guard reject)", () => {
    expect(normalizeClassCodeFromUrl("")).toBe("");
  });

  it("preserves codes shorter than 4 chars (server returns Invalid class code)", () => {
    expect(normalizeClassCodeFromUrl("AB")).toBe("AB");
  });
});
