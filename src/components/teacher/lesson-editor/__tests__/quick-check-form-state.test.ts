/**
 * TG.0C.4 — pure-logic tests for QuickCheckRow form-state reducer.
 *
 * Per Lesson #71: tests import the .ts sibling, not the .tsx.
 * Per Lesson #38: assertions check expected values, not just non-null.
 */

import { describe, it, expect } from "vitest";
import {
  buildCreateInput,
  INITIAL_FORM_STATE,
  isQuickCheckFormReady,
  quickCheckReducer,
  validateQuickCheckForm,
  type QuickCheckFormState,
} from "../quick-check-form-state";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

describe("quickCheckReducer", () => {
  it("setTitle updates title only", () => {
    const next = quickCheckReducer(INITIAL_FORM_STATE, {
      type: "setTitle",
      title: "Quiz 1",
    });
    expect(next.title).toBe("Quiz 1");
    expect(next.criterion).toBeNull();
    expect(next.dueDate).toBe("");
  });

  it("setCriterion updates criterion only", () => {
    const next = quickCheckReducer(INITIAL_FORM_STATE, {
      type: "setCriterion",
      criterion: "researching",
    });
    expect(next.criterion).toBe("researching");
    expect(next.title).toBe("");
  });

  it("setCriterion(null) clears criterion (deselect)", () => {
    const withCriterion: QuickCheckFormState = {
      ...INITIAL_FORM_STATE,
      criterion: "researching",
    };
    const next = quickCheckReducer(withCriterion, {
      type: "setCriterion",
      criterion: null,
    });
    expect(next.criterion).toBeNull();
  });

  it("setDueDate updates dueDate", () => {
    const next = quickCheckReducer(INITIAL_FORM_STATE, {
      type: "setDueDate",
      dueDate: "2026-05-15",
    });
    expect(next.dueDate).toBe("2026-05-15");
  });

  it("togglePage adds a new page", () => {
    const page = { unit_id: VALID_UUID, page_id: "L01" };
    const next = quickCheckReducer(INITIAL_FORM_STATE, {
      type: "togglePage",
      page,
    });
    expect(next.linkedPages).toEqual([page]);
  });

  it("togglePage removes an existing page", () => {
    const page = { unit_id: VALID_UUID, page_id: "L01" };
    const withPage: QuickCheckFormState = {
      ...INITIAL_FORM_STATE,
      linkedPages: [page],
    };
    const next = quickCheckReducer(withPage, { type: "togglePage", page });
    expect(next.linkedPages).toEqual([]);
  });

  it("togglePage preserves other pages when toggling one", () => {
    const p1 = { unit_id: VALID_UUID, page_id: "L01" };
    const p2 = { unit_id: VALID_UUID, page_id: "L02" };
    const withTwo: QuickCheckFormState = {
      ...INITIAL_FORM_STATE,
      linkedPages: [p1, p2],
    };
    const next = quickCheckReducer(withTwo, { type: "togglePage", page: p1 });
    expect(next.linkedPages).toEqual([p2]);
  });

  it("reset returns INITIAL_FORM_STATE", () => {
    const dirty: QuickCheckFormState = {
      title: "x",
      criterion: "researching",
      dueDate: "2026-05-15",
      linkedPages: [{ unit_id: VALID_UUID, page_id: "L01" }],
    };
    const next = quickCheckReducer(dirty, { type: "reset" });
    expect(next).toEqual(INITIAL_FORM_STATE);
  });
});

describe("validateQuickCheckForm", () => {
  it("returns no errors for a valid state", () => {
    const state: QuickCheckFormState = {
      title: "Quiz 1",
      criterion: "researching",
      dueDate: "",
      linkedPages: [],
    };
    expect(validateQuickCheckForm(state)).toEqual([]);
  });

  it("flags missing title", () => {
    const state: QuickCheckFormState = {
      ...INITIAL_FORM_STATE,
      criterion: "researching",
    };
    const errors = validateQuickCheckForm(state);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("title");
  });

  it("flags whitespace-only title", () => {
    const state: QuickCheckFormState = {
      title: "   ",
      criterion: "researching",
      dueDate: "",
      linkedPages: [],
    };
    const errors = validateQuickCheckForm(state);
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("flags title over 200 chars", () => {
    const state: QuickCheckFormState = {
      title: "x".repeat(201),
      criterion: "researching",
      dueDate: "",
      linkedPages: [],
    };
    const errors = validateQuickCheckForm(state);
    expect(errors.some((e) => e.field === "title" && e.message.includes("200"))).toBe(true);
  });

  it("flags missing criterion", () => {
    const state: QuickCheckFormState = {
      title: "Quiz 1",
      criterion: null,
      dueDate: "",
      linkedPages: [],
    };
    const errors = validateQuickCheckForm(state);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("criterion");
  });

  it("flags both title + criterion when both missing", () => {
    const errors = validateQuickCheckForm(INITIAL_FORM_STATE);
    expect(errors).toHaveLength(2);
  });
});

describe("isQuickCheckFormReady", () => {
  it("returns true when validation passes", () => {
    expect(
      isQuickCheckFormReady({
        title: "Quiz 1",
        criterion: "researching",
        dueDate: "",
        linkedPages: [],
      })
    ).toBe(true);
  });

  it("returns false on initial state", () => {
    expect(isQuickCheckFormReady(INITIAL_FORM_STATE)).toBe(false);
  });
});

describe("buildCreateInput", () => {
  it("builds a valid CreateTaskInput from a complete form state", () => {
    const state: QuickCheckFormState = {
      title: "  Quiz 1  ",
      criterion: "researching",
      dueDate: "2026-05-15",
      linkedPages: [{ unit_id: VALID_UUID, page_id: "L01" }],
    };
    const input = buildCreateInput(state, VALID_UUID, null);
    expect(input.unit_id).toBe(VALID_UUID);
    expect(input.class_id).toBeNull();
    expect(input.title).toBe("Quiz 1"); // trimmed
    expect(input.task_type).toBe("formative");
    expect(input.status).toBe("draft");
    expect(input.criteria).toEqual([{ key: "researching", weight: 100 }]);
    const config = input.config as Record<string, unknown>;
    expect(config.criteria).toEqual(["researching"]);
    expect(config.due_date).toBe("2026-05-15");
    expect(config.linked_pages).toEqual([
      { unit_id: VALID_UUID, page_id: "L01" },
    ]);
  });

  it("omits due_date when empty", () => {
    const state: QuickCheckFormState = {
      title: "Quiz",
      criterion: "researching",
      dueDate: "",
      linkedPages: [],
    };
    const input = buildCreateInput(state, VALID_UUID, null);
    const config = input.config as Record<string, unknown>;
    expect(config.due_date).toBeUndefined();
  });

  it("omits linked_pages when empty", () => {
    const state: QuickCheckFormState = {
      title: "Quiz",
      criterion: "researching",
      dueDate: "",
      linkedPages: [],
    };
    const input = buildCreateInput(state, VALID_UUID, null);
    const config = input.config as Record<string, unknown>;
    expect(config.linked_pages).toBeUndefined();
    expect(input.linked_pages).toBeUndefined();
  });

  it("passes class_id through", () => {
    const state: QuickCheckFormState = {
      title: "Quiz",
      criterion: "researching",
      dueDate: "",
      linkedPages: [],
    };
    const input = buildCreateInput(state, VALID_UUID, "class-uuid");
    expect(input.class_id).toBe("class-uuid");
  });

  it("throws if form is not ready", () => {
    expect(() =>
      buildCreateInput(INITIAL_FORM_STATE, VALID_UUID, null)
    ).toThrow(/incomplete form state/);
  });
});
