/**
 * GET /api/v1/teacher/students/[id]/audit-log
 *
 * Phase 5.6 — teacher (or platform_admin) view of audit events for a
 * specific student. Returns events where the student is either the actor
 * (e.g., login, classcode entry) OR the target (e.g., data export, soft-delete,
 * AI budget over-cap warning).
 *
 * Auth: same gate as /api/v1/student/[id]/{export,delete} (Phase 5.4):
 * platform_admin OR verifyTeacherCanManageStudent.
 *
 * Query parameters:
 *   ?limit=N         (default 50, max 200)
 *   ?before=<ISO>    (cursor — events strictly older than this created_at)
 *
 * Response shape:
 *   {
 *     student_id: string,
 *     events: AuditEvent[],     // sorted created_at DESC, deduped by id
 *     next_cursor: string | null  // pass as ?before to fetch the next page
 *   }
 *
 * RLS: the scanner-flagged `audit_events_school_teacher_read` policy
 * already scopes reads correctly; this endpoint uses the service-role
 * admin client for predictability + the auth gate above is the
 * defence-in-depth layer.
 *
 * audit-skip: this is a read-only GET endpoint (not a mutation route)
 *
 * Status mapping:
 *   200 — events array returned
 *   400 — invalid student_id OR invalid limit/before
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type RouteContext = { params: Promise<{ id: string }> };

interface AuditEventRow {
  id: string;
  created_at: string;
  [k: string]: unknown;
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { id: studentId } = await ctx.params;

  if (!UUID_RE.test(studentId)) {
    return NextResponse.json(
      { error: "Invalid student id" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  // ── Parse + validate query params ──────────────────────────────
  const params = request.nextUrl.searchParams;
  const limitRaw = params.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitRaw !== null) {
    const n = parseInt(limitRaw, 10);
    if (!Number.isFinite(n) || n < 1 || n > MAX_LIMIT) {
      return NextResponse.json(
        {
          error: "Invalid limit",
          message: `limit must be 1..${MAX_LIMIT}`,
        },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }
    limit = n;
  }

  const before = params.get("before");
  if (before !== null && !Number.isFinite(Date.parse(before))) {
    return NextResponse.json(
      { error: "Invalid before cursor", message: "must be ISO timestamp" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  // ── Auth ───────────────────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          /* no-op */
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
  let canRead = platformAdmin;
  if (!canRead) {
    canRead = await verifyTeacherCanManageStudent(user.id, studentId);
  }
  if (!canRead) {
    return NextResponse.json(
      { error: "Not authorized to view this student's audit log" },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }

  const adminClient = createAdminClient();

  // ── Verify student exists (404 vs 200-empty) ─────────────────
  const { data: studentRow, error: studentErr } = await adminClient
    .from("students")
    .select("id")
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

  // ── Fetch events: actor + target queries combined, deduped ──
  // We fetch up to (limit + 1) from each query so that after dedup we
  // can confidently identify the cursor + know if more exist.
  const fetchSize = limit + 1;

  const actorQuery = adminClient
    .from("audit_events")
    .select(
      "id, actor_id, actor_type, action, target_table, target_id, school_id, payload_jsonb, severity, created_at",
    )
    .eq("actor_id", studentId)
    .order("created_at", { ascending: false })
    .limit(fetchSize);

  const targetQuery = adminClient
    .from("audit_events")
    .select(
      "id, actor_id, actor_type, action, target_table, target_id, school_id, payload_jsonb, severity, created_at",
    )
    .eq("target_table", "students")
    .eq("target_id", studentId)
    .order("created_at", { ascending: false })
    .limit(fetchSize);

  const beforeFilter = before ? new Date(before).toISOString() : null;
  const [actorRes, targetRes] = await Promise.all([
    beforeFilter ? actorQuery.lt("created_at", beforeFilter) : actorQuery,
    beforeFilter ? targetQuery.lt("created_at", beforeFilter) : targetQuery,
  ]);

  const errMsg = actorRes.error?.message ?? targetRes.error?.message ?? null;
  if (errMsg) {
    return NextResponse.json(
      { error: "DB error reading audit events", message: errMsg },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }

  // Merge + dedupe by id + sort created_at DESC
  const seen = new Set<string>();
  const merged: AuditEventRow[] = [];
  for (const row of [
    ...((actorRes.data ?? []) as AuditEventRow[]),
    ...((targetRes.data ?? []) as AuditEventRow[]),
  ]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }
  merged.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

  const events = merged.slice(0, limit);
  const hasMore = merged.length > limit;
  const nextCursor =
    hasMore && events.length > 0
      ? events[events.length - 1].created_at
      : null;

  return NextResponse.json(
    {
      student_id: studentId,
      events,
      next_cursor: nextCursor,
    },
    { status: 200, headers: PRIVATE_HEADERS },
  );
}
