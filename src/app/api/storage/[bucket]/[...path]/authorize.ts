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
 *   unit-images (curriculum thumbnails):
 *     Path shape: {unitId}/{timestamp}.jpg (single writer:
 *     /api/teacher/upload-unit-image/route.ts:88).
 *     Allowed (S5 9 May 2026 — F-11 closure):
 *       - students enrolled in any class with this unit assigned
 *         (auth.uid → students.user_id → class_students → class_units → unit)
 *       - teachers with verifyTeacherHasUnit (authored OR assigned via class_members)
 *       - platform admins
 *
 *   knowledge-media (teacher-uploaded teaching materials):
 *     Path shape: {teacherId}/{timestamp}.{ext} (single writer:
 *     /api/teacher/knowledge/media/route.ts:63).
 *     Allowed (S5 9 May 2026 — F-11 closure):
 *       - the owning teacher themselves (path[0] == auth.uid for teachers)
 *       - any teacher in the same school as the owning teacher
 *         (school-co-membership; v1 share-by-school model per pilot scope)
 *       - any student in the same school as the owning teacher
 *       - platform admins
 */

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyTeacherCanManageStudent,
  verifyTeacherHasUnit,
} from "@/lib/auth/verify-teacher-unit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuthorizeResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "malformed_path" };

export async function authorizeBucketAccess(
  user: User,
  bucket: string,
  path: string,
): Promise<AuthorizeResult> {
  if (bucket === "unit-images") {
    return authorizeUnitImagesAccess(user, path);
  }
  if (bucket === "knowledge-media") {
    return authorizeKnowledgeMediaAccess(user, path);
  }

  // `responses` (v1) and `user-profile-photos` (v2) share the same
  // per-student PII auth pattern: path[0] is the studentId; student must
  // own that path, teachers must manage the student, platform admins
  // read all. Both fall through to authorizePerStudentBucketAccess
  // below.
  if (bucket !== "responses" && bucket !== "user-profile-photos") {
    // Defensive — shouldn't reach here because the route handler
    // allowlist-checks before calling us.
    return { ok: false, reason: "forbidden" };
  }

  return authorizePerStudentBucketAccess(user, path);
}

// ─── responses + user-profile-photos buckets (per-student PII) ─────────
//
// Both buckets follow the same path shape: {studentId}/...
//   - responses: {studentId}/{unitId}/{pageId}/{timestamp}.{ext}
//   - user-profile-photos: {studentId}/{unitId}.{ext}
//
// Authorization is identical: student must own the path's first segment,
// teachers must verifyTeacherCanManageStudent, platform admins pass.

async function authorizePerStudentBucketAccess(
  user: User,
  path: string,
): Promise<AuthorizeResult> {
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

// ─── unit-images bucket ────────────────────────────────────────────────
//
// Path shape: {unitId}/{timestamp}.jpg (verified by audit 9 May 2026 —
// single writer at /api/teacher/upload-unit-image/route.ts:88).
//
// Scoping (S5 / F-11):
//   - Students enrolled in any class with this unit assigned.
//   - Teachers via verifyTeacherHasUnit (authored OR assigned via class_members).
//   - Platform admins.

async function authorizeUnitImagesAccess(
  user: User,
  path: string,
): Promise<AuthorizeResult> {
  const firstSegment = path.split("/")[0];
  if (!firstSegment || !UUID_RE.test(firstSegment)) {
    return { ok: false, reason: "malformed_path" };
  }
  const targetUnitId = firstSegment;

  const userType = (user.app_metadata as Record<string, unknown> | undefined)
    ?.user_type;
  const admin = createAdminClient();

  // Platform admin: read-all (check first; cheapest fast-path for admins).
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_platform_admin) return { ok: true };

  if (userType === "teacher") {
    const result = await verifyTeacherHasUnit(user.id, targetUnitId);
    return result.hasAccess
      ? { ok: true }
      : { ok: false, reason: "forbidden" };
  }

  if (userType === "student") {
    // Chain: auth.uid → students.id → class_students → class_units(unit_id).
    // Two queries because Supabase's PostgREST inner-join syntax for this
    // shape is awkward and the indexes make 2 simple lookups fast.
    const { data: studentRow } = await admin
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!studentRow) return { ok: false, reason: "forbidden" };

    // Get this unit's class assignments
    const { data: classUnits } = await admin
      .from("class_units")
      .select("class_id")
      .eq("unit_id", targetUnitId)
      .eq("is_active", true);
    const classIds = (classUnits ?? [])
      .map((r) => r.class_id as string)
      .filter(Boolean);
    if (classIds.length === 0) return { ok: false, reason: "forbidden" };

    // Is the student actively enrolled in any of those classes?
    const { data: enrollment } = await admin
      .from("class_students")
      .select("class_id")
      .eq("student_id", studentRow.id)
      .eq("is_active", true)
      .in("class_id", classIds)
      .limit(1)
      .maybeSingle();
    return enrollment ? { ok: true } : { ok: false, reason: "forbidden" };
  }

  return { ok: false, reason: "forbidden" };
}

// ─── knowledge-media bucket ─────────────────────────────────────────────
//
// Path shape: {teacherId}/{timestamp}.{ext} (verified by audit 9 May 2026
// — single writer at /api/teacher/knowledge/media/route.ts:63; teacherId
// here is auth.users.id since teachers.id == auth.users.id 1:1 per Phase
// 1.1+).
//
// Scoping (S5 / F-11):
//   - Owning teacher themselves (auth.uid === path[0]).
//   - Same-school teachers (school-co-membership; v1 share-by-school model).
//   - Same-school students.
//   - Platform admins.

async function authorizeKnowledgeMediaAccess(
  user: User,
  path: string,
): Promise<AuthorizeResult> {
  const firstSegment = path.split("/")[0];
  if (!firstSegment || !UUID_RE.test(firstSegment)) {
    return { ok: false, reason: "malformed_path" };
  }
  const ownerTeacherId = firstSegment;

  // Self-access fast-path.
  const userType = (user.app_metadata as Record<string, unknown> | undefined)
    ?.user_type;
  if (userType === "teacher" && user.id === ownerTeacherId) {
    return { ok: true };
  }

  const admin = createAdminClient();

  // Platform admin: read-all.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_platform_admin) return { ok: true };

  // Resolve the owning teacher's school.
  const { data: ownerRow } = await admin
    .from("teachers")
    .select("school_id")
    .eq("id", ownerTeacherId)
    .maybeSingle();
  const ownerSchoolId = ownerRow?.school_id as string | null | undefined;
  if (!ownerSchoolId) return { ok: false, reason: "forbidden" };

  if (userType === "teacher") {
    const { data: accessorRow } = await admin
      .from("teachers")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();
    return accessorRow?.school_id === ownerSchoolId
      ? { ok: true }
      : { ok: false, reason: "forbidden" };
  }

  if (userType === "student") {
    const { data: studentRow } = await admin
      .from("students")
      .select("school_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return studentRow?.school_id === ownerSchoolId
      ? { ok: true }
      : { ok: false, reason: "forbidden" };
  }

  return { ok: false, reason: "forbidden" };
}
