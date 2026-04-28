import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireStudentAuth } from "@/lib/auth/student";
import type { UnitHit, SearchResponse } from "@/types/search";

const PER_BUCKET = 8;

export const GET = withErrorHandler("student/search:GET", async (request: NextRequest) => {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const url = new URL(request.url);
  const rawQ = (url.searchParams.get("q") ?? "").trim();
  const escaped = rawQ.replace(/[\\%_]/g, (m) => `\\${m}`);
  const pattern = `%${escaped}%`;

  const empty: SearchResponse = { query: rawQ, classes: [], units: [], students: [] };
  if (rawQ.length < 2) {
    return NextResponse.json(empty);
  }

  // Service-role client — student auth is enforced by token cookie above.
  // Same pattern as /api/student/units and other student routes.
  const supabase = createAdminClient();

  // Resolve the student's class ids — junction table is authoritative,
  // legacy students.class_id kept as a fallback (mirrors /api/student/units).
  const [enrollmentsRes, studentRes] = await Promise.all([
    supabase
      .from("class_students")
      .select("class_id")
      .eq("student_id", studentId)
      .eq("is_active", true),
    supabase
      .from("students")
      .select("class_id")
      .eq("id", studentId)
      .maybeSingle(),
  ]);

  const classIds = new Set<string>();
  for (const e of (enrollmentsRes.data ?? []) as Array<{ class_id: string }>) {
    classIds.add(e.class_id);
  }
  const legacyClassId = (studentRes.data as { class_id: string | null } | null)?.class_id;
  if (legacyClassId) classIds.add(legacyClassId);

  if (classIds.size === 0) {
    return NextResponse.json(empty);
  }

  const classIdArray = Array.from(classIds);

  // Fetch class names (for unit subtitles) and matching units in parallel.
  const [classRowsRes, classUnitsRes] = await Promise.all([
    supabase.from("classes").select("id, name").in("id", classIdArray),
    supabase
      .from("class_units")
      .select("unit_id, class_id, units!inner(id, title)")
      .in("class_id", classIdArray)
      .eq("is_active", true)
      .ilike("units.title", pattern)
      .limit(PER_BUCKET * 2),
  ]);

  const classNameById = new Map(
    ((classRowsRes.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name])
  );

  // Dedup units by id (one unit may be assigned to multiple of the
  // student's classes — show it once, attribute to the first class).
  // PostgREST !inner embed returns a single object at runtime; the
  // generated type widens to an array, so cast through unknown.
  const seen = new Set<string>();
  const units: UnitHit[] = [];
  const cuRows = (classUnitsRes.data ?? []) as unknown as Array<{
    unit_id: string;
    class_id: string;
    units: { id: string; title: string };
  }>;
  for (const row of cuRows) {
    if (!row.units || seen.has(row.units.id)) continue;
    seen.add(row.units.id);
    units.push({
      type: "unit",
      id: row.units.id,
      title: row.units.title,
      subtitle: classNameById.get(row.class_id) ?? null,
      href: `/unit/${row.units.id}`,
    });
    if (units.length >= PER_BUCKET) break;
  }

  const response: SearchResponse = { query: rawQ, classes: [], units, students: [] };
  return NextResponse.json(response);
});
