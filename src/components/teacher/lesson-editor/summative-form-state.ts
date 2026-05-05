/**
 * TG.0D.2 — pure form-state reducer for the 5-tab summative drawer.
 *
 * Mirrors `quick-check-form-state.ts` but for the much richer summative
 * surface. Per Lesson #71: pure logic in `.ts` so tests can import without
 * crossing the JSX boundary.
 *
 * Shape strategy:
 *   - State carries each tab's blocks AS THEY ARE TYPED (strings, not
 *     trimmed; numeric fields as raw input strings to allow empty state)
 *   - buildSummativeCreateInput coerces + trims at submit time
 *   - validateSummativeForm returns errors keyed by tab so the drawer's
 *     tab nav can show error badges per tab
 */

import type { NeutralCriterionKey } from "@/lib/pipeline/stages/stage4-neutral-validator";
import type {
  AssessmentTask,
  CreateTaskInput,
  SummativeConfig,
} from "@/lib/tasks/types";

// ─── State shape ─────────────────────────────────────────────────────────────

export type SummativeTabId =
  | "grasps"
  | "submission"
  | "rubric"
  | "timeline"
  | "policy";

export const SUMMATIVE_TAB_ORDER: readonly SummativeTabId[] = [
  "grasps",
  "submission",
  "rubric",
  "timeline",
  "policy",
];

export const SUMMATIVE_TAB_LABELS: Record<SummativeTabId, string> = {
  grasps: "GRASPS",
  submission: "Submission",
  rubric: "Rubric",
  timeline: "Timeline",
  policy: "Policy",
};

export interface RubricDescriptors {
  level1_2: string;
  level3_4: string;
  level5_6: string;
  level7_8: string;
}

export interface SummativeCriterionEntry {
  key: NeutralCriterionKey;
  weight: number;
  descriptors: RubricDescriptors;
}

export interface SummativeFormState {
  title: string;
  activeTab: SummativeTabId;

  // Tab 1 — GRASPS
  grasps: {
    goal: string;
    role: string;
    audience: string;
    situation: string;
    performance: string;
    standards: string;
  };

  // Tab 2 — Submission
  submission: {
    format: "text" | "upload" | "multi";
    word_count_cap: string; // raw input string, coerced at submit
    ai_use_policy: "allowed" | "allowed_with_citation" | "not_allowed";
    integrity_declaration_required: boolean;
  };

  // Tab 3 — Rubric (criteria + per-criterion descriptors + self-assessment toggle)
  criteria: SummativeCriterionEntry[];
  self_assessment_required: boolean;

  // Tab 4 — Timeline
  timeline: {
    due_date: string;
    late_policy: string;
    resubmission_mode: "off" | "open_until" | "max_attempts";
    resubmission_until: string;
    resubmission_max: string; // raw input string
    linked_pages: Array<{ unit_id: string; page_id: string }>;
  };

  // Tab 5 — Policy
  policy: {
    grouping: "individual" | "group";
    notify_on_publish: boolean;
    notify_on_due_soon: boolean;
  };
}

// ─── Initial state (Matt's defaults: 1 default criterion, off resubmission) ──

const EMPTY_DESCRIPTORS: RubricDescriptors = {
  level1_2: "",
  level3_4: "",
  level5_6: "",
  level7_8: "",
};

export const INITIAL_SUMMATIVE_STATE: SummativeFormState = {
  title: "",
  activeTab: "grasps",
  grasps: {
    goal: "",
    role: "",
    audience: "",
    situation: "",
    performance: "",
    standards: "",
  },
  submission: {
    format: "upload",
    word_count_cap: "",
    ai_use_policy: "not_allowed",
    integrity_declaration_required: true,
  },
  // Brief Q3 default: 1 default criterion (researching, weight 100)
  criteria: [
    {
      key: "researching" as NeutralCriterionKey,
      weight: 100,
      descriptors: { ...EMPTY_DESCRIPTORS },
    },
  ],
  // OQ-3 default: self-assessment ON for summative (Hattie d=1.33)
  self_assessment_required: true,
  timeline: {
    due_date: "",
    late_policy: "",
    // Brief Q4 default: resubmission OFF
    resubmission_mode: "off",
    resubmission_until: "",
    resubmission_max: "",
    linked_pages: [],
  },
  policy: {
    grouping: "individual",
    notify_on_publish: true,
    notify_on_due_soon: true,
  },
};

// ─── Actions ─────────────────────────────────────────────────────────────────

export type SummativeAction =
  | { type: "setTitle"; title: string }
  | { type: "setActiveTab"; tab: SummativeTabId }
  | {
      type: "setGraspsField";
      field: keyof SummativeFormState["grasps"];
      value: string;
    }
  | {
      type: "setSubmissionField";
      field: keyof SummativeFormState["submission"];
      value: string | boolean;
    }
  | { type: "addCriterion"; key: NeutralCriterionKey }
  | { type: "removeCriterion"; key: NeutralCriterionKey }
  | { type: "setCriterionWeight"; key: NeutralCriterionKey; weight: number }
  | {
      type: "setRubricDescriptor";
      key: NeutralCriterionKey;
      level: keyof RubricDescriptors;
      value: string;
    }
  | { type: "setSelfAssessmentRequired"; required: boolean }
  | {
      type: "setTimelineField";
      field: keyof SummativeFormState["timeline"];
      value: string | Array<{ unit_id: string; page_id: string }>;
    }
  | { type: "toggleLinkedPage"; page: { unit_id: string; page_id: string } }
  | {
      type: "setPolicyField";
      field: keyof SummativeFormState["policy"];
      value: string | boolean;
    }
  | { type: "loadFromTask"; task: AssessmentTask }
  | { type: "reset" };

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function summativeReducer(
  state: SummativeFormState,
  action: SummativeAction
): SummativeFormState {
  switch (action.type) {
    case "setTitle":
      return { ...state, title: action.title };

    case "setActiveTab":
      return { ...state, activeTab: action.tab };

    case "setGraspsField":
      return {
        ...state,
        grasps: { ...state.grasps, [action.field]: action.value },
      };

    case "setSubmissionField":
      return {
        ...state,
        submission: { ...state.submission, [action.field]: action.value },
      };

    case "addCriterion": {
      if (state.criteria.some((c) => c.key === action.key)) return state;
      const newEntry: SummativeCriterionEntry = {
        key: action.key,
        weight: 100,
        descriptors: { ...EMPTY_DESCRIPTORS },
      };
      return { ...state, criteria: [...state.criteria, newEntry] };
    }

    case "removeCriterion":
      return {
        ...state,
        criteria: state.criteria.filter((c) => c.key !== action.key),
      };

    case "setCriterionWeight":
      return {
        ...state,
        criteria: state.criteria.map((c) =>
          c.key === action.key ? { ...c, weight: action.weight } : c
        ),
      };

    case "setRubricDescriptor":
      return {
        ...state,
        criteria: state.criteria.map((c) =>
          c.key === action.key
            ? {
                ...c,
                descriptors: {
                  ...c.descriptors,
                  [action.level]: action.value,
                },
              }
            : c
        ),
      };

    case "setSelfAssessmentRequired":
      return { ...state, self_assessment_required: action.required };

    case "setTimelineField":
      return {
        ...state,
        timeline: { ...state.timeline, [action.field]: action.value },
      };

    case "toggleLinkedPage": {
      const exists = state.timeline.linked_pages.some(
        (p) =>
          p.unit_id === action.page.unit_id &&
          p.page_id === action.page.page_id
      );
      const linked_pages = exists
        ? state.timeline.linked_pages.filter(
            (p) =>
              !(
                p.unit_id === action.page.unit_id &&
                p.page_id === action.page.page_id
              )
          )
        : [...state.timeline.linked_pages, action.page];
      return {
        ...state,
        timeline: { ...state.timeline, linked_pages },
      };
    }

    case "setPolicyField":
      return {
        ...state,
        policy: { ...state.policy, [action.field]: action.value },
      };

    case "loadFromTask":
      return loadFromTask(state, action.task);

    case "reset":
      return INITIAL_SUMMATIVE_STATE;

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

function loadFromTask(
  state: SummativeFormState,
  task: AssessmentTask
): SummativeFormState {
  // The task may be summative (typical) or formative (defensive — should
  // not happen via the drawer entry points). We coerce best-effort.
  const config = task.config as SummativeConfig;

  return {
    ...state,
    title: task.title,
    activeTab: "grasps",
    grasps: {
      goal: config.grasps?.goal ?? "",
      role: config.grasps?.role ?? "",
      audience: config.grasps?.audience ?? "",
      situation: config.grasps?.situation ?? "",
      performance: config.grasps?.performance ?? "",
      standards: config.grasps?.standards ?? "",
    },
    submission: {
      format: config.submission?.format ?? "upload",
      word_count_cap:
        config.submission?.word_count_cap !== undefined
          ? String(config.submission.word_count_cap)
          : "",
      ai_use_policy: config.submission?.ai_use_policy ?? "not_allowed",
      integrity_declaration_required:
        config.submission?.integrity_declaration_required ?? true,
    },
    criteria:
      task.criteria.length > 0
        ? task.criteria.map((key) => ({
            key,
            weight: 100, // weights live in task_criterion_weights; we'd need a richer GET to surface
            descriptors: { ...EMPTY_DESCRIPTORS },
          }))
        : INITIAL_SUMMATIVE_STATE.criteria,
    self_assessment_required: config.self_assessment_required ?? true,
    timeline: {
      due_date: config.timeline?.due_date ?? "",
      late_policy: config.timeline?.late_policy ?? "",
      resubmission_mode: config.timeline?.resubmission?.mode ?? "off",
      resubmission_until: config.timeline?.resubmission?.until ?? "",
      resubmission_max:
        config.timeline?.resubmission?.max !== undefined
          ? String(config.timeline.resubmission.max)
          : "",
      linked_pages: task.linked_pages,
    },
    policy: {
      grouping: config.policy?.grouping ?? "individual",
      notify_on_publish: config.policy?.notify_on_publish ?? true,
      notify_on_due_soon: config.policy?.notify_on_due_soon ?? true,
    },
  };
}

// ─── Validators / per-tab error counts ───────────────────────────────────────

export interface SummativeValidationError {
  tab: SummativeTabId;
  field: string;
  message: string;
}

const MAX_TITLE_LEN = 200;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateSummativeForm(
  state: SummativeFormState
): SummativeValidationError[] {
  const errors: SummativeValidationError[] = [];

  // Title (no tab — header-level; group with grasps for badge purposes)
  if (state.title.trim().length === 0) {
    errors.push({ tab: "grasps", field: "title", message: "Title required" });
  } else if (state.title.length > MAX_TITLE_LEN) {
    errors.push({
      tab: "grasps",
      field: "title",
      message: `Title ≤ ${MAX_TITLE_LEN} chars`,
    });
  }

  // GRASPS — all 6 fields required (non-empty)
  const graspsFields: ReadonlyArray<keyof SummativeFormState["grasps"]> = [
    "goal",
    "role",
    "audience",
    "situation",
    "performance",
    "standards",
  ];
  for (const f of graspsFields) {
    if (state.grasps[f].trim().length === 0) {
      errors.push({
        tab: "grasps",
        field: f,
        message: `GRASPS ${f} required`,
      });
    }
  }

  // Submission — format always set; word cap optional but valid integer if present
  if (state.submission.word_count_cap !== "") {
    const n = Number(state.submission.word_count_cap);
    if (!Number.isInteger(n) || n < 0 || n > 20000) {
      errors.push({
        tab: "submission",
        field: "word_count_cap",
        message: "Word cap must be 0-20000",
      });
    }
  }

  // Rubric — at least 1 criterion
  if (state.criteria.length === 0) {
    errors.push({
      tab: "rubric",
      field: "criteria",
      message: "At least one criterion required",
    });
  }
  // Each criterion's weight bounded
  for (const c of state.criteria) {
    if (
      !Number.isInteger(c.weight) ||
      c.weight < 0 ||
      c.weight > 100
    ) {
      errors.push({
        tab: "rubric",
        field: `weight:${c.key}`,
        message: `Weight for ${c.key} must be 0-100`,
      });
    }
  }

  // Timeline — due date format, resubmission mode-conditional
  if (state.timeline.due_date !== "" && !ISO_DATE_RE.test(state.timeline.due_date)) {
    errors.push({
      tab: "timeline",
      field: "due_date",
      message: "Due date must be YYYY-MM-DD",
    });
  }
  if (state.timeline.resubmission_mode === "open_until") {
    if (
      state.timeline.resubmission_until === "" ||
      !ISO_DATE_RE.test(state.timeline.resubmission_until)
    ) {
      errors.push({
        tab: "timeline",
        field: "resubmission_until",
        message: "Resubmission deadline required (YYYY-MM-DD)",
      });
    }
  }
  if (state.timeline.resubmission_mode === "max_attempts") {
    const n = Number(state.timeline.resubmission_max);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      errors.push({
        tab: "timeline",
        field: "resubmission_max",
        message: "Max attempts must be 1-10",
      });
    }
  }

  // Policy — no required fields beyond defaults; grouping always set

  return errors;
}

export function isSummativeFormReady(state: SummativeFormState): boolean {
  return validateSummativeForm(state).length === 0;
}

/**
 * Counts errors per tab so the drawer's tab nav can render a red badge
 * with the count. Tabs with 0 errors get no badge.
 */
export function errorCountsByTab(
  errors: readonly SummativeValidationError[]
): Record<SummativeTabId, number> {
  const counts: Record<SummativeTabId, number> = {
    grasps: 0,
    submission: 0,
    rubric: 0,
    timeline: 0,
    policy: 0,
  };
  for (const e of errors) counts[e.tab]++;
  return counts;
}

// ─── Payload builder ─────────────────────────────────────────────────────────

/**
 * Build a CreateTaskInput payload from a complete summative form state.
 * Caller MUST validate first (isSummativeFormReady) — this throws if
 * required fields are missing.
 */
export function buildSummativeCreateInput(
  state: SummativeFormState,
  unitId: string,
  classId: string | null = null
): CreateTaskInput {
  if (!isSummativeFormReady(state)) {
    throw new Error(
      "buildSummativeCreateInput called on incomplete form state — call validateSummativeForm first"
    );
  }

  const config: SummativeConfig = {
    grasps: {
      goal: state.grasps.goal.trim(),
      role: state.grasps.role.trim(),
      audience: state.grasps.audience.trim(),
      situation: state.grasps.situation.trim(),
      performance: state.grasps.performance.trim(),
      standards: state.grasps.standards.trim(),
    },
    submission: {
      format: state.submission.format,
      word_count_cap:
        state.submission.word_count_cap !== ""
          ? Number(state.submission.word_count_cap)
          : undefined,
      ai_use_policy: state.submission.ai_use_policy,
      integrity_declaration_required:
        state.submission.integrity_declaration_required,
    },
    timeline: {
      due_date: state.timeline.due_date || undefined,
      late_policy: state.timeline.late_policy || undefined,
      resubmission: buildResubmission(state),
      linked_pages:
        state.timeline.linked_pages.length > 0
          ? state.timeline.linked_pages
          : undefined,
    },
    policy: {
      grouping: state.policy.grouping,
      notify_on_publish: state.policy.notify_on_publish,
      notify_on_due_soon: state.policy.notify_on_due_soon,
    },
    self_assessment_required: state.self_assessment_required,
  };

  return {
    unit_id: unitId,
    class_id: classId,
    title: state.title.trim(),
    task_type: "summative",
    status: "draft", // caller flips to 'published' via separate publish action
    config,
    criteria: state.criteria.map((c) => ({ key: c.key, weight: c.weight })),
    linked_pages:
      state.timeline.linked_pages.length > 0
        ? state.timeline.linked_pages
        : undefined,
  };
}

function buildResubmission(state: SummativeFormState): SummativeConfig["timeline"]["resubmission"] {
  const mode = state.timeline.resubmission_mode;
  if (mode === "off") return { mode };
  if (mode === "open_until") return { mode, until: state.timeline.resubmission_until };
  return { mode, max: Number(state.timeline.resubmission_max) };
}
