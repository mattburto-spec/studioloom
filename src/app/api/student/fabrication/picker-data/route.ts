/**
 * GET /api/student/fabrication/picker-data
 *
 * Preflight Phase 4-3. Returns the two lists the fabrication upload page
 * needs to populate its class + machine-profile dropdowns:
 *   - classes the student is enrolled in (via class_students junction)
 *   - all available machine profiles (system templates + teacher-owned)
 *
 * Unfiltered per FU-CLASS-MACHINE-LINK — v1 shows every student every
 * profile. Per-class filtering lands in Phase 8 when the teacher
 * machine-admin UI ships.
 *
 * Auth: student cookie-token session.
 * Cache: private, no-cache (Lesson #11).
 *
 * Response shape on success (200):
 *   {
 *     classes: [{ id, name, code }, ...],
 *     machineProfiles: [{ id, name, machine_category, bed_size_x_mm,
 *                        bed_size_y_mm, nozzle_diameter_mm, kerf_mm,
 *                        is_system_template }, ...]
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

  // Classes via class_students junction. Order by class name so the
  // dropdown isn't in random insert-order.
  const enrolmentsResult = await db
    .from("class_students")
    .select("classes(id, name, code)")
    .eq("student_id", auth.studentId);

  if (enrolmentsResult.error) {
    return NextResponse.json(
      { error: `Enrolment lookup failed: ${enrolmentsResult.error.message}` },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  type EnrolmentRow = {
    classes:
      | { id: string; name: string; code: string }
      | { id: string; name: string; code: string }[]
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

  // Machine profiles — all system templates + all teacher-owned (v1
  // unfiltered per FU-CLASS-MACHINE-LINK). System templates first.
  const profilesResult = await db
    .from("machine_profiles")
    .select(
      "id, name, machine_category, bed_size_x_mm, bed_size_y_mm, nozzle_diameter_mm, kerf_mm, is_system_template"
    )
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
