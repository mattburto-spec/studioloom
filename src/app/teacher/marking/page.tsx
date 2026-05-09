"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { getPageList } from "@/lib/unit-adapter";
import { getGradingScale, type CurriculumFrameworkId } from "@/lib/constants";
import type { UnitContentData } from "@/types";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { extractTilesFromPage, tileProgress, type LessonTile } from "@/lib/grading/lesson-tiles";
import { computeStudentRollup, type CriterionRollup } from "@/lib/grading/rollup";
import { computeCriterionCoverage, coverageStatus } from "@/lib/grading/criterion-coverage";
import { sanitizeResponseText } from "@/lib/grading/sanitize-response";
import { classifyCommentReadState, commentChipTooltip } from "@/lib/grading/comment-status";
import { ScorePill } from "@/components/grading/ScorePill";
import { ScoreSelector } from "@/components/grading/ScoreSelector";

const STEP_TRANSITION = { type: "tween" as const, duration: 0.18, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] };

export default function MarkingPage() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("class");
  const unitId = searchParams.get("unit");

  // The step key drives the AnimatePresence swap. Each step is independent;
  // exit animation overlaps the next step's enter for no perceived delay.
  const stepKey = !classId ? "classes" : !unitId ? "units" : "calibrate";

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={STEP_TRANSITION}
      >
        {stepKey === "classes" && <ClassPicker />}
        {stepKey === "units" && <UnitPicker classId={classId!} />}
        {stepKey === "calibrate" && <CalibrateView classId={classId!} unitId={unitId!} />}
      </motion.div>
    </AnimatePresence>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Class picker (no-params landing — Option B per Q1.1.A)
// ════════════════════════════════════════════════════════════════════════════

interface ClassRow {
  id: string;
  name: string;
  framework: string | null;
  studentCount: number;
  unitCount: number;
}

function ClassPicker() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, framework")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (!classData) {
        setClasses([]);
        return;
      }

      const ids = classData.map((c) => c.id);
      const [studentsRes, classUnitsRes] = await Promise.all([
        supabase.from("class_students").select("class_id").in("class_id", ids).eq("is_active", true),
        supabase.from("class_units").select("class_id, is_active").in("class_id", ids),
      ]);

      const studentCounts: Record<string, number> = {};
      for (const s of studentsRes.data ?? []) {
        studentCounts[s.class_id] = (studentCounts[s.class_id] || 0) + 1;
      }
      const unitCounts: Record<string, number> = {};
      for (const cu of classUnitsRes.data ?? []) {
        if (cu.is_active !== false) {
          unitCounts[cu.class_id] = (unitCounts[cu.class_id] || 0) + 1;
        }
      }

      setClasses(
        classData.map((c) => ({
          id: c.id,
          name: c.name,
          framework: c.framework,
          studentCount: studentCounts[c.id] ?? 0,
          unitCount: unitCounts[c.id] ?? 0,
        })),
      );
    })();
  }, []);

  if (classes === null) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-sm text-gray-500">Loading…</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Marking</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pick a class to start the Calibrate flow. Tiles load from the most-recently-edited unit.
        </p>
      </header>

      {classes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500">
          No active classes yet.{" "}
          <Link href="/teacher/classes" className="text-purple-600 font-semibold hover:underline">
            Create one →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/marking?class=${c.id}`}
              className="group flex items-center justify-between gap-4 px-5 py-4 bg-white border border-gray-200 rounded-2xl hover:border-purple-300 hover:shadow-sm transition"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-gray-900 group-hover:text-purple-700 transition">
                    {c.name}
                  </span>
                  {c.framework && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      {c.framework.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.studentCount} student{c.studentCount === 1 ? "" : "s"} · {c.unitCount} unit
                  {c.unitCount === 1 ? "" : "s"}
                </p>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-300 group-hover:text-purple-500 transition flex-shrink-0"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// UnitPicker — class is selected, list this class's units to choose from.
// ════════════════════════════════════════════════════════════════════════════

interface UnitCardRow {
  unitId: string;
  title: string;
  thumbnailUrl: string | null;
  pageCount: number;
  classUnitUpdatedAt: string | null;
  unitCreatedAt: string;
}

function UnitPicker({ classId }: { classId: string }) {
  const [className, setClassName] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitCardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const [classRes, cuRes] = await Promise.all([
        supabase.from("classes").select("name").eq("id", classId).single(),
        supabase
          .from("class_units")
          .select(
            "unit_id, is_active, content_data, updated_at, units(id, title, thumbnail_url, content_data, created_at)",
          )
          .eq("class_id", classId),
      ]);

      if (cancelled) return;

      if (classRes.error || !classRes.data) {
        setError("Class not found.");
        return;
      }
      setClassName((classRes.data as { name: string }).name);

      if (cuRes.error) {
        setError(`Failed to load units: ${cuRes.error.message}`);
        return;
      }

      type Joined = {
        unit_id: string;
        is_active: boolean | null;
        content_data: UnitContentData | null;
        updated_at: string | null;
        units: {
          id: string;
          title: string;
          thumbnail_url: string | null;
          content_data: UnitContentData | null;
          created_at: string;
        } | null;
      };

      const all = (cuRes.data ?? []) as Joined[];
      const active = all
        .filter((cu) => cu.is_active !== false && cu.units !== null)
        .map<UnitCardRow>((cu) => {
          // Use the resolved (forked-or-master) content for the page count
          // so the card reflects what the teacher actually sees in this class.
          const masterContent =
            cu.units!.content_data ?? ({ version: 2, pages: [] } as UnitContentData);
          const resolved = resolveClassUnitContent(masterContent, cu.content_data);
          const pages = getPageList(resolved);
          return {
            unitId: cu.units!.id,
            title: cu.units!.title,
            thumbnailUrl: cu.units!.thumbnail_url,
            pageCount: pages.length,
            classUnitUpdatedAt: cu.updated_at,
            unitCreatedAt: cu.units!.created_at,
          };
        })
        .sort((a, b) => {
          const aKey = a.classUnitUpdatedAt ?? a.unitCreatedAt;
          const bKey = b.classUnitUpdatedAt ?? b.unitCreatedAt;
          return bKey.localeCompare(aKey);
        });

      setUnits(active);
    })();

    return () => {
      cancelled = true;
    };
  }, [classId]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/teacher/marking" className="text-sm text-purple-600 hover:underline">
          ← Back to classes
        </Link>
        <div className="mt-4 p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/teacher/marking" className="text-xs text-gray-500 hover:text-purple-600 transition">
        ← All classes
      </Link>
      <header className="mb-6 mt-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
          {className ?? "Loading…"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Pick a unit to start marking.</p>
      </header>

      {units === null ? (
        // Skeleton — animates in instantly so there's no blank flash
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[78px] bg-white border border-gray-200 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : units.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500">
          No active units in this class.
        </div>
      ) : (
        <motion.div
          className="grid gap-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
          }}
        >
          {units.map((u) => (
            <motion.div
              key={u.unitId}
              variants={{
                hidden: { opacity: 0, y: 6 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
              }}
            >
              <Link
                href={`/teacher/marking?class=${classId}&unit=${u.unitId}`}
                className="group flex items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-2xl hover:border-purple-300 hover:shadow-sm transition"
              >
                {u.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u.thumbnailUrl}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover bg-gray-100 flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 group-hover:text-purple-700 transition truncate">
                    {u.title}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {u.pageCount} lesson{u.pageCount === 1 ? "" : "s"}
                  </p>
                </div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-300 group-hover:text-purple-500 transition flex-shrink-0"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Calibrate view (when ?class=X is present)
// ════════════════════════════════════════════════════════════════════════════

interface ClassDetail {
  id: string;
  name: string;
  framework: CurriculumFrameworkId | string;
  subject: string | null;
}

interface UnitDetail {
  id: string;
  title: string;
  contentData: UnitContentData | null;
}

interface StudentRow {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface TileGradeRow {
  id: string;
  student_id: string;
  page_id: string;
  tile_id: string;
  score: number | null;
  confirmed: boolean;
  ai_pre_score: number | null;
  ai_quote?: string | null;
  ai_confidence?: number | null;
  ai_reasoning?: string | null;
  ai_comment_draft?: string | null;
  criterion_keys: string[];
  override_note?: string | null;
  student_facing_comment?: string | null;
  score_na?: boolean | null;
  // TFL.1 — read receipts. updated_at is the row's last-write time
  // (proxy for "comment last edited" in v1; over-aggressive for non-
  // comment edits like score changes — see brief Open Question).
  // student_seen_comment_at is the most recent timestamp the student
  // loaded a lesson page that surfaced this comment.
  student_seen_comment_at?: string | null;
  updated_at?: string | null;
}

function CalibrateView({ classId, unitId }: { classId: string; unitId: string }) {
  const [klass, setKlass] = useState<ClassDetail | null>(null);
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [grades, setGrades] = useState<Record<string, TileGradeRow>>({});
  // student_progress.responses keyed: pageId → studentId → tileId → text.
  // PR-A (10 May 2026, post-Checkpoint 1.1 round 2 smoke): switched from
  // a flat per-active-page shape to a one-shot all-pages rollup so the
  // page-selector chips can show accurate "n / m graded" counts across
  // every lesson without paying a refetch on every chip click. Same data
  // volume is still cheap (cohort × pages = ~144 jsonb rows for a typical
  // class). The override panel deep-indexes by activePageId.
  const [responsesByPage, setResponsesByPage] = useState<
    Record<string, Record<string, Record<string, string>>>
  >({});
  const [activeTileIdx, setActiveTileIdx] = useState(0);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [overrideNoteDraft, setOverrideNoteDraft] = useState<Record<string, string>>({});
  const [studentCommentDraft, setStudentCommentDraft] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [aiBatchRunning, setAiBatchRunning] = useState(false);
  const [aiBatchSummary, setAiBatchSummary] = useState<string | null>(null);
  const [view, setView] = useState<"calibrate" | "synthesize">("calibrate");
  const [releasingStudentId, setReleasingStudentId] = useState<string | null>(null);
  const [synthCommentDraft, setSynthCommentDraft] = useState<Record<string, string>>({});
  const [releasedAtByStudent, setReleasedAtByStudent] = useState<Record<string, string>>({});

  // Compose a stable key for the grade map.
  const gradeKey = (studentId: string, tileId: string, pageId: string) =>
    `${studentId}::${pageId}::${tileId}`;

  // All-pages response rollup. Loaded once during loadAll. The shape is
  // pageId → studentId → tileId → text so the page selector chip can
  // pre-compute "n / m graded" per page without paying a refetch on every
  // chip click. The override panel reads
  // `responsesByPage[activePageId]?.[studentId]?.[activeTile.tileId]`.
  const loadAllResponses = useCallback(
    async (unitIdParam: string, cohortIds: string[]) => {
      if (cohortIds.length === 0) {
        setResponsesByPage({});
        return;
      }
      const supabase = createClient();
      const { data: progressRows } = await supabase
        .from("student_progress")
        .select("student_id, page_id, responses")
        .eq("unit_id", unitIdParam)
        .in("student_id", cohortIds);

      type ProgressRow = {
        student_id: string;
        page_id: string;
        responses: Record<string, unknown> | null;
      };
      const byPage: Record<string, Record<string, Record<string, string>>> = {};
      for (const p of (progressRows ?? []) as ProgressRow[]) {
        if (!p.responses || typeof p.responses !== "object") continue;
        const stringResponses: Record<string, string> = {};
        for (const [k, v] of Object.entries(p.responses)) {
          // Only keep non-empty string responses. Empty strings get
          // treated as "no submission" by the work-driven counter +
          // tile filter — same contract as the rest of the marking
          // flow (sanitizeResponseText also returns "" for null/blank).
          if (typeof v === "string" && v.trim().length > 0) {
            stringResponses[k] = v;
          }
        }
        if (Object.keys(stringResponses).length === 0) continue;
        if (!byPage[p.page_id]) byPage[p.page_id] = {};
        byPage[p.page_id][p.student_id] = stringResponses;
      }
      setResponsesByPage(byPage);
    },
    [],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();

      // Class
      const { data: cls } = await supabase
        .from("classes")
        .select("id, name, framework, subject")
        .eq("id", classId)
        .single();
      if (!cls) {
        setLoadError("Class not found, or you don't have permission to view it.");
        setLoading(false);
        return;
      }
      setKlass(cls as ClassDetail);

      // Fetch the specific class_unit assignment (unitId from URL).
      const { data: cuRow, error: cuErr } = await supabase
        .from("class_units")
        .select("unit_id, is_active, content_data, units(id, title, content_data)")
        .eq("class_id", classId)
        .eq("unit_id", unitId)
        .maybeSingle();

      if (cuErr) {
        setLoadError(`Failed to load this unit: ${cuErr.message}`);
        setLoading(false);
        return;
      }

      type ClassUnitJoined = {
        unit_id: string;
        is_active: boolean | null;
        content_data: UnitContentData | null;
        units: { id: string; title: string; content_data: UnitContentData | null } | null;
      };
      const cu = cuRow as ClassUnitJoined | null;

      if (!cu || !cu.units) {
        setLoadError("This unit isn't assigned to the class. Pick a different unit.");
        setLoading(false);
        return;
      }
      if (cu.is_active === false) {
        setLoadError("This unit is marked inactive in this class. Reactivate it first.");
        setLoading(false);
        return;
      }

      const unitRow = cu.units;
      const masterContent = unitRow.content_data ?? ({ version: 2, pages: [] } as UnitContentData);
      const resolved = resolveClassUnitContent(masterContent, cu.content_data);

      const unitDetail: UnitDetail = {
        id: unitRow.id,
        title: unitRow.title,
        contentData: resolved,
      };
      setUnit(unitDetail);

      const pages = getPageList(resolved);
      const firstWithSections = pages.find((p) => (p.content?.sections ?? []).length > 0);
      if (!firstWithSections) {
        setLoadError("This unit has no gradeable tiles yet.");
        setLoading(false);
        return;
      }
      setActivePageId(firstWithSections.id);

      // Students enrolled in the class (junction-first, Lesson #22).
      const { data: enrolment } = await supabase
        .from("class_students")
        .select("student_id, students(id, display_name, username, avatar_url)")
        .eq("class_id", classId)
        .eq("is_active", true);

      type EnrolmentRow = {
        student_id: string;
        students: { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
      };
      const cohort: StudentRow[] = (enrolment ?? []).map((row) => {
        const r = row as EnrolmentRow;
        return {
          id: r.students.id,
          display_name: r.students.display_name,
          username: r.students.username,
          avatar_url: r.students.avatar_url,
        };
      });
      setStudents(cohort);

      // Existing grades for this class+unit.
      const { data: gradeRows } = await supabase
        .from("student_tile_grades")
        .select(
          "id, student_id, page_id, tile_id, score, confirmed, ai_pre_score, ai_quote, ai_confidence, ai_reasoning, ai_comment_draft, criterion_keys, override_note, student_facing_comment, score_na, student_seen_comment_at, updated_at",
        )
        .eq("class_id", classId)
        .eq("unit_id", unitDetail.id);

      const map: Record<string, TileGradeRow> = {};
      const noteDraftMap: Record<string, string> = {};
      const commentDraftMap: Record<string, string> = {};
      for (const g of (gradeRows ?? []) as TileGradeRow[]) {
        const k = gradeKey(g.student_id, g.tile_id, g.page_id);
        map[k] = g;
        if (g.override_note) noteDraftMap[k] = g.override_note;
        // Seed the comment textarea with: published student-facing comment if
        // it exists, else the AI draft (G3.1). The teacher edits + clicks
        // "Send to student" to promote the value to student_facing_comment.
        if (g.student_facing_comment) {
          commentDraftMap[k] = g.student_facing_comment;
        } else if (g.ai_comment_draft) {
          commentDraftMap[k] = g.ai_comment_draft;
        }
      }
      setGrades(map);
      setOverrideNoteDraft(noteDraftMap);
      setStudentCommentDraft(commentDraftMap);

      // Student responses across ALL pages (drives both the override panel's
      // "see the actual work" view AND the page-selector chip's per-lesson
      // counter). One query at mount instead of per-page refetch — see
      // loadAllResponses comment.
      const cohortIds = cohort.map((s) => s.id);
      await loadAllResponses(unitDetail.id, cohortIds);

      setLoading(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unexpected error loading data.");
      setLoading(false);
    }
  }, [classId, unitId, loadAllResponses]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Reset tile focus to the first tile of the newly active page so the
  // override panel doesn't open against a tile from the previous lesson.
  // No refetch here — responses for every page are already loaded by
  // loadAllResponses on mount.
  useEffect(() => {
    if (!activePageId) return;
    setActiveTileIdx(0);
  }, [activePageId]);

  const activePage = useMemo(() => {
    if (!unit?.contentData || !activePageId) return undefined;
    return getPageList(unit.contentData).find((p) => p.id === activePageId);
  }, [unit, activePageId]);

  // Pages-with-sections drive the page selector. We exclude pages with no
  // sections (front-matter/intro pages with no gradeable tiles).
  //
  // PR-A counter shape (10 May 2026, post-Checkpoint 1.1 round 2): the
  // "n / m graded" counter is WORK-DRIVEN, not roster-driven:
  //   m (denom) = number of (student, tile) pairs where the student has a
  //               non-empty response on this page. Tiles with no
  //               submissions don't count toward m. A page with one fully
  //               empty tile and 24 students contributes 0 to m, not 24.
  //   n (num)   = confirmed grades among those (student, tile) pairs.
  // So `0/0` means "no work has been submitted on this page yet" and is
  // visually distinct from `0/24` ("24 submissions waiting"). Closes
  // Matt's smoke gap that the previous students × tiles denom included
  // pure-instruction tiles + non-submitting students.
  const gradeablePages = useMemo(() => {
    if (!unit?.contentData) return [];
    const all = getPageList(unit.contentData);
    return all
      .filter((p) => (p.content?.sections ?? []).length > 0)
      .map((p) => {
        const pageTiles = extractTilesFromPage(p, {
          framework: klass?.framework ?? undefined,
          unitType: klass?.subject ?? undefined,
        });
        const tileIds = new Set(pageTiles.map((t) => t.tileId));
        // Submissions: (student, tile) pairs with non-empty content for
        // any tile that exists on this page.
        const pageResponses = responsesByPage[p.id] ?? {};
        let submissions = 0;
        for (const studentResponses of Object.values(pageResponses)) {
          for (const tid of Object.keys(studentResponses)) {
            if (tileIds.has(tid)) submissions += 1;
          }
        }
        // Confirmed grades on those submissions only.
        let confirmedCount = 0;
        for (const g of Object.values(grades)) {
          if (g.page_id !== p.id) continue;
          if (!tileIds.has(g.tile_id)) continue;
          if (!g.confirmed) continue;
          // Only count if the student actually had a submission OR the
          // grade is NA (NA explicitly means "no submission expected /
          // accepted"). This keeps confirmedCount aligned with the
          // submissions denom — we never see n > m.
          const hasSubmission =
            !!pageResponses[g.student_id]?.[g.tile_id];
          if (hasSubmission || g.score_na === true) {
            confirmedCount += 1;
          }
        }
        return {
          id: p.id,
          title: p.title ?? p.id,
          tileCount: pageTiles.length,
          confirmedCount,
          denom: submissions,
        };
      });
  }, [unit, klass, grades, responsesByPage]);

  // PR-A (10 May 2026): the tile carousel filters to "tiles with at least
  // one student submission on this page". Pure-instruction tiles ("Studio
  // rhythm", "Open Project Board" — read-only teacher copy with no
  // student-facing input) get extracted by extractTilesFromPage but never
  // hold any student responses, so they're hidden from the marking flow.
  // The teacher can still see them via the unit content authoring view;
  // they just don't pollute the calibrate workflow.
  const tiles = useMemo<LessonTile[]>(() => {
    if (!activePage) return [];
    const allTiles = extractTilesFromPage(activePage, {
      framework: klass?.framework ?? undefined,
      unitType: klass?.subject ?? undefined,
    });
    const pageResponses = activePageId ? responsesByPage[activePageId] ?? {} : {};
    // A tile is "gradable" if any student in the cohort has a non-empty
    // response keyed by that tile_id on this page.
    const tilesWithSubmissions = new Set<string>();
    for (const studentResponses of Object.values(pageResponses)) {
      for (const tid of Object.keys(studentResponses)) {
        tilesWithSubmissions.add(tid);
      }
    }
    return allTiles.filter((t) => tilesWithSubmissions.has(t.tileId));
  }, [activePage, klass, activePageId, responsesByPage]);

  const activeTile = tiles[activeTileIdx];

  const scale = useMemo(
    () => getGradingScale(klass?.framework ?? "IB_MYP"),
    [klass?.framework],
  );

  // Confirmed counts per tile for the strip progress label.
  const confirmedRows = useMemo(
    () =>
      Object.values(grades)
        .filter((g) => g.page_id === activePageId)
        .map((g) => ({ tile_id: g.tile_id, confirmed: g.confirmed })),
    [grades, activePageId],
  );

  // Resolve neutral criterion keys for the write — for G1.1.3 we trust that
  // the section's first criterionTags entry is already in the 8-key vocabulary
  // OR matches one of the framework-criterion keys. Validation is enforced
  // server-side (saveTileGrade.validateCriterionKeys + DB CHECK). The full
  // FrameworkAdapter normalisation chain is wired in G1.4.
  const NEUTRAL = new Set([
    "researching", "analysing", "designing", "creating",
    "evaluating", "reflecting", "communicating", "planning",
  ]);
  const FRAMEWORK_TO_NEUTRAL_HINT: Record<string, string[]> = {
    A: ["researching", "analysing"],
    B: ["designing"],
    C: ["creating"],
    D: ["evaluating"],
  };
  function resolveNeutralKeys(rawTags: string[]): string[] {
    const out = new Set<string>();
    for (const t of rawTags) {
      if (NEUTRAL.has(t)) {
        out.add(t);
        continue;
      }
      const hint = FRAMEWORK_TO_NEUTRAL_HINT[t];
      if (hint) hint.forEach((h) => out.add(h));
    }
    return Array.from(out);
  }

  async function saveTile(
    studentId: string,
    score: number | null,
    confirmed: boolean,
    extras: {
      override_note?: string | null;
      student_facing_comment?: string | null;
      score_na?: boolean;
    } = {},
  ) {
    if (!klass || !unit || !activePageId || !activeTile) return;
    const key = gradeKey(studentId, activeTile.tileId, activePageId);
    setSavingKey(key);
    try {
      const criterionKeys = resolveNeutralKeys(activeTile.criterionTags);
      const payload: Record<string, unknown> = {
        student_id: studentId,
        unit_id: unit.id,
        page_id: activePageId,
        tile_id: activeTile.tileId,
        class_id: klass.id,
        score,
        confirmed,
        criterion_keys: criterionKeys,
      };
      if (extras.override_note !== undefined) payload.override_note = extras.override_note;
      if (extras.student_facing_comment !== undefined) {
        payload.student_facing_comment = extras.student_facing_comment;
      }
      if (extras.score_na !== undefined) payload.score_na = extras.score_na;
      const res = await fetch("/api/teacher/grading/tile-grades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `Save failed (${res.status})`);
      }
      // Optimistic refresh of just this row from the response.
      const newRow = json.grade as TileGradeRow;
      setGrades((prev) => ({ ...prev, [key]: newRow }));
      // If the override_note round-tripped, sync the draft state so the
      // textarea no longer shows "Unsaved" after a successful save.
      if (extras.override_note !== undefined) {
        setOverrideNoteDraft((prev) => ({
          ...prev,
          [key]: newRow.override_note ?? "",
        }));
      }
      if (extras.student_facing_comment !== undefined) {
        setStudentCommentDraft((prev) => ({
          ...prev,
          [key]: newRow.student_facing_comment ?? "",
        }));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingKey(null);
    }
  }

  async function runAiPrescoreBatch() {
    if (!klass || !unit || !activePageId || !activeTile) return;
    if (students.length === 0) return;
    setAiBatchRunning(true);
    setAiBatchSummary(null);
    try {
      const res = await fetch("/api/teacher/grading/tile-grades/ai-prescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: klass.id,
          unit_id: unit.id,
          page_id: activePageId,
          tile_id: activeTile.tileId,
          student_ids: students.map((s) => s.id),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `AI batch failed (${res.status})`);
      }
      type Result = {
        student_id: string;
        ok: boolean;
        error?: string;
      };
      const results = (json.results as Result[]) ?? [];
      const okCount = results.filter((r) => r.ok).length;
      const errCount = results.length - okCount;
      setAiBatchSummary(
        errCount === 0
          ? `AI suggested ${okCount} score${okCount === 1 ? "" : "s"}.`
          : `AI suggested ${okCount}; ${errCount} failed (see console).`,
      );
      if (errCount > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          "[ai-prescore] failures:",
          results.filter((r) => !r.ok),
        );
      }
      // Reload grades from DB so ai_pre_score / ai_quote / ai_confidence
      // populate via the same shape the loader uses.
      await loadAll();
    } catch (err) {
      setAiBatchSummary(err instanceof Error ? err.message : "AI batch failed");
    } finally {
      setAiBatchRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 text-sm text-gray-500">
        Loading marking view…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link
          href={`/teacher/marking?class=${classId}`}
          className="text-sm text-purple-600 hover:underline"
        >
          ← Back to units
        </Link>
        <div className="mt-4 p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-6 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <Link
            href={`/teacher/marking?class=${classId}`}
            className="text-xs text-gray-500 hover:text-purple-600 transition"
          >
            ← {klass?.name ?? "All units"}
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 mt-1">
            Marking · <span className="text-gray-500 font-bold">{klass?.name}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {unit?.title} · {scale.type === "percentage" ? "Percentage" : `Scale ${scale.min}–${scale.max}`}
          </p>
        </div>

        {/* View switcher */}
        <div className="flex-shrink-0 inline-flex bg-gray-100 rounded-lg p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setView("calibrate")}
            className={[
              "px-3 py-1.5 rounded-md transition",
              view === "calibrate" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            Calibrate
          </button>
          <button
            type="button"
            onClick={() => setView("synthesize")}
            className={[
              "px-3 py-1.5 rounded-md transition",
              view === "synthesize" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            Synthesize
          </button>
        </div>
      </header>

      {/* Page selector — horizontal pill strip above the view content.
          Hidden when there's only one gradeable page (no point picking).
          Switching pages refetches responses (effect above) + resets the
          tile focus to tile 0. Counter shows "n / m graded" where n is
          confirmed (student, tile) cells and m is tiles × students. */}
      {gradeablePages.length > 1 && (
        <nav
          aria-label="Lesson selector"
          data-testid="marking-page-selector"
          className="mt-4 mb-2 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
        >
          {gradeablePages.map((p, idx) => {
            const isActive = p.id === activePageId;
            const ratio = p.denom > 0 ? p.confirmedCount / p.denom : 0;
            const isFullyGraded = p.denom > 0 && p.confirmedCount === p.denom;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePageId(p.id)}
                data-testid={`marking-page-chip-${p.id}`}
                data-active={isActive}
                className={[
                  "flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md border transition",
                  isActive
                    ? "border-purple-400 bg-purple-50 text-purple-800"
                    : isFullyGraded
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800",
                ].join(" ")}
                title={`${p.title} — ${p.confirmedCount} of ${p.denom} graded`}
              >
                <span>
                  Lesson {idx + 1}
                  <span className="ml-1.5 font-normal text-[10px] opacity-70">{p.title}</span>
                </span>
                <span
                  className={[
                    "inline-flex items-center justify-center min-w-[34px] h-4 px-1.5 rounded text-[10px] font-bold",
                    isActive
                      ? "bg-purple-200 text-purple-900"
                      : isFullyGraded
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-gray-100 text-gray-600",
                  ].join(" ")}
                  aria-label={`${p.confirmedCount} of ${p.denom} graded (${Math.round(ratio * 100)}%)`}
                >
                  {p.confirmedCount}/{p.denom}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {view === "synthesize" ? (
        <SynthesizeView
          klass={klass}
          unit={unit}
          students={students}
          grades={grades}
          activePageId={activePageId}
          scale={scale}
          synthCommentDraft={synthCommentDraft}
          setSynthCommentDraft={setSynthCommentDraft}
          releasingStudentId={releasingStudentId}
          setReleasingStudentId={setReleasingStudentId}
          releasedAtByStudent={releasedAtByStudent}
          setReleasedAtByStudent={setReleasedAtByStudent}
          loadAll={loadAll}
        />
      ) : (
        <CalibrateInner
          tiles={tiles}
          activeTileIdx={activeTileIdx}
          setActiveTileIdx={setActiveTileIdx}
          activeTile={activeTile}
          activePageId={activePageId}
          students={students}
          confirmedRows={confirmedRows}
          grades={grades}
          responses={activePageId ? responsesByPage[activePageId] ?? {} : {}}
          gradeKey={gradeKey}
          scale={scale}
          savingKey={savingKey}
          saveTile={saveTile}
          expandedStudentId={expandedStudentId}
          setExpandedStudentId={setExpandedStudentId}
          overrideNoteDraft={overrideNoteDraft}
          setOverrideNoteDraft={setOverrideNoteDraft}
          aiBatchRunning={aiBatchRunning}
          aiBatchSummary={aiBatchSummary}
          runAiPrescoreBatch={runAiPrescoreBatch}
          unitContentData={unit?.contentData ?? null}
          framework={klass?.framework ?? undefined}
          unitType={klass?.subject ?? undefined}
          studentCommentDraft={studentCommentDraft}
          setStudentCommentDraft={setStudentCommentDraft}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CalibrateInner — extracted from inline render to allow tab switch.
// All hooks stay on the parent CalibrateView; this is presentational.
// ════════════════════════════════════════════════════════════════════════════

interface CalibrateInnerProps {
  tiles: LessonTile[];
  activeTileIdx: number;
  setActiveTileIdx: (n: number) => void;
  activeTile: LessonTile | undefined;
  activePageId: string | null;
  students: StudentRow[];
  confirmedRows: { tile_id: string; confirmed: boolean }[];
  grades: Record<string, TileGradeRow>;
  responses: Record<string, Record<string, string>>;
  gradeKey: (s: string, t: string, p: string) => string;
  scale: ReturnType<typeof getGradingScale>;
  savingKey: string | null;
  saveTile: (s: string, score: number | null, confirmed: boolean, extras?: { override_note?: string | null; student_facing_comment?: string | null; score_na?: boolean }) => Promise<void>;
  expandedStudentId: string | null;
  setExpandedStudentId: (s: string | null) => void;
  overrideNoteDraft: Record<string, string>;
  setOverrideNoteDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  studentCommentDraft: Record<string, string>;
  setStudentCommentDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  aiBatchRunning: boolean;
  aiBatchSummary: string | null;
  runAiPrescoreBatch: () => Promise<void>;
  // G2.2 — heatmap inputs (unit-level coverage across all tiles).
  unitContentData: UnitContentData | null;
  framework: string | undefined;
  unitType: string | undefined;
}

function CalibrateInner({
  tiles,
  activeTileIdx,
  setActiveTileIdx,
  activeTile,
  activePageId,
  students,
  confirmedRows,
  grades,
  responses,
  gradeKey,
  scale,
  savingKey,
  saveTile,
  expandedStudentId,
  setExpandedStudentId,
  overrideNoteDraft,
  setOverrideNoteDraft,
  aiBatchRunning,
  aiBatchSummary,
  runAiPrescoreBatch,
  unitContentData,
  framework,
  unitType,
  studentCommentDraft,
  setStudentCommentDraft,
}: CalibrateInnerProps) {
  // G2.2 — criterion coverage heatmap (unit-level, across all pages).
  const coverage = useMemo(
    () =>
      computeCriterionCoverage(
        unitContentData,
        Object.values(grades).map((g) => ({
          student_id: g.student_id,
          page_id: g.page_id,
          tile_id: g.tile_id,
          confirmed: g.confirmed,
          criterion_keys: g.criterion_keys,
          score: g.score,
          score_na: g.score_na ?? false,
        })),
        students.map((s) => s.id),
        { framework, unitType },
      ),
    [unitContentData, grades, students, framework, unitType],
  );

  return (
    <>
      {/* G2.2 — Criterion coverage heatmap */}
      {coverage.length > 0 && (
        <div className="mb-4 px-4 py-3 bg-white border border-gray-200 rounded-2xl">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400">
              Coverage
            </div>
            <div className="text-[10px] text-gray-400">
              students with ≥1 confirmed score on this criterion
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {coverage.map((c) => {
              const status = coverageStatus(c.percent);
              const styles = {
                covered: { bg: "#10B98115", text: "#047857", bar: "#10B981" },
                partial: { bg: "#F59E0B15", text: "#B45309", bar: "#F59E0B" },
                thin:    { bg: "#EF444415", text: "#B91C1C", bar: "#EF4444" },
              }[status];
              return (
                <div
                  key={c.criterionKey}
                  className="inline-flex flex-col gap-1 px-2.5 py-1.5 rounded-lg border"
                  style={{ background: styles.bg, borderColor: `${styles.bar}33` }}
                  title={`${c.tilesTargeting} tile${c.tilesTargeting === 1 ? "" : "s"} target this criterion`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: styles.text }}>
                      {c.label.split(" ")[0]}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums" style={{ color: styles.text }}>
                      {c.confirmedStudents}/{c.totalStudents}
                    </span>
                  </div>
                  <div className="h-1 w-16 rounded-full bg-white/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${c.percent}%`, background: styles.bar }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tile strip — only tiles with student submissions on this page.
          Pure-instruction tiles (no responses) are filtered out by the
          tiles useMemo upstream. If nothing's been submitted yet, render
          an explicit empty state so the teacher knows it's a "no work"
          page, not a broken view. */}
      {tiles.length === 0 ? (
        <div
          data-testid="marking-no-submissions"
          className="mb-6 rounded-xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500"
        >
          <div className="font-bold text-gray-700 mb-1">No submissions on this lesson yet.</div>
          <div>
            Tiles with no student work are hidden until someone submits something. Check
            back after class or pick another lesson from the selector above.
          </div>
        </div>
      ) : (
      <div className="mb-6 -mx-1 overflow-x-auto">
        <div className="flex gap-2 px-1 pb-2">
          {tiles.map((tile, idx) => {
            const isActive = idx === activeTileIdx;
            const { confirmed, total } = tileProgress(tile.tileId, students.length, confirmedRows);
            return (
              <button
                key={tile.tileId}
                type="button"
                onClick={() => setActiveTileIdx(idx)}
                className={[
                  "flex-shrink-0 text-left px-3 py-2.5 rounded-xl border transition min-w-[180px] max-w-[260px]",
                  isActive
                    ? "bg-white border-purple-400 shadow-sm"
                    : "bg-white/60 border-gray-200 hover:border-gray-300",
                ].join(" ")}
                aria-pressed={isActive}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white tracking-wide"
                    style={{ background: tile.criterionColor }}
                  >
                    {tile.criterionLabel.split(" ")[0]}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 tabular-nums">
                    {confirmed}/{total}
                  </span>
                </div>
                <div className="text-xs font-semibold text-gray-700 leading-snug line-clamp-2">
                  {tile.title}
                </div>
                {/* progress bar */}
                <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: total === 0 ? 0 : `${(confirmed / total) * 100}%`,
                      background: tile.criterionColor,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Active tile prompt + AI batch trigger */}
      {activeTile && (
        <div className="mb-4 p-4 bg-white border border-gray-200 rounded-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400">
                {activeTile.criterionLabel}
              </div>
              <p className="text-sm text-gray-800 mt-1 leading-relaxed">{activeTile.title}</p>
            </div>
            <button
              type="button"
              onClick={() => void runAiPrescoreBatch()}
              disabled={aiBatchRunning || students.length === 0}
              className={[
                "flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition",
                aiBatchRunning
                  ? "bg-purple-50 text-purple-400 border-purple-200 cursor-wait"
                  : "bg-gradient-to-br from-purple-600 to-violet-600 text-white border-purple-700 hover:from-purple-700 hover:to-violet-700 shadow-sm",
                students.length === 0 ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
              title="Run Haiku 4.5 across the cohort. Suggestions are unconfirmed until you Confirm each row."
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
              </svg>
              {aiBatchRunning ? "Suggesting…" : `AI suggest (${students.length})`}
            </button>
          </div>
          {aiBatchSummary && (
            <p className="mt-2 text-[11px] text-gray-500 italic">{aiBatchSummary}</p>
          )}
        </div>
      )}

      {/* Per-student rows */}
      <div className="space-y-2">
        {students.length === 0 ? (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
            No students enrolled in this class yet.
          </div>
        ) : (
          students.map((s) => {
            if (!activePageId || !activeTile) return null;
            const key = gradeKey(s.id, activeTile.tileId, activePageId);
            const grade = grades[key];
            const score = grade?.score ?? null;
            const confirmed = grade?.confirmed ?? false;
            const aiPreScore = grade?.ai_pre_score ?? null;
            const isNa = grade?.score_na === true;
            const isSaving = savingKey === key;
            const isExpanded = expandedStudentId === s.id;
            const responseText = sanitizeResponseText(
              responses[s.id]?.[activeTile.tileId] ?? "",
            );
            const noteDraft = overrideNoteDraft[key] ?? "";
            const persistedNote =
              ((grade as TileGradeRow & { override_note?: string | null })
                ?.override_note ?? "") || "";
            const noteDirty = noteDraft !== persistedNote;
            const studentComment = studentCommentDraft[key] ?? "";
            const persistedStudentComment = grade?.student_facing_comment ?? "";
            const studentCommentDirty = studentComment !== persistedStudentComment;
            const displayName = s.display_name?.trim() || s.username?.trim() || "(unnamed)";
            const initials = displayName
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={s.id}
                className={[
                  "bg-white border rounded-2xl transition-shadow",
                  isExpanded ? "border-purple-300 shadow-md" : "border-gray-200",
                ].join(" ")}
              >
                {/* ── Compact row ── */}
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    {s.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.avatar_url}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover bg-gray-100"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    {grade?.ai_quote ? (
                      <p
                        className="text-[11px] text-purple-700 italic line-clamp-1"
                        title={grade.ai_reasoning ?? undefined}
                      >
                        <span aria-hidden="true">✦ </span>&ldquo;{grade.ai_quote}&rdquo;
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic line-clamp-1">
                        {responseText
                          ? `"${responseText.slice(0, 90)}${responseText.length > 90 ? "…" : ""}"`
                          : "No submission yet"}
                      </p>
                    )}
                  </div>

                  <ScoreSelector
                    scale={scale}
                    value={score}
                    isNa={isNa}
                    onChange={(next, opts) =>
                      void saveTile(s.id, next, false, { score_na: opts?.na ?? false })
                    }
                    disabled={isSaving}
                  />

                  <ScorePill
                    scale={scale}
                    score={score}
                    confirmed={confirmed}
                    aiPreScore={aiPreScore}
                    isNa={isNa}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      // NA-confirmed is a valid state; numeric confirm needs a score.
                      if (score === null && !isNa) {
                        alert("Set a score or mark N/A first.");
                        return;
                      }
                      void saveTile(s.id, score, !confirmed, { score_na: isNa });
                    }}
                    disabled={isSaving || (score === null && !isNa)}
                    className={[
                      "px-3 py-1.5 text-xs font-bold rounded-lg border transition",
                      confirmed
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-white text-purple-700 border-purple-200 hover:bg-purple-50",
                      isSaving || score === null ? "opacity-50 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    {isSaving ? "…" : confirmed ? "Confirmed" : "Confirm"}
                  </button>

                  {/* G3.2 — Feedback status chip. Surfaces what's normally
                      buried in the expand panel: is there a draft? has it been
                      sent? Click expands the row + scrolls focus to the comment
                      textarea. */}
                  {(() => {
                    const sent = grade?.student_facing_comment ?? "";
                    const draft = grade?.ai_comment_draft ?? "";
                    type State = "sent" | "ai_draft" | "edited" | "empty";
                    let state: State = "empty";
                    let label = "+ feedback";
                    let className =
                      "border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50";
                    if (sent.trim().length > 0) {
                      state = sent === draft ? "sent" : "edited";
                      label = state === "sent" ? "Sent" : "Sent ✎";
                      className =
                        "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100";
                    } else if (draft.trim().length > 0) {
                      state = "ai_draft";
                      label = "AI draft";
                      className =
                        "border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100";
                    }

                    // TFL.1.3 — read-receipt dot. Only meaningful for "sent"/
                    // "edited" states (must have a comment for the student to
                    // have seen). Layered into the chip; the chip's title
                    // attribute is overridden with the receipt tooltip when a
                    // receipt is in play (more useful than the static "Student
                    // can see this comment" copy).
                    const hasComment = state === "sent" || state === "edited";
                    const readState = hasComment
                      ? classifyCommentReadState({
                          commentSentAt: grade?.updated_at ?? null,
                          seenAt: grade?.student_seen_comment_at ?? null,
                        })
                      : "unsent";
                    // Dot colour ladder (revised per Checkpoint 1.1 smoke,
                    // 10 May 2026 — the brief originally lumped seen-stale
                    // in with seen-current as emerald, but Matt's smoke
                    // surfaced that "I edited and the student hasn't
                    // re-seen the new version" is a teacher-action state,
                    // not a "no action needed" state):
                    //   GREEN (emerald) = seen-current — student saw the
                    //                     latest. No action needed.
                    //   AMBER           = seen-stale (you edited since
                    //                     they read) OR unread-stale
                    //                     (>48h still unread). Both are
                    //                     "nudge worth doing" buckets;
                    //                     the tooltip disambiguates the
                    //                     reason.
                    //   GREY            = unread-fresh — just waiting,
                    //                     recent. No action.
                    const dotClass = !hasComment
                      ? null
                      : readState === "seen-current"
                        ? "bg-emerald-500"
                        : readState === "seen-stale" || readState === "unread-stale"
                          ? "bg-amber-500"
                          : "bg-gray-300";
                    const receiptTooltip = hasComment
                      ? commentChipTooltip(
                          readState,
                          grade?.updated_at ?? null,
                          grade?.student_seen_comment_at ?? null,
                        )
                      : null;

                    return (
                      <button
                        type="button"
                        onClick={() => setExpandedStudentId(isExpanded ? null : s.id)}
                        className={[
                          "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-md border transition",
                          className,
                        ].join(" ")}
                        aria-label={
                          state === "sent"
                            ? "Feedback sent to student"
                            : state === "edited"
                              ? "Feedback sent (edited from AI draft)"
                              : state === "ai_draft"
                                ? "AI draft ready — review and send"
                                : "No feedback yet"
                        }
                        title={
                          receiptTooltip ??
                          (state === "ai_draft"
                            ? "AI drafted a comment — open to review + send"
                            : state === "sent"
                              ? "Student can see this comment"
                              : state === "edited"
                                ? "Student can see your edited version"
                                : "Open to write feedback or run AI suggest")
                        }
                      >
                        {dotClass && (
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`}
                            aria-hidden="true"
                            data-testid="read-receipt-dot"
                            data-state={readState}
                          />
                        )}
                        {state === "ai_draft" && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
                          </svg>
                        )}
                        {state === "sent" && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="4 12 9 17 20 6" />
                          </svg>
                        )}
                        {label}
                      </button>
                    );
                  })()}

                  {/* Expand chevron */}
                  <button
                    type="button"
                    onClick={() => setExpandedStudentId(isExpanded ? null : s.id)}
                    className="w-7 h-7 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition flex items-center justify-center"
                    aria-label={isExpanded ? "Collapse details" : "Expand details"}
                    aria-expanded={isExpanded}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>

                {/* ── Override panel (G1.2 + G3 polish: stack single-column
                    so feedback textarea sits the same width as the response,
                    directly below it. AI suggestion + score selector +
                    override note follow underneath.) ── */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/40 rounded-b-2xl">
                    <div className="flex flex-col gap-5">
                      {/* Student work */}
                      <div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-2">
                          Student response
                        </div>
                        {responseText ? (
                          <div className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap bg-white border border-gray-200 rounded-xl p-4 max-h-[420px] overflow-y-auto">
                            {responseText}
                          </div>
                        ) : (
                          <div className="text-sm italic text-gray-500 bg-white border border-dashed border-gray-300 rounded-xl p-4">
                            {displayName} hasn&rsquo;t submitted on this tile yet.
                          </div>
                        )}
                      </div>

                      {/* G3 polish — Feedback block sits FIRST, directly under
                          the response, full-width. Matt's "make the grading
                          card as wide as the student text box and move it
                          closer." */}
                      <div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-emerald-700 mb-2">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            Feedback to {displayName.split(" ")[0] || "student"}
                            {(() => {
                              // G3.1 — show "AI drafted" badge when:
                              //   the textarea content equals the AI draft AND nothing has been
                              //   sent to the student yet. Once teacher edits or sends, badge clears.
                              const aiDraft = grade?.ai_comment_draft ?? "";
                              const sent = grade?.student_facing_comment ?? "";
                              const isUneditedAiDraft =
                                aiDraft && !sent && studentComment === aiDraft;
                              if (!isUneditedAiDraft) {
                                return (
                                  <span className="font-normal lowercase tracking-normal text-emerald-600/80">
                                    (student sees this)
                                  </span>
                                );
                              }
                              return (
                                <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold text-[9px]" title="Drafted by Haiku — review and edit before sending">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
                                  </svg>
                                  AI draft
                                </span>
                              );
                            })()}
                          </div>
                          <textarea
                            value={studentComment}
                            onChange={(e) =>
                              setStudentCommentDraft((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder={
                              grade?.ai_comment_draft
                                ? "Edit the AI draft, or replace it entirely."
                                : "What landed well, what to work on. Specific is better than encouraging."
                            }
                            rows={4}
                            className="w-full px-3 py-2 text-sm border border-emerald-200 bg-emerald-50/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                          />
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <div className="flex items-center gap-2">
                              {grade?.ai_comment_draft && studentComment !== grade.ai_comment_draft && grade.ai_comment_draft !== grade.student_facing_comment && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStudentCommentDraft((prev) => ({ ...prev, [key]: grade.ai_comment_draft! }))
                                  }
                                  className="text-[11px] font-semibold text-purple-700 hover:text-purple-800 underline-offset-2 hover:underline transition"
                                  title="Restore the original AI draft"
                                >
                                  Restore AI draft
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {studentCommentDirty && (
                                <span className="text-[11px] text-amber-600 font-semibold">Unsaved</span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  void saveTile(s.id, score, confirmed, {
                                    student_facing_comment:
                                      studentComment.trim() === "" ? null : studentComment,
                                  })
                                }
                                disabled={isSaving || !studentCommentDirty}
                                className={[
                                  "px-3 py-1.5 text-xs font-bold rounded-lg transition",
                                  studentCommentDirty
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed",
                                ].join(" ")}
                              >
                                {isSaving ? "Saving…" : "Send to student"}
                              </button>
                            </div>
                          </div>
                        </div>

                      {/* AI suggestion (purple) — reference info, full width below feedback */}
                      {grade?.ai_pre_score !== null && grade?.ai_pre_score !== undefined && (
                        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-purple-700 mb-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
                            </svg>
                            AI suggestion
                            {typeof grade.ai_confidence === "number" && (
                              <span className="ml-auto text-[10px] font-mono text-purple-500">
                                conf {Math.round(grade.ai_confidence * 100)}%
                              </span>
                            )}
                          </div>
                          {grade.ai_quote && (
                            <p className="text-xs italic text-gray-800 leading-relaxed">
                              &ldquo;{grade.ai_quote}&rdquo;
                            </p>
                          )}
                          {grade.ai_reasoning && (
                            <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">
                              {grade.ai_reasoning}
                            </p>
                          )}
                          {typeof grade.ai_pre_score === "number" && score !== grade.ai_pre_score && (
                            <button
                              type="button"
                              onClick={() => void saveTile(s.id, grade.ai_pre_score!, true)}
                              disabled={isSaving}
                              className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-md bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 transition disabled:opacity-50"
                            >
                              Accept AI ({grade.ai_pre_score})
                            </button>
                          )}
                        </div>
                      )}

                      {/* Score selector — full width row of buttons + NA */}
                      <div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-2">
                          Score
                        </div>
                        <ScoreSelector
                          scale={scale}
                          value={score}
                          isNa={isNa}
                          onChange={(next, opts) =>
                            void saveTile(s.id, next, false, { score_na: opts?.na ?? false })
                          }
                          disabled={isSaving}
                        />
                      </div>

                        <div>
                          <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-2">
                            Override note <span className="font-normal lowercase tracking-normal text-gray-400">(private to you)</span>
                          </div>
                          <textarea
                            value={noteDraft}
                            onChange={(e) =>
                              setOverrideNoteDraft((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder="Why this score over what the rubric defaults to? Anchored to specific evidence is best."
                            rows={4}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                          />
                          <div className="flex items-center justify-end gap-2 mt-2">
                            {noteDirty && (
                              <span className="text-[11px] text-amber-600 font-semibold">Unsaved</span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                void saveTile(s.id, score, confirmed, {
                                  override_note: noteDraft.trim() === "" ? null : noteDraft,
                                })
                              }
                              disabled={isSaving || !noteDirty}
                              className={[
                                "px-3 py-1.5 text-xs font-bold rounded-lg transition",
                                noteDirty
                                  ? "bg-purple-600 text-white hover:bg-purple-700"
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
                              ].join(" ")}
                            >
                              {isSaving ? "Saving…" : "Save note"}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-end pt-2 border-t border-gray-200">
                          <button
                            type="button"
                            onClick={() => setExpandedStudentId(null)}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition"
                          >
                            Done
                          </button>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SynthesizeView — per-student vertical rollup + Release flow.
// ════════════════════════════════════════════════════════════════════════════

interface SynthesizeViewProps {
  klass: ClassDetail | null;
  unit: UnitDetail | null;
  students: StudentRow[];
  grades: Record<string, TileGradeRow>;
  activePageId: string | null;
  scale: ReturnType<typeof getGradingScale>;
  synthCommentDraft: Record<string, string>;
  setSynthCommentDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  releasingStudentId: string | null;
  setReleasingStudentId: React.Dispatch<React.SetStateAction<string | null>>;
  releasedAtByStudent: Record<string, string>;
  setReleasedAtByStudent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  loadAll: () => Promise<void>;
}

interface PastFeedbackRecord {
  id: string;
  unit_id: string;
  class_id: string;
  data: {
    overall_comment?: string | null;
    criterion_scores?: Array<{ criterion_key: string; level: number }>;
  };
  overall_grade: number | null;
  assessed_at: string;
  units: { title: string } | null;
}

function relativeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

function SynthesizeView({
  klass,
  unit,
  students,
  grades,
  scale,
  synthCommentDraft,
  setSynthCommentDraft,
  releasingStudentId,
  setReleasingStudentId,
  releasedAtByStudent,
  setReleasedAtByStudent,
  loadAll,
}: SynthesizeViewProps) {
  // Past-feedback memory — fetched per-student on mount, cached in state.
  const [pastFeedback, setPastFeedback] = useState<Record<string, PastFeedbackRecord[]>>({});

  useEffect(() => {
    if (!unit) return;
    let cancelled = false;
    void (async () => {
      const fetches = students.map(async (s) => {
        const res = await fetch(
          `/api/teacher/grading/past-feedback?student_id=${s.id}&exclude_unit_id=${unit.id}`,
        );
        if (!res.ok) return [s.id, [] as PastFeedbackRecord[]] as const;
        const json = (await res.json()) as { records: PastFeedbackRecord[] };
        return [s.id, json.records ?? []] as const;
      });
      const settled = await Promise.all(fetches);
      if (cancelled) return;
      const map: Record<string, PastFeedbackRecord[]> = {};
      for (const [id, recs] of settled) map[id] = recs;
      setPastFeedback(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [unit, students]);

  if (!klass || !unit) return null;
  if (students.length === 0) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
        No students enrolled in this class yet.
      </div>
    );
  }

  // For each student, compute the cross-page rollup using the full set of
  // confirmed grades for the unit (NOT just the active page — Synthesize is
  // the assemble-everything step).
  return (
    <div className="space-y-3">
      {students.map((s) => {
        const studentGrades = Object.values(grades).filter(
          (g) => g.student_id === s.id,
        );
        const confirmedCount = studentGrades.filter((g) => g.confirmed && g.score !== null).length;
        const totalCount = studentGrades.length;
        const rollups: CriterionRollup[] = computeStudentRollup(
          studentGrades.map((g) => ({
            tile_id: g.tile_id,
            page_id: g.page_id,
            score: g.score,
            confirmed: g.confirmed,
            criterion_keys: g.criterion_keys,
            graded_at: null,
            score_na: g.score_na ?? false,
          })),
        );
        const displayName = s.display_name?.trim() || s.username?.trim() || "(unnamed)";
        const initials = displayName
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        const commentDraft = synthCommentDraft[s.id] ?? "";
        const isReleasing = releasingStudentId === s.id;
        const releasedAt = releasedAtByStudent[s.id];
        const canRelease = rollups.length > 0;

        return (
          <div key={s.id} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              {s.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.avatar_url}
                  alt=""
                  className="w-11 h-11 rounded-full object-cover bg-gray-100 flex-shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-purple-100 text-purple-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <p className="text-base font-bold text-gray-900">{displayName}</p>
                  <span className="text-[11px] font-mono text-gray-400 tabular-nums">
                    {confirmedCount}/{totalCount} confirmed
                  </span>
                  {releasedAt && (
                    <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                      Released
                    </span>
                  )}
                </div>

                {/* Rollup pills */}
                {rollups.length === 0 ? (
                  <p className="text-xs italic text-gray-400 mt-2">
                    No confirmed scores yet — confirm at least one tile in Calibrate to see a rollup.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {rollups.map((r) => (
                      <div
                        key={r.neutral_key}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {r.neutral_key}
                        </span>
                        <span className="text-sm font-extrabold text-gray-900 tabular-nums">
                          {scale.formatDisplay(r.score)}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          n={r.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Past-feedback memory — amber callout, surfaced just
                    above the comment so it's in eyeline while writing. */}
                {(() => {
                  const prior = pastFeedback[s.id]?.[0];
                  if (!prior) return null;
                  const comment = prior.data?.overall_comment;
                  if (!comment || !comment.trim()) return null;
                  const ago = relativeAgo(prior.assessed_at);
                  const unitLabel = prior.units?.title ? ` on “${prior.units.title}”` : "";
                  return (
                    <div className="mt-4 mb-3 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50/70">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-amber-700 mb-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5v6m0 4v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                        </svg>
                        You said {ago}{unitLabel}
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed italic">
                        &ldquo;{comment.length > 240 ? `${comment.slice(0, 240)}…` : comment}&rdquo;
                      </p>
                    </div>
                  );
                })()}

                {/* Comment textarea + release */}
                <div className="mt-4">
                  <textarea
                    value={commentDraft}
                    onChange={(e) =>
                      setSynthCommentDraft((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    placeholder={`A short overall comment for ${displayName} — what landed, what to push on next.`}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      type="button"
                      disabled={isReleasing || !canRelease}
                      onClick={async () => {
                        setReleasingStudentId(s.id);
                        try {
                          const res = await fetch("/api/teacher/grading/release", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              class_id: klass.id,
                              unit_id: unit.id,
                              student_id: s.id,
                              comment: commentDraft.trim() || null,
                            }),
                          });
                          const json = await res.json();
                          if (!res.ok) {
                            throw new Error(json.error ?? `Release failed (${res.status})`);
                          }
                          setReleasedAtByStudent((prev) => ({ ...prev, [s.id]: json.released_at }));
                          await loadAll();
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "Release failed");
                        } finally {
                          setReleasingStudentId(null);
                        }
                      }}
                      className={[
                        "px-4 py-2 text-xs font-bold rounded-lg transition",
                        canRelease && !isReleasing
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed",
                      ].join(" ")}
                    >
                      {isReleasing
                        ? "Releasing…"
                        : releasedAt
                          ? "Re-release"
                          : `Release to ${displayName.split(" ")[0] || "student"}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
