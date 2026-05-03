/**
 * GET /api/v1/student/[id]/export
 *
 * Phase 5.4 — FERPA / GDPR / PIPL right-to-access (DSAR) endpoint.
 * Returns a single JSON dump of student-owned data per the v1 manifest
 * in src/lib/access-v2/data-subject/export-student.ts.
 *
 * Auth: platform_admin OR a teacher who can manage this student
 * (verifyTeacherCanManageStudent — same predicate as the unified Support
 * tab; Decision 7 line 140).
 *
 * Audit: emits 'student.data_export.requested' BEFORE the response so the
 * audit row exists even if the export build fails. failureMode 'throw' —
 * data exports are compliance-critical; the audit record IS the trail.
 *
 * Response headers:
 *   Content-Type: application/json
 *   Content-Disposition: attachment; filename="student-<id>-export-<date>.json"
 *   Cache-Control: private, no-store
 *
 * Status mapping:
 *   200 — JSON payload streamed
 *   400 — invalid student_id
 *   401 — unauthenticated
 *   403 — authenticated but not authorised for this student
 *   404 — student not found
 *   500 — db_error
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/auth/require-platform-admin";
import { verifyTeacherCanManageStudent } from "@/lib/auth/verify-teacher-unit";
import { buildStudentExport } from "@/lib/access-v2/data-subject/export-student";
import { logAuditEvent } from "@/lib/access-v2/audit-log";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { id: studentId } = await ctx.params;

  if (!UUID_RE.test(studentId)) {
    return NextResponse.json(
      { error: "Invalid student id" },
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

  const adminClient = createAdminClient();

  // Platform admin OR teacher who can manage this student
  const platformAdmin = await isPlatformAdmin(user.id);
  let canExport = platformAdmin;
  if (!canExport) {
    canExport = await verifyTeacherCanManageStudent(user.id, studentId);
  }
  if (!canExport) {
    return NextResponse.json(
      { error: "Not authorized to export this student's data" },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }

  // ── Verify student exists (404 vs 200-with-empty-export) ────────
  const { data: studentRow, error: studentErr } = await adminClient
    .from("students")
    .select("id, school_id")
    .eq("id", studentId)
    .maybeSingle();
  if (studentErr) {
    return NextResponse.json(
      { error: "DB error reading student", message: studentErr.message },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
  if (!studentRow) {
    return NextResponse.json(
      { error: "Student not found" },
      { status: 404, headers: PRIVATE_HEADERS },
    );
  }
  const schoolId = (studentRow as { school_id: string | null }).school_id;

  // ── Audit BEFORE build ─────────────────────────────────────────
  // Compliance: the access record must exist regardless of build success.
  // failureMode 'throw' — DSAR audit is non-negotiable.
  await logAuditEvent(adminClient, {
    actorId: user.id,
    actorType: platformAdmin ? "platform_admin" : "teacher",
    action: "student.data_export.requested",
    targetTable: "students",
    targetId: studentId,
    schoolId,
    payload: {
      requester_email: user.email ?? null,
      via: platformAdmin ? "platform_admin" : "teacher",
    },
    severity: "warn",
    failureMode: "throw",
  });

  // ── Build export ───────────────────────────────────────────────
  let payload;
  try {
    payload = await buildStudentExport(adminClient, studentId);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Export build failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }

  const filename = `student-${studentId}-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...PRIVATE_HEADERS,
    },
  });
}
