/**
 * TG.0C.1 — validator unit tests
 *
 * Per Lesson #38: assertions check expected values, not just non-null.
 * Coverage: happy path, missing fields, type mismatches, oversize input,
 * invalid criterion keys, invalid task_type, summative-rejection (TG.0C scope).
 */

import { describe, it, expect } from "vitest";
import {
  validateCreateTaskInput,
  validateFormativeConfig,
  validateUpdateTaskInput,
} from "../validators";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";
const VALID_UUID_2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("validateFormativeConfig", () => {
  it("accepts a minimal valid config (criteria only)", () => {
    const result = validateFormativeConfig({ criteria: ["researching"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.criteria).toEqual(["researching"]);
      expect(result.value.due_date).toBeUndefined();
      expect(result.value.linked_pages).toBeUndefined();
    }
  });

  it("accepts criteria + due_date + linked_pages", () => {
    const result = validateFormativeConfig({
      criteria: ["analysing", "designing"],
      due_date: "2026-05-15",
      linked_pages: [{ unit_id: VALID_UUID, page_id: "L01" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.criteria).toHaveLength(2);
      expect(result.value.due_date).toBe("2026-05-15");
      expect(result.value.linked_pages).toEqual([
        { unit_id: VALID_UUID, page_id: "L01" },
      ]);
    }
  });

  it("rejects null/missing config", () => {
    const r1 = validateFormativeConfig(null);
    const r2 = validateFormativeConfig(undefined);
    const r3 = validateFormativeConfig("not an object");
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(r3.ok).toBe(false);
  });

  it("rejects empty criteria array", () => {
    const result = validateFormativeConfig({ criteria: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("at least one"))).toBe(true);
    }
  });

  it("rejects non-neutral criterion keys", () => {
    const result = validateFormativeConfig({ criteria: ["A", "researching"] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("invalid key"))).toBe(true);
      // Should explicitly call out "A" — Lesson #38: assert specific value
      expect(result.errors.some((e) => e.includes('"A"'))).toBe(true);
    }
  });

  it("rejects malformed due_date", () => {
    const r1 = validateFormativeConfig({
      criteria: ["researching"],
      due_date: "May 15, 2026",
    });
    const r2 = validateFormativeConfig({
      criteria: ["researching"],
      due_date: "2026-13-01", // valid format, invalid month — pattern only catches format
    });
    expect(r1.ok).toBe(false);
    // r2 passes the regex but real date validation is at DB layer
    expect(r2.ok).toBe(true);
  });

  it("rejects linked_pages without unit_id or page_id", () => {
    const result = validateFormativeConfig({
      criteria: ["researching"],
      linked_pages: [{ unit_id: VALID_UUID } as any, { page_id: "L02" } as any],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("[0].page_id"))).toBe(true);
      expect(result.errors.some((e) => e.includes("[1].unit_id"))).toBe(true);
    }
  });
});

describe("validateCreateTaskInput", () => {
  function validQuickCheckBody(overrides: Record<string, unknown> = {}) {
    return {
      unit_id: VALID_UUID,
      title: "Quiz 1",
      task_type: "formative",
      config: { criteria: ["researching"] },
      criteria: [{ key: "researching", weight: 100 }],
      ...overrides,
    };
  }

  it("accepts a minimal valid Quick-Check payload", () => {
    const result = validateCreateTaskInput(validQuickCheckBody());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unit_id).toBe(VALID_UUID);
      expect(result.value.title).toBe("Quiz 1");
      expect(result.value.task_type).toBe("formative");
      expect(result.value.status).toBe("draft"); // default
      expect(result.value.criteria).toEqual([
        { key: "researching", weight: 100 },
      ]);
      expect(result.value.class_id).toBeNull(); // default
    }
  });

  it("trims title whitespace", () => {
    const result = validateCreateTaskInput(
      validQuickCheckBody({ title: "   Quiz 1   " })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Quiz 1");
    }
  });

  it("defaults criteria weight to 100 if omitted", () => {
    const result = validateCreateTaskInput(
      validQuickCheckBody({ criteria: [{ key: "researching" }] })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.criteria[0].weight).toBe(100);
    }
  });

  it("rejects empty title", () => {
    const result = validateCreateTaskInput(validQuickCheckBody({ title: "" }));
    expect(result.ok).toBe(false);
  });

  it("rejects whitespace-only title", () => {
    const result = validateCreateTaskInput(
      validQuickCheckBody({ title: "    " })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects title over 200 chars", () => {
    const longTitle = "x".repeat(201);
    const result = validateCreateTaskInput(
      validQuickCheckBody({ title: longTitle })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("200"))).toBe(true);
    }
  });

  it("rejects invalid unit_id", () => {
    const result = validateCreateTaskInput(
      validQuickCheckBody({ unit_id: "not-a-uuid" })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown task_type", () => {
    const result = validateCreateTaskInput(
      validQuickCheckBody({ task_type: "weekly" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("task_type"))).toBe(true);
    }
  });

  it("rejects summative task_type with TG.0D-deferral message (TG.0C scope)", () => {
    const result = validateCreateTaskInput(
      validQuickCheckBody({ task_type: "summative" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("TG.0D"))).toBe(true);
    }
  });

  it("rejects peer/self task_type as deferred", () => {
    const r1 = validateCreateTaskInput(validQuickCheckBody({ task_type: "peer" }));
    const r2 = validateCreateTaskInput(validQuickCheckBody({ task_type: "self" }));
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (!r1.ok) {
      expect(r1.errors.some((e) => e.includes("deferred"))).toBe(true);
    }
  });

  it("rejects criteria array with invalid key", () => {
    const result = validateCreateTaskInput(
      validQuickCheckBody({ criteria: [{ key: "thinking" }] })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // explicit value check
      expect(result.errors.some((e) => e.includes('"thinking"'))).toBe(true);
    }
  });

  it("rejects weight outside 0-100", () => {
    const r1 = validateCreateTaskInput(
      validQuickCheckBody({ criteria: [{ key: "researching", weight: 150 }] })
    );
    const r2 = validateCreateTaskInput(
      validQuickCheckBody({ criteria: [{ key: "researching", weight: -1 }] })
    );
    const r3 = validateCreateTaskInput(
      validQuickCheckBody({ criteria: [{ key: "researching", weight: 50.5 }] })
    );
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(r3.ok).toBe(false);
  });

  it("accepts class_id as null", () => {
    const result = validateCreateTaskInput(
      validQuickCheckBody({ class_id: null })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.class_id).toBeNull();
    }
  });

  it("accepts class_id as a UUID", () => {
    const result = validateCreateTaskInput(
      validQuickCheckBody({ class_id: VALID_UUID_2 })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.class_id).toBe(VALID_UUID_2);
    }
  });

  it("rejects empty criteria array", () => {
    const result = validateCreateTaskInput(
      validQuickCheckBody({ criteria: [] })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-object body", () => {
    expect(validateCreateTaskInput(null).ok).toBe(false);
    expect(validateCreateTaskInput(undefined).ok).toBe(false);
    expect(validateCreateTaskInput("string").ok).toBe(false);
    expect(validateCreateTaskInput([]).ok).toBe(false);
  });

  it("collects all errors, not just the first (Lesson #39 — surface all sites)", () => {
    const result = validateCreateTaskInput({
      unit_id: "bad",
      title: "",
      task_type: "weekly",
      config: { criteria: [] },
      criteria: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("validateUpdateTaskInput", () => {
  it("accepts an empty patch (no-op update)", () => {
    const result = validateUpdateTaskInput({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBeUndefined();
      expect(result.value.status).toBeUndefined();
    }
  });

  it("accepts a title-only patch + trims whitespace", () => {
    const result = validateUpdateTaskInput({ title: "  Quiz 1 — revised  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Quiz 1 — revised");
    }
  });

  it("accepts a status flip", () => {
    const result = validateUpdateTaskInput({ status: "published" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("published");
    }
  });

  it("rejects unknown status", () => {
    const result = validateUpdateTaskInput({ status: "open" });
    expect(result.ok).toBe(false);
  });

  it("rejects empty criteria array if criteria provided", () => {
    const result = validateUpdateTaskInput({ criteria: [] });
    expect(result.ok).toBe(false);
  });

  it("accepts replacing criteria", () => {
    const result = validateUpdateTaskInput({
      criteria: [
        { key: "researching", weight: 50 },
        { key: "analysing", weight: 50 },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.criteria).toHaveLength(2);
      expect(result.value.criteria![0].weight).toBe(50);
    }
  });
});
