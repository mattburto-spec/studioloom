import { describe, it, expect } from "vitest";
import { getGradeTimingProfile, buildTimingBlock } from "../prompts";

describe("getGradeTimingProfile", () => {
  it.each(["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"])(
    "returns profile for %s",
    (grade) => {
      const profile = getGradeTimingProfile(grade);
      expect(profile.mypYear).toBe(parseInt(grade.replace("Year ", ""), 10));
      expect(profile.warmupMinutes).toBeGreaterThan(0);
      expect(profile.maxHighCognitiveMinutes).toBeGreaterThan(0);
      expect(profile.maxHandsOnMinutes).toBeGreaterThan(0);
    }
  );

  it("defaults to Year 3 for unknown grade", () => {
    const profile = getGradeTimingProfile("Grade 8");
    expect(profile.mypYear).toBe(3);
  });

  it("cognitive load increases with year level", () => {
    const y1 = getGradeTimingProfile("Year 1");
    const y3 = getGradeTimingProfile("Year 3");
    const y5 = getGradeTimingProfile("Year 5");
    expect(y1.maxHighCognitiveMinutes).toBeLessThan(y3.maxHighCognitiveMinutes);
    expect(y3.maxHighCognitiveMinutes).toBeLessThan(y5.maxHighCognitiveMinutes);
  });
});

describe("buildTimingBlock", () => {
  it("generates timing block for Year 1 / 50 min lesson", () => {
    const profile = getGradeTimingProfile("Year 1");
    const block = buildTimingBlock(profile, 50);
    expect(block).toContain("Age-Appropriate Pacing");
    expect(block).toContain("50 minutes");
    expect(block).toMatchSnapshot();
  });

  it("generates timing block for Year 5 / 60 min lesson", () => {
    const profile = getGradeTimingProfile("Year 5");
    const block = buildTimingBlock(profile, 60);
    expect(block).toMatchSnapshot();
  });
});
