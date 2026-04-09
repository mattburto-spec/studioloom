/**
 * Tests for W1 (input adapter) and W2 (output adapter)
 */

import { describe, it, expect } from "vitest";
import { wizardInputToGenerationRequest } from "../input-adapter";
import { timedUnitToContentData } from "../output-adapter";
import type { UnitWizardInput } from "@/types";
import type {
  TimedUnit,
  TimedLesson,
  TimedPhase,
  PolishedActivity,
  QualityReport,
  GenerationRequest,
  CostBreakdown,
  LessonExtension as PipelineLessonExtension,
} from "@/types/activity-blocks";

// ---------------------------------------------------------------------------
// Test helpers — minimal valid fixtures
// ---------------------------------------------------------------------------

const zeroCost: CostBreakdown = { inputTokens: 0, outputTokens: 0, totalUSD: 0 };

function makeActivity(overrides: Partial<PolishedActivity> = {}): PolishedActivity {
  return {
    source: "generated",
    title: "Test Activity",
    prompt: "Do this thing",
    bloom_level: "apply",
    time_weight: "moderate",
    grouping: "individual",
    phase: "work-time",
    activity_category: "making",
    lesson_structure_role: "core",
    response_type: "text",
    materials_needed: ["paper"],
    ...overrides,
  };
}

function makePhase(label: string, durationMinutes: number, activities: PolishedActivity[] = [makeActivity()]): TimedPhase {
  return {
    label,
    phaseId: label.toLowerCase().replace(/\s+/g, "-"),
    activities,
    durationMinutes,
    isFlexible: false,
  };
}

function makeLesson(overrides: Partial<TimedLesson> = {}): TimedLesson {
  return {
    position: 0,
    label: "Lesson 1",
    description: "First lesson",
    learningGoal: "Students will learn X",
    activities: [makeActivity()],
    phases: [
      makePhase("opening", 5),
      makePhase("mini-lesson", 10),
      makePhase("work-time", 30, [makeActivity(), makeActivity({ title: "Second Activity" })]),
      makePhase("debrief", 5),
    ],
    totalMinutes: 50,
    ...overrides,
  };
}

function makeTimedUnit(lessons: TimedLesson[] = [makeLesson()]): TimedUnit {
  return {
    request: {
      topic: "Test Topic",
      unitType: "design",
      lessonCount: lessons.length,
      gradeLevel: "Year 3 (Grade 8)",
      framework: "IB_MYP",
      constraints: {
        availableResources: [],
        periodMinutes: 60,
        workshopAccess: true,
        softwareAvailable: [],
      },
    },
    lessons,
    timingMetrics: {
      totalMinutesAllocated: 50,
      totalMinutesAvailable: 60,
      overflowLessons: [],
      timingSource: "starter_default",
      timingTimeMs: 100,
      timingCost: zeroCost,
    },
  };
}

function makeQualityReport(): QualityReport {
  return {
    overallScore: 7.5,
    dimensions: {
      cognitiveRigour: { score: 7, confidence: 0.8, subScores: {} },
      studentAgency: { score: 8, confidence: 0.8, subScores: {} },
      teacherCraft: { score: 7, confidence: 0.8, subScores: {} },
      variety: { score: 8, confidence: 0.8, subScores: {} },
      coherence: { score: 7, confidence: 0.8, subScores: {} },
    },
    coverage: { bloomLevels: {}, groupingTypes: {}, activityCategories: {}, phasesUsed: {} },
    libraryMetrics: { blocksUsed: 0, blocksAvailable: 0, coveragePercent: 0 },
    costSummary: zeroCost,
    recommendations: [],
  };
}

function makeWizardInput(overrides: Partial<UnitWizardInput> = {}): UnitWizardInput {
  return {
    title: "Chair Design",
    gradeLevel: "Year 3 (Grade 8)",
    durationWeeks: 4,
    selectedCriteria: ["A", "B", "C", "D"],
    topic: "Designing ergonomic chairs",
    globalContext: "Scientific and technical innovation",
    keyConcept: "Systems",
    relatedConcepts: ["Function", "Form"],
    statementOfInquiry: "Systems thinking leads to better design",
    atlSkills: ["Thinking"],
    specificSkills: [],
    resourceUrls: [],
    specialRequirements: "",
    ...overrides,
  } as UnitWizardInput;
}

// ===========================================================================
// W1: Input Adapter tests
// ===========================================================================

describe("wizardInputToGenerationRequest", () => {
  it("maps basic fields correctly", () => {
    const input = makeWizardInput();
    const req = wizardInputToGenerationRequest(input);

    expect(req.topic).toBe("Designing ergonomic chairs");
    expect(req.gradeLevel).toBe("Year 3 (Grade 8)");
    expect(req.framework).toBe("IB_MYP");
    expect(req.unitType).toBe("design");
  });

  it("falls back to title when topic is empty", () => {
    const input = makeWizardInput({ topic: "", title: "My Unit Title" });
    const req = wizardInputToGenerationRequest(input);
    expect(req.topic).toBe("My Unit Title");
  });

  it("falls back to 'Untitled Unit' when both topic and title are empty", () => {
    const input = makeWizardInput({ topic: "", title: "" });
    const req = wizardInputToGenerationRequest(input);
    expect(req.topic).toBe("Untitled Unit");
  });

  it("derives lessonCount from durationWeeks (2 per week)", () => {
    const input = makeWizardInput({ durationWeeks: 3 });
    const req = wizardInputToGenerationRequest(input);
    expect(req.lessonCount).toBe(6);
  });

  it("caps lessonCount at 20", () => {
    const input = makeWizardInput({ durationWeeks: 15 });
    const req = wizardInputToGenerationRequest(input);
    expect(req.lessonCount).toBe(20);
  });

  it("defaults durationWeeks to 4 when missing", () => {
    const input = makeWizardInput({ durationWeeks: undefined as unknown as number });
    const req = wizardInputToGenerationRequest(input);
    expect(req.lessonCount).toBe(8); // 4 * 2
  });

  it("defaults framework to IB_MYP", () => {
    const input = makeWizardInput({ framework: undefined });
    const req = wizardInputToGenerationRequest(input);
    expect(req.framework).toBe("IB_MYP");
  });

  it("defaults unitType to design", () => {
    const input = makeWizardInput({ unitType: undefined });
    const req = wizardInputToGenerationRequest(input);
    expect(req.unitType).toBe("design");
  });

  it("detects workshopAccess=false from special requirements", () => {
    const input = makeWizardInput({ specialRequirements: "No workshop available" });
    const req = wizardInputToGenerationRequest(input);
    expect(req.constraints.workshopAccess).toBe(false);
  });

  it("detects software from special requirements", () => {
    const input = makeWizardInput({ specialRequirements: "Students have Fusion 360 and Figma" });
    const req = wizardInputToGenerationRequest(input);
    expect(req.constraints.softwareAvailable).toContain("fusion 360");
    expect(req.constraints.softwareAvailable).toContain("figma");
  });

  it("passes through context fields", () => {
    const input = makeWizardInput({
      realWorldContext: "Local furniture industry",
      studentContext: "Mixed ability class",
      classroomConstraints: "Only 45 min periods",
    });
    const req = wizardInputToGenerationRequest(input);
    expect(req.context?.realWorldContext).toBe("Local furniture industry");
    expect(req.context?.studentContext).toBe("Mixed ability class");
    expect(req.context?.classroomConstraints).toBe("Only 45 min periods");
  });

  it("converts criteriaFocus to numeric weights", () => {
    const input = makeWizardInput({
      criteriaFocus: { A: "emphasis", B: "light", C: "standard", D: "emphasis" },
    });
    const req = wizardInputToGenerationRequest(input);
    expect(req.preferences?.criteriaEmphasis).toEqual({
      A: 1.5,
      B: 0.5,
      C: 1.0,
      D: 1.5,
    });
  });

  it("passes selectedCriteria as emphasisAreas", () => {
    const input = makeWizardInput({ selectedCriteria: ["A", "C"] });
    const req = wizardInputToGenerationRequest(input);
    expect(req.preferences?.emphasisAreas).toEqual(["A", "C"]);
  });

  it("passes resourceUrls as availableResources", () => {
    const input = makeWizardInput({ resourceUrls: ["https://example.com/doc.pdf"] });
    const req = wizardInputToGenerationRequest(input);
    expect(req.constraints.availableResources).toEqual(["https://example.com/doc.pdf"]);
  });

  it("passes curriculumContext through", () => {
    const input = makeWizardInput({ curriculumContext: "MYP Personal Project" });
    const req = wizardInputToGenerationRequest(input);
    expect(req.curriculumContext).toBe("MYP Personal Project");
  });

  it("handles service unit type", () => {
    const input = makeWizardInput({ unitType: "service" });
    const req = wizardInputToGenerationRequest(input);
    expect(req.unitType).toBe("service");
  });
});

// ===========================================================================
// W2: Output Adapter tests
// ===========================================================================

describe("timedUnitToContentData", () => {
  it("returns contentData with version 2 and pages array", () => {
    const unit = makeTimedUnit();
    const report = makeQualityReport();
    const input = makeWizardInput();

    const { contentData, pages } = timedUnitToContentData(unit, report, input);

    expect(contentData.version).toBe(2);
    expect(contentData.pages).toHaveLength(1);
    expect(pages).toHaveLength(1);
  });

  it("creates one page per lesson", () => {
    const lessons = [
      makeLesson({ label: "Lesson 1", position: 0 }),
      makeLesson({ label: "Lesson 2", position: 1 }),
      makeLesson({ label: "Lesson 3", position: 2 }),
    ];
    const unit = makeTimedUnit(lessons);
    const { pages } = timedUnitToContentData(unit, makeQualityReport(), makeWizardInput());

    expect(pages).toHaveLength(3);
    expect(pages[0].title).toBe("Lesson 1");
    expect(pages[1].title).toBe("Lesson 2");
    expect(pages[2].title).toBe("Lesson 3");
  });

  it("generates unique page IDs", () => {
    const lessons = [makeLesson(), makeLesson({ position: 1, label: "Lesson 2" })];
    const unit = makeTimedUnit(lessons);
    const { pages } = timedUnitToContentData(unit, makeQualityReport(), makeWizardInput());

    expect(pages[0].id).toMatch(/^page_/);
    expect(pages[1].id).toMatch(/^page_/);
    expect(pages[0].id).not.toBe(pages[1].id);
  });

  it("maps page type to strand", () => {
    const { pages } = timedUnitToContentData(makeTimedUnit(), makeQualityReport(), makeWizardInput());
    expect(pages[0].type).toBe("strand");
  });

  it("maps lesson label and learningGoal to page content", () => {
    const lesson = makeLesson({ label: "Ergonomic Design", learningGoal: "Understand ergonomics" });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    expect(pages[0].content.title).toBe("Ergonomic Design");
    expect(pages[0].content.learningGoal).toBe("Understand ergonomics");
  });

  it("collects activities from all phases into sections", () => {
    const lesson = makeLesson({
      phases: [
        makePhase("opening", 5, [makeActivity({ title: "Hook", prompt: "Hook prompt" })]),
        makePhase("mini-lesson", 10, [makeActivity({ title: "Demo", prompt: "Demo prompt" })]),
        makePhase("work-time", 30, [makeActivity({ title: "Build", prompt: "Build prompt" }), makeActivity({ title: "Test", prompt: "Test prompt" })]),
        makePhase("debrief", 5, [makeActivity({ title: "Reflect", prompt: "Reflect prompt" })]),
      ],
    });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    expect(pages[0].content.sections).toHaveLength(5);
    expect(pages[0].content.sections[0].prompt).toBe("Hook prompt");
    expect(pages[0].content.sections[4].prompt).toBe("Reflect prompt");
  });

  it("generates unique activity IDs", () => {
    const { pages } = timedUnitToContentData(makeTimedUnit(), makeQualityReport(), makeWizardInput());
    const ids = pages[0].content.sections.map((s) => s.activityId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^act_/));
  });

  it("maps workshop phases with correct durations", () => {
    const lesson = makeLesson({
      phases: [
        makePhase("opening", 5),
        makePhase("mini-lesson", 12),
        makePhase("work-time", 28),
        makePhase("debrief", 5),
      ],
    });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    const ws = pages[0].content.workshopPhases!;
    expect(ws.opening.durationMinutes).toBe(5);
    expect(ws.miniLesson.durationMinutes).toBe(12);
    expect(ws.workTime.durationMinutes).toBe(28);
    expect(ws.debrief.durationMinutes).toBe(5);
  });

  it("maps response types correctly", () => {
    const act = makeActivity({ response_type: "upload" });
    const lesson = makeLesson({ phases: [makePhase("work-time", 30, [act])] });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    expect(pages[0].content.sections[0].responseType).toBe("upload");
  });

  it("defaults invalid response types to text", () => {
    const act = makeActivity({ response_type: "invalid-type" });
    const lesson = makeLesson({ phases: [makePhase("work-time", 30, [act])] });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    expect(pages[0].content.sections[0].responseType).toBe("text");
  });

  it("maps grouping values correctly", () => {
    const act = makeActivity({ grouping: "small_group" });
    const lesson = makeLesson({ phases: [makePhase("work-time", 30, [act])] });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    expect(pages[0].content.sections[0].grouping).toBe("small_group");
  });

  it("maps scaffolding when present", () => {
    const act = makeActivity({
      scaffolding: {
        sentence_starters: ["I think..."],
        hints: ["Consider the user"],
      },
    });
    const lesson = makeLesson({ phases: [makePhase("work-time", 30, [act])] });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    const section = pages[0].content.sections[0];
    expect(section.scaffolding?.ell1?.sentenceStarters).toEqual(["I think..."]);
    expect(section.scaffolding?.ell1?.hints).toEqual(["Consider the user"]);
  });

  it("maps ai_rules when present", () => {
    const act = makeActivity({
      ai_rules: {
        phase: "divergent",
        tone: "encouraging",
        rules: ["push for more ideas"],
        forbidden_words: ["wrong"],
      },
    });
    const lesson = makeLesson({ phases: [makePhase("work-time", 30, [act])] });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    const section = pages[0].content.sections[0];
    expect(section.ai_rules?.phase).toBe("divergent");
    expect(section.ai_rules?.tone).toBe("encouraging");
    expect(section.ai_rules?.rules).toEqual(["push for more ideas"]);
  });

  it("converts lesson extensions", () => {
    const lesson = makeLesson({
      extensions: [
        { title: "Deep Dive", description: "Explore further", duration: 15, designPhase: "investigate" },
      ],
    });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    expect(pages[0].content.extensions).toHaveLength(1);
    expect(pages[0].content.extensions![0].title).toBe("Deep Dive");
    expect(pages[0].content.extensions![0].durationMinutes).toBe(15);
  });

  it("falls back to activities list when no phases", () => {
    const lesson = makeLesson({
      phases: [],
      activities: [makeActivity({ title: "Standalone", prompt: "Standalone prompt" })],
    });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    expect(pages[0].content.sections).toHaveLength(1);
    expect(pages[0].content.sections[0].prompt).toBe("Standalone prompt");
  });

  it("sets minimum durations for empty phases", () => {
    const lesson = makeLesson({
      phases: [makePhase("work-time", 40)],
      totalMinutes: 40,
    });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    const ws = pages[0].content.workshopPhases!;
    // opening and debrief should get minimum 5 min each, miniLesson minimum 5
    expect(ws.opening.durationMinutes).toBe(5);
    expect(ws.miniLesson.durationMinutes).toBe(5);
    expect(ws.debrief.durationMinutes).toBe(5);
    expect(ws.workTime.durationMinutes).toBe(40);
  });

  it("maps phase labels to workshop keys (variant names)", () => {
    const lesson = makeLesson({
      phases: [
        makePhase("warmup", 5),
        makePhase("instruction", 10),
        makePhase("core", 30),
        makePhase("reflection", 5),
      ],
    });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    const ws = pages[0].content.workshopPhases!;
    expect(ws.opening.durationMinutes).toBe(5);
    expect(ws.miniLesson.durationMinutes).toBe(10);
    expect(ws.workTime.durationMinutes).toBe(30);
    expect(ws.debrief.durationMinutes).toBe(5);
  });

  it("preserves tags from activity", () => {
    const act = makeActivity({ activity_category: "critique", phase: "debrief" });
    const lesson = makeLesson({ phases: [makePhase("debrief", 10, [act])] });
    const { pages } = timedUnitToContentData(makeTimedUnit([lesson]), makeQualityReport(), makeWizardInput());

    expect(pages[0].content.sections[0].tags).toContain("critique");
    expect(pages[0].content.sections[0].tags).toContain("debrief");
  });
});
