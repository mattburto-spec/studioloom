/**
 * Round 27 (7 May 2026) — StudioSetup onboarding trimmed.
 *
 * Per Matt: "remove the parts of the student onboarding that ask to
 * choose the different design styles from a picture and the mentor."
 *
 * Trimmed from 4 screens → 2:
 *   visualPicks (REMOVED)  +  mentor (REMOVED)
 *   conversation (KEPT)    +  welcome (KEPT)
 *
 * Default mentor = "kit", default theme = "warm" — both editable later
 * via Settings cog. The visualPicks + mentor screen JSX stays in the
 * file as dead branches (Screen state never enters them), since v2
 * Designer Mentor reactivates a richer version of those flows.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC = readFileSync(
  join(__dirname, "..", "StudioSetup.tsx"),
  "utf-8"
);

describe("StudioSetup — round 27 trim", () => {
  it("initial screen is 'conversation' (not 'visualPicks')", () => {
    expect(SRC).toMatch(
      /useState<Screen>\("conversation"\)/
    );
    expect(SRC).not.toMatch(/useState<Screen>\("visualPicks"\)/);
  });

  it("initial mentor = 'kit'", () => {
    expect(SRC).toMatch(
      /useState<MentorId \| null>\("kit"\)/
    );
  });

  it("initial theme = 'warm' (auto-derived from kit)", () => {
    expect(SRC).toMatch(
      /useState<ThemeId \| null>\("warm"\)/
    );
  });

  it("greeting fires on mount via useEffect (not via proceedFromMentor)", () => {
    expect(SRC).toMatch(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,400}showMentorReaction\([\s\S]{0,200}greeting/
    );
  });

  it("progress dots are trimmed to ['conversation', 'welcome']", () => {
    expect(SRC).toMatch(
      /\["conversation",\s*"welcome"\] as Screen\[\]/
    );
    // The old 4-element array should NOT appear inside the progress-dot map.
    expect(SRC).not.toMatch(
      /\["visualPicks",\s*"mentor",\s*"conversation",\s*"welcome"\] as Screen\[\]/
    );
  });

  it("Screen type union still includes all 4 (kept as dead branches for v2)", () => {
    // Keeping the Screen type intact lets the v2 Designer Mentor reintroduce
    // those flows without re-typing.
    expect(SRC).toMatch(
      /type Screen = "visualPicks"\s*\|\s*"mentor"\s*\|\s*"conversation"\s*\|\s*"welcome"/
    );
  });

  it("conversation sub-steps trimmed to 4 (learning_diffs removed 15 May 2026)", () => {
    // Round 28 trim: Matt didn't need ADHD/dyslexia/etc. info for the pilot.
    // The learning_differences field on LearningProfileData is preserved as
    // an empty array so downstream readers still type-check.
    expect(SRC).toMatch(
      /CONVO_STEPS:\s*ConvoStep\[\]\s*=\s*\[\s*"languages",\s*"confidence",\s*"working",\s*"feedback"\s*\]/
    );
    expect(SRC).not.toMatch(/"learning_diffs"/);
  });

  it("learning profile shape unchanged (downstream consumers still get the same data)", () => {
    expect(SRC).toContain("languages_at_home: string[]");
    expect(SRC).toContain("countries_lived_in: string[]");
    expect(SRC).toContain("design_confidence: 1 | 2 | 3 | 4 | 5");
    expect(SRC).toContain('working_style: "solo" | "partner" | "small_group"');
    expect(SRC).toContain('feedback_preference: "private" | "public"');
    expect(SRC).toContain("learning_differences: string[]");
  });

  it("onComplete still fires with mentorId + themeId + learningProfile + onboardingPicks", () => {
    expect(SRC).toMatch(
      /onComplete\(\{[\s\S]{0,300}mentorId:\s*selectedMentor[\s\S]{0,100}themeId[\s\S]{0,100}learningProfile[\s\S]{0,100}onboardingPicks/
    );
  });
});
