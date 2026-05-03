// audit-skip: audit row emitted inside softDeleteStudent lib helper at src/lib/access-v2/data-subject/delete-student.ts
/**
 * DELETE /api/v1/student/[id]?confirm=true
 *
 * Phase 5.4 — soft-delete a student + queue 30-day hard-delete via
 * scheduled_deletions (Q5 resolution).
 *
 * Confirmation pattern: requires `?confirm=true` query param. Defence in
 * depth — clicking the wrong link or curl-ing without intent shouldn't
 * soft-delete. (Some clients can't send a body on DELETE; query param is
 * the universal signal.)
 *
 * Auth: platform_admin OR teacher who can manage this student.
 *
 * Audit: emits 'student.deleted.soft' atomically with the soft-delete
 * (failureMode 'throw' inside softDeleteStudent).
 *
 * Status mapping:
 *   200 — soft-deleted + scheduled. Returns { ok, scheduledHardDeleteAt,
 *         scheduledDeletionId, alreadyScheduled }
 *   400 — invalid student id OR missing ?confirm=true
 *   401 — unauthenticated
 *   403 — authenticated but not authorised
 *   404 — student not found
 *   500 — db_error during soft-delete
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/auth/require-platform-admin";
import { verifyTeacherCanManageStudent } from "@/lib/auth/verify-teacher-unit";
import { softDeleteStudent } from "@/lib/access-v2/data-subject/delete-student";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { id: studentId } = await ctx.params;

  if (!UUID_RE.test(studentId)) {
    return NextResponse.json(
      { error: "Invalid student id" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  // Confirmation gate
  const confirm = request.nextUrl.searchParams.get("confirm");
  if (confirm !== "true") {
    return NextResponse.json(
      {
        error: "Confirmation required",
        message:
          "Add ?confirm=true to the URL to proceed with soft-deletion. The student record will be marked deleted and queued for hard-deletion in 30 days.",
      },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  // ── Auth ────────────────────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          /* no-op for API routes */
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  const platformAdmin = await isPlatformAdmin(user.id);
  let canDelete = platformAdmin;
  if (!canDelete) {
    canDelete = await verifyTeacherCanManageStudent(user.id, studentId);
  }
  if (!canDelete) {
    return NextResponse.json(
      { error: "Not authorized to delete this student" },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }

  // ── Soft-delete ─────────────────────────────────────────────────
  const adminClient = createAdminClient();
  const result = await softDeleteStudent(adminClient, studentId, user.id);

  if (!result.ok) {
    const status = result.reason === "student_not_found" ? 404 : 500;
    return NextResponse.json(
      { error: result.reason, message: result.message },
      { status, headers: PRIVATE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      student_id: studentId,
      scheduled_deletion_id: result.scheduledDeletionId,
      scheduled_hard_delete_at: result.scheduledHardDeleteAt,
      already_scheduled: result.alreadyScheduled,
      message: result.alreadyScheduled
        ? "Student was already soft-deleted; existing schedule returned."
        : `Student soft-deleted; hard-delete scheduled for ${result.scheduledHardDeleteAt}.`,
    },
    { status: 200, headers: PRIVATE_HEADERS },
  );
}
