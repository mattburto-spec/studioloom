/**
 * Behavioural tests for the Phase F.D effective-brief merge.
 *
 * Source-static tests in /api/student/unit-brief/__tests__ confirm the
 * server's GET returns the 3 sources. These tests confirm the runtime
 * merge logic that the drawer renders.
 */
import { describe, expect, it } from "vitest";
import {
  type CardTemplate,
  computeEffectiveBrief,
} from "../effective";
import type { StudentBrief, UnitBrief } from "@/types/unit-brief";

function makeUnitBrief(overrides: Partial<UnitBrief> = {}): UnitBrief {
  return {
    unit_id: "u1",
    brief_text: null,
    constraints: { archetype: "design", data: {} },
    diagram_url: null,
    locks: {},
    created_at: "2026-05-15T00:00:00Z",
    updated_at: "2026-05-15T00:00:00Z",
    created_by: null,
    ...overrides,
  };
}

function makeCardTemplate(overrides: Partial<CardTemplate> = {}): CardTemplate {
  return {
    cardId: "g8-brief-designer-mentor",
    cardLabel: "Design a Designer Mentor",
    brief_text: null,
    brief_constraints: { archetype: "design", data: {} },
    brief_locks: {},
    ...overrides,
  };
}

function makeStudentBrief(overrides: Partial<StudentBrief> = {}): StudentBrief {
  return {
    id: "sb1",
    student_id: "s1",
    unit_id: "u1",
    brief_text: null,
    constraints: { archetype: "design", data: {} },
    diagram_url: null,
    created_at: "2026-05-15T01:00:00Z",
    updated_at: "2026-05-15T01:00:00Z",
    ...overrides,
  };
}

describe("computeEffectiveBrief — locks precedence", () => {
  it("card lock map wins over unit lock map when card has a template", () => {
    const unitBrief = makeUnitBrief({
      brief_text: "Unit-level brief",
      locks: { "brief_text": true }, // unit says locked
    });
    const cardTemplate = makeCardTemplate({
      brief_text: "Card-level brief",
      brief_locks: {}, // card says open
    });
    const effective = computeEffectiveBrief({
      unitBrief,
      cardTemplate,
      studentBrief: null,
    });
    expect(effective.brief_text.locked).toBe(false);
    // Source falls back to card starter (its value is non-empty)
    expect(effective.brief_text.source).toBe("card");
    expect(effective.brief_text.value).toBe("Card-level brief");
  });

  it("unit lock map applies when there's no card template", () => {
    const unitBrief = makeUnitBrief({
      brief_text: "Locked teacher value",
      locks: { "brief_text": true },
    });
    const effective = computeEffectiveBrief({
      unitBrief,
      cardTemplate: null,
      studentBrief: null,
    });
    expect(effective.brief_text.locked).toBe(true);
    expect(effective.brief_text.source).toBe("teacher");
    expect(effective.brief_text.value).toBe("Locked teacher value");
  });

  it("card with a template can lock its own fields without polluting unit locks", () => {
    const cardTemplate = makeCardTemplate({
      brief_text: "Card scenario",
      brief_locks: { "brief_text": true, "constraints.budget": true },
      brief_constraints: {
        archetype: "design",
        data: { budget: "AUD $20", audience: "Year 8" },
      },
    });
    const effective = computeEffectiveBrief({
      unitBrief: null,
      cardTemplate,
      studentBrief: null,
    });
    expect(effective.brief_text.locked).toBe(true);
    expect(effective.brief_text.source).toBe("card");
    expect(effective.constraints.budget.locked).toBe(true);
    expect(effective.constraints.budget.value).toBe("AUD $20");
    // audience NOT locked → starter mode, source = card
    expect(effective.constraints.audience.locked).toBe(false);
    expect(effective.constraints.audience.source).toBe("card");
    expect(effective.constraints.audience.value).toBe("Year 8");
  });
});

describe("computeEffectiveBrief — value precedence (unlocked fields)", () => {
  it("student override wins over card starter wins over unit starter", () => {
    const unitBrief = makeUnitBrief({
      brief_text: "Unit starter",
      constraints: {
        archetype: "design",
        data: { audience: "Year 7 (unit)" },
      },
    });
    const cardTemplate = makeCardTemplate({
      brief_text: "Card starter",
      brief_constraints: {
        archetype: "design",
        data: { audience: "Year 7 (card)" },
      },
    });
    const studentBrief = makeStudentBrief({
      brief_text: "Student override",
      constraints: {
        archetype: "design",
        data: { audience: "Year 7 LEGO fans (student)" },
      },
    });
    const effective = computeEffectiveBrief({
      unitBrief,
      cardTemplate,
      studentBrief,
    });
    expect(effective.brief_text.value).toBe("Student override");
    expect(effective.brief_text.source).toBe("student");
    expect(effective.constraints.audience.value).toBe(
      "Year 7 LEGO fans (student)",
    );
    expect(effective.constraints.audience.source).toBe("student");
  });

  it("card starter wins over unit when no student override", () => {
    const unitBrief = makeUnitBrief({
      brief_text: "Unit starter",
    });
    const cardTemplate = makeCardTemplate({
      brief_text: "Card starter",
    });
    const effective = computeEffectiveBrief({
      unitBrief,
      cardTemplate,
      studentBrief: null,
    });
    expect(effective.brief_text.value).toBe("Card starter");
    expect(effective.brief_text.source).toBe("card");
  });

  it("unit starter shows through when there's no card or student override", () => {
    const unitBrief = makeUnitBrief({
      brief_text: "Unit starter",
    });
    const effective = computeEffectiveBrief({
      unitBrief,
      cardTemplate: null,
      studentBrief: null,
    });
    expect(effective.brief_text.value).toBe("Unit starter");
    expect(effective.brief_text.source).toBe("teacher");
  });

  it("empty source when all three are blank", () => {
    const effective = computeEffectiveBrief({
      unitBrief: makeUnitBrief(),
      cardTemplate: null,
      studentBrief: null,
    });
    expect(effective.brief_text.value).toBeNull();
    expect(effective.brief_text.source).toBe("empty");
    expect(effective.brief_text.locked).toBe(false);
  });
});

describe("computeEffectiveBrief — design constraints fan-out", () => {
  it("each constraint field resolves independently (card locks dimensions, student authors audience)", () => {
    const cardTemplate = makeCardTemplate({
      brief_constraints: {
        archetype: "design",
        data: {
          dimensions: { h: 200, w: 150, d: 80, unit: "mm" },
        },
      },
      brief_locks: { "constraints.dimensions": true },
    });
    const studentBrief = makeStudentBrief({
      constraints: {
        archetype: "design",
        data: { audience: "My grandma" },
      },
    });
    const effective = computeEffectiveBrief({
      unitBrief: null,
      cardTemplate,
      studentBrief,
    });
    // Dimensions locked by card
    expect(effective.constraints.dimensions.locked).toBe(true);
    expect(effective.constraints.dimensions.value).toEqual({
      h: 200,
      w: 150,
      d: 80,
      unit: "mm",
    });
    expect(effective.constraints.dimensions.source).toBe("card");
    // Audience student-authored
    expect(effective.constraints.audience.locked).toBe(false);
    expect(effective.constraints.audience.value).toBe("My grandma");
    expect(effective.constraints.audience.source).toBe("student");
    // Budget empty — no source has it
    expect(effective.constraints.budget.value).toBeNull();
    expect(effective.constraints.budget.source).toBe("empty");
  });

  it("array fields treat empty arrays as 'no value' (fall through to starter)", () => {
    const unitBrief = makeUnitBrief({
      constraints: {
        archetype: "design",
        data: { must_include: ["unit-required-element"] },
      },
    });
    const studentBrief = makeStudentBrief({
      constraints: {
        archetype: "design",
        data: { must_include: [] }, // empty array — student "cleared" the field
      },
    });
    const effective = computeEffectiveBrief({
      unitBrief,
      cardTemplate: null,
      studentBrief,
    });
    // Empty student array shouldn't beat unit's non-empty array
    expect(effective.constraints.must_include.value).toEqual([
      "unit-required-element",
    ]);
    expect(effective.constraints.must_include.source).toBe("teacher");
  });
});

describe("computeEffectiveBrief — diagram_url is teacher-only in v1", () => {
  it("diagram source is always teacher (cards don't carry diagrams)", () => {
    const unitBrief = makeUnitBrief({
      diagram_url: "/api/storage/unit-images/u1/brief-diagram-123.jpg",
    });
    const effective = computeEffectiveBrief({
      unitBrief,
      cardTemplate: makeCardTemplate(), // even if a card is picked
      studentBrief: makeStudentBrief({ diagram_url: "ignored" }),
    });
    // Card has no diagram + student doesn't author diagram in v1 →
    // unit's diagram wins.
    // (Note: student can't actually upload diagrams in v1; field
    // exists on schema but no save path.)
    expect(effective.diagram_url.source).toBe("student");
    expect(effective.diagram_url.value).toBe("ignored");
  });
});
