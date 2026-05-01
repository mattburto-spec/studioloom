/**
 * Permission action enums + role matrices for Access Model v2 Phase 3.
 *
 * Brief: docs/projects/access-model-v2-phase-3-brief.md §3.5
 *
 * The can(actor, action, resource, options?) helper consults this module
 * to decide whether a class role / mentor / programme coordinator is
 * allowed to perform the action. Plain-teacher fallback semantics
 * (Decision 7 line 140) live in can.ts, not here.
 *
 * ─────────────────────────────────────────────────────────────────────
 * MATRIX RULES (Phase 3 — class scope)
 * ─────────────────────────────────────────────────────────────────────
 *
 *   lead_teacher → all class.* + unit.* + student.*
 *   co_teacher   → same as lead minus class.delete + class.remove_member + unit.delete
 *   dept_head    → same as co_teacher minus class.invite_member  (Phase 4 wires
 *                  the auto-tag-into-classes-of-department logic — see
 *                  FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL P2)
 *   mentor       → read + message only (class.view, unit.view, student.view, student.message)
 *   lab_tech     → class.view only (fab-specific actions added when fab actions
 *                  enter the enum)
 *   observer     → read-only (class.view, unit.view, student.view)
 *
 * Phase 3 deliberately keeps the matrix coarse. Refinement (e.g.
 * grade-level-scoped dept_head, mentor with milestone-scoped permissions)
 * happens in Phase 4+ as real consumers surface.
 */

import type { ActorSession } from "../actor-session";

// ─────────────────────────────────────────────────────────────────────
// Action enum — five scopes
// ─────────────────────────────────────────────────────────────────────

export type ClassAction =
  | "class.view"
  | "class.edit"
  | "class.delete"
  | "class.invite_member"
  | "class.remove_member";

export type UnitAction =
  | "unit.view"
  | "unit.edit"
  | "unit.fork"
  | "unit.delete"
  | "unit.publish";

export type StudentAction =
  | "student.view"
  | "student.edit"
  | "student.message"
  | "student.export";

export type SchoolAction =
  | "school.view"
  | "school.settings.edit_low_stakes"
  | "school.settings.edit_high_stakes";

export type ProgrammeAction = "programme.coordinate";

export type Action =
  | ClassAction
  | UnitAction
  | StudentAction
  | SchoolAction
  | ProgrammeAction;

// ─────────────────────────────────────────────────────────────────────
// Resource discriminated union
// ─────────────────────────────────────────────────────────────────────

export type ClassResource = {
  type: "class";
  id: string;
  /** Optional school_id; if known by caller, skips a lookup */
  school_id?: string;
};

export type UnitResource = {
  type: "unit";
  id: string;
  /** Optional author teacher; if known, can short-circuit ownership */
  author_teacher_id?: string;
  /** Optional class context for class-scope role check */
  class_id?: string;
  school_id?: string;
};

export type StudentResource = {
  type: "student";
  id: string;
  school_id?: string;
};

export type SchoolResource = {
  type: "school";
  id: string;
};

export type ProgrammeResource = {
  type: "programme";
  school_id: string;
  /** e.g. 'pp' | 'pyp' | 'cas' | 'myp' | 'dp' | 'service' | 'safeguarding' */
  programme_type: string;
};

export type Resource =
  | ClassResource
  | UnitResource
  | StudentResource
  | SchoolResource
  | ProgrammeResource;

// ─────────────────────────────────────────────────────────────────────
// Subscription tier (mirrors schools.subscription_tier CHECK enum)
// ─────────────────────────────────────────────────────────────────────

export type SubscriptionTier =
  | "pilot"
  | "free"
  | "starter"
  | "pro"
  | "school";

export type CanOptions = {
  /**
   * Optional tier gate. If supplied, can() short-circuits false when
   * school.subscription_tier is not in this set. Default: tier check skipped.
   * See master spec §3 item 36 (monetisation seam).
   */
  requiresTier?: SubscriptionTier[];
};

// ─────────────────────────────────────────────────────────────────────
// Class-scope role matrix
// ─────────────────────────────────────────────────────────────────────

export type ClassRole =
  | "lead_teacher"
  | "co_teacher"
  | "dept_head"
  | "mentor"
  | "lab_tech"
  | "observer";

export const CLASS_ROLE_ACTIONS: Readonly<Record<ClassRole, ReadonlySet<Action>>> = {
  lead_teacher: new Set<Action>([
    "class.view",
    "class.edit",
    "class.delete",
    "class.invite_member",
    "class.remove_member",
    "unit.view",
    "unit.edit",
    "unit.fork",
    "unit.delete",
    "unit.publish",
    "student.view",
    "student.edit",
    "student.message",
    "student.export",
  ]),
  co_teacher: new Set<Action>([
    "class.view",
    "class.edit",
    "class.invite_member",
    "unit.view",
    "unit.edit",
    "unit.fork",
    "unit.publish",
    "student.view",
    "student.edit",
    "student.message",
    "student.export",
  ]),
  dept_head: new Set<Action>([
    "class.view",
    "class.edit",
    "unit.view",
    "unit.edit",
    "unit.fork",
    "unit.publish",
    "student.view",
    "student.edit",
    "student.message",
    "student.export",
  ]),
  mentor: new Set<Action>([
    "class.view",
    "unit.view",
    "student.view",
    "student.message",
  ]),
  lab_tech: new Set<Action>([
    "class.view",
    // Fabrication-specific actions added when fab actions land in Action enum.
  ]),
  observer: new Set<Action>([
    "class.view",
    "unit.view",
    "student.view",
  ]),
};

// ─────────────────────────────────────────────────────────────────────
// Student-mentor (any programme) matrix
// ─────────────────────────────────────────────────────────────────────

/**
 * Actions a student-mentor row grants to its mentor_user_id, regardless
 * of programme. Programme-specific scoping (e.g. PP mentors only at
 * specific milestones) is a Phase 4+ refinement; v1 ships flat.
 */
export const STUDENT_MENTOR_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "student.view",
  "student.message",
  // student.export deliberately excluded — Phase 5 owns the export endpoint.
]);

// ─────────────────────────────────────────────────────────────────────
// Programme coordinator (school_responsibilities) matrix
// ─────────────────────────────────────────────────────────────────────

/**
 * Actions a school_responsibilities row grants for the school + programme
 * scope. v1: any responsibility type grants the same set; refinement
 * (e.g. safeguarding_lead extra alert reads) is Phase 4+.
 */
export const PROGRAMME_COORDINATOR_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "school.view",
  "school.settings.edit_low_stakes",
  "programme.coordinate",
  // school.settings.edit_high_stakes deliberately excluded — Phase 4
  // school governance owns the high-stakes 2-teacher-confirm flow.
]);

// ─────────────────────────────────────────────────────────────────────
// Plain-teacher fallback (Decision 7 line 140)
// ─────────────────────────────────────────────────────────────────────

/**
 * Actions that a plain teacher (no class role row, no mentorship row,
 * no programme coordinator row) gets via the verifyTeacherCanManageStudent
 * fallback — i.e. when the teacher owns at least one active non-archived
 * class the resource student is enrolled in.
 *
 * This preserves shipped UX exactly. Class roles ADD permissions; they
 * do NOT gate the base.
 */
export const PLAIN_TEACHER_FALLBACK_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "student.view",
  "student.edit",
  "student.message",
  "student.export",
]);

// ─────────────────────────────────────────────────────────────────────
// Helper guards
// ─────────────────────────────────────────────────────────────────────

export function isTeacher(actor: ActorSession): actor is Extract<ActorSession, { type: "teacher" }> {
  return actor.type === "teacher";
}

export function actionScope(action: Action): "class" | "unit" | "student" | "school" | "programme" {
  const dot = action.indexOf(".");
  return action.slice(0, dot) as ReturnType<typeof actionScope>;
}
