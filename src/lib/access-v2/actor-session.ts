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

export interface StudentSession {
  type: "student";
  /** students.id — the student PK (UUID; distinct from auth.users.id) */
  studentId: string;
  /** auth.users.id — also students.user_id */
  userId: string;
  /** students.school_id — denormalised from Phase 0.3; required for school-scoped reads */
  schoolId: string | null;
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
  // TEMP Phase 1.4-debug — log incoming cookie names so we can diagnose
  // whether the SSR client is seeing the sb-* cookies at all.
  // Remove after fix lands.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const allCookies = store.getAll();
    // eslint-disable-next-line no-console
    console.error("[actor-session-debug] cookies seen by buildSsrClient", {
      count: allCookies.length,
      names: allCookies.map((c) => c.name),
      hasSupabaseCookie: allCookies.some((c) => c.name.startsWith("sb-")),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[actor-session-debug] cookies() read failed", (e as Error).message);
  }

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

  return {
    type: "student",
    studentId: row.id,
    userId: user.id,
    schoolId: row.school_id ?? null,
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
    supabaseAdmin
      .from("teachers")
      .select("id, school_id")
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

  return {
    type: "teacher",
    teacherId: teacherResult.data.id,
    userId: user.id,
    schoolId: teacherResult.data.school_id ?? null,
    isPlatformAdmin: profileResult.data?.is_platform_admin ?? false,
  };
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

  // TEMP Phase 1.4-debug — verbose logging to diagnose Vercel-preview 401s.
  // Remove after fix lands.
  if (userErr || !userData?.user) {
    // eslint-disable-next-line no-console
    console.error("[actor-session-debug] auth.getUser failed", {
      hasError: Boolean(userErr),
      errorMessage: userErr?.message ?? null,
      errorStatus: (userErr as { status?: number } | null)?.status ?? null,
      hasUser: Boolean(userData?.user),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(unset)",
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    });
    return null;
  }

  const user = userData.user;
  const userType = (user.app_metadata as Record<string, unknown> | undefined)
    ?.user_type;

  // eslint-disable-next-line no-console
  console.error("[actor-session-debug] auth.getUser ok", {
    userId: user.id,
    userType,
    appMetadataKeys: Object.keys(user.app_metadata ?? {}),
  });

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
