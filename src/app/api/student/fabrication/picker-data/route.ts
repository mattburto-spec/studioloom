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
  // student picks a class. Phase 8.1d-39 (audit HIGH-1): also pull
  // the class's teacher's school_id so we can scope the machine
  // picker to the student's school(s) — without this, the picker
  // returned every active machine globally (cross-school inventory
  // leak when pilot expands beyond NIS).
  const enrolmentsResult = await db
    .from("class_students")
    .select(
      "classes(id, name, code, default_lab_id, teachers(school_id))"
    )
    .eq("student_id", auth.studentId);

  if (enrolmentsResult.error) {
    return NextResponse.json(
      { error: `Enrolment lookup failed: ${enrolmentsResult.error.message}` },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  type TeachersEmbed =
    | { school_id: string | null }
    | { school_id: string | null }[]
    | null;
  type ClassEmbed = {
    id: string;
    name: string;
    code: string;
    default_lab_id: string | null;
    teachers: TeachersEmbed;
  };
  type EnrolmentRow = {
    classes: ClassEmbed | ClassEmbed[] | null;
  };
  const flatClasses = (enrolmentsResult.data as EnrolmentRow[] | null ?? [])
    .flatMap((row) => {
      // PostgREST returns the embedded table as an object when the FK is
      // singular, but some versions/select shapes return an array. Normalise.
      if (!row.classes) return [];
      return Array.isArray(row.classes) ? row.classes : [row.classes];
    });

  // Distinct school_ids the student's enrollments span. Most students
  // are at one school but a transfer / visiting student could be at
  // two. We surface every school-scoped machine they could legitimately
  // pick.
  const schoolIds = Array.from(
    new Set(
      flatClasses
        .flatMap((c) => {
          if (!c.teachers) return [];
          return Array.isArray(c.teachers) ? c.teachers : [c.teachers];
        })
        .map((t) => t.school_id)
        .filter((s): s is string => typeof s === "string" && s.length > 0)
    )
  );

  // Strip the teachers embed before sending classes back — the
  // client only needs id/name/code/default_lab_id.
  const classes = flatClasses
    .map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      default_lab_id: c.default_lab_id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Machine profiles — Phase 8.1d-5: nested-select the lab name so
  // the picker can group machines by lab without a second query.
  // Excludes soft-deleted (is_active=false). System templates first
  // — they have no lab and bucket into "Unassigned" / "Templates"
  // group on the picker side.
  //
  // Phase 8.1d-39 (audit HIGH-1): server-side school filter.
  // Two-query split (templates + school-scoped) so we don't have to
  // do a complex `.or(...)` over an embedded-resource filter that
  // PostgREST handles inconsistently. Templates are visible to every
  // student regardless of school (they're seed data with no owner);
  // teacher-owned machines must be in a lab at one of the student's
  // schools.
  const baseSelect =
    "id, name, machine_category, machine_brand, machine_model, bed_size_x_mm, bed_size_y_mm, nozzle_diameter_mm, kerf_mm, is_system_template, lab_id, fabrication_labs(name)";

  const templatesResult = await db
    .from("machine_profiles")
    .select(baseSelect)
    .eq("is_active", true)
    .eq("is_system_template", true)
    .order("name", { ascending: true });
  if (templatesResult.error) {
    return NextResponse.json(
      { error: `Machine profile lookup failed: ${templatesResult.error.message}` },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  // School-scoped non-templates: only fetch if the student has at
  // least one school. Orphan students (no school via any class)
  // see only templates — no leakage of any school's machines.
  let schoolProfilesData: unknown[] = [];
  if (schoolIds.length > 0) {
    const schoolResult = await db
      .from("machine_profiles")
      .select(`${baseSelect}, fabrication_labs!inner(school_id, name)`)
      .eq("is_active", true)
      .eq("is_system_template", false)
      .in("fabrication_labs.school_id", schoolIds)
      .order("name", { ascending: true });
    if (schoolResult.error) {
      return NextResponse.json(
        { error: `Machine profile lookup failed: ${schoolResult.error.message}` },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }
    schoolProfilesData = schoolResult.data ?? [];
  }

  // Build a single profilesResult-shaped array so the downstream
  // mapping logic doesn't need to know about the split. Errors from
  // each query are already returned above; this is just a merge.
  const profilesResult = {
    data: [
      ...((templatesResult.data ?? []) as unknown[]),
      ...schoolProfilesData,
    ],
  };

  // Flatten the nested fabrication_labs join into a `lab_name` field.
  // PostgREST nests as object or array depending on the FK; normalise.
  type RawProfile = {
    id: string;
    name: string;
    machine_category: string;
    machine_brand: string | null;
    machine_model: string | null;
    bed_size_x_mm: number;
    bed_size_y_mm: number;
    nozzle_diameter_mm: number | null;
    kerf_mm: number | null;
    is_system_template: boolean;
    lab_id: string | null;
    fabrication_labs:
      | { name: string }
      | { name: string }[]
      | null;
  };
  const machineProfiles = (profilesResult.data as RawProfile[] | null ?? []).map((p) => {
    const labRow = Array.isArray(p.fabrication_labs)
      ? p.fabrication_labs[0]
      : p.fabrication_labs;
    return {
      id: p.id,
      name: p.name,
      machine_category: p.machine_category,
      machine_brand: p.machine_brand,
      machine_model: p.machine_model,
      bed_size_x_mm: p.bed_size_x_mm,
      bed_size_y_mm: p.bed_size_y_mm,
      nozzle_diameter_mm: p.nozzle_diameter_mm,
      kerf_mm: p.kerf_mm,
      is_system_template: p.is_system_template,
      lab_id: p.lab_id,
      lab_name: labRow?.name ?? null,
    };
  });

  return NextResponse.json(
    {
      classes,
      machineProfiles,
    },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}
