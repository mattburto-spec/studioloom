import { describe, it, expect } from "vitest";
import {
  mapLanguageToCode,
  resolveL1Target,
  l1DisplayLabel,
  SUPPORTED_L1_TARGETS,
} from "../language-mapping";

describe("mapLanguageToCode", () => {
  it("maps known English names case-insensitively", () => {
    expect(mapLanguageToCode("English")).toBe("en");
    expect(mapLanguageToCode("english")).toBe("en");
    expect(mapLanguageToCode("ENGLISH")).toBe("en");
  });

  it("maps multiple Chinese variants to zh", () => {
    expect(mapLanguageToCode("Mandarin")).toBe("zh");
    expect(mapLanguageToCode("Chinese")).toBe("zh");
    expect(mapLanguageToCode("Cantonese")).toBe("zh");
    expect(mapLanguageToCode("Putonghua")).toBe("zh");
    expect(mapLanguageToCode("中文")).toBe("zh");
  });

  it("maps Korean / Japanese", () => {
    expect(mapLanguageToCode("Korean")).toBe("ko");
    expect(mapLanguageToCode("한국어")).toBe("ko");
    expect(mapLanguageToCode("Japanese")).toBe("ja");
    expect(mapLanguageToCode("日本語")).toBe("ja");
  });

  it("maps Spanish / French with diacritic + non-diacritic forms", () => {
    expect(mapLanguageToCode("Spanish")).toBe("es");
    expect(mapLanguageToCode("Español")).toBe("es");
    expect(mapLanguageToCode("Castellano")).toBe("es");
    expect(mapLanguageToCode("French")).toBe("fr");
    expect(mapLanguageToCode("Français")).toBe("fr");
  });

  it("returns null for unmapped languages", () => {
    expect(mapLanguageToCode("Tagalog")).toBeNull();
    expect(mapLanguageToCode("Swahili")).toBeNull();
    expect(mapLanguageToCode("Klingon")).toBeNull();
  });

  it("returns null for empty / whitespace / null / non-string", () => {
    expect(mapLanguageToCode("")).toBeNull();
    expect(mapLanguageToCode("   ")).toBeNull();
    expect(mapLanguageToCode(null)).toBeNull();
    expect(mapLanguageToCode(undefined)).toBeNull();
    expect(mapLanguageToCode(42 as unknown as string)).toBeNull();
  });

  it("trims whitespace before lookup", () => {
    expect(mapLanguageToCode("  Mandarin  ")).toBe("zh");
  });
});

describe("resolveL1Target", () => {
  it("picks index 0 from the array", () => {
    expect(resolveL1Target(["Mandarin", "English"])).toBe("zh");
    expect(resolveL1Target(["English"])).toBe("en");
  });

  it("returns 'en' for empty / null / non-array", () => {
    expect(resolveL1Target([])).toBe("en");
    expect(resolveL1Target(null)).toBe("en");
    expect(resolveL1Target(undefined)).toBe("en");
  });

  it("returns 'en' for unmapped index 0 (safe fallback)", () => {
    expect(resolveL1Target(["Tagalog", "Mandarin"])).toBe("en");
  });
});

describe("l1DisplayLabel", () => {
  it("returns a human-readable label for every supported code", () => {
    for (const code of SUPPORTED_L1_TARGETS) {
      expect(l1DisplayLabel(code)).toBeTruthy();
      expect(typeof l1DisplayLabel(code)).toBe("string");
    }
  });

  it("returns specific labels for the 6 supported languages", () => {
    expect(l1DisplayLabel("en")).toBe("English");
    expect(l1DisplayLabel("zh")).toBe("Mandarin Chinese (Simplified)");
    expect(l1DisplayLabel("ko")).toBe("Korean");
    expect(l1DisplayLabel("ja")).toBe("Japanese");
    expect(l1DisplayLabel("es")).toBe("Spanish");
    expect(l1DisplayLabel("fr")).toBe("French");
  });
});
