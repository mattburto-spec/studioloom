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
  TaskStatus,
  TaskType,
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

  // TG.0C only ships formative writes through this endpoint. Reject summative
  // until TG.0D enables it. peer/self deferred entirely.
  if (b.task_type === "summative") {
    errors.push("summative task creation lands in TG.0D — use formative for now");
  }
  if (b.task_type === "peer" || b.task_type === "self") {
    errors.push("peer/self tasks are deferred; not in v1");
  }

  if (b.status !== undefined && !TASK_STATUSES.includes(b.status as TaskStatus)) {
    errors.push(`status must be one of: ${TASK_STATUSES.join(", ")} or omitted`);
  }

  // Validate config based on task_type
  let validatedConfig: FormativeConfig | undefined;
  if (b.task_type === "formative") {
    const configResult = validateFormativeConfig(b.config);
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
      config: validatedConfig ?? (b.config as FormativeConfig),
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
    // For TG.0C we only accept formative config in PATCH
    const configResult = validateFormativeConfig(b.config);
    if (!configResult.ok) {
      errors.push(...configResult.errors);
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
      config: b.config as FormativeConfig | undefined,
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
