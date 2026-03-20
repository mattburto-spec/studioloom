import { describe, it, expect } from "vitest";
import {
  validateLessonTiming,
  TIMING_PRESETS,
  applyTimingPreset,
} from "../timing-validation";
import type {
  GeneratedLesson,
  TimingValidationResult,
} from "../timing-validation";
import { getGradeTimingProfile } from "../prompts";
import type { TimingContext } from "../prompts";

const profile = getGradeTimingProfile("Year 3");
const defaultTimingCtx: TimingContext = {
  periodMinutes: 50,
  isWorkshop: false,
  transitionMinutes: 3,
  setupMinutes: 0,
  cleanupMinutes: 0,
  gradeProfile: profile,
};

function makeLesson(overrides: Partial<GeneratedLesson> = {}): GeneratedLesson {
  return {
    title: "Test Lesson",
    learningGoal: "Learn something",
    workshopPhases: {
      opening: { durationMinutes: 5, hook: "Hook question" },
      miniLesson: { durationMinutes: 10, focus: "Key concept" },
      workTime: { durationMinutes: 22, focus: "Student work" },
      debrief: { durationMinutes: 7, protocol: "quick-share", prompt: "Share one thing" },
    },
    sections: [
      { prompt: "Do this", durationMinutes: 15, responseType: "text" },
      { prompt: "Do that", durationMinutes: 7, responseType: "upload" },
    ],
    extensions: [
      { title: "Go deeper", description: "Research more", durationMinutes: 10 },
      { title: "Try another", description: "Alternative approach", durationMinutes: 10 },
    ],
    ...overrides,
  };
}

describe("validateLessonTiming", () => {
  const profile = getGradeTimingProfile("Year 3");

  it("passes validation for a well-formed lesson", () => {
    const lesson = makeLesson();
    const result = validateLessonTiming(lesson, profile, defaultTimingCtx);
    expect(result.stats.usableMinutes).toBeGreaterThan(0);
    expect(result.repairedLesson).toBeTruthy();
    expect(result.repairedLesson.workshopPhases).toBeTruthy();
  });

  it("auto-repairs missing workshopPhases", () => {
    const lesson = makeLesson({ workshopPhases: undefined });
    const result = validateLessonTiming(lesson, profile, defaultTimingCtx);
    expect(result.repairedLesson.workshopPhases).toBeTruthy();
    expect(result.issues.some((i) => i.code === "MISSING_PHASES")).toBe(true);
  });

  it("auto-repairs over-cap instruction time", () => {
    const lesson = makeLesson({
      workshopPhases: {
        opening: { durationMinutes: 5 },
        miniLesson: { durationMinutes: 30, focus: "Way too long" },
        workTime: { durationMinutes: 10, focus: "Work" },
        debrief: { durationMinutes: 5, protocol: "quick-share", prompt: "Share" },
      },
    });
    const result = validateLessonTiming(lesson, profile, defaultTimingCtx);
    const repairedMiniLesson = result.repairedLesson.workshopPhases!.miniLesson;
    expect(repairedMiniLesson.durationMinutes).toBeLessThanOrEqual(
      result.stats.instructionCap
    );
  });

  it("auto-repairs missing debrief", () => {
    const lesson = makeLesson({
      workshopPhases: {
        opening: { durationMinutes: 5 },
        miniLesson: { durationMinutes: 10 },
        workTime: { durationMinutes: 30 },
        debrief: { durationMinutes: 0 },
      },
    });
    const result = validateLessonTiming(lesson, profile, defaultTimingCtx);
    expect(result.repairedLesson.workshopPhases!.debrief.durationMinutes).toBeGreaterThanOrEqual(5);
  });

  it("flags missing extensions", () => {
    const lesson = makeLesson({ extensions: undefined });
    const result = validateLessonTiming(lesson, profile, defaultTimingCtx);
    expect(result.issues.some((i) => i.code === "NO_EXTENSIONS")).toBe(true);
  });

  it("returns stats with correct usable time calculation", () => {
    const lesson = makeLesson();
    const result = validateLessonTiming(lesson, profile, defaultTimingCtx);
    // 50 min period - 3 min transition - setup/cleanup = usable time
    expect(result.stats.usableMinutes).toBeLessThan(50);
    expect(result.stats.usableMinutes).toBeGreaterThan(30);
  });

  it("validates work time floor (45%)", () => {
    const lesson = makeLesson({
      workshopPhases: {
        opening: { durationMinutes: 10 },
        miniLesson: { durationMinutes: 15 },
        workTime: { durationMinutes: 5, focus: "Tiny" },
        debrief: { durationMinutes: 10, protocol: "quick-share", prompt: "Share" },
      },
    });
    const result = validateLessonTiming(lesson, profile, defaultTimingCtx);
    const repairedWorkTime = result.repairedLesson.workshopPhases!.workTime.durationMinutes;
    expect(repairedWorkTime).toBeGreaterThan(5);
  });
});

describe("TIMING_PRESETS", () => {
  it("has at least 3 presets", () => {
    expect(TIMING_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it("all presets have required fields", () => {
    for (const preset of TIMING_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(typeof preset.getPhases).toBe("function");
    }
  });

  it("all presets produce valid phases for 44 usable minutes", () => {
    for (const preset of TIMING_PRESETS) {
      const phases = preset.getPhases(44, 14); // 44 usable, 14 min cap (Year 3, age 13)
      expect(phases.opening.durationMinutes).toBeGreaterThan(0);
      expect(phases.miniLesson.durationMinutes).toBeGreaterThan(0);
      expect(phases.workTime.durationMinutes).toBeGreaterThan(0);
      expect(phases.debrief.durationMinutes).toBeGreaterThanOrEqual(5);
      const total =
        phases.opening.durationMinutes +
        phases.miniLesson.durationMinutes +
        phases.workTime.durationMinutes +
        phases.debrief.durationMinutes;
      expect(total).toBeGreaterThanOrEqual(40);
      expect(total).toBeLessThanOrEqual(48);
    }
  });
});

describe("applyTimingPreset", () => {
  const profile = getGradeTimingProfile("Year 3");

  it("applies Balanced preset correctly", () => {
    const phases = applyTimingPreset("balanced", profile, defaultTimingCtx);
    expect(phases).not.toBeNull();
    expect(phases!.opening.durationMinutes).toBeGreaterThan(0);
    expect(phases!.miniLesson.durationMinutes).toBeGreaterThan(0);
    expect(phases!.workTime.durationMinutes).toBeGreaterThan(0);
    expect(phases!.debrief.durationMinutes).toBeGreaterThanOrEqual(5);
  });

  it("returns null for unknown preset", () => {
    const phases = applyTimingPreset("nonexistent", profile, defaultTimingCtx);
    expect(phases).toBeNull();
  });

  it("hands-on preset has more work time than balanced", () => {
    const balanced = applyTimingPreset("balanced", profile, defaultTimingCtx);
    const handsOn = applyTimingPreset("hands-on", profile, defaultTimingCtx);
    expect(balanced).not.toBeNull();
    expect(handsOn).not.toBeNull();
    expect(handsOn!.workTime.durationMinutes).toBeGreaterThanOrEqual(
      balanced!.workTime.durationMinutes
    );
  });
});
