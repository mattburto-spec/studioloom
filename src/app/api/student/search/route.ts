import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireStudentAuth } from "@/lib/auth/student";
import { getPageList } from "@/lib/unit-adapter";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import type { UnitContentData } from "@/types";
import type { LessonHit, UnitHit, SearchResponse } from "@/types/search";

const PER_BUCKET = 8;

export const GET = withErrorHandler("student/search:GET", async (request: NextRequest) => {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const url = new URL(request.url);
  const rawQ = (url.searchParams.get("q") ?? "").trim();
  const queryLower = rawQ.toLowerCase();

  const empty: SearchResponse = { query: rawQ, classes: [], units: [], lessons: [], students: [] };
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

  // Load class names (for unit subtitles) and the student's class_unit
  // assignments (with per-class fork content_data) in parallel.
  const [classRowsRes, classUnitsRes] = await Promise.all([
    supabase.from("classes").select("id, name").in("id", classIdArray),
    supabase
      .from("class_units")
      .select("unit_id, class_id, content_data")
      .in("class_id", classIdArray)
      .eq("is_active", true),
  ]);

  const classNameById = new Map(
    ((classRowsRes.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name])
  );

  const cuRows = (classUnitsRes.data ?? []) as Array<{
    unit_id: string;
    class_id: string;
    content_data: UnitContentData | null;
  }>;
  if (cuRows.length === 0) {
    return NextResponse.json(empty);
  }

  // Dedup by unit_id — if a student has the same unit in multiple classes,
  // keep the first assignment (subtitle attribution falls back accordingly).
  const seenUnits = new Set<string>();
  const dedupedAssignments: typeof cuRows = [];
  for (const cu of cuRows) {
    if (seenUnits.has(cu.unit_id)) continue;
    seenUnits.add(cu.unit_id);
    dedupedAssignments.push(cu);
  }

  // Load master units in one query so we can resolve effective content
  // (per-class fork wins via resolveClassUnitContent).
  const unitIds = dedupedAssignments.map((cu) => cu.unit_id);
  const { data: unitRows } = await supabase
    .from("units")
    .select("id, title, content_data")
    .in("id", unitIds);

  const unitMap = new Map<string, { id: string; title: string; content_data: UnitContentData }>();
  for (const u of (unitRows ?? []) as Array<{ id: string; title: string; content_data: UnitContentData }>) {
    unitMap.set(u.id, u);
  }

  // Walk each assignment once, resolving content; collect units (by title)
  // and lessons (by page title) until both buckets are full.
  const units: UnitHit[] = [];
  const lessons: LessonHit[] = [];

  for (const cu of dedupedAssignments) {
    const u = unitMap.get(cu.unit_id);
    if (!u) continue;

    const subtitleClass = classNameById.get(cu.class_id) ?? null;

    if (units.length < PER_BUCKET && u.title.toLowerCase().includes(queryLower)) {
      units.push({
        type: "unit",
        id: u.id,
        title: u.title,
        subtitle: subtitleClass,
        href: `/unit/${u.id}`,
      });
    }

    if (lessons.length < PER_BUCKET) {
      // Resolve the class-fork-aware effective content so lesson titles
      // reflect what the student actually sees in the unit.
      const effective = resolveClassUnitContent(u.content_data, cu.content_data);
      const pages = getPageList(effective);
      for (const p of pages) {
        if (!p.title) continue;
        if (p.title.toLowerCase().includes(queryLower)) {
          lessons.push({
            type: "lesson",
            id: `${u.id}:${p.id}`,
            unitId: u.id,
            pageId: p.id,
            title: p.title,
            subtitle: u.title,
            href: `/unit/${u.id}/${p.id}`,
          });
          if (lessons.length >= PER_BUCKET) break;
        }
      }
    }

    if (units.length >= PER_BUCKET && lessons.length >= PER_BUCKET) break;
  }

  const response: SearchResponse = {
    query: rawQ,
    classes: [],
    units,
    lessons,
    students: [],
  };
  return NextResponse.json(response);
});
