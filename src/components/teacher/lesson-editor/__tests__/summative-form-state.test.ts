/**
 * TG.0D.2 — pure-logic tests for summative-form-state.
 *
 * Per Lesson #71: tests import from `.ts` sibling, not `.tsx`.
 * Per Lesson #38: assertions check expected values + specific keys.
 */

import { describe, it, expect } from "vitest";
import {
  buildSummativeCreateInput,
  errorCountsByTab,
  INITIAL_SUMMATIVE_STATE,
  isSummativeFormReady,
  summativeReducer,
  validateSummativeForm,
  SUMMATIVE_TAB_ORDER,
  type SummativeFormState,
} from "../summative-form-state";
import type { AssessmentTask } from "@/lib/tasks/types";
import type { NeutralCriterionKey } from "@/lib/pipeline/stages/stage4-neutral-validator";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

function ready(over: Partial<SummativeFormState> = {}): SummativeFormState {
  return {
    ...INITIAL_SUMMATIVE_STATE,
    title: "Roller Coaster Brief",
    grasps: {
      goal: "Design a marble run",
      role: "Engineer",
      audience: "Year 7 peers",
      situation: "STEM fair",
      performance: "Build + present",
      standards: "Functional + creative",
    },
    ...over,
  };
}

describe("summativeReducer — basic actions", () => {
  it("setTitle updates only title", () => {
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "setTitle",
      title: "Quiz",
    });
    expect(next.title).toBe("Quiz");
    expect(next.grasps.goal).toBe("");
  });

  it("setActiveTab cycles through 5 tabs", () => {
    let s = INITIAL_SUMMATIVE_STATE;
    for (const t of SUMMATIVE_TAB_ORDER) {
      s = summativeReducer(s, { type: "setActiveTab", tab: t });
      expect(s.activeTab).toBe(t);
    }
  });

  it("setGraspsField updates only that field", () => {
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "setGraspsField",
      field: "goal",
      value: "Build something cool",
    });
    expect(next.grasps.goal).toBe("Build something cool");
    expect(next.grasps.role).toBe("");
  });

  it("setSubmissionField with string value", () => {
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "setSubmissionField",
      field: "ai_use_policy",
      value: "allowed_with_citation",
    });
    expect(next.submission.ai_use_policy).toBe("allowed_with_citation");
  });

  it("setSubmissionField with boolean value", () => {
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "setSubmissionField",
      field: "integrity_declaration_required",
      value: false,
    });
    expect(next.submission.integrity_declaration_required).toBe(false);
  });
});

describe("summativeReducer — criterion management", () => {
  it("addCriterion appends a new criterion with weight 100 + empty descriptors", () => {
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "addCriterion",
      key: "designing" as NeutralCriterionKey,
    });
    expect(next.criteria).toHaveLength(2);
    expect(next.criteria[1].key).toBe("designing");
    expect(next.criteria[1].weight).toBe(100);
    expect(next.criteria[1].descriptors.level1_2).toBe("");
  });

  it("addCriterion is idempotent (no-op if already present)", () => {
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "addCriterion",
      key: "researching" as NeutralCriterionKey, // already in INITIAL
    });
    expect(next.criteria).toHaveLength(1);
  });

  it("removeCriterion removes the criterion", () => {
    const withTwo = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "addCriterion",
      key: "designing" as NeutralCriterionKey,
    });
    const next = summativeReducer(withTwo, {
      type: "removeCriterion",
      key: "researching" as NeutralCriterionKey,
    });
    expect(next.criteria).toHaveLength(1);
    expect(next.criteria[0].key).toBe("designing");
  });

  it("setCriterionWeight updates only the matching criterion's weight", () => {
    const withTwo = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "addCriterion",
      key: "designing" as NeutralCriterionKey,
    });
    const next = summativeReducer(withTwo, {
      type: "setCriterionWeight",
      key: "designing" as NeutralCriterionKey,
      weight: 25,
    });
    expect(next.criteria.find((c) => c.key === "researching")!.weight).toBe(100);
    expect(next.criteria.find((c) => c.key === "designing")!.weight).toBe(25);
  });

  it("setRubricDescriptor updates the matching criterion's specific level only", () => {
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "setRubricDescriptor",
      key: "researching" as NeutralCriterionKey,
      level: "level5_6",
      value: "Identifies relevant secondary research with limited synthesis",
    });
    const c = next.criteria[0];
    expect(c.descriptors.level5_6).toBe(
      "Identifies relevant secondary research with limited synthesis"
    );
    expect(c.descriptors.level1_2).toBe("");
    expect(c.descriptors.level3_4).toBe("");
  });

  it("setSelfAssessmentRequired toggles the OQ-3 flag", () => {
    const off = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "setSelfAssessmentRequired",
      required: false,
    });
    expect(off.self_assessment_required).toBe(false);
    const on = summativeReducer(off, {
      type: "setSelfAssessmentRequired",
      required: true,
    });
    expect(on.self_assessment_required).toBe(true);
  });
});

describe("summativeReducer — timeline + linked pages", () => {
  it("setTimelineField updates string fields", () => {
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "setTimelineField",
      field: "due_date",
      value: "2026-06-15",
    });
    expect(next.timeline.due_date).toBe("2026-06-15");
  });

  it("toggleLinkedPage adds + removes pages", () => {
    const page = { unit_id: VALID_UUID, page_id: "L01" };
    const added = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "toggleLinkedPage",
      page,
    });
    expect(added.timeline.linked_pages).toEqual([page]);
    const removed = summativeReducer(added, {
      type: "toggleLinkedPage",
      page,
    });
    expect(removed.timeline.linked_pages).toEqual([]);
  });

  it("toggleLinkedPage preserves other pages when toggling one", () => {
    const p1 = { unit_id: VALID_UUID, page_id: "L01" };
    const p2 = { unit_id: VALID_UUID, page_id: "L02" };
    let s = summativeReducer(INITIAL_SUMMATIVE_STATE, { type: "toggleLinkedPage", page: p1 });
    s = summativeReducer(s, { type: "toggleLinkedPage", page: p2 });
    s = summativeReducer(s, { type: "toggleLinkedPage", page: p1 });
    expect(s.timeline.linked_pages).toEqual([p2]);
  });

  it("setPolicyField with string value", () => {
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "setPolicyField",
      field: "grouping",
      value: "group",
    });
    expect(next.policy.grouping).toBe("group");
  });

  it("reset returns INITIAL_SUMMATIVE_STATE", () => {
    const dirty = summativeReducer(ready(), { type: "setTitle", title: "x" });
    const next = summativeReducer(dirty, { type: "reset" });
    expect(next).toEqual(INITIAL_SUMMATIVE_STATE);
  });
});

describe("summativeReducer — loadFromTask", () => {
  function summativeTask(): AssessmentTask {
    return {
      id: "t1",
      unit_id: VALID_UUID,
      class_id: null,
      school_id: "s1",
      title: "Existing",
      task_type: "summative",
      status: "draft",
      config: {
        grasps: {
          goal: "G",
          role: "R",
          audience: "A",
          situation: "S",
          performance: "P",
          standards: "St",
        },
        submission: {
          format: "text",
          word_count_cap: 750,
          ai_use_policy: "allowed",
          integrity_declaration_required: false,
        },
        timeline: {
          due_date: "2026-07-01",
          late_policy: "10% per day",
          resubmission: { mode: "max_attempts", max: 3 },
        },
        policy: {
          grouping: "individual",
          notify_on_publish: true,
          notify_on_due_soon: false,
        },
        self_assessment_required: false,
      } as any,
      created_by: "x",
      created_at: "now",
      updated_at: "now",
      criteria: ["researching", "designing"] as NeutralCriterionKey[],
      linked_pages: [{ unit_id: VALID_UUID, page_id: "L02" }],
    };
  }

  it("populates all 5 tabs from an existing task", () => {
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "loadFromTask",
      task: summativeTask(),
    });
    expect(next.title).toBe("Existing");
    expect(next.grasps.goal).toBe("G");
    expect(next.submission.format).toBe("text");
    expect(next.submission.word_count_cap).toBe("750");
    expect(next.submission.ai_use_policy).toBe("allowed");
    expect(next.submission.integrity_declaration_required).toBe(false);
    expect(next.criteria).toHaveLength(2);
    expect(next.criteria[0].key).toBe("researching");
    expect(next.criteria[1].key).toBe("designing");
    expect(next.self_assessment_required).toBe(false);
    expect(next.timeline.due_date).toBe("2026-07-01");
    expect(next.timeline.resubmission_mode).toBe("max_attempts");
    expect(next.timeline.resubmission_max).toBe("3");
    expect(next.timeline.linked_pages).toHaveLength(1);
    expect(next.policy.grouping).toBe("individual");
    expect(next.policy.notify_on_due_soon).toBe(false);
  });

  it("falls back to defaults when task config is partial", () => {
    const partial = summativeTask();
    partial.config = {} as any;
    partial.criteria = [];
    partial.linked_pages = [];
    const next = summativeReducer(INITIAL_SUMMATIVE_STATE, {
      type: "loadFromTask",
      task: partial,
    });
    expect(next.grasps.goal).toBe("");
    expect(next.submission.format).toBe("upload"); // INITIAL default
    expect(next.criteria).toHaveLength(1); // falls back to INITIAL's 1 default
    expect(next.self_assessment_required).toBe(true); // OQ-3 default
  });
});

describe("validateSummativeForm", () => {
  it("returns no errors for a complete state", () => {
    expect(validateSummativeForm(ready())).toEqual([]);
  });

  it("flags missing title", () => {
    const errors = validateSummativeForm(ready({ title: "" }));
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("flags whitespace-only title", () => {
    const errors = validateSummativeForm(ready({ title: "   " }));
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("flags each missing GRASPS field", () => {
    const errors = validateSummativeForm(
      ready({
        grasps: {
          goal: "",
          role: "",
          audience: "",
          situation: "",
          performance: "",
          standards: "",
        },
      })
    );
    expect(errors.filter((e) => e.tab === "grasps" && e.field !== "title")).toHaveLength(6);
  });

  it("flags invalid word_count_cap", () => {
    const errors = validateSummativeForm(
      ready({
        submission: { ...INITIAL_SUMMATIVE_STATE.submission, word_count_cap: "-5" },
      })
    );
    expect(errors.some((e) => e.tab === "submission" && e.field === "word_count_cap")).toBe(true);
  });

  it("flags zero criteria", () => {
    const errors = validateSummativeForm(ready({ criteria: [] }));
    expect(errors.some((e) => e.tab === "rubric" && e.field === "criteria")).toBe(true);
  });

  it("flags weight out of bounds", () => {
    const errors = validateSummativeForm(
      ready({
        criteria: [
          {
            key: "researching" as NeutralCriterionKey,
            weight: 150,
            descriptors: { level1_2: "", level3_4: "", level5_6: "", level7_8: "" },
          },
        ],
      })
    );
    expect(errors.some((e) => e.tab === "rubric" && e.field.startsWith("weight"))).toBe(true);
  });

  it("flags malformed due date", () => {
    const errors = validateSummativeForm(
      ready({
        timeline: { ...INITIAL_SUMMATIVE_STATE.timeline, due_date: "June 15" },
      })
    );
    expect(errors.some((e) => e.tab === "timeline" && e.field === "due_date")).toBe(true);
  });

  it("flags resubmission open_until without date", () => {
    const errors = validateSummativeForm(
      ready({
        timeline: {
          ...INITIAL_SUMMATIVE_STATE.timeline,
          resubmission_mode: "open_until",
          resubmission_until: "",
        },
      })
    );
    expect(errors.some((e) => e.tab === "timeline" && e.field === "resubmission_until")).toBe(true);
  });

  it("flags resubmission max_attempts with bad max", () => {
    const errors = validateSummativeForm(
      ready({
        timeline: {
          ...INITIAL_SUMMATIVE_STATE.timeline,
          resubmission_mode: "max_attempts",
          resubmission_max: "20",
        },
      })
    );
    expect(errors.some((e) => e.tab === "timeline" && e.field === "resubmission_max")).toBe(true);
  });
});

describe("errorCountsByTab", () => {
  it("groups errors per tab", () => {
    const errors = validateSummativeForm({
      ...INITIAL_SUMMATIVE_STATE,
      title: "",
    });
    const counts = errorCountsByTab(errors);
    expect(counts.grasps).toBeGreaterThan(0); // title + 6 grasps fields
    expect(counts.submission).toBe(0);
    expect(counts.rubric).toBe(0);
  });

  it("returns 0 for all tabs on a ready state", () => {
    const counts = errorCountsByTab(validateSummativeForm(ready()));
    expect(counts.grasps).toBe(0);
    expect(counts.submission).toBe(0);
    expect(counts.rubric).toBe(0);
    expect(counts.timeline).toBe(0);
    expect(counts.policy).toBe(0);
  });
});

describe("isSummativeFormReady", () => {
  it("returns true on ready state", () => {
    expect(isSummativeFormReady(ready())).toBe(true);
  });

  it("returns false on initial state", () => {
    expect(isSummativeFormReady(INITIAL_SUMMATIVE_STATE)).toBe(false);
  });
});

describe("buildSummativeCreateInput", () => {
  it("builds a complete payload from a ready state", () => {
    const input = buildSummativeCreateInput(ready(), VALID_UUID, null);
    expect(input.unit_id).toBe(VALID_UUID);
    expect(input.task_type).toBe("summative");
    expect(input.status).toBe("draft");
    expect(input.title).toBe("Roller Coaster Brief");

    const config = input.config as any;
    expect(config.grasps.goal).toBe("Design a marble run");
    expect(config.submission.format).toBe("upload");
    expect(config.submission.word_count_cap).toBeUndefined(); // default empty
    expect(config.timeline.resubmission.mode).toBe("off");
    expect(config.policy.grouping).toBe("individual");
    expect(config.self_assessment_required).toBe(true);

    expect(input.criteria).toEqual([{ key: "researching", weight: 100 }]);
  });

  it("coerces word_count_cap from string to number", () => {
    const input = buildSummativeCreateInput(
      ready({
        submission: { ...INITIAL_SUMMATIVE_STATE.submission, word_count_cap: "500" },
      }),
      VALID_UUID,
      null
    );
    const config = input.config as any;
    expect(config.submission.word_count_cap).toBe(500);
  });

  it("builds resubmission with open_until + until date", () => {
    const input = buildSummativeCreateInput(
      ready({
        timeline: {
          ...INITIAL_SUMMATIVE_STATE.timeline,
          resubmission_mode: "open_until",
          resubmission_until: "2026-07-01",
        },
      }),
      VALID_UUID,
      null
    );
    const config = input.config as any;
    expect(config.timeline.resubmission.mode).toBe("open_until");
    expect(config.timeline.resubmission.until).toBe("2026-07-01");
  });

  it("builds resubmission with max_attempts + numeric max", () => {
    const input = buildSummativeCreateInput(
      ready({
        timeline: {
          ...INITIAL_SUMMATIVE_STATE.timeline,
          resubmission_mode: "max_attempts",
          resubmission_max: "3",
        },
      }),
      VALID_UUID,
      null
    );
    const config = input.config as any;
    expect(config.timeline.resubmission.mode).toBe("max_attempts");
    expect(config.timeline.resubmission.max).toBe(3);
  });

  it("trims grasps field whitespace", () => {
    const input = buildSummativeCreateInput(
      ready({
        grasps: {
          goal: "  Goal  ",
          role: "  Role  ",
          audience: "A",
          situation: "S",
          performance: "P",
          standards: "St",
        },
      }),
      VALID_UUID,
      null
    );
    const config = input.config as any;
    expect(config.grasps.goal).toBe("Goal");
    expect(config.grasps.role).toBe("Role");
  });

  it("omits linked_pages when empty", () => {
    const input = buildSummativeCreateInput(ready(), VALID_UUID, null);
    expect(input.linked_pages).toBeUndefined();
    const config = input.config as any;
    expect(config.timeline.linked_pages).toBeUndefined();
  });

  it("includes linked_pages when present", () => {
    const input = buildSummativeCreateInput(
      ready({
        timeline: {
          ...INITIAL_SUMMATIVE_STATE.timeline,
          linked_pages: [{ unit_id: VALID_UUID, page_id: "L02" }],
        },
      }),
      VALID_UUID,
      null
    );
    expect(input.linked_pages).toHaveLength(1);
    const config = input.config as any;
    expect(config.timeline.linked_pages).toHaveLength(1);
  });

  it("passes class_id through", () => {
    const input = buildSummativeCreateInput(ready(), VALID_UUID, "class-uuid");
    expect(input.class_id).toBe("class-uuid");
  });

  it("throws when state is not ready", () => {
    expect(() =>
      buildSummativeCreateInput(INITIAL_SUMMATIVE_STATE, VALID_UUID, null)
    ).toThrow(/incomplete/);
  });
});
