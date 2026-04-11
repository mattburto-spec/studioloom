/**
 * Phase 2 sub-task 5.2 — Stage 4 neutral content enforcement tests.
 *
 * 7 tests:
 *  (1)-(4) validator throws on each forbidden framework token separately
 *  (5) validator passes the captured neutral fixture
 *  (6) criterion_tags pass-through schema is well-formed
 *  (7) integration — validator runs INSIDE stage4_polish (mocked AI)
 *
 * If any of these fire, read docs/projects/dimensions3-phase-2-brief.md
 * §5 row 5.2 BEFORE "fixing" — the validator is fail-loud by design.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateNeutralContent,
  NeutralValidationError,
  NEUTRAL_CRITERION_KEYS,
} from "../stages/stage4-neutral-validator";

const FIXTURE_PATH = join(
  process.cwd(),
  "tests/fixtures/phase-2/stage4-neutral-baseline.json"
);

interface FixtureActivity {
  id: string;
  title: string;
  prompt: string;
  criterion_tags?: string[];
}
interface FixtureLesson {
  position: number;
  label: string;
  description: string;
  learningGoal: string;
  activities: FixtureActivity[];
}
interface Fixture {
  request: { topic: string };
  lessons: FixtureLesson[];
}

function loadFixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;
}

describe("stage4 neutral content enforcement (Phase 2 sub-task 5.2)", () => {
  it("throws NeutralValidationError on 'Criterion A'", () => {
    expect(() =>
      validateNeutralContent("Now apply Criterion A to your design.")
    ).toThrow(NeutralValidationError);
    try {
      validateNeutralContent("Now apply Criterion A to your design.");
    } catch (e) {
      expect(e).toBeInstanceOf(NeutralValidationError);
      expect((e as Error).message).toContain("Criterion A-D");
    }
  });

  it("throws NeutralValidationError on 'AO2'", () => {
    expect(() =>
      validateNeutralContent("This activity targets AO2.")
    ).toThrow(NeutralValidationError);
    try {
      validateNeutralContent("This activity targets AO2.");
    } catch (e) {
      expect((e as Error).message).toContain("AO1-AO4");
    }
  });

  it("throws NeutralValidationError on 'MYP'", () => {
    expect(() =>
      validateNeutralContent("Aligned to MYP standards.")
    ).toThrow(NeutralValidationError);
    try {
      validateNeutralContent("Aligned to MYP standards.");
    } catch (e) {
      expect((e as Error).message).toContain("MYP");
    }
  });

  it("throws NeutralValidationError on 'GCSE'", () => {
    expect(() =>
      validateNeutralContent("GCSE assessment criteria apply here.")
    ).toThrow(NeutralValidationError);
    try {
      validateNeutralContent("GCSE assessment criteria apply here.");
    } catch (e) {
      expect((e as Error).message).toContain("GCSE");
    }
  });

  it("validator passes neutral output (captured fixture)", () => {
    const fixture = loadFixture();
    const parts: string[] = [fixture.request.topic];
    for (const lesson of fixture.lessons) {
      parts.push(lesson.label, lesson.description, lesson.learningGoal);
      for (const act of lesson.activities) {
        parts.push(act.title, act.prompt);
      }
    }
    const concatenated = parts.join("\n");
    expect(() => validateNeutralContent(concatenated)).not.toThrow();
  });

  it("criterion_tags pass-through schema is well-formed", () => {
    const fixture = loadFixture();
    const allowedKeys = new Set<string>(NEUTRAL_CRITERION_KEYS);
    const distinctKeys = new Set<string>();
    let activitiesWithTags = 0;

    for (const lesson of fixture.lessons) {
      for (const act of lesson.activities) {
        if (act.criterion_tags !== undefined) {
          activitiesWithTags++;
          expect(Array.isArray(act.criterion_tags)).toBe(true);
          expect(act.criterion_tags.length).toBeGreaterThan(0);
          for (const tag of act.criterion_tags) {
            expect(typeof tag).toBe("string");
            expect(allowedKeys.has(tag)).toBe(true);
            distinctKeys.add(tag);
          }
        }
      }
    }

    expect(activitiesWithTags).toBeGreaterThan(0);
    expect(distinctKeys.size).toBeGreaterThanOrEqual(4);
  });
});

// Integration test — isolated describe with scoped mock of @anthropic-ai/sdk
// so it can't pollute sibling test files (e.g. stages.test.ts).
describe("stage4 neutral content enforcement — integration (Phase 2 sub-task 5.2)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@anthropic-ai/sdk");
  });

  it("validator runs INSIDE stage4_polish and throws on forbidden AI output", async () => {
    const forbiddenJson = JSON.stringify({
      activities: [
        {
          lessonPosition: 1,
          activityIndex: 0,
          transitionIn: "Apply Criterion B here",
          crossReferences: [],
        },
      ],
      interactionMap: [],
      scaffoldingNotes: {},
    });

    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: forbiddenJson }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    // Import AFTER the mock is installed so stage4-polish picks up the
    // mocked Anthropic class.
    const { stage4_polish } = await import("../stages/stage4-polish");

    const fixture = loadFixture();
    const filled = {
      ...fixture,
      generationMetrics: {
        gapsFilled: 0,
        totalTokensUsed: 0,
        totalCost: {
          inputTokens: 0,
          outputTokens: 0,
          modelId: "fixture",
          estimatedCostUSD: 0,
          timeMs: 0,
        },
        generationTimeMs: 0,
        perGapMetrics: [],
      },
    };

    // Minimal FormatProfile — stage4 reads cycleName + connectiveTissue in the prompt.
    // Stub values are fine; this test exercises neutral-validator integration, not prompt content.
    const minimalProfile = {
      cycleName: "Design",
      connectiveTissue: {
        transitionVocabulary: [],
        reflectionStyle: "end-only",
        audienceLanguage: "your audience",
      },
    } as unknown as import("@/lib/ai/unit-types").FormatProfile;

    // Note: we match by message + error.name (not instanceof) because
    // vi.resetModules() hands stage4_polish a fresh copy of
    // NeutralValidationError distinct from the top-of-file import.
    let caught: unknown;
    try {
      await stage4_polish(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filled as any,
        minimalProfile,
        { apiKey: "fake" }
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect((caught as Error).name).toBe("NeutralValidationError");
    expect((caught as Error).message).toContain("Criterion A-D");
    expect((caught as Error).message).toContain("Criterion B");
  });
});
