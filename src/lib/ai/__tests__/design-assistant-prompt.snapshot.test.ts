import { describe, it, expect } from "vitest";
import {
  buildDesignAssistantSystemPrompt,
  suggestQuestionType,
  assessEffort,
  QUESTION_TYPES,
  BLOOM_LEVELS,
} from "../design-assistant-prompt";

describe("buildDesignAssistantSystemPrompt", () => {
  it("generates baseline prompt (Bloom 1, default framework)", () => {
    const prompt = buildDesignAssistantSystemPrompt({
      bloomLevel: 1,
      effortScore: 5,
    });
    expect(prompt).toMatchSnapshot();
  });

  it("generates prompt at Bloom level 4 with activity context", () => {
    const prompt = buildDesignAssistantSystemPrompt({
      bloomLevel: 4,
      effortScore: 7,
      activityTitle: "Material Selection Analysis",
      activityPrompt: "Compare two materials for your phone stand prototype",
      unitTopic: "Product Design",
      gradeLevel: "MYP Year 4",
      criterionTags: ["B", "C"],
      previousTurns: 5,
    });
    expect(prompt).toMatchSnapshot();
  });

  it("generates prompt at Bloom level 6 (Create)", () => {
    const prompt = buildDesignAssistantSystemPrompt({
      bloomLevel: 6,
      effortScore: 8,
      previousTurns: 10,
    });
    expect(prompt).toMatchSnapshot();
  });

  it("includes effort alert when score <= 2", () => {
    const prompt = buildDesignAssistantSystemPrompt({
      bloomLevel: 2,
      effortScore: 1,
      previousTurns: 4,
    });
    expect(prompt).toContain("EFFORT ALERT");
    expect(prompt).toMatchSnapshot();
  });

  it("uses GCSE vocabulary when framework is GCSE_DT", () => {
    const prompt = buildDesignAssistantSystemPrompt({
      bloomLevel: 3,
      effortScore: 5,
      framework: "GCSE_DT",
    });
    expect(prompt).toContain("assessment objectives");
    expect(prompt).toContain("Investigate → Design → Make → Evaluate");
    expect(prompt).toMatchSnapshot();
  });

  it("uses ACARA vocabulary", () => {
    const prompt = buildDesignAssistantSystemPrompt({
      bloomLevel: 3,
      effortScore: 5,
      framework: "ACARA_DT",
    });
    expect(prompt).toContain("strands");
    expect(prompt).toContain("Investigating → Generating → Producing → Evaluating");
    expect(prompt).toMatchSnapshot();
  });

  it("start-of-conversation prompt differs from mid-conversation", () => {
    const startPrompt = buildDesignAssistantSystemPrompt({
      bloomLevel: 1,
      effortScore: 5,
      previousTurns: 0,
    });
    const midPrompt = buildDesignAssistantSystemPrompt({
      bloomLevel: 1,
      effortScore: 5,
      previousTurns: 5,
    });
    expect(startPrompt).toContain("START of a conversation");
    expect(midPrompt).not.toContain("START of a conversation");
  });
});

describe("suggestQuestionType", () => {
  it("suggests clarification for early turns", () => {
    expect(suggestQuestionType(1, 1)).toBe("clarification");
    expect(suggestQuestionType(2, 1)).toBe("clarification");
  });

  it("suggests assumption for turns 3-4", () => {
    expect(suggestQuestionType(3, 1)).toBe("assumption");
    expect(suggestQuestionType(4, 2)).toBe("assumption");
  });

  it("suggests viewpoint for high Bloom mid-turns", () => {
    expect(suggestQuestionType(5, 4)).toBe("viewpoint");
  });

  it("suggests evidence for normal mid-turns", () => {
    expect(suggestQuestionType(5, 2)).toBe("evidence");
  });

  it("suggests meta for late turns", () => {
    expect(suggestQuestionType(9, 3)).toBe("meta");
  });
});

describe("assessEffort", () => {
  it("penalizes very short messages", () => {
    expect(assessEffort("ok")).toBe(-1);
    expect(assessEffort("I don't know")).toBe(-1);
  });

  it("returns neutral for medium messages", () => {
    expect(assessEffort("I think wood would work")).toBe(0);
  });

  it("rewards longer messages", () => {
    expect(assessEffort("I think wood would be a good material because it is strong and easy to shape and also looks nice for a phone stand")).toBe(1);
  });
});

describe("constants", () => {
  it("QUESTION_TYPES has all 6 Richard Paul types", () => {
    expect(Object.keys(QUESTION_TYPES)).toHaveLength(6);
    expect(Object.keys(QUESTION_TYPES)).toEqual([
      "clarification", "assumption", "evidence", "viewpoint", "implication", "meta",
    ]);
  });

  it("BLOOM_LEVELS has 6 levels", () => {
    expect(Object.keys(BLOOM_LEVELS)).toHaveLength(6);
  });
});
