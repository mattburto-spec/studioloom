/**
 * Per-bucket authorization for the /api/storage proxy.
 *
 * Closes the IDOR Gemini external review caught (9 May 2026):
 * pre-fix the proxy only checked "is there ANY authenticated session" — so
 * Student A could request /api/storage/responses/{StudentB_UUID}/avatar/...
 * and get a valid signed URL because the proxy uses service-role to mint
 * (which bypasses RLS).
 *
 * Authorization rules per bucket:
 *
 *   responses (student PII — avatars, work uploads):
 *     Path shape: {studentId}/...
 *     Allowed:
 *       - the student themselves (students.user_id == auth.uid AND students.id == path[0])
 *       - any teacher who manages that student (verifyTeacherCanManageStudent)
 *       - platform admins (auth.users.is_platform_admin)
 *
 *   unit-images (curriculum thumbnails — low PII risk):
 *     Path shape: {unitId}/...
 *     Allowed: any authenticated user (these render in shared library views).
 *     Future tightening tracked as FU-SEC-UNIT-IMAGES-SCOPING.
 *
 *   knowledge-media (teacher-uploaded teaching materials):
 *     Path shape: free-form
 *     Allowed: any authenticated user. These are teacher-uploaded curriculum
 *     content; the readers are students + teachers in the same school.
 *     Future tightening tracked as FU-SEC-KNOWLEDGE-MEDIA-SCOPING.
 */

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTeacherCanManageStudent } from "@/lib/auth/verify-teacher-unit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuthorizeResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "malformed_path" };

export async function authorizeBucketAccess(
  user: User,
  bucket: string,
  path: string,
): Promise<AuthorizeResult> {
  // The two low-stakes buckets — any authenticated user OK.
  if (bucket === "unit-images" || bucket === "knowledge-media") {
    return { ok: true };
  }

  if (bucket !== "responses") {
    // Defensive — shouldn't reach here because the route handler
    // allowlist-checks before calling us.
    return { ok: false, reason: "forbidden" };
  }

  // responses bucket — strict per-student authorization.
  const firstSegment = path.split("/")[0];
  if (!firstSegment || !UUID_RE.test(firstSegment)) {
    return { ok: false, reason: "malformed_path" };
  }
  const targetStudentId = firstSegment;

  const userType = (user.app_metadata as Record<string, unknown> | undefined)
    ?.user_type;

  // Platform admin: read-all.
  // is_platform_admin lives on user_profiles.is_platform_admin per
  // src/lib/auth/require-platform-admin.ts. We resolve it via admin client
  // — same pattern as the rest of the codebase.
  const admin = createAdminClient();

  if (userType !== "student" && userType !== "teacher") {
    // Could still be a platform admin without a typed app_metadata flag.
    const { data: profile } = await admin
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.is_platform_admin) return { ok: true };
    return { ok: false, reason: "forbidden" };
  }

  // Student: must own the path's studentId.
  if (userType === "student") {
    const { data: studentRow } = await admin
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!studentRow) return { ok: false, reason: "forbidden" };
    return studentRow.id === targetStudentId
      ? { ok: true }
      : { ok: false, reason: "forbidden" };
  }

  // Teacher: must manage the student.
  // verifyTeacherCanManageStudent encapsulates the can() helper logic
  // (Phase 3.4 shim) — co-teachers, dept-heads, and cross-class mentors
  // all flow through it correctly.
  if (userType === "teacher") {
    // Belt-and-braces: also allow if the teacher is a platform admin.
    const [profileResult, manageResult] = await Promise.all([
      admin
        .from("user_profiles")
        .select("is_platform_admin")
        .eq("id", user.id)
        .maybeSingle(),
      verifyTeacherCanManageStudent(user.id, targetStudentId),
    ]);
    if (profileResult.data?.is_platform_admin) return { ok: true };
    return manageResult ? { ok: true } : { ok: false, reason: "forbidden" };
  }

  return { ok: false, reason: "forbidden" };
}
