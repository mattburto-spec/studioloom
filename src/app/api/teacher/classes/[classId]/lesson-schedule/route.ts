// audit-skip: routine teacher pedagogy ops — scheduling lesson dates.
//
// /api/teacher/classes/[classId]/lesson-schedule
//   GET  ?unitId=<uuid>   — return all scheduled dates for this
//                            class+unit pair.
//   PUT                    — bulk-upsert (and bulk-delete cleared rows)
//                            the schedule for this class+unit pair.
//
// Per-class scheduling: same unit taught to two classes can have two
// different timelines (G8 + G9 cohorts at different paces).
//
// Auth: requireTeacher + verify the teacher owns this class.
// Tier 2 of the lesson-scheduling feature (13 May 2026).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth/require-teacher";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD

interface ScheduleEntry {
  page_id: string;
  scheduled_date: string; // ISO YYYY-MM-DD
}

async function verifyTeacherOwnsClass(
  db: ReturnType<typeof createAdminClient>,
  teacherId: string,
  classId: string,
): Promise<boolean> {
  const { data } = await db
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  return !!data;
}

// ─────────────────────────────────────────────────────────────────────
// GET — return all schedule entries for (classId, unitId)
// ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const { classId } = await params;
  if (!classId || !UUID_RE.test(classId)) {
    return NextResponse.json({ error: "classId required (uuid)" }, { status: 400 });
  }

  const unitId = request.nextUrl.searchParams.get("unitId");
  if (!unitId || !UUID_RE.test(unitId)) {
    return NextResponse.json(
      { error: "unitId query param required (uuid)" },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const owns = await verifyTeacherOwnsClass(db, teacherId, classId);
  if (!owns) {
    return NextResponse.json({ error: "Class not in your roster" }, { status: 403 });
  }

  const { data, error } = await db
    .from("class_unit_lesson_schedule")
    .select("page_id, scheduled_date")
    .eq("class_id", classId)
    .eq("unit_id", unitId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { schedule: (data ?? []) as ScheduleEntry[] },
    { headers: { "Cache-Control": "private, max-age=10" } },
  );
}

// ─────────────────────────────────────────────────────────────────────
// PUT — bulk upsert + clear. Body: { unitId, entries: [{page_id, scheduled_date | null}, ...] }
//
// Semantics: entries with a `scheduled_date` are upserted on
// (class_id, page_id). Entries with `scheduled_date === null` delete
// the schedule row for that page (teacher cleared the date).
// Pages NOT mentioned in `entries` are left untouched. So the client
// can send only the rows it's changed in this save.
// ─────────────────────────────────────────────────────────────────────

interface PutBody {
  unitId?: unknown;
  entries?: unknown;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const { classId } = await params;
  if (!classId || !UUID_RE.test(classId)) {
    return NextResponse.json({ error: "classId required (uuid)" }, { status: 400 });
  }

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const unitId = typeof body.unitId === "string" ? body.unitId : "";
  if (!UUID_RE.test(unitId)) {
    return NextResponse.json({ error: "unitId required (uuid)" }, { status: 400 });
  }

  if (!Array.isArray(body.entries)) {
    return NextResponse.json(
      { error: "entries required (array)" },
      { status: 400 },
    );
  }

  // Parse + validate each entry.
  const upserts: Array<{
    class_id: string;
    unit_id: string;
    page_id: string;
    scheduled_date: string;
  }> = [];
  const deletes: string[] = []; // page_ids to clear

  for (const raw of body.entries) {
    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { error: "entry must be { page_id, scheduled_date }" },
        { status: 400 },
      );
    }
    const e = raw as { page_id?: unknown; scheduled_date?: unknown };
    if (typeof e.page_id !== "string" || e.page_id.length === 0) {
      return NextResponse.json(
        { error: "entry.page_id must be a non-empty string" },
        { status: 400 },
      );
    }
    if (e.scheduled_date === null) {
      deletes.push(e.page_id);
      continue;
    }
    if (typeof e.scheduled_date !== "string" || !ISO_DATE_RE.test(e.scheduled_date)) {
      return NextResponse.json(
        { error: "entry.scheduled_date must be YYYY-MM-DD or null" },
        { status: 400 },
      );
    }
    upserts.push({
      class_id: classId,
      unit_id: unitId,
      page_id: e.page_id,
      scheduled_date: e.scheduled_date,
    });
  }

  const db = createAdminClient();
  const owns = await verifyTeacherOwnsClass(db, teacherId, classId);
  if (!owns) {
    return NextResponse.json({ error: "Class not in your roster" }, { status: 403 });
  }

  // Upsert non-null dates.
  if (upserts.length > 0) {
    const { error: upErr } = await db
      .from("class_unit_lesson_schedule")
      .upsert(upserts, { onConflict: "class_id,page_id" });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  // Delete cleared rows.
  if (deletes.length > 0) {
    const { error: delErr } = await db
      .from("class_unit_lesson_schedule")
      .delete()
      .eq("class_id", classId)
      .eq("unit_id", unitId)
      .in("page_id", deletes);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
  }

  // Return the fresh state.
  const { data: fresh } = await db
    .from("class_unit_lesson_schedule")
    .select("page_id, scheduled_date")
    .eq("class_id", classId)
    .eq("unit_id", unitId);

  return NextResponse.json({ schedule: (fresh ?? []) as ScheduleEntry[] });
}
