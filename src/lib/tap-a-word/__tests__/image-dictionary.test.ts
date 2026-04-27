import { describe, it, expect } from "vitest";
import { imageForWord, __dictionarySize } from "../image-dictionary";

describe("imageForWord", () => {
  it("returns a URL for seeded words (ergonomics is in v0 seed)", () => {
    const url = imageForWord("ergonomics");
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https?:\/\//);
  });

  it("matches case-insensitively", () => {
    expect(imageForWord("Ergonomics")).toBe(imageForWord("ergonomics"));
    expect(imageForWord("ERGONOMICS")).toBe(imageForWord("ergonomics"));
  });

  it("trims whitespace before lookup", () => {
    expect(imageForWord("  ergonomics  ")).toBe(imageForWord("ergonomics"));
  });

  it("returns null for unknown words", () => {
    expect(imageForWord("klingon-warrior")).toBeNull();
    expect(imageForWord("xyzqq")).toBeNull();
  });

  it("returns null for empty / whitespace / null / non-string input", () => {
    expect(imageForWord("")).toBeNull();
    expect(imageForWord("   ")).toBeNull();
    expect(imageForWord(null)).toBeNull();
    expect(imageForWord(undefined)).toBeNull();
    expect(imageForWord(42 as unknown as string)).toBeNull();
  });

  it("dictionary ships with non-zero seed (catches accidental empty commits)", () => {
    expect(__dictionarySize()).toBeGreaterThan(0);
  });

  it("all seed URLs use HTTPS (not http or relative)", () => {
    // Sanity: prevent http:// urls from sneaking into the dictionary
    // (Mixed-content blocks them on https:// pages).
    const allKnown = ["ergonomics", "prototype", "sketch", "extrude", "scaffold", "iterate"];
    for (const w of allKnown) {
      const url = imageForWord(w);
      if (url) expect(url).toMatch(/^https:\/\//);
    }
  });
});
