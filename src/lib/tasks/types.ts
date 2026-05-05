/**
 * TG.0C.1 — task system v1 types
 *
 * Pure types for the assessment_tasks + task_lesson_links + task_criterion_weights
 * surface. Discriminated union on task_type — formative ships in TG.0C, summative
 * in TG.0D, peer/self deferred. Schema-backed by migration 20260505032750_task_system_v1_schema.sql.
 *
 * See: docs/projects/task-system-architecture.md (brief)
 *      docs/projects/task-system-tg0c-brief.md (this phase)
 */

import type { NeutralCriterionKey } from "@/lib/pipeline/stages/stage4-neutral-validator";

// ─── Discriminator ───────────────────────────────────────────────────────────

export type TaskType = "formative" | "summative" | "peer" | "self";
export type TaskStatus = "draft" | "published" | "closed";

// ─── Type-specific config (Cowork correction #4 — JSONB extension point) ───

/**
 * Formative config (TG.0C).
 *
 * Quick-Check captures: the criterion(s) being checked, optional due date,
 * optional list of lessons it draws from. No GRASPS, no rubric_descriptors,
 * no submission policy — those are summative-only.
 */
export interface FormativeConfig {
  /** Framework-neutral keys (8-key taxonomy). One Quick-Check covers >=1 criteria. */
  criteria: NeutralCriterionKey[];
  /** ISO date string (YYYY-MM-DD). Optional — formatives can be undated. */
  due_date?: string;
  /** Lessons this Quick-Check draws from. Empty array = "any work in this unit." */
  linked_pages?: Array<{ unit_id: string; page_id: string }>;
}

/**
 * Summative config (TG.0D — stub here so the discriminated union is complete).
 *
 * Will gain: GRASPS block, submission_format, ai_use_policy, late_policy,
 * resubmission settings, self_assessment toggle, etc. See brief §Project task.
 */
export interface SummativeConfig {
  /** TG.0D will populate. For TG.0C this stub satisfies the discriminator. */
  grasps?: Record<string, string>;
  submission_format?: "text" | "upload" | "multi";
  word_count_cap?: number;
  ai_use_policy?: "allowed" | "allowed_with_citation" | "not_allowed";
  late_policy?: string;
  resubmission?: { mode: "off" | "open_until" | "max_attempts"; until?: string; max?: number };
  self_assessment_required?: boolean; // default true (Hattie d=1.33, OQ-3)
}

/** Discriminated union keyed on TaskType. */
export type TaskConfig =
  | { kind: "formative"; data: FormativeConfig }
  | { kind: "summative"; data: SummativeConfig };

// ─── Wire shapes (DB row + denormalized API response) ────────────────────────

/**
 * One row in `assessment_tasks` plus its child rows denormalized for panel
 * rendering. The API GET endpoint returns this shape; the panel consumes it
 * directly without follow-up requests.
 */
export interface AssessmentTask {
  id: string;
  unit_id: string | null;
  class_id: string | null;
  school_id: string;
  title: string;
  task_type: TaskType;
  status: TaskStatus;
  config: FormativeConfig | SummativeConfig;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Denormalized from task_criterion_weights — flat list of NeutralCriterionKey. */
  criteria: NeutralCriterionKey[];
  /** Denormalized from task_lesson_links. */
  linked_pages: Array<{ unit_id: string; page_id: string }>;
}

/** Edge row — `task_criterion_weights`. */
export interface TaskCriterionWeight {
  task_id: string;
  criterion_key: NeutralCriterionKey;
  weight: number;
  rubric_descriptors: null | {
    level1_2?: string;
    level3_4?: string;
    level5_6?: string;
    level7_8?: string;
  };
}

/** Many-to-many — `task_lesson_links`. */
export interface TaskLessonLink {
  task_id: string;
  unit_id: string;
  page_id: string;
}

// ─── API request shapes (validator targets) ──────────────────────────────────

/**
 * POST /api/teacher/tasks input. school_id and created_by are derived from
 * the authenticated teacher; the client supplies task-specific fields only.
 */
export interface CreateTaskInput {
  unit_id: string;
  class_id?: string | null;
  title: string;
  task_type: TaskType;
  status?: TaskStatus; // defaults 'draft'
  /** Discriminated by task_type — TG.0C only validates formative shape. */
  config: FormativeConfig | SummativeConfig;
  /** Criteria + weights. For Quick-Check, weight defaults to 100 each. */
  criteria: Array<{ key: NeutralCriterionKey; weight?: number }>;
  /** Optional lesson links. */
  linked_pages?: Array<{ unit_id: string; page_id: string }>;
}

/** PATCH /api/teacher/tasks/[id] — partial update. */
export interface UpdateTaskInput {
  title?: string;
  status?: TaskStatus;
  config?: FormativeConfig | SummativeConfig;
  /** If supplied, REPLACES the criterion set (DELETE old + INSERT new). */
  criteria?: Array<{ key: NeutralCriterionKey; weight?: number }>;
  /** If supplied, REPLACES the linked_pages set. */
  linked_pages?: Array<{ unit_id: string; page_id: string }>;
}

// ─── Type guards ─────────────────────────────────────────────────────────────

export function isFormativeTask(
  task: AssessmentTask
): task is AssessmentTask & { config: FormativeConfig } {
  return task.task_type === "formative";
}

export function isSummativeTask(
  task: AssessmentTask
): task is AssessmentTask & { config: SummativeConfig } {
  return task.task_type === "summative";
}
