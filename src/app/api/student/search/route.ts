import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { getPageList } from "@/lib/unit-adapter";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import type { UnitContentData, UnitPage } from "@/types";
import type { LessonHit, UnitHit, SearchResponse } from "@/types/search";

const PER_BUCKET = 8;

/**
 * Concatenate every student-visible string on a page into one lowercase
 * blob for substring matching. Lesson titles in v4 units are derived
 * from the first core activity's title only — most of the words a
 * student remembers (vocab terms, prompt language, intro paragraphs,
 * reflection prompts, success criteria) live in the body. Without this,
 * lesson search misses anything that isn't in the short title.
 *
 * Deliberately excludes teacher_notes (private) and AI rules (internal).
 */
function pageSearchText(page: UnitPage): string {
  const parts: string[] = [];
  if (page.title) parts.push(page.title);
  const c = page.content;
  if (c) {
    if (c.title && c.title !== page.title) parts.push(c.title);
    if (c.learningGoal) parts.push(c.learningGoal);
    if (c.introduction?.text) parts.push(c.introduction.text);
    if (Array.isArray(c.sections)) {
      for (const s of c.sections) {
        if (s.prompt) parts.push(s.prompt);
        if (s.exampleResponse) parts.push(s.exampleResponse);
        const sc = s.scaffolding;
        if (sc) {
          if (sc.ell1?.sentenceStarters) parts.push(...sc.ell1.sentenceStarters);
          if (sc.ell1?.hints) parts.push(...sc.ell1.hints);
          if (sc.ell2?.sentenceStarters) parts.push(...sc.ell2.sentenceStarters);
          if (sc.ell3?.extensionPrompts) parts.push(...sc.ell3.extensionPrompts);
        }
      }
    }
    if (Array.isArray(c.success_criteria)) parts.push(...c.success_criteria);
    if (c.reflection?.items?.length) parts.push(...c.reflection.items);
    if (c.vocabWarmup?.terms?.length) {
      for (const t of c.vocabWarmup.terms) {
        if (t.term) parts.push(t.term);
        if (t.definition) parts.push(t.definition);
        if (t.example) parts.push(t.example);
      }
    }
  }
  return parts.join(" \n").toLowerCase();
}

export const GET = withErrorHandler("student/search:GET", async (request: NextRequest) => {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

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

  // Walk each assignment once, resolving content. Collect title hits and
  // body hits separately so title matches sort first when we trim to the
  // bucket cap.
  const units: UnitHit[] = [];
  const titleHits: LessonHit[] = [];
  const bodyHits: LessonHit[] = [];

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

    // Resolve the class-fork-aware effective content so lesson hits
    // reflect what the student actually sees in the unit.
    const effective = resolveClassUnitContent(u.content_data, cu.content_data);
    const pages = getPageList(effective);
    for (const p of pages) {
      const titleHit = !!p.title && p.title.toLowerCase().includes(queryLower);
      const bodyHit = titleHit ? false : pageSearchText(p).includes(queryLower);
      if (!titleHit && !bodyHit) continue;
      const hit: LessonHit = {
        type: "lesson",
        id: `${u.id}:${p.id}`,
        unitId: u.id,
        pageId: p.id,
        title: p.title || `Lesson`,
        subtitle: u.title,
        href: `/unit/${u.id}/${p.id}`,
      };
      (titleHit ? titleHits : bodyHits).push(hit);
      if (titleHits.length >= PER_BUCKET) break;
    }

    if (units.length >= PER_BUCKET && titleHits.length >= PER_BUCKET) break;
  }

  const lessons: LessonHit[] = titleHits
    .concat(bodyHits.slice(0, Math.max(0, PER_BUCKET - titleHits.length)))
    .slice(0, PER_BUCKET);

  const response: SearchResponse = {
    query: rawQ,
    classes: [],
    units,
    lessons,
    students: [],
  };
  return NextResponse.json(response);
});
