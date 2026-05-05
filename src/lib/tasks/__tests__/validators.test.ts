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
  validateSummativeConfig,
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

  it("rejects summative task_type with formative-shape config (TG.0D — wrong config shape)", () => {
    // TG.0D enables summative, but a body with task_type='summative' AND
    // a formative-shape config (just { criteria }) should fail summative
    // validation (missing grasps/submission/timeline/policy/self_assessment_required).
    const result = validateCreateTaskInput(
      validQuickCheckBody({ task_type: "summative" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should call out the missing grasps block, not "TG.0D"
      expect(result.errors.some((e) => e.includes("grasps"))).toBe(true);
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

// ─── TG.0D — summative validators ────────────────────────────────────────────

function validSummativeConfig(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    grasps: {
      goal: "Design a marble run",
      role: "Engineer",
      audience: "Year 7 peers",
      situation: "School STEM fair",
      performance: "Build + present a working marble run",
      standards: "Functional + creative",
    },
    submission: {
      format: "upload",
      word_count_cap: 500,
      ai_use_policy: "allowed_with_citation",
      integrity_declaration_required: true,
    },
    timeline: {
      due_date: "2026-06-15",
      late_policy: "1 day grace, then 10% per day",
      resubmission: { mode: "off" },
    },
    policy: {
      grouping: "individual",
      notify_on_publish: true,
      notify_on_due_soon: true,
    },
    self_assessment_required: true,
    ...over,
  };
}

describe("validateSummativeConfig", () => {
  it("accepts a complete summative config", () => {
    const result = validateSummativeConfig(validSummativeConfig());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.grasps.goal).toBe("Design a marble run");
      expect(result.value.submission.format).toBe("upload");
      expect(result.value.timeline.resubmission.mode).toBe("off");
      expect(result.value.policy.grouping).toBe("individual");
      expect(result.value.self_assessment_required).toBe(true);
    }
  });

  it("rejects missing grasps block", () => {
    const result = validateSummativeConfig(validSummativeConfig({ grasps: undefined }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("grasps"))).toBe(true);
    }
  });

  it("rejects grasps with non-string field", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({ grasps: { goal: 123 } as any })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("grasps.goal"))).toBe(true);
    }
  });

  it("rejects oversized grasps field (1000+ chars)", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        grasps: {
          goal: "x".repeat(1001),
          role: "r",
          audience: "a",
          situation: "s",
          performance: "p",
          standards: "s",
        },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("1000"))).toBe(true);
    }
  });

  it("rejects unknown submission format", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        submission: {
          format: "voice",
          ai_use_policy: "not_allowed",
          integrity_declaration_required: false,
        } as any,
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("format"))).toBe(true);
    }
  });

  it("rejects negative word_count_cap", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        submission: {
          format: "text",
          word_count_cap: -10,
          ai_use_policy: "not_allowed",
          integrity_declaration_required: true,
        } as any,
      })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects word_count_cap above 20000", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        submission: {
          format: "text",
          word_count_cap: 25000,
          ai_use_policy: "not_allowed",
          integrity_declaration_required: true,
        } as any,
      })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown ai_use_policy", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        submission: {
          format: "text",
          ai_use_policy: "encouraged",
          integrity_declaration_required: false,
        } as any,
      })
    );
    expect(result.ok).toBe(false);
  });

  it("requires resubmission.until when mode='open_until'", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        timeline: {
          resubmission: { mode: "open_until" },
        } as any,
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("until"))).toBe(true);
    }
  });

  it("accepts resubmission with valid until date", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        timeline: {
          resubmission: { mode: "open_until", until: "2026-06-30" },
        },
      })
    );
    expect(result.ok).toBe(true);
  });

  it("requires resubmission.max when mode='max_attempts'", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        timeline: {
          resubmission: { mode: "max_attempts" },
        } as any,
      })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects resubmission.max outside 1-10", () => {
    const r1 = validateSummativeConfig(
      validSummativeConfig({
        timeline: { resubmission: { mode: "max_attempts", max: 11 } } as any,
      })
    );
    const r2 = validateSummativeConfig(
      validSummativeConfig({
        timeline: { resubmission: { mode: "max_attempts", max: 0 } } as any,
      })
    );
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
  });

  it("accepts resubmission with valid max=3", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        timeline: {
          resubmission: { mode: "max_attempts", max: 3 },
        },
      })
    );
    expect(result.ok).toBe(true);
  });

  it("rejects malformed timeline.due_date", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        timeline: {
          due_date: "June 15 2026",
          resubmission: { mode: "off" },
        } as any,
      })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown policy.grouping", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        policy: {
          grouping: "team",
          notify_on_publish: true,
          notify_on_due_soon: true,
        } as any,
      })
    );
    expect(result.ok).toBe(false);
  });

  it("accepts grouping='group' (forward-compat for v1.1)", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        policy: {
          grouping: "group",
          notify_on_publish: true,
          notify_on_due_soon: true,
        } as any,
      })
    );
    expect(result.ok).toBe(true);
  });

  it("requires self_assessment_required as boolean", () => {
    const r1 = validateSummativeConfig(
      validSummativeConfig({ self_assessment_required: undefined })
    );
    const r2 = validateSummativeConfig(
      validSummativeConfig({ self_assessment_required: "yes" } as any)
    );
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
  });

  it("rejects timeline.linked_pages with bad shape", () => {
    const result = validateSummativeConfig(
      validSummativeConfig({
        timeline: {
          resubmission: { mode: "off" },
          linked_pages: [{ unit_id: "not-uuid", page_id: "L01" }],
        } as any,
      })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-object body", () => {
    expect(validateSummativeConfig(null).ok).toBe(false);
    expect(validateSummativeConfig(undefined).ok).toBe(false);
    expect(validateSummativeConfig("string").ok).toBe(false);
    expect(validateSummativeConfig([]).ok).toBe(false);
  });

  it("collects all errors across blocks (Lesson #39 — surface all sites)", () => {
    const result = validateSummativeConfig({
      grasps: { goal: 1 },
      submission: { format: "voice", ai_use_policy: "encouraged", integrity_declaration_required: "yes" },
      timeline: { resubmission: { mode: "open_until" } },
      policy: { grouping: "team", notify_on_publish: 1, notify_on_due_soon: 1 },
      self_assessment_required: "yes",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Multiple blocks contributing errors — sanity check
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("validateCreateTaskInput — TG.0D summative path", () => {
  function validSummativeBody(over: Record<string, unknown> = {}) {
    return {
      unit_id: VALID_UUID,
      title: "Roller Coaster Brief",
      task_type: "summative",
      config: validSummativeConfig(),
      criteria: [
        { key: "researching", weight: 25 },
        { key: "designing", weight: 25 },
        { key: "creating", weight: 25 },
        { key: "evaluating", weight: 25 },
      ],
      ...over,
    };
  }

  it("accepts a complete summative create payload", () => {
    const result = validateCreateTaskInput(validSummativeBody());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.task_type).toBe("summative");
      expect(result.value.criteria).toHaveLength(4);
    }
  });

  it("rejects summative payload with formative-shape config", () => {
    const result = validateCreateTaskInput(
      validSummativeBody({ config: { criteria: ["researching"] } })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("grasps"))).toBe(true);
    }
  });

  it("rejects summative payload with empty criteria array", () => {
    const result = validateCreateTaskInput(validSummativeBody({ criteria: [] }));
    expect(result.ok).toBe(false);
  });

  it("supports summative status='published' on creation (skip-draft path)", () => {
    const result = validateCreateTaskInput(
      validSummativeBody({ status: "published" })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("published");
    }
  });
});

