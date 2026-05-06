// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * /api/teacher/students/[studentId]
 *   PATCH  — update student profile fields (display_name today; extensible)
 *   DELETE — hard-delete a student from the teacher's roster
 *
 * Round 20 (6 May 2026 PM) — closes the gap surfaced on the per-student
 * teacher view. Previously the page only had per-class "Remove" buttons
 * (unenroll), with no way to edit the display name or hard-delete the
 * student. Both are now first-class operations on this route.
 *
 * Auth: any teacher who can manage the student via
 * `verifyTeacherCanManageStudent` (active enrollment in a class they own).
 * That helper is the same one the unified support-settings + cross-class
 * mentor flows already rely on, so we share the trust boundary.
 *
 * DELETE side-effects (in order, all via service-role admin client):
 *   1. class_students rows for this student → DELETE (cascades enrollment)
 *   2. student_progress rows → DELETE (FK to student row)
 *   3. students row → DELETE (the student record itself)
 *   4. auth.users row keyed off students.user_id → DELETE
 *      (Supabase auth admin client; ignore "user not found" errors so a
 *      half-provisioned student can still be cleaned up.)
 *
 * NOT deleted: portfolio items, work submissions, fabrication jobs, audit
 * logs. Those are intentionally preserved for compliance / historical
 * record. If the teacher needs a hard wipe of all student-linked data
 * (GDPR-style), that's a separate platform-admin operation.
 *
 * The orchestration is intentionally inlined — no new lib helper. We may
 * extract one if a second consumer surfaces (e.g. bulk-delete from a
 * roster page), but YAGNI for now.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTeacherAuth,
  verifyTeacherCanManageStudent,
} from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";

const CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CACHE_HEADERS });
}

interface PatchBody {
  displayName?: unknown;
}

// ---------------------------------------------------------------------------
// PATCH — update display_name (extensible to other profile fields later)
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const { studentId } = await params;
  if (!studentId) return privateJson({ error: "Missing studentId" }, 400);

  const owns = await verifyTeacherCanManageStudent(teacherId, studentId);
  if (!owns) {
    return privateJson(
      { error: "Student not found or not in your roster" },
      403
    );
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const updates: Record<string, string | null> = {};

  if (body.displayName !== undefined) {
    if (body.displayName === null) {
      updates.display_name = null;
    } else if (typeof body.displayName === "string") {
      const trimmed = body.displayName.trim();
      if (trimmed.length === 0) {
        // Empty string → null so getDisplayName() falls back to username.
        updates.display_name = null;
      } else if (trimmed.length > 80) {
        return privateJson(
          { error: "Display name must be 80 characters or fewer" },
          400
        );
      } else {
        updates.display_name = trimmed;
      }
    } else {
      return privateJson(
        { error: "displayName must be a string or null" },
        400
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return privateJson({ error: "No fields to update" }, 400);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("students")
    .update(updates)
    .eq("id", studentId)
    .select("id, display_name, username")
    .single();

  if (error || !data) {
    console.error("[teacher/students/[id]:PATCH] update failed:", error?.message);
    return privateJson(
      { error: error?.message || "Failed to update student" },
      500
    );
  }

  return privateJson({ student: data });
}

// ---------------------------------------------------------------------------
// DELETE — hard-delete the student
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const { studentId } = await params;
  if (!studentId) return privateJson({ error: "Missing studentId" }, 400);

  const owns = await verifyTeacherCanManageStudent(teacherId, studentId);
  if (!owns) {
    return privateJson(
      { error: "Student not found or not in your roster" },
      403
    );
  }

  const supabase = createAdminClient();

  // Pull user_id first so we can clean up the auth.users row even if the
  // students row delete cascades it out.
  const { data: studentRow } = await supabase
    .from("students")
    .select("id, user_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!studentRow) {
    return privateJson({ error: "Student not found" }, 404);
  }

  // 1. class_students enrollments
  const { error: enrollErr } = await supabase
    .from("class_students")
    .delete()
    .eq("student_id", studentId);
  if (enrollErr) {
    console.warn(
      "[teacher/students/[id]:DELETE] class_students cleanup warning:",
      enrollErr.message
    );
  }

  // 2. student_progress rows (drops journey progress, integrity metadata, etc.)
  const { error: progressErr } = await supabase
    .from("student_progress")
    .delete()
    .eq("student_id", studentId);
  if (progressErr) {
    console.warn(
      "[teacher/students/[id]:DELETE] student_progress cleanup warning:",
      progressErr.message
    );
  }

  // 3. The student row itself
  const { error: studentErr } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId);
  if (studentErr) {
    console.error(
      "[teacher/students/[id]:DELETE] students delete failed:",
      studentErr.message
    );
    return privateJson(
      { error: studentErr.message || "Failed to delete student" },
      500
    );
  }

  // 4. Best-effort auth.users cleanup. If the user_id is null (legacy or
  //    half-provisioned), or the auth user is already gone, swallow the
  //    error — the student row is gone and that's the source of truth for
  //    the teacher view.
  if (studentRow.user_id) {
    try {
      const { error: authErr } = await supabase.auth.admin.deleteUser(
        studentRow.user_id
      );
      if (authErr && !/not.*found/i.test(authErr.message)) {
        console.warn(
          "[teacher/students/[id]:DELETE] auth.users cleanup warning:",
          authErr.message
        );
      }
    } catch (e) {
      console.warn(
        "[teacher/students/[id]:DELETE] auth.users cleanup threw:",
        e
      );
    }
  }

  return privateJson({ ok: true });
}
