/**
 * Shared student authentication helper.
 *
 * Centralises the token-based student session lookup used by all
 * student API routes. Previously duplicated ~17 times across routes.
 *
 * Students authenticate via SESSION_COOKIE_NAME cookie → student_sessions
 * table → student_id. This is NOT Supabase Auth — it's a custom token
 * system using nanoid(48) tokens with 7-day TTL.
 */

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Extract student_id from the session token cookie.
 * Returns null if no token, expired, or invalid.
 *
 * Uses createAdminClient() (service role) to bypass RLS —
 * student_sessions is a simple auth table, not user-facing data.
 */
export async function getStudentId(
  request: NextRequest
): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

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
