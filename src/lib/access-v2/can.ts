/**
 * Permission helper for Access Model v2 Phase 3.
 *
 * Brief: docs/projects/access-model-v2-phase-3-brief.md §3.5
 *
 *   can(actor, action, resource, options?)
 *
 * Replaces direct `.eq('classes.teacher_id', X)` / `.eq('author_teacher_id', X)`
 * ownership reads in ~50 callsites with a unified 6-branch resolution:
 *
 *   1. Tier gate (opt-in via options.requiresTier)
 *   2. Platform admin (actor.isPlatformAdmin)
 *   3. Class scope    — has_class_role(class_id, ?) + CLASS_ROLE_ACTIONS
 *   4. Student mentor — has_student_mentorship(student_id, ?) + STUDENT_MENTOR_ACTIONS
 *   5a. School admin (Phase 4.7b-1) — is_school_admin(user, school) +
 *       SCHOOL_ADMIN_ACTIONS (governance role, superset of 5b)
 *   5b. Programme coord — has_school_responsibility(school_id, ?) +
 *       PROGRAMME_COORDINATOR_ACTIONS (academic role)
 *   6. Plain-teacher fallback — verifyTeacherCanManageStudent semantics
 *      (Decision 7 line 140: preserve shipped UX exactly).
 *
 * Class roles ADD permissions on top of the plain-teacher base; they
 * never gate it. A co_teacher of class A and a lead_teacher of class B
 * both pass step 6 if student S is in either class.
 *
 * SECURITY DEFINER + STABLE Postgres helpers (Phase 3.1) bypass RLS on
 * class_members / school_responsibilities / student_mentors so this
 * helper is safe to call from any auth-context (Lesson #64).
 *
 * Phase 3.0 kill-switch: if admin_settings.auth.permission_helper_rollout
 * is false, callers should fall back to the legacy verifyTeacherOwnsClass /
 * verifyTeacherHasUnit / verifyTeacherCanManageStudent helpers. The
 * isPermissionHelperRolloutEnabled() helper exposed below reads the flag.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActorSession } from "./actor-session";
import {
  CLASS_ROLE_ACTIONS,
  PLAIN_TEACHER_FALLBACK_ACTIONS,
  PROGRAMME_COORDINATOR_ACTIONS,
  SCHOOL_ADMIN_ACTIONS,
  STUDENT_MENTOR_ACTIONS,
  type Action,
  type CanOptions,
  type ClassRole,
  type Resource,
  type SubscriptionTier,
} from "./permissions/actions";

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

/**
 * Decide whether the actor is allowed to perform `action` on `resource`.
 *
 * @param actor     ActorSession from getActorSession() / getTeacherSession().
 * @param action    Discriminated action token (e.g. 'class.edit').
 * @param resource  The thing being acted on.
 * @param options   Optional: requiresTier for monetisation gating.
 * @param supabase  Optional Supabase client (for tests). Defaults to
 *                  createServerSupabaseClient() — RLS-respecting SSR client.
 *                  The Postgres helpers used internally are SECURITY DEFINER
 *                  so RLS context doesn't matter for them, but the tier
 *                  lookup + plain-teacher fallback queries DO see RLS.
 */
export async function can(
  actor: ActorSession,
  action: Action,
  resource: Resource,
  options?: CanOptions,
  supabase?: SupabaseClient
): Promise<boolean> {
  // Students cannot use can() for teacher-side resources. (A future Phase
  // 4+ student permission helper may use the same shape; for now, keep the
  // surface small.)
  if (actor.type !== "teacher") return false;

  const db = supabase ?? (await createServerSupabaseClient());

  // ─── 1. Tier gate (opt-in) ──────────────────────────────────────────
  if (options?.requiresTier && options.requiresTier.length > 0) {
    const schoolId = resourceSchoolId(resource) ?? actor.schoolId;
    if (!schoolId) {
      // No school context = no tier resolution = deny-by-default for tier gate.
      return false;
    }
    const tier = await getSchoolTier(db, schoolId);
    if (!tier || !options.requiresTier.includes(tier)) return false;
  }

  // ─── 2. Platform admin (Matt) ───────────────────────────────────────
  if (actor.isPlatformAdmin) {
    // TODO Phase 5: emit logAuditEvent({ kind: 'platform_admin.action', ... })
    return true;
  }

  // ─── 3-5. Branch on resource type ───────────────────────────────────
  switch (resource.type) {
    case "class":
      return canOnClass(db, actor, action, resource);
    case "unit":
      return canOnUnit(db, actor, action, resource);
    case "student":
      return canOnStudent(db, actor, action, resource);
    case "school":
      return canOnSchool(db, actor, action, resource);
    case "programme":
      return canOnProgramme(db, actor, action, resource);
    default: {
      // Exhaustiveness check — any new Resource variant must be handled.
      const _exhaustive: never = resource;
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Per-scope branches
// ─────────────────────────────────────────────────────────────────────

async function canOnClass(
  db: SupabaseClient,
  actor: Extract<ActorSession, { type: "teacher" }>,
  action: Action,
  resource: Extract<Resource, { type: "class" }>
): Promise<boolean> {
  // Find the actor's role on this class (if any).
  const role = await findClassRole(db, resource.id, actor.userId);
  if (role && CLASS_ROLE_ACTIONS[role].has(action)) return true;
  return false;
}

async function canOnUnit(
  db: SupabaseClient,
  actor: Extract<ActorSession, { type: "teacher" }>,
  action: Action,
  resource: Extract<Resource, { type: "unit" }>
): Promise<boolean> {
  // 1. Author shortcut: the unit's author has every unit.* action by default.
  //    The Resource may carry author_teacher_id; if not, look it up.
  const authorTeacherId =
    resource.author_teacher_id ?? (await getUnitAuthor(db, resource.id));
  if (authorTeacherId && authorTeacherId === actor.teacherId) return true;

  // 2. Class-scope role check via class_units junction. The Resource may
  //    carry class_id (cheap); else enumerate via class_units.
  const classIds = resource.class_id
    ? [resource.class_id]
    : await getUnitClasses(db, resource.id);

  for (const classId of classIds) {
    const role = await findClassRole(db, classId, actor.userId);
    if (role && CLASS_ROLE_ACTIONS[role].has(action)) return true;
  }
  return false;
}

async function canOnStudent(
  db: SupabaseClient,
  actor: Extract<ActorSession, { type: "teacher" }>,
  action: Action,
  resource: Extract<Resource, { type: "student" }>
): Promise<boolean> {
  // 1. Mentorship scope (cross-class) — closes FU-MENTOR-SCOPE.
  if (STUDENT_MENTOR_ACTIONS.has(action)) {
    const isMentor = await rpcHasStudentMentorship(db, resource.id);
    if (isMentor) return true;
  }

  // 2. Class-role-via-enrollment. For every class the student is enrolled
  //    in, check whether actor has a role on that class that grants action.
  const classIds = await getStudentEnrolledClasses(db, resource.id);
  for (const classId of classIds) {
    const role = await findClassRole(db, classId, actor.userId);
    if (role && CLASS_ROLE_ACTIONS[role].has(action)) return true;
  }

  // 3. Plain-teacher fallback (Decision 7 line 140) — preserve
  //    verifyTeacherCanManageStudent semantics. Active enrollment in any
  //    class the teacher OWNS (lead_teacher or co_teacher in class_members,
  //    or the legacy classes.teacher_id ownership during the grace window).
  if (PLAIN_TEACHER_FALLBACK_ACTIONS.has(action)) {
    const sharesClass = await teacherSharesActiveClassWith(
      db,
      actor.teacherId,
      resource.id
    );
    if (sharesClass) return true;
  }

  return false;
}

async function canOnSchool(
  db: SupabaseClient,
  actor: Extract<ActorSession, { type: "teacher" }>,
  action: Action,
  resource: Extract<Resource, { type: "school" }>
): Promise<boolean> {
  // Same-school flat-membership grants school.view by default.
  if (action === "school.view" && actor.schoolId === resource.id) return true;

  // Phase 4.7b-1 — school_admin governance role grants the wider
  // SCHOOL_ADMIN_ACTIONS set (superset of programme coordinator).
  // Check this BEFORE programme coordinator so the broader matrix wins
  // when the actor holds both roles (rare but possible).
  if (SCHOOL_ADMIN_ACTIONS.has(action)) {
    const isSchoolAdmin = await rpcIsSchoolAdmin(db, actor.userId, resource.id);
    if (isSchoolAdmin) return true;
  }

  // Programme coordinators get the (narrower) responsibility-tier set.
  if (PROGRAMME_COORDINATOR_ACTIONS.has(action)) {
    const isCoordinator = await rpcHasSchoolResponsibility(db, resource.id);
    if (isCoordinator) return true;
  }

  return false;
}

async function canOnProgramme(
  db: SupabaseClient,
  actor: Extract<ActorSession, { type: "teacher" }>,
  action: Action,
  resource: Extract<Resource, { type: "programme" }>
): Promise<boolean> {
  if (!PROGRAMME_COORDINATOR_ACTIONS.has(action)) return false;

  // Programme coordinator must coordinate THIS programme at THIS school.
  const programmeType = `${resource.programme_type}_coordinator`;
  const isCoordinator = await rpcHasSchoolResponsibility(
    db,
    resource.school_id,
    programmeType
  );
  return isCoordinator;
}

// ─────────────────────────────────────────────────────────────────────
// RPC + lookup helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Find which class_members.role the actor holds on the given class, if any.
 * Returns null when the actor has no active membership.
 *
 * Uses has_class_role RPC pattern but pulls the actual role value back —
 * RPC returns boolean, so we issue a direct SELECT here. has_class_role()
 * is for "yes/no with optional role filter" callers.
 */
async function findClassRole(
  db: SupabaseClient,
  classId: string,
  memberUserId: string
): Promise<ClassRole | null> {
  const { data, error } = await db
    .from("class_members")
    .select("role")
    .eq("class_id", classId)
    .eq("member_user_id", memberUserId)
    .is("removed_at", null)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.role as ClassRole;
}

async function rpcHasStudentMentorship(
  db: SupabaseClient,
  studentId: string,
  programme?: string
): Promise<boolean> {
  const { data, error } = await db.rpc("has_student_mentorship", {
    _student_id: studentId,
    _required_programme: programme ?? null,
  });
  if (error) return false;
  return data === true;
}

async function rpcHasSchoolResponsibility(
  db: SupabaseClient,
  schoolId: string,
  responsibilityType?: string
): Promise<boolean> {
  const { data, error } = await db.rpc("has_school_responsibility", {
    _school_id: schoolId,
    _required_type: responsibilityType ?? null,
  });
  if (error) return false;
  return data === true;
}

/**
 * Phase 4.7b-1 — `is_school_admin(p_user_id, p_school_id)` SECURITY
 * DEFINER helper. Distinct from rpcHasSchoolResponsibility because it
 * takes the user_id explicitly (rather than reading auth.uid() inside
 * the function), which lets call sites pass any user id (e.g. when the
 * caller is platform admin checking impersonation context).
 */
async function rpcIsSchoolAdmin(
  db: SupabaseClient,
  userId: string,
  schoolId: string
): Promise<boolean> {
  const { data, error } = await db.rpc("is_school_admin", {
    p_user_id: userId,
    p_school_id: schoolId,
  });
  if (error) return false;
  return data === true;
}

async function getUnitAuthor(
  db: SupabaseClient,
  unitId: string
): Promise<string | null> {
  const { data } = await db
    .from("units")
    .select("author_teacher_id")
    .eq("id", unitId)
    .maybeSingle();
  return data?.author_teacher_id ?? null;
}

async function getUnitClasses(
  db: SupabaseClient,
  unitId: string
): Promise<string[]> {
  const { data } = await db
    .from("class_units")
    .select("class_id")
    .eq("unit_id", unitId)
    .eq("is_active", true);
  return (data ?? []).map((r) => r.class_id as string).filter(Boolean);
}

async function getStudentEnrolledClasses(
  db: SupabaseClient,
  studentId: string
): Promise<string[]> {
  const { data } = await db
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("is_active", true);
  return (data ?? []).map((r) => r.class_id as string).filter(Boolean);
}

/**
 * Plain-teacher fallback: returns true iff the teacher has an active
 * (lead_teacher OR co_teacher) class_members row on at least one
 * non-archived class that the student is currently enrolled in. Class
 * roles ADD permissions; this is the BASE case. Equivalent to the
 * shipped verifyTeacherCanManageStudent semantics (Decision 7 line 140).
 */
async function teacherSharesActiveClassWith(
  db: SupabaseClient,
  teacherUserId: string,
  studentId: string
): Promise<boolean> {
  // Step 1: classes the teacher leads or co-teaches.
  const { data: memberships } = await db
    .from("class_members")
    .select("class_id, classes!inner(is_archived)")
    .eq("member_user_id", teacherUserId)
    .in("role", ["lead_teacher", "co_teacher"])
    .is("removed_at", null);

  const teacherClassIds = (memberships ?? [])
    .filter((r) => {
      const cls = (r as { classes: { is_archived: boolean } | { is_archived: boolean }[] }).classes;
      const archived = Array.isArray(cls) ? cls[0]?.is_archived : cls?.is_archived;
      return archived !== true;
    })
    .map((r) => r.class_id as string)
    .filter(Boolean);

  if (teacherClassIds.length === 0) return false;

  // Step 2: any active enrolment in those classes?
  const { data: hit } = await db
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .in("class_id", teacherClassIds)
    .limit(1)
    .maybeSingle();

  return !!hit;
}

async function getSchoolTier(
  db: SupabaseClient,
  schoolId: string
): Promise<SubscriptionTier | null> {
  const { data } = await db
    .from("schools")
    .select("subscription_tier")
    .eq("id", schoolId)
    .maybeSingle();
  return (data?.subscription_tier as SubscriptionTier | undefined) ?? null;
}

function resourceSchoolId(resource: Resource): string | null {
  switch (resource.type) {
    case "class":
    case "unit":
    case "student":
      return resource.school_id ?? null;
    case "school":
      return resource.id;
    case "programme":
      return resource.school_id;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 3.0 kill-switch reader
// ─────────────────────────────────────────────────────────────────────

/**
 * Read the auth.permission_helper_rollout flag from admin_settings.
 * Defaults to true when the row is absent (matches "feature on by default"
 * semantics from the migration). Cache budget is per-request — callers
 * can stash the result in module-local memo if hot path becomes visible.
 */
export async function isPermissionHelperRolloutEnabled(
  supabase?: SupabaseClient
): Promise<boolean> {
  const db = supabase ?? (await createServerSupabaseClient());
  const { data } = await db
    .from("admin_settings")
    .select("value")
    .eq("key", "auth.permission_helper_rollout")
    .maybeSingle();
  if (!data) return true; // absent row = on
  return data.value === true;
}
