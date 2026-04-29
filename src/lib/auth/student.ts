/**
 * Shared student authentication helper.
 *
 * Centralises the student session lookup used by all student API routes.
 * Previously duplicated ~17 times across routes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DUAL-MODE AUTH (Phase 1.4a — Access Model v2 Auth Unification)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Originally read SESSION_COOKIE_NAME (`questerra_student_session`) →
 * `student_sessions` table → `student_id`. This is the LEGACY path.
 *
 * Phase 1.4a (29 Apr 2026) added a Supabase-Auth-first lookup that runs
 * BEFORE the legacy fallback. New auth flow:
 *
 *   1. Try `getStudentSession()` from access-v2/actor-session.ts
 *      → reads sb-* cookies set by Phase 1.2's classcode-login route
 *      → validates JWT against Supabase Auth
 *      → returns the student row's id (students.id, NOT auth.users.id)
 *   2. If no Supabase session, fall back to the legacy table lookup
 *      → reads questerra_student_session cookie + student_sessions table
 *
 * Why dual-mode: rolls out the new auth path to ALL 63 student routes
 * with ZERO route file changes. Routes that haven't migrated to
 * `requireStudentSession()` (Phase 1.4b/c) still get the new auth via
 * this wrapper. The legacy fallback stays callable until Phase 6 deletes
 * the `student_sessions` table entirely.
 *
 * IMPORTANT: getStudentId() returns `students.id` (the student PK), NOT
 * auth.users.id. Both auth paths converge on the same return shape so
 * downstream code is unaffected.
 *
 * Lessons:
 *   - #54: don't trust an aged auth helper to "just work" through a
 *     Phase 0.8b NOT NULL tighten — verify every code path with tests
 *   - Dual-mode introduces ordering risk: if the new path silently
 *     errors, callers shouldn't get the wrong actor. Failures from
 *     getStudentSession() return null (handled in actor-session.ts) so
 *     we cleanly fall through to legacy.
 */

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentSession } from "@/lib/access-v2/actor-session";

/**
 * Extract student_id from the request's auth context.
 * Returns null if no auth (any source), expired, or invalid.
 *
 * Lookup order:
 *   1. Supabase Auth via @supabase/ssr (post-Phase-1.2 sessions)
 *   2. Legacy `questerra_student_session` cookie + student_sessions table
 *
 * Both paths return `students.id` (the student PK), so downstream callers
 * see no behavioural change.
 */
export async function getStudentId(
  request: NextRequest
): Promise<string | null> {
  // Phase 1.4a — try the new Supabase Auth path FIRST.
  // getStudentSession returns null when:
  //   - no sb-* cookie present (legacy-only client)
  //   - JWT validation fails or expired
  //   - app_metadata.user_type !== 'student'
  //   - students row missing for the user_id (data inconsistency)
  // In all those cases we fall through to the legacy lookup below.
  try {
    const session = await getStudentSession(request);
    if (session) return session.studentId;
  } catch {
    // Defensive — getStudentSession should never throw, but if the SSR
    // client construction errors (e.g., env var missing in some preview),
    // fall back to legacy rather than 5xx the request.
  }

  // Legacy fallback — original Phase 0 path.
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return session?.student_id || null;
}

/**
 * Standard 401 response for unauthenticated student requests.
 */
export function studentUnauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Standard 401 response for invalid/expired sessions.
 */
export function studentInvalidSession(): NextResponse {
  return NextResponse.json({ error: "Invalid session" }, { status: 401 });
}

/**
 * Validate student auth and return student_id or an error response.
 *
 * Convenience wrapper that combines getStudentId + error response.
 * Use this for the common pattern:
 *
 *   const auth = await requireStudentAuth(request);
 *   if (auth.error) return auth.error;
 *   const studentId = auth.studentId;
 */
export async function requireStudentAuth(
  request: NextRequest
): Promise<
  { studentId: string; error?: never } | { studentId?: never; error: NextResponse }
> {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return { error: studentUnauthorized() };
  }
  return { studentId };
}
