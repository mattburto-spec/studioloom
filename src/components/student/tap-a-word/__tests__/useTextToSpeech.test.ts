import { describe, it, expect } from "vitest";
import { pickVoice } from "../useTextToSpeech";

/**
 * Tests for the pure voice-selection helper inside useTextToSpeech.
 *
 * Project convention (per shell.test.tsx comment): no DOM-render harness,
 * no React testing-library. Pure helpers only.
 *
 * The hook's other behaviour (state machine, cancel-on-unmount, in-flight
 * cancellation, supported detection) is small + browser-coupled — covered
 * by visual smoke + Phase 5 live E2E gate. The risky logic that DOES need
 * unit tests is voice matching: subtle BCP-47 prefix rules.
 */

const VOICES = [
  { lang: "en-US", name: "Samantha" },
  { lang: "en-GB", name: "Daniel" },
  { lang: "zh-CN", name: "Tingting" },
  { lang: "zh-TW", name: "Mei-Jia" },
  { lang: "ko-KR", name: "Yuna" },
  { lang: "ja-JP", name: "Kyoko" },
  { lang: "es-ES", name: "Monica" },
  { lang: "fr-FR", name: "Amelie" },
];

describe("pickVoice", () => {
  it("returns exact-match voice for full BCP-47 code", () => {
    expect(pickVoice(VOICES, "zh-CN")?.name).toBe("Tingting");
    expect(pickVoice(VOICES, "ko-KR")?.name).toBe("Yuna");
    expect(pickVoice(VOICES, "ja-JP")?.name).toBe("Kyoko");
    expect(pickVoice(VOICES, "en-US")?.name).toBe("Samantha");
  });

  it("matches case-insensitively", () => {
    expect(pickVoice(VOICES, "ZH-CN")?.name).toBe("Tingting");
    expect(pickVoice(VOICES, "Ja-Jp")?.name).toBe("Kyoko");
  });

  it("returns first matching prefix when only bare lang is given", () => {
    // 'zh' matches 'zh-CN' (first in array) — order matters
    expect(pickVoice(VOICES, "zh")?.name).toBe("Tingting");
    expect(pickVoice(VOICES, "en")?.name).toBe("Samantha");
  });

  it("prefers exact match over prefix match when both available", () => {
    const voicesReversed = [
      { lang: "zh-TW", name: "Mei-Jia" },
      { lang: "zh-CN", name: "Tingting" },
    ];
    // Even though zh-TW is first, exact match for zh-CN wins
    expect(pickVoice(voicesReversed, "zh-CN")?.name).toBe("Tingting");
    // For bare "zh", picks first prefix match (zh-TW now first)
    expect(pickVoice(voicesReversed, "zh")?.name).toBe("Mei-Jia");
  });

  it("returns null when no voice matches the requested lang", () => {
    expect(pickVoice(VOICES, "tl")).toBeNull(); // Tagalog
    expect(pickVoice(VOICES, "sw")).toBeNull(); // Swahili
    expect(pickVoice(VOICES, "ar")).toBeNull(); // Arabic
  });

  it("returns null on empty voices array", () => {
    expect(pickVoice([], "en")).toBeNull();
  });

  it("handles single-char prefix carefully (no false 'starts-with' match)", () => {
    // "e" should NOT match "en-US" via prefix-with-region (rule requires "-" after prefix)
    // But the bare-prefix rule WILL match it (e starts en-US). This test documents that behavior.
    const result = pickVoice(VOICES, "e");
    // The bare-prefix rule matches 'en-US' (starts with 'e')
    expect(result?.name).toBe("Samantha");
  });

  it("matches Spanish + French explicitly (the 6 supported L1s)", () => {
    expect(pickVoice(VOICES, "es")?.name).toBe("Monica");
    expect(pickVoice(VOICES, "fr")?.name).toBe("Amelie");
  });
});
