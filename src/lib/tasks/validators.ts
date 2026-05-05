/**
 * TG.0C.1 — task input validators
 *
 * Hand-rolled validators (matches repo convention — no zod). Returns either
 * `{ ok: true, value }` or `{ ok: false, errors: string[] }` so route handlers
 * can branch cleanly on the result.
 *
 * Per Lesson #38: assertions check expected values, not just presence. Per
 * Lesson #67: every consumer of TaskType + criterion_key must agree on the
 * allowed set — these validators are the choke point.
 */

import {
  NEUTRAL_CRITERION_KEYS,
  type NeutralCriterionKey,
} from "@/lib/pipeline/stages/stage4-neutral-validator";
import type {
  CreateTaskInput,
  FormativeConfig,
  GraspsBlock,
  PolicyBlock,
  ResubmissionPolicy,
  SubmissionPolicy,
  SummativeConfig,
  TaskStatus,
  TaskType,
  TimelineBlock,
  UpdateTaskInput,
} from "./types";

const TASK_TYPES: readonly TaskType[] = [
  "formative",
  "summative",
  "peer",
  "self",
];
const TASK_STATUSES: readonly TaskStatus[] = ["draft", "published", "closed"];

const NEUTRAL_KEY_SET: Set<string> = new Set(NEUTRAL_CRITERION_KEYS);

const MAX_TITLE_LEN = 200;
const MIN_TITLE_LEN = 1;

// ─── Result types ────────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function isUuidLike(x: unknown): x is string {
  // Permissive UUID check — exact format validated at DB layer. We just want
  // to catch obvious garbage like "" or 123 or { id: ... }.
  return typeof x === "string" && /^[0-9a-f-]{20,}$/i.test(x);
}

function isIsoDateOnly(x: unknown): x is string {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
}

function isNeutralKey(x: unknown): x is NeutralCriterionKey {
  return typeof x === "string" && NEUTRAL_KEY_SET.has(x);
}

// ─── Formative config validator ──────────────────────────────────────────────

export function validateFormativeConfig(
  config: unknown
): ValidationResult<FormativeConfig> {
  const errors: string[] = [];

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, errors: ["config must be an object"] };
  }

  const c = config as Record<string, unknown>;

  if (!Array.isArray(c.criteria)) {
    errors.push("config.criteria must be an array");
  } else if (c.criteria.length === 0) {
    errors.push("config.criteria must have at least one criterion");
  } else {
    for (const k of c.criteria) {
      if (!isNeutralKey(k)) {
        errors.push(
          `config.criteria contains invalid key "${String(k)}"; must be one of: ${NEUTRAL_CRITERION_KEYS.join(", ")}`
        );
      }
    }
  }

  if (c.due_date !== undefined && !isIsoDateOnly(c.due_date)) {
    errors.push("config.due_date must be ISO YYYY-MM-DD or omitted");
  }

  if (c.linked_pages !== undefined) {
    if (!Array.isArray(c.linked_pages)) {
      errors.push("config.linked_pages must be an array if provided");
    } else {
      for (let i = 0; i < c.linked_pages.length; i++) {
        const lp = c.linked_pages[i] as Record<string, unknown>;
        if (!lp || typeof lp !== "object") {
          errors.push(`config.linked_pages[${i}] must be an object`);
          continue;
        }
        if (!isUuidLike(lp.unit_id)) {
          errors.push(`config.linked_pages[${i}].unit_id must be a UUID`);
        }
        if (!isNonEmptyString(lp.page_id)) {
          errors.push(`config.linked_pages[${i}].page_id must be a non-empty string`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      criteria: c.criteria as NeutralCriterionKey[],
      due_date: c.due_date as string | undefined,
      linked_pages: c.linked_pages as
        | Array<{ unit_id: string; page_id: string }>
        | undefined,
    },
  };
}

// ─── Summative config validators (TG.0D) ─────────────────────────────────────

const SUBMISSION_FORMATS: readonly SubmissionPolicy["format"][] = [
  "text",
  "upload",
  "multi",
];
const AI_USE_POLICIES: readonly SubmissionPolicy["ai_use_policy"][] = [
  "allowed",
  "allowed_with_citation",
  "not_allowed",
];
const RESUBMISSION_MODES: readonly ResubmissionPolicy["mode"][] = [
  "off",
  "open_until",
  "max_attempts",
];
const GROUPING_OPTIONS: readonly PolicyBlock["grouping"][] = [
  "individual",
  "group",
];

const MAX_GRASPS_FIELD_LEN = 1000; // generous; UI clamps at ~500
const MAX_LATE_POLICY_LEN = 500;
const MAX_WORD_CAP = 20000;

function validateGraspsBlock(input: unknown): ValidationResult<GraspsBlock> {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["grasps must be an object"] };
  }
  const g = input as Record<string, unknown>;
  const fields: ReadonlyArray<keyof GraspsBlock> = [
    "goal",
    "role",
    "audience",
    "situation",
    "performance",
    "standards",
  ];
  for (const f of fields) {
    if (typeof g[f] !== "string") {
      errors.push(`grasps.${f} must be a string`);
    } else if ((g[f] as string).length > MAX_GRASPS_FIELD_LEN) {
      errors.push(
        `grasps.${f} must be ${MAX_GRASPS_FIELD_LEN} chars or fewer`
      );
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      goal: (g.goal as string).trim(),
      role: (g.role as string).trim(),
      audience: (g.audience as string).trim(),
      situation: (g.situation as string).trim(),
      performance: (g.performance as string).trim(),
      standards: (g.standards as string).trim(),
    },
  };
}

function validateSubmissionPolicy(
  input: unknown
): ValidationResult<SubmissionPolicy> {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["submission must be an object"] };
  }
  const s = input as Record<string, unknown>;

  if (
    typeof s.format !== "string" ||
    !SUBMISSION_FORMATS.includes(s.format as SubmissionPolicy["format"])
  ) {
    errors.push(
      `submission.format must be one of: ${SUBMISSION_FORMATS.join(", ")}`
    );
  }

  if (s.word_count_cap !== undefined) {
    if (
      typeof s.word_count_cap !== "number" ||
      !Number.isInteger(s.word_count_cap) ||
      s.word_count_cap < 0 ||
      s.word_count_cap > MAX_WORD_CAP
    ) {
      errors.push(
        `submission.word_count_cap must be an integer 0-${MAX_WORD_CAP} or omitted`
      );
    }
  }

  if (
    typeof s.ai_use_policy !== "string" ||
    !AI_USE_POLICIES.includes(s.ai_use_policy as SubmissionPolicy["ai_use_policy"])
  ) {
    errors.push(
      `submission.ai_use_policy must be one of: ${AI_USE_POLICIES.join(", ")}`
    );
  }

  if (typeof s.integrity_declaration_required !== "boolean") {
    errors.push("submission.integrity_declaration_required must be a boolean");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      format: s.format as SubmissionPolicy["format"],
      word_count_cap: s.word_count_cap as number | undefined,
      ai_use_policy: s.ai_use_policy as SubmissionPolicy["ai_use_policy"],
      integrity_declaration_required: s.integrity_declaration_required as boolean,
    },
  };
}

function validateResubmissionPolicy(
  input: unknown
): ValidationResult<ResubmissionPolicy> {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["resubmission must be an object"] };
  }
  const r = input as Record<string, unknown>;

  if (
    typeof r.mode !== "string" ||
    !RESUBMISSION_MODES.includes(r.mode as ResubmissionPolicy["mode"])
  ) {
    errors.push(
      `resubmission.mode must be one of: ${RESUBMISSION_MODES.join(", ")}`
    );
  }

  if (r.mode === "open_until") {
    if (!isIsoDateOnly(r.until)) {
      errors.push("resubmission.until must be ISO YYYY-MM-DD when mode='open_until'");
    }
  }
  if (r.mode === "max_attempts") {
    if (
      typeof r.max !== "number" ||
      !Number.isInteger(r.max) ||
      r.max < 1 ||
      r.max > 10
    ) {
      errors.push("resubmission.max must be an integer 1-10 when mode='max_attempts'");
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      mode: r.mode as ResubmissionPolicy["mode"],
      until: r.until as string | undefined,
      max: r.max as number | undefined,
    },
  };
}

function validateTimelineBlock(
  input: unknown
): ValidationResult<TimelineBlock> {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["timeline must be an object"] };
  }
  const t = input as Record<string, unknown>;

  if (t.due_date !== undefined && !isIsoDateOnly(t.due_date)) {
    errors.push("timeline.due_date must be ISO YYYY-MM-DD or omitted");
  }

  if (t.late_policy !== undefined) {
    if (typeof t.late_policy !== "string") {
      errors.push("timeline.late_policy must be a string or omitted");
    } else if ((t.late_policy as string).length > MAX_LATE_POLICY_LEN) {
      errors.push(
        `timeline.late_policy must be ${MAX_LATE_POLICY_LEN} chars or fewer`
      );
    }
  }

  const resub = validateResubmissionPolicy(t.resubmission);
  if (!resub.ok) errors.push(...resub.errors);

  if (t.linked_pages !== undefined) {
    if (!Array.isArray(t.linked_pages)) {
      errors.push("timeline.linked_pages must be an array if provided");
    } else {
      for (let i = 0; i < t.linked_pages.length; i++) {
        const lp = t.linked_pages[i] as Record<string, unknown>;
        if (!lp || typeof lp !== "object") {
          errors.push(`timeline.linked_pages[${i}] must be an object`);
          continue;
        }
        if (!isUuidLike(lp.unit_id)) {
          errors.push(`timeline.linked_pages[${i}].unit_id must be a UUID`);
        }
        if (!isNonEmptyString(lp.page_id)) {
          errors.push(
            `timeline.linked_pages[${i}].page_id must be a non-empty string`
          );
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      due_date: t.due_date as string | undefined,
      late_policy: t.late_policy as string | undefined,
      resubmission: resub.ok ? resub.value : { mode: "off" },
      linked_pages: t.linked_pages as
        | Array<{ unit_id: string; page_id: string }>
        | undefined,
    },
  };
}

function validatePolicyBlock(input: unknown): ValidationResult<PolicyBlock> {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["policy must be an object"] };
  }
  const p = input as Record<string, unknown>;

  if (
    typeof p.grouping !== "string" ||
    !GROUPING_OPTIONS.includes(p.grouping as PolicyBlock["grouping"])
  ) {
    errors.push(
      `policy.grouping must be one of: ${GROUPING_OPTIONS.join(", ")}`
    );
  }
  // 'group' is reserved for v1.1 — UI greys it out, but if a malicious
  // client sends grouping='group' we accept it for forward compat. The
  // student-side surface (TG.0F) will treat it as 'individual' until v1.1.

  if (typeof p.notify_on_publish !== "boolean") {
    errors.push("policy.notify_on_publish must be a boolean");
  }
  if (typeof p.notify_on_due_soon !== "boolean") {
    errors.push("policy.notify_on_due_soon must be a boolean");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      grouping: p.grouping as PolicyBlock["grouping"],
      notify_on_publish: p.notify_on_publish as boolean,
      notify_on_due_soon: p.notify_on_due_soon as boolean,
      peer_evaluator_config: (p.peer_evaluator_config as Record<string, unknown>) ?? undefined,
    },
  };
}

export function validateSummativeConfig(
  config: unknown
): ValidationResult<SummativeConfig> {
  const errors: string[] = [];

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, errors: ["config must be an object"] };
  }
  const c = config as Record<string, unknown>;

  const grasps = validateGraspsBlock(c.grasps);
  if (!grasps.ok) errors.push(...grasps.errors);

  const submission = validateSubmissionPolicy(c.submission);
  if (!submission.ok) errors.push(...submission.errors);

  const timeline = validateTimelineBlock(c.timeline);
  if (!timeline.ok) errors.push(...timeline.errors);

  const policy = validatePolicyBlock(c.policy);
  if (!policy.ok) errors.push(...policy.errors);

  if (typeof c.self_assessment_required !== "boolean") {
    errors.push("config.self_assessment_required must be a boolean");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      grasps: grasps.ok ? grasps.value : ({} as GraspsBlock),
      submission: submission.ok ? submission.value : ({} as SubmissionPolicy),
      timeline: timeline.ok ? timeline.value : ({} as TimelineBlock),
      policy: policy.ok ? policy.value : ({} as PolicyBlock),
      self_assessment_required: c.self_assessment_required as boolean,
    },
  };
}

// ─── CreateTaskInput validator ───────────────────────────────────────────────

export function validateCreateTaskInput(
  body: unknown
): ValidationResult<CreateTaskInput> {
  const errors: string[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: ["body must be an object"] };
  }

  const b = body as Record<string, unknown>;

  if (!isUuidLike(b.unit_id)) {
    errors.push("unit_id must be a UUID");
  }

  if (b.class_id !== undefined && b.class_id !== null && !isUuidLike(b.class_id)) {
    errors.push("class_id must be a UUID, null, or omitted");
  }

  if (!isNonEmptyString(b.title)) {
    errors.push("title must be a non-empty string");
  } else if ((b.title as string).length > MAX_TITLE_LEN) {
    errors.push(`title must be ${MAX_TITLE_LEN} chars or fewer`);
  } else if ((b.title as string).trim().length < MIN_TITLE_LEN) {
    errors.push("title must not be whitespace-only");
  }

  if (typeof b.task_type !== "string" || !TASK_TYPES.includes(b.task_type as TaskType)) {
    errors.push(`task_type must be one of: ${TASK_TYPES.join(", ")}`);
  }

  // TG.0D enables summative; peer/self still deferred for v1.
  if (b.task_type === "peer" || b.task_type === "self") {
    errors.push("peer/self tasks are deferred; not in v1");
  }

  if (b.status !== undefined && !TASK_STATUSES.includes(b.status as TaskStatus)) {
    errors.push(`status must be one of: ${TASK_STATUSES.join(", ")} or omitted`);
  }

  // Validate config based on task_type
  let validatedConfig: FormativeConfig | SummativeConfig | undefined;
  if (b.task_type === "formative") {
    const configResult = validateFormativeConfig(b.config);
    if (!configResult.ok) {
      errors.push(...configResult.errors);
    } else {
      validatedConfig = configResult.value;
    }
  } else if (b.task_type === "summative") {
    const configResult = validateSummativeConfig(b.config);
    if (!configResult.ok) {
      errors.push(...configResult.errors);
    } else {
      validatedConfig = configResult.value;
    }
  }

  if (!Array.isArray(b.criteria)) {
    errors.push("criteria array required (>=1 item)");
  } else if (b.criteria.length === 0) {
    errors.push("criteria must have at least one entry");
  } else {
    for (let i = 0; i < b.criteria.length; i++) {
      const cr = b.criteria[i] as Record<string, unknown>;
      if (!cr || typeof cr !== "object") {
        errors.push(`criteria[${i}] must be an object`);
        continue;
      }
      if (!isNeutralKey(cr.key)) {
        errors.push(
          `criteria[${i}].key invalid "${String(cr.key)}"; must be one of: ${NEUTRAL_CRITERION_KEYS.join(", ")}`
        );
      }
      if (cr.weight !== undefined) {
        if (
          typeof cr.weight !== "number" ||
          !Number.isInteger(cr.weight) ||
          cr.weight < 0 ||
          cr.weight > 100
        ) {
          errors.push(`criteria[${i}].weight must be an integer 0-100 or omitted`);
        }
      }
    }
  }

  if (b.linked_pages !== undefined) {
    if (!Array.isArray(b.linked_pages)) {
      errors.push("linked_pages must be an array if provided");
    } else {
      for (let i = 0; i < b.linked_pages.length; i++) {
        const lp = b.linked_pages[i] as Record<string, unknown>;
        if (!lp || typeof lp !== "object") {
          errors.push(`linked_pages[${i}] must be an object`);
          continue;
        }
        if (!isUuidLike(lp.unit_id)) {
          errors.push(`linked_pages[${i}].unit_id must be a UUID`);
        }
        if (!isNonEmptyString(lp.page_id)) {
          errors.push(`linked_pages[${i}].page_id must be a non-empty string`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      unit_id: b.unit_id as string,
      class_id: (b.class_id as string | null | undefined) ?? null,
      title: (b.title as string).trim(),
      task_type: b.task_type as TaskType,
      status: (b.status as TaskStatus | undefined) ?? "draft",
      config: validatedConfig ?? (b.config as FormativeConfig | SummativeConfig),
      criteria: (b.criteria as Array<{ key: NeutralCriterionKey; weight?: number }>).map(
        (c) => ({ key: c.key, weight: c.weight ?? 100 })
      ),
      linked_pages: b.linked_pages as
        | Array<{ unit_id: string; page_id: string }>
        | undefined,
    },
  };
}

// ─── UpdateTaskInput validator ───────────────────────────────────────────────

export function validateUpdateTaskInput(
  body: unknown
): ValidationResult<UpdateTaskInput> {
  const errors: string[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: ["body must be an object"] };
  }

  const b = body as Record<string, unknown>;

  if (b.title !== undefined) {
    if (!isNonEmptyString(b.title)) {
      errors.push("title must be a non-empty string if provided");
    } else if ((b.title as string).length > MAX_TITLE_LEN) {
      errors.push(`title must be ${MAX_TITLE_LEN} chars or fewer`);
    }
  }

  if (b.status !== undefined && !TASK_STATUSES.includes(b.status as TaskStatus)) {
    errors.push(`status must be one of: ${TASK_STATUSES.join(", ")} or omitted`);
  }

  if (b.config !== undefined) {
    // TG.0D: accept either formative or summative shape. Try formative
    // first — if it fails, try summative. The route handler dispatches
    // based on the existing row's task_type, so both shapes are wire-valid.
    const formativeResult = validateFormativeConfig(b.config);
    if (!formativeResult.ok) {
      const summativeResult = validateSummativeConfig(b.config);
      if (!summativeResult.ok) {
        // Surface formative errors first; summative errors are noisier
        // and usually a superset of "missing optional fields"
        errors.push(...formativeResult.errors);
      }
    }
  }

  if (b.criteria !== undefined) {
    if (!Array.isArray(b.criteria)) {
      errors.push("criteria must be an array if provided");
    } else if (b.criteria.length === 0) {
      errors.push("criteria array must have at least one entry if provided");
    } else {
      for (let i = 0; i < b.criteria.length; i++) {
        const cr = b.criteria[i] as Record<string, unknown>;
        if (!cr || typeof cr !== "object") {
          errors.push(`criteria[${i}] must be an object`);
          continue;
        }
        if (!isNeutralKey(cr.key)) {
          errors.push(
            `criteria[${i}].key invalid "${String(cr.key)}"; must be one of: ${NEUTRAL_CRITERION_KEYS.join(", ")}`
          );
        }
        if (cr.weight !== undefined) {
          if (
            typeof cr.weight !== "number" ||
            !Number.isInteger(cr.weight) ||
            cr.weight < 0 ||
            cr.weight > 100
          ) {
            errors.push(`criteria[${i}].weight must be an integer 0-100 or omitted`);
          }
        }
      }
    }
  }

  if (b.linked_pages !== undefined) {
    if (!Array.isArray(b.linked_pages)) {
      errors.push("linked_pages must be an array if provided");
    } else {
      for (let i = 0; i < b.linked_pages.length; i++) {
        const lp = b.linked_pages[i] as Record<string, unknown>;
        if (!lp || typeof lp !== "object") {
          errors.push(`linked_pages[${i}] must be an object`);
          continue;
        }
        if (!isUuidLike(lp.unit_id)) {
          errors.push(`linked_pages[${i}].unit_id must be a UUID`);
        }
        if (!isNonEmptyString(lp.page_id)) {
          errors.push(`linked_pages[${i}].page_id must be a non-empty string`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      title:
        b.title !== undefined ? (b.title as string).trim() : undefined,
      status: b.status as TaskStatus | undefined,
      config: b.config as FormativeConfig | SummativeConfig | undefined,
      criteria:
        b.criteria !== undefined
          ? (b.criteria as Array<{ key: NeutralCriterionKey; weight?: number }>).map(
              (c) => ({ key: c.key, weight: c.weight ?? 100 })
            )
          : undefined,
      linked_pages: b.linked_pages as
        | Array<{ unit_id: string; page_id: string }>
        | undefined,
    },
  };
}
