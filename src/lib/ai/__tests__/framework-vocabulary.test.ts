import { describe, it, expect } from "vitest";
import {
  getFrameworkVocabulary,
  buildFrameworkPromptBlock,
  getSupportedFrameworks,
} from "../framework-vocabulary";

describe("getFrameworkVocabulary", () => {
  it("returns IB_MYP as default when no framework specified", () => {
    const vocab = getFrameworkVocabulary();
    expect(vocab.name).toBe("IB MYP Design");
    expect(vocab.criteriaLabels).toEqual(["A", "B", "C", "D"]);
  });

  it("returns IB_MYP for unknown framework", () => {
    const vocab = getFrameworkVocabulary("UNKNOWN_FRAMEWORK");
    expect(vocab.name).toBe("IB MYP Design");
  });

  it.each(["IB_MYP", "GCSE_DT", "ACARA_DT", "PLTW", "A_LEVEL_DT", "IGCSE_DT", "NESA_DT", "VIC_DT"])(
    "returns valid vocabulary for %s",
    (framework) => {
      const vocab = getFrameworkVocabulary(framework);
      expect(vocab.name).toBeTruthy();
      expect(vocab.criteriaLabels.length).toBeGreaterThan(0);
      expect(vocab.designCyclePhases.length).toBeGreaterThan(0);
      expect(vocab.preferredVerbs.length).toBeGreaterThan(0);
      expect(vocab.assessmentScale).toBeTruthy();
      expect(Object.keys(vocab.criteriaNames).length).toBe(vocab.criteriaLabels.length);
    }
  );
});

describe("buildFrameworkPromptBlock", () => {
  it("returns empty string for IB_MYP (default)", () => {
    expect(buildFrameworkPromptBlock("IB_MYP")).toBe("");
    expect(buildFrameworkPromptBlock()).toBe("");
  });

  it("generates prompt block for GCSE_DT", () => {
    const block = buildFrameworkPromptBlock("GCSE_DT");
    expect(block).toContain("GCSE");
    expect(block).toContain("assessment objectives");
    expect(block).toContain("NOT IB MYP");
    expect(block).toMatchSnapshot();
  });

  it("generates prompt block for each non-MYP framework", () => {
    for (const fw of ["GCSE_DT", "ACARA_DT", "PLTW", "A_LEVEL_DT", "IGCSE_DT", "NESA_DT", "VIC_DT"]) {
      const block = buildFrameworkPromptBlock(fw);
      expect(block).toContain("NOT IB MYP");
      expect(block.length).toBeGreaterThan(100);
    }
  });
});

describe("getSupportedFrameworks", () => {
  it("returns all 8 frameworks", () => {
    const frameworks = getSupportedFrameworks();
    expect(frameworks).toHaveLength(8);
    expect(frameworks).toContain("IB_MYP");
    expect(frameworks).toContain("GCSE_DT");
    expect(frameworks).toContain("ACARA_DT");
    expect(frameworks).toContain("PLTW");
    expect(frameworks).toContain("A_LEVEL_DT");
    expect(frameworks).toContain("IGCSE_DT");
    expect(frameworks).toContain("NESA_DT");
    expect(frameworks).toContain("VIC_DT");
  });
});
