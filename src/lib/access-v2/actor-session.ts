/**
 * Polymorphic actor session helpers (Phase 1.3 — Access Model v2).
 *
 * Brief:  docs/projects/access-model-v2-phase-1-brief.md §4.3
 *
 * Single entry point for reading the authenticated actor on any request:
 *
 *   - getActorSession(req)        → ActorSession | null  (polymorphic, dispatches on user_type)
 *   - getStudentSession(req)      → StudentSession | null
 *   - getTeacherSession(req)      → TeacherSession | null
 *   - requireStudentSession(req)  → StudentSession | NextResponse(401)
 *   - requireActorSession(req)    → ActorSession | NextResponse(401)
 *
 * The helpers read the Supabase session via the @supabase/ssr cookies adapter
 * (set on this request by Phase 1.2's classcode-login route OR by the legacy
 * teacher Supabase auth flow). They dispatch on `app_metadata.user_type` —
 * the security-critical claim that lives in admin-only metadata and is signed
 * into the JWT.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SCOPE BOUNDARIES (Lesson #45)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * THIS module:
 *   - Reads the Supabase session
 *   - Looks up the actor row (students or teachers) by user_id
 *   - Returns a typed identity record { type, studentId/teacherId, userId, schoolId, ... }
 *
 * THIS module does NOT:
 *   - Resolve classId — callers use `resolveStudentClassId()` from
 *     src/lib/student-support/resolve-class-id.ts (Phase 1.3 keeps the
 *     session cheap; per-request class resolution is opt-in)
 *   - Verify teacher-can-manage-student permissions — callers use
 *     `verifyTeacherCanManageStudent()` from src/lib/auth/verify-teacher-unit.ts
 *   - Read app_settings or class context
 *   - Mutate cookies (verifyOtp on the login route handles that; reads here
 *     are session-only)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BACKWARDS COMPAT
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The legacy `requireStudentAuth(request)` from src/lib/auth/student.ts is
 * UNCHANGED in Phase 1.3 — it still reads the legacy `questerra_student_session`
 * cookie + student_sessions table. The 63 student routes will be migrated to
 * `requireStudentSession()` in Phase 1.4 batches. Both auth paths coexist
 * during the grace window. Phase 6 deletes the legacy path.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERFORMANCE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Per-request cost:
 *   - 1× supabase.auth.getUser() — validates JWT against Supabase Auth (~50ms)
 *   - 1× students or teachers lookup by user_id (indexed; ~10ms)
 *
 * Total ~60ms added per request that gates on session. Comparable to the
 * legacy `student_sessions` table lookup in `getStudentId()`. Acceptable for
 * Phase 1; can be optimized in Phase 5+ via session caching if hot-path
 * becomes visible.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type SubscriptionTier =
  | "pilot"
  | "free"
  | "starter"
  | "pro"
  | "school";

export interface StudentSession {
  type: "student";
  /** students.id — the student PK (UUID; distinct from auth.users.id) */
  studentId: string;
  /** auth.users.id — also students.user_id */
  userId: string;
  /** students.school_id — denormalised from Phase 0.3; required for school-scoped reads */
  schoolId: string | null;
  /**
   * Phase 4.8b — effective subscription tier. Resolved from
   * schools.subscription_tier of student's school; 'free' fallback
   * when no school. Students don't have personal subscription_tier.
   */
  plan: SubscriptionTier;
}

export interface TeacherSession {
  type: "teacher";
  /** teachers.id — same value as user_id (teachers are 1:1 with auth.users) */
  teacherId: string;
  /** auth.users.id */
  userId: string;
  /** teachers.school_id — required for school-scoped admin views */
  schoolId: string | null;
  /** user_profiles.is_platform_admin — gates Matt's super-admin views */
  isPlatformAdmin: boolean;
  /**
   * Phase 4.8b — effective subscription tier. Cascade resolution:
   *   teachers.subscription_tier (Pro Teacher self-serve)
   *   → schools.subscription_tier (school-tier inheritance)
   *   → 'free' fallback
   * Pre-resolved at session build time so downstream gating doesn't
   * pay a round-trip cost. The freemium build later wraps this with
   * the can(...){requiresTier} chokepoint.
   */
  plan: SubscriptionTier;
}

export type ActorSession = StudentSession | TeacherSession;

// ─────────────────────────────────────────────────────────────────────────
// Internal: SSR client builder
// ─────────────────────────────────────────────────────────────────────────

/**
 * Constructs the SSR Supabase client for the current request. Reads the
 * sb-*-auth-token cookies set by Phase 1.2's classcode-login route OR the
 * legacy teacher signin flow. Used internally; tests inject a stub.
 */
async function buildSsrClient(): Promise<SupabaseClient> {
  return createServerSupabaseClient();
}

// ─────────────────────────────────────────────────────────────────────────
// Internal: actor lookup
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a StudentSession from a verified auth.users row + students lookup.
 * Returns null if the auth user has user_type='student' in app_metadata
 * but no matching students row exists (data inconsistency we treat as
 * unauthenticated, NOT as 5xx — caller can re-login).
 */
async function buildStudentSession(
  user: User,
  supabaseAdmin: SupabaseClient
): Promise<StudentSession | null> {
  const { data: row, error } = await supabaseAdmin
    .from("students")
    .select("id, school_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !row) {
    // Don't 5xx — the auth.users row exists but the students row is missing
    // or deleted. Treat as no-session; caller falls through to 401.
    return null;
  }

  // Phase 4.8b — resolve subscription tier from student's school.
  // Students don't have a personal subscription_tier; they inherit
  // from school. 'free' fallback when no school.
  const plan = await resolveTier({
    teacherId: null,
    schoolId: row.school_id ?? null,
    db: supabaseAdmin,
  });

  return {
    type: "student",
    studentId: row.id,
    userId: user.id,
    schoolId: row.school_id ?? null,
    plan,
  };
}

/**
 * Build a TeacherSession. teachers.id = auth.users.id (1:1), so we use
 * user.id directly + look up school_id and platform-admin flag.
 *
 * Two queries: teachers (for school_id) and user_profiles (for is_platform_admin).
 * Could be one .select() if the FK is set up — but separate queries are safer
 * during Phase 1 transition while user_profiles trigger is still settling.
 */
async function buildTeacherSession(
  user: User,
  supabaseAdmin: SupabaseClient
): Promise<TeacherSession | null> {
  const [teacherResult, profileResult] = await Promise.all([
    // Phase 4.8b extends the select to include subscription_tier
    supabaseAdmin
      .from("teachers")
      .select("id, school_id, subscription_tier")
      .eq("id", user.id)
      .maybeSingle(),
    supabaseAdmin
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (teacherResult.error || !teacherResult.data) {
    // Auth user claims teacher but no teachers row — treat as no-session.
    return null;
  }

  // Phase 4.8b — cascade tier resolution. teacher tier wins; else
  // school inherits; else 'free' fallback.
  const teacherTier =
    (teacherResult.data.subscription_tier as SubscriptionTier | undefined) ??
    null;
  const plan = await resolveTier({
    teacherId: user.id,
    schoolId: teacherResult.data.school_id ?? null,
    teacherTier,
    db: supabaseAdmin,
  });

  return {
    type: "teacher",
    teacherId: teacherResult.data.id,
    userId: user.id,
    schoolId: teacherResult.data.school_id ?? null,
    isPlatformAdmin: profileResult.data?.is_platform_admin ?? false,
    plan,
  };
}

/**
 * Phase 4.8b — cascade tier resolution helper.
 *
 *   teacher tier (Pro Teacher self-serve, if set on teachers row)
 *   → school tier (inherited from schools.subscription_tier)
 *   → 'free' fallback
 *
 * Called inline from session-build functions. No round-trip cost
 * beyond what's already happening (tier joins via the same admin
 * client; the student path adds one schools query when school_id
 * is set). The freemium build later replaces this with admin_settings
 * tier-default lookups.
 */
async function resolveTier(args: {
  teacherId: string | null;
  schoolId: string | null;
  teacherTier?: SubscriptionTier | null;
  db: SupabaseClient;
}): Promise<SubscriptionTier> {
  // Teacher tier wins (Pro Teacher self-serve)
  if (
    args.teacherTier &&
    args.teacherTier !== "free" &&
    isValidTier(args.teacherTier)
  ) {
    return args.teacherTier;
  }

  // School-tier inheritance
  if (args.schoolId) {
    const { data } = await args.db
      .from("schools")
      .select("subscription_tier")
      .eq("id", args.schoolId)
      .maybeSingle();
    if (data?.subscription_tier && isValidTier(data.subscription_tier)) {
      return data.subscription_tier as SubscriptionTier;
    }
  }

  // Fallback — covers (a) no school context, (b) school lookup failed,
  // (c) teacher.subscription_tier was 'free' (fall through to school
  // inheritance, which may also be 'free'/'pilot').
  return args.teacherTier && isValidTier(args.teacherTier)
    ? args.teacherTier
    : "free";
}

function isValidTier(value: string): value is SubscriptionTier {
  return ["pilot", "free", "starter", "pro", "school"].includes(value);
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

/**
 * Read the authenticated actor for the current request. Returns null when:
 *   - No Supabase session cookie present
 *   - Session expired (Supabase rejects the token)
 *   - app_metadata.user_type is missing or unrecognised
 *   - The actor row (students or teachers) doesn't exist for the user_id
 *
 * Polymorphic on `app_metadata.user_type`:
 *   - 'student' → StudentSession
 *   - 'teacher' → TeacherSession
 *   - others (fabricator, platform_admin, community_member, guardian)
 *     → null in Phase 1.3 (Phase 2/3+ extends this to handle them)
 *
 * @param _request — accepted for future use (rate-limit / signature checks)
 *   but currently unused; the SSR client reads cookies via next/headers
 */
export async function getActorSession(
  _request?: NextRequest
): Promise<ActorSession | null> {
  const ssr = await buildSsrClient();
  const { data: userData, error: userErr } = await ssr.auth.getUser();
  if (userErr || !userData?.user) return null;

  const user = userData.user;
  const userType = (user.app_metadata as Record<string, unknown> | undefined)
    ?.user_type;

  // Use admin client for the actor-row lookup (RLS-respecting reads come
  // later when routes migrate; for the session helper itself we want
  // deterministic identity resolution regardless of policy).
  const supabaseAdmin = createAdminClient();

  if (userType === "student") {
    return buildStudentSession(user, supabaseAdmin);
  }
  if (userType === "teacher") {
    return buildTeacherSession(user, supabaseAdmin);
  }

  // Unknown / unsupported user_type for Phase 1.3 — caller falls through to 401.
  return null;
}

/**
 * Convenience: returns a StudentSession or null. Wraps getActorSession + filters.
 * Use when the route ONLY accepts students.
 */
export async function getStudentSession(
  request?: NextRequest
): Promise<StudentSession | null> {
  const actor = await getActorSession(request);
  if (!actor || actor.type !== "student") return null;
  return actor;
}

/**
 * Convenience: returns a TeacherSession or null. Wraps getActorSession + filters.
 * Use when the route ONLY accepts teachers.
 */
export async function getTeacherSession(
  request?: NextRequest
): Promise<TeacherSession | null> {
  const actor = await getActorSession(request);
  if (!actor || actor.type !== "teacher") return null;
  return actor;
}

// ─────────────────────────────────────────────────────────────────────────
// require* wrappers — return NextResponse(401) instead of null
// ─────────────────────────────────────────────────────────────────────────

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
    }
  );
}

/**
 * Require an authenticated student. Returns the StudentSession on success,
 * or a NextResponse(401) the caller can return directly.
 *
 * Pattern in routes:
 *
 *   const session = await requireStudentSession(request);
 *   if (session instanceof NextResponse) return session;
 *   // ...use session.studentId, session.userId, session.schoolId
 */
export async function requireStudentSession(
  request?: NextRequest
): Promise<StudentSession | NextResponse> {
  const session = await getStudentSession(request);
  if (!session) return unauthorizedResponse();
  return session;
}

/**
 * Require any authenticated actor (student or teacher). Returns the
 * polymorphic ActorSession on success, or NextResponse(401).
 *
 * Pattern in routes:
 *
 *   const session = await requireActorSession(request);
 *   if (session instanceof NextResponse) return session;
 *   if (session.type === 'student') { ... }
 *   else if (session.type === 'teacher') { ... }
 */
export async function requireActorSession(
  request?: NextRequest
): Promise<ActorSession | NextResponse> {
  const session = await getActorSession(request);
  if (!session) return unauthorizedResponse();
  return session;
}
