/**
 * GET /api/student/fabrication/picker-data
 *
 * Returns the two lists the fabrication upload page needs to populate
 * its class + machine-profile dropdowns:
 *   - classes the student is enrolled in (via class_students junction),
 *     each with its `default_lab_id` (Phase 8-5)
 *   - all active machine profiles (system templates + teacher-owned,
 *     excluding soft-deleted via is_active = false), each with lab_id
 *
 * Phase 8-5 filter: the client uses `filterMachinesForClass` from
 * picker-helpers.ts to narrow the machines dropdown to the selected
 * class's default lab. `classes` with null `default_lab_id` = show all
 * (legacy fallback for any class that missed the 114 backfill).
 *
 * Auth: student cookie-token session.
 * Cache: private, no-cache (Lesson #11).
 *
 * Response shape on success (200):
 *   {
 *     classes: [{ id, name, code, default_lab_id }, ...],
 *     machineProfiles: [{ id, name, machine_category, bed_size_x_mm,
 *                        bed_size_y_mm, nozzle_diameter_mm, kerf_mm,
 *                        is_system_template, lab_id }, ...]
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  const db = createAdminClient();

  // Classes via class_students junction. Phase 8-5: also ship
  // default_lab_id so the client can filter machines when the
  // student picks a class.
  const enrolmentsResult = await db
    .from("class_students")
    .select("classes(id, name, code, default_lab_id)")
    .eq("student_id", auth.studentId);

  if (enrolmentsResult.error) {
    return NextResponse.json(
      { error: `Enrolment lookup failed: ${enrolmentsResult.error.message}` },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  type EnrolmentRow = {
    classes:
      | { id: string; name: string; code: string; default_lab_id: string | null }
      | { id: string; name: string; code: string; default_lab_id: string | null }[]
      | null;
  };
  const classes = (enrolmentsResult.data as EnrolmentRow[] | null ?? [])
    .flatMap((row) => {
      // PostgREST returns the embedded table as an object when the FK is
      // singular, but some versions/select shapes return an array. Normalise.
      if (!row.classes) return [];
      return Array.isArray(row.classes) ? row.classes : [row.classes];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Machine profiles — ship lab_id (Phase 8-5) so the client can
  // filter by class.default_lab_id. Exclude soft-deleted machines
  // (is_active = false) — students shouldn't see them at all. System
  // templates first for the "add from template" UX at teacher-admin
  // time (students rarely see templates but they're included for the
  // legacy no-lab fallback).
  const profilesResult = await db
    .from("machine_profiles")
    .select(
      "id, name, machine_category, bed_size_x_mm, bed_size_y_mm, nozzle_diameter_mm, kerf_mm, is_system_template, lab_id"
    )
    .eq("is_active", true)
    .order("is_system_template", { ascending: false })
    .order("name", { ascending: true });

  if (profilesResult.error) {
    return NextResponse.json(
      { error: `Machine profile lookup failed: ${profilesResult.error.message}` },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      classes,
      machineProfiles: profilesResult.data ?? [],
    },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}
