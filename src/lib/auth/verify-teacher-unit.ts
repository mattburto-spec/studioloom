/**
 * Teacher authorization helpers.
 *
 * - requireTeacherAuth() — extract authenticated teacher from Supabase session
 * - verifyTeacherHasUnit() — check teacher ↔ unit access (authored OR assigned)
 * - getNmConfigForClassUnit() — NM config with class→unit fallback
 * - verifyTeacherOwnsClass() — check teacher ↔ class ownership
 * - verifyTeacherCanManageStudent() — check teacher ↔ student access (shares-class)
 *
 * ─────────────────────────────────────────────────────────────────────
 * PHASE 3.4 — DEPRECATION SHIMS (1 May 2026)
 * ─────────────────────────────────────────────────────────────────────
 *
 * verifyTeacherOwnsClass / verifyTeacherHasUnit / verifyTeacherCanManageStudent
 * now delegate to can(actor, action, resource) when the
 * auth.permission_helper_rollout admin_settings flag is true (default).
 * The shim:
 *   - opens up co_teacher + dept_head capability via class_members
 *   - opens up cross-class mentor capability via student_mentors (closes
 *     FU-MENTOR-SCOPE on student paths)
 *   - preserves the plain-teacher base via Decision 7 line 140 fallback
 *
 * If the kill-switch flag is false (`auth.permission_helper_rollout = false`),
 * the legacy implementations below run unchanged. No code revert required.
 *
 * Phase 6 cutover deletes the legacy paths + the shim layer entirely.
 * Tracked: FU-AV2-PHASE-6-DELETE-SHIMS P3.
 *
 * Brief: docs/projects/access-model-v2-phase-3-brief.md §3.2 + §3.8 Q2 + §4 Phase 3.4
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, isPermissionHelperRolloutEnabled } from "@/lib/access-v2/can";
import type { ActorSession } from "@/lib/access-v2/actor-session";

// ---------------------------------------------------------------------------
// Teacher authentication
// ---------------------------------------------------------------------------

/**
 * Extract authenticated teacher from the Supabase session cookie.
 *
 * Returns the teacher's user ID or an error response.
 * Replaces the 35+ inline `createServerClient` + `getUser()` patterns.
 */
export async function requireTeacherAuth(
  request: NextRequest
): Promise<
  { teacherId: string; error?: never } | { teacherId?: never; error: NextResponse }
> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Server components can't set cookies — no-op
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { teacherId: user.id };
}

// ---------------------------------------------------------------------------
// Phase 3.4 shim helper — fabricate a TeacherSession from teacherId
// ---------------------------------------------------------------------------

/**
 * The legacy helpers take a bare `teacherId: string`. can() needs a full
 * ActorSession. We synthesize one by looking up the school_id + platform-
 * admin flag with the admin client. One extra DB call per helper invocation;
 * acceptable since the helpers are NOT hot path (called per-route, not
 * per-request inside loops).
 *
 * teachers.id === auth.users.id (Phase 1.1+ established 1:1).
 */
async function buildTeacherSessionForShim(
  teacherId: string
): Promise<ActorSession> {
  const db = createAdminClient();
  const [teacherResult, profileResult] = await Promise.all([
    db
      .from("teachers")
      .select("school_id, subscription_tier")
      .eq("id", teacherId)
      .maybeSingle(),
    db
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("id", teacherId)
      .maybeSingle(),
  ]);

  // Phase 4.8b — resolve effective subscription tier. Cascade:
  //   teacher tier (Pro Teacher self-serve) → school tier → 'free'
  let plan: "pilot" | "free" | "starter" | "pro" | "school" = "free";
  const teacherTier = teacherResult.data?.subscription_tier as
    | "pilot"
    | "free"
    | "starter"
    | "pro"
    | "school"
    | undefined;
  if (
    teacherTier &&
    teacherTier !== "free" &&
    ["pilot", "free", "starter", "pro", "school"].includes(teacherTier)
  ) {
    plan = teacherTier;
  } else if (teacherResult.data?.school_id) {
    const { data: schoolRow } = await db
      .from("schools")
      .select("subscription_tier")
      .eq("id", teacherResult.data.school_id)
      .maybeSingle();
    const schoolTier = schoolRow?.subscription_tier;
    if (
      schoolTier &&
      ["pilot", "free", "starter", "pro", "school"].includes(schoolTier)
    ) {
      plan = schoolTier as typeof plan;
    }
  }

  return {
    type: "teacher",
    teacherId,
    userId: teacherId,
    schoolId: teacherResult.data?.school_id ?? null,
    isPlatformAdmin: profileResult.data?.is_platform_admin ?? false,
    plan,
  };
}

// ---------------------------------------------------------------------------
// Teacher ↔ Unit / Class authorization
// ---------------------------------------------------------------------------

/**
 * Check if a teacher has access to a unit (authored OR assigned).
 * Returns the class_id if access is via assignment, null if via authorship.
 *
 * @deprecated Phase 3.4 shim. New code should call
 *   `can(actor, 'unit.edit', { type: 'unit', id: unitId })` directly.
 *   Phase 6 cutover deletes this helper.
 */
export async function verifyTeacherHasUnit(
  teacherId: string,
  unitId: string
): Promise<{ hasAccess: boolean; isAuthor: boolean; classIds: string[] }> {
  const rolloutOn = await isPermissionHelperRolloutEnabled();
  const db = createAdminClient();

  // isAuthor + classIds are computed regardless — callers depend on the
  // rich return shape. hasAccess is the only field that respects the
  // rollout flag.

  // Author check — natural identifier; same query both paths.
  const { data: unit } = await db
    .from("units")
    .select("id")
    .eq("id", unitId)
    .or(`author_teacher_id.eq.${teacherId},teacher_id.eq.${teacherId}`)
    .single();
  const isAuthor = !!unit;

  if (rolloutOn) {
    // can()-backed path — opens up co_teacher + dept_head capability.
    const actor = await buildTeacherSessionForShim(teacherId);
    const hasAccess = await can(actor, "unit.edit", { type: "unit", id: unitId });

    // Compute classIds via class_members membership chain (broader than
    // the legacy classes.teacher_id chain).
    const { data: memberships } = await db
      .from("class_members")
      .select("class_id")
      .eq("member_user_id", teacherId)
      .is("removed_at", null);
    const memberClassIds = (memberships ?? [])
      .map((r) => r.class_id as string)
      .filter(Boolean);

    let classIds: string[] = [];
    if (memberClassIds.length > 0) {
      const { data: classUnits } = await db
        .from("class_units")
        .select("class_id")
        .eq("unit_id", unitId)
        .eq("is_active", true)
        .in("class_id", memberClassIds);
      classIds = (classUnits ?? []).map((cu) => cu.class_id as string);
    }

    return { hasAccess, isAuthor, classIds };
  }

  // ─── Legacy path (kill-switch off) ──────────────────────────────────
  const { data: classUnits } = await db
    .from("class_units")
    .select("class_id")
    .eq("unit_id", unitId)
    .eq("is_active", true)
    .in(
      "class_id",
      (
        await db.from("classes").select("id").eq("teacher_id", teacherId)
      ).data?.map((c) => c.id) || []
    );

  const classIds = (classUnits || []).map((cu) => cu.class_id);
  const hasAccess = isAuthor || classIds.length > 0;
  return { hasAccess, isAuthor, classIds };
}

/**
 * Get the NM config for a unit in a specific class context.
 * Reads from class_units.nm_config first, falls back to units.nm_config.
 *
 * Not gated by the rollout flag — pure config read, no auth check.
 */
export async function getNmConfigForClassUnit(
  classId: string,
  unitId: string
): Promise<Record<string, unknown> | null> {
  const db = createAdminClient();

  // Try class-level config first
  const { data: classUnit } = await db
    .from("class_units")
    .select("nm_config")
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .single();

  if (classUnit?.nm_config) {
    return classUnit.nm_config as Record<string, unknown>;
  }

  // Fall back to unit-level config (backward compat)
  const { data: unit } = await db
    .from("units")
    .select("nm_config")
    .eq("id", unitId)
    .single();

  return (unit?.nm_config as Record<string, unknown>) || null;
}

/**
 * Verify a teacher owns a specific class.
 *
 * @deprecated Phase 3.4 shim. New code should call
 *   `can(actor, 'class.edit', { type: 'class', id: classId })` directly.
 *   Phase 6 cutover deletes this helper.
 */
export async function verifyTeacherOwnsClass(
  teacherId: string,
  classId: string
): Promise<boolean> {
  const rolloutOn = await isPermissionHelperRolloutEnabled();

  if (rolloutOn) {
    const actor = await buildTeacherSessionForShim(teacherId);
    return can(actor, "class.edit", { type: "class", id: classId });
  }

  // ─── Legacy path (kill-switch off) ──────────────────────────────────
  const db = createAdminClient();
  const { data } = await db
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .single();
  return !!data;
}

/**
 * Verify a teacher can manage a specific student. Returns true when the
 * teacher owns at least one class the student is currently enrolled in
 * (active enrollment + non-archived class). Used by per-student endpoints
 * that don't have a single classId in scope (e.g. unified support-settings
 * page) but still need to enforce that random teachers can't edit students
 * they have no relationship with.
 *
 * Stricter than `students.author_teacher_id` because that's "who created
 * the student record" — co-teachers + shared classes mean someone other
 * than the author may legitimately need to manage the student. Less strict
 * than per-class verify because it doesn't require a specific class match.
 *
 * @deprecated Phase 3.4 shim. New code should call
 *   `can(actor, 'student.edit', { type: 'student', id: studentId })` directly.
 *   Phase 6 cutover deletes this helper.
 *
 * The shim broadens semantics slightly — cross-class mentors (via
 * student_mentors) can now manage students they mentor (closes
 * FU-MENTOR-SCOPE). The class-role base is preserved exactly per
 * Decision 7 line 140.
 */
export async function verifyTeacherCanManageStudent(
  teacherId: string,
  studentId: string
): Promise<boolean> {
  const rolloutOn = await isPermissionHelperRolloutEnabled();

  if (rolloutOn) {
    const actor = await buildTeacherSessionForShim(teacherId);
    return can(actor, "student.edit", { type: "student", id: studentId });
  }

  // ─── Legacy path (kill-switch off) ──────────────────────────────────
  const db = createAdminClient();

  // Step 1: classes this teacher owns.
  const { data: teacherClasses } = await db
    .from("classes")
    .select("id")
    .eq("teacher_id", teacherId);
  const teacherClassIds = (teacherClasses ?? [])
    .map((r) => r.id as string)
    .filter(Boolean);
  if (teacherClassIds.length === 0) return false;

  // Step 2: any active enrollment of the student in those classes?
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
