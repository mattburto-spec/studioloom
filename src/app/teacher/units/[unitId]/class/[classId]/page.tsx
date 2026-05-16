"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
// Lever-MM (4 May 2026): NMConfigPanel no longer mounted from this surface
// — configuration moved to the lesson editor's New Metrics block category.
// Component kept in @/components/nm/index for potential reuse.
import { NMResultsPanel, NMElementsPanel, ObservationSnap } from "@/components/nm";
import { BadgesTab } from "@/components/teacher/class-hub/BadgesTab";
import { LessonSchedule } from "@/components/teacher/LessonSchedule";
import type { ScheduleOverrides } from "@/components/teacher/LessonSchedule";
import type { NMUnitConfig } from "@/lib/nm/constants";
import { DEFAULT_NM_CONFIG, AGENCY_ELEMENTS } from "@/lib/nm/constants";
import { getPageList } from "@/lib/unit-adapter";
import { getPageColor } from "@/lib/constants";
import type { Unit, UnitPage, UnitContentData, StudentProgress } from "@/types";
import type { AssessmentRecordRow } from "@/types/assessment";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { OpenStudioClassView } from "@/components/open-studio";
import { PaceFeedbackSummary } from "@/components/teacher/PaceFeedbackSummary";
import IntegrityReport from "@/components/teacher/IntegrityReport";
import { StudentResponseValue } from "@/components/teacher/StudentResponseValue";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";
import { analyzeIntegrity, worstIntegrityLevel } from "@/lib/integrity/analyze-integrity";
import { ClassProfileOverview } from "@/components/teacher/ClassProfileOverview";
import { GalleryRoundCreator, GalleryMonitor, GalleryRoundCard, GalleryCanvasModal } from "@/components/gallery";
import { getYearLevelNumber } from "@/lib/utils/year-level";
import StudentDrawer from "@/components/teacher/class-hub/StudentDrawer";
import UnitAttentionPanel from "@/components/teacher/UnitAttentionPanel";

// ---------------------------------------------------------------------------
// DT Class Canvas — single unified per-class surface for the teacher.
// ---------------------------------------------------------------------------
// Replaces the 7-tab Class Hub (16 May 2026 rebuild — see audit Section F /
// Phase 3.1). Layout: canvas-header + canvas-grid (main column + 360px
// sticky side rail). Main column = lesson hero (3.3), student grid (3.1),
// gallery strip (3.5). Side rail = Marking / Open Studio / Class Metrics /
// Safety summary cards (3.2). Kebab on the header carries class + unit
// actions (3.4). Surfaces previously living on Students / Gallery / Open
// Studio / New Metrics / Badges / Settings tabs now open as drawers /
// sub-routes wired through the side-rail card CTAs and the kebab.
// URL: /teacher/units/[unitId]/class/[classId]
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Progress tab types
// ---------------------------------------------------------------------------

interface ProgressCell {
  status: "not_started" | "in_progress" | "complete";
  hasResponses: boolean;
  timeSpent: number;
  hasIntegrityData: boolean;
  /**
   * Worst integrity level across all sections in this page's response
   * metadata. Round 8 (6 May 2026): the dot used to render whenever
   * data was collected (always blue), which made every actively-used
   * lesson look "flagged". Now only dots when there's a real concern.
   *   - "high" or null  → no dot (green/clean)
   *   - "medium"        → amber dot (warning)
   *   - "low"           → rose dot (concern)
   */
  integrityLevel: "high" | "medium" | "low" | null;
}

type GradingStatus = "ungraded" | "draft" | "published";
type StudentProgressMap = Record<string, Record<string, ProgressCell>>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Gallery Tab — manages gallery rounds for this class+unit
// ---------------------------------------------------------------------------
function GalleryTab({ unitId, classId, unitPages }: { unitId: string; classId: string; unitPages: UnitPage[] }) {
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [monitorRoundId, setMonitorRoundId] = useState<string | null>(null);
  const [canvasRoundId, setCanvasRoundId] = useState<string | null>(null);

  const loadRounds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/gallery?unitId=${unitId}&classId=${classId}`);
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds || []);
      }
    } catch (e) {
      console.error("Failed to load gallery rounds:", e);
    } finally {
      setLoading(false);
    }
  }, [unitId, classId]);

  useEffect(() => { loadRounds(); }, [loadRounds]);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Monitor modal (grid display mode) */}
      {monitorRoundId && (
        <GalleryMonitor roundId={monitorRoundId} onClose={() => { setMonitorRoundId(null); loadRounds(); }} />
      )}

      {/* Canvas modal (canvas display mode) */}
      {canvasRoundId && (
        <GalleryCanvasModal roundId={canvasRoundId} onClose={() => { setCanvasRoundId(null); loadRounds(); }} />
      )}

      {/* Creator modal */}
      {showCreator && (
        <GalleryRoundCreator
          unitId={unitId}
          classId={classId}
          pages={unitPages.map(p => ({ id: p.id, title: p.title }))}
          onCreated={() => { setShowCreator(false); loadRounds(); }}
          onClose={() => setShowCreator(false)}
        />
      )}

      {/* Header + New Round button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Pin-Up Gallery</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create critique rounds where students share work and give peer feedback</p>
        </div>
        <button
          onClick={() => setShowCreator(true)}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Gallery Round
        </button>
      </div>

      {/* Rounds list */}
      {loading ? (
        <div className="space-y-3">
          <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : rounds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold mb-1">No gallery rounds yet</p>
          <p className="text-gray-500 text-sm mb-4">Create a pin-up crit round for students to share work and give peer feedback.</p>
          <button
            onClick={() => setShowCreator(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
          >
            Create Your First Round
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round: any) => (
            <GalleryRoundCard
              key={round.id}
              round={round}
              onClick={() => {
                if (round.display_mode === "canvas") {
                  setCanvasRoundId(round.id);
                } else {
                  setMonitorRoundId(round.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Info card */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
        <h3 className="font-semibold text-purple-900 flex items-center gap-2 mb-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
          </svg>
          About Pin-Up Gallery
        </h3>
        <p className="text-sm text-purple-700 leading-relaxed mb-3">
          Pin-up crits are a core design studio practice. Students share work-in-progress, then browse and give structured feedback to classmates. Effort-gated: students must complete their reviews before seeing feedback on their own work.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
            <div className="font-semibold text-purple-800 mb-1">Review Formats</div>
            <p className="text-purple-600 text-xs">Quick Comment, PMI Analysis, Two Stars & a Wish, or any toolkit tool.</p>
          </div>
          <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
            <div className="font-semibold text-purple-800 mb-1">Effort-Gating</div>
            <p className="text-purple-600 text-xs">Students must complete minimum reviews before seeing their own feedback.</p>
          </div>
          <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
            <div className="font-semibold text-purple-800 mb-1">MYP Criterion D</div>
            <p className="text-purple-600 text-xs">Structured peer evaluation maps directly to Criterion D (Evaluating).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClassHubPage({
  params,
}: {
  params: Promise<{ unitId: string; classId: string }>;
}) {
  const { unitId, classId } = use(params);

  // Shared data (loaded once)
  const [unit, setUnit] = useState<Unit | null>(null);
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [classFramework, setClassFramework] = useState<string>("IB_MYP");
  const [students, setStudents] = useState<Array<{ id: string; display_name: string; username: string; graduation_year?: string | null }>>([]);
  const [pages, setPages] = useState<Array<{ id: string; title: string }>>([]);
  const [unitPages, setUnitPages] = useState<UnitPage[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings tab state
  const [nmConfig, setNmConfig] = useState<NMUnitConfig>(DEFAULT_NM_CONFIG);
  const [globalNmEnabled, setGlobalNmEnabled] = useState(false);
  const [terms, setTerms] = useState<Array<{ id: string; academic_year: string; term_name: string; term_order: number; start_date?: string; end_date?: string }>>([]);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [savingTerm, setSavingTerm] = useState(false);
  const [termMessage, setTermMessage] = useState("");
  const [scheduleInfo, setScheduleInfo] = useState<{
    lessonCount: number | null;
    nextClass: { dateISO: string; dayOfWeek: string; cycleDay: number; periodNumber?: number; room?: string; formatted: string; short: string } | null;
    reason?: string;
  } | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverrides>({});

  // Progress tab state
  const [progressMap, setProgressMap] = useState<StudentProgressMap>({});
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [gradingStatusMap, setGradingStatusMap] = useState<Record<string, GradingStatus>>({});
  // Open Studio unlock/revoke is managed entirely in the Open Studio tab
  const [badgeRequirements, setBadgeRequirements] = useState<Array<{ badge_id: string; badge_name: string; badge_slug: string; is_required: boolean }>>([]);
  const [badgeStatusMap, setBadgeStatusMap] = useState<Record<string, Array<{ badge_id: string; status: "earned" | "failed" | "not_attempted"; score: number | null }>>>({});
  const [selectedDetailStudent, setSelectedDetailStudent] = useState<{ id: string; name: string } | null>(null);
  const [selectedDetailPage, setSelectedDetailPage] = useState<string | null>(null);
  const [detailResponses, setDetailResponses] = useState<Record<string, string> | null>(null);
  const [detailIntegrity, setDetailIntegrity] = useState<Record<string, IntegrityMetadata> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [nmObserveStudent, setNmObserveStudent] = useState<{ id: string; name: string } | null>(null);

  // Student Drawer state
  const [drawerStudent, setDrawerStudent] = useState<{ id: string; name: string } | null>(null);

  // -----------------------------------------------------------------------
  // Load shared data (unit, class, students, pages, settings)
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [unitRes, classRes, studentsRes, classUnitRes, termsRes, cohortTermRes] = await Promise.all([
        supabase.from("units").select("*").eq("id", unitId).single(),
        supabase.from("classes").select("name, code, framework").eq("id", classId).single(),
        supabase.from("class_students").select("student_id, students(id, display_name, username, graduation_year)").eq("class_id", classId).eq("is_active", true),
        supabase.from("class_units").select("term_id, schedule_overrides, content_data, forked_at, forked_from_version, nm_config").eq("class_id", classId).eq("unit_id", unitId).single(),
        fetch("/api/teacher/school-calendar").then((r) => (r.ok ? r.json() : Promise.resolve({ terms: [] }))),
        // Class "current cohort" — derived from the most-recent active enrollment
        // that has a term_id set. Mirrors the logic in src/app/teacher/classes/page.tsx.
        // Used below to auto-inherit the unit's term_id when it's null.
        supabase.from("class_students").select("term_id").eq("class_id", classId).eq("is_active", true).not("term_id", "is", null).order("enrolled_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      setUnit(unitRes.data);
      setClassName(classRes.data?.name || "");
      setClassCode(classRes.data?.code || "");
      setClassFramework(classRes.data?.framework || "IB_MYP");

      const enrolledStudents = (studentsRes.data || [])
        .filter((row: any) => row.students)
        .map((row: any) => ({
          id: row.students.id,
          display_name: row.students.display_name || "",
          username: row.students.username || "",
          graduation_year: row.students.graduation_year || null,
        }))
        .sort((a: any, b: any) => (a.display_name || a.username).localeCompare(b.display_name || b.username));
      setStudents(enrolledStudents);

      if (unitRes.data) {
        const resolvedContent = resolveClassUnitContent(
          unitRes.data.content_data as UnitContentData,
          (classUnitRes.data?.content_data as UnitContentData | null) ?? undefined
        );
        const pageList = getPageList(resolvedContent);
        setUnitPages(pageList);
        setPages(
          pageList.map((p: UnitPage, i: number) => ({
            id: p.id,
            title: p.title || p.content?.title || `Page ${i + 1}`,
          }))
        );
      }

      // Settings data
      if (classUnitRes.data) {
        // Auto-inherit unit term_id from the class's current cohort term
        // when unset. This closes the surprise gap where a teacher sets
        // "Semester 2 2025-2026" on the class but the unit's Settings tab
        // shows "— No term assigned —". Fire-and-forget the persist:
        // self-heals on next reload if the PATCH fails.
        let resolvedTermId: string | null = classUnitRes.data.term_id || null;
        const cohortTermId = (cohortTermRes.data?.term_id as string | undefined) || null;
        if (!resolvedTermId && cohortTermId) {
          resolvedTermId = cohortTermId;
          void fetch("/api/teacher/class-units", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ classId, unitId, term_id: cohortTermId }),
          });
        }
        setSelectedTermId(resolvedTermId);
        if (classUnitRes.data.schedule_overrides) {
          setScheduleOverrides(classUnitRes.data.schedule_overrides as ScheduleOverrides);
        }
      }
      if (termsRes?.terms) setTerms(termsRes.terms);

      // NM config
      try {
        const res = await fetch(`/api/teacher/nm-config?unitId=${unitId}&classId=${classId}`);
        if (res.ok) {
          const data = await res.json();
          setNmConfig(data.config || DEFAULT_NM_CONFIG);
          setGlobalNmEnabled(data.globalNmEnabled !== false);
        }
      } catch {
        if (classUnitRes.data?.nm_config) {
          setNmConfig(classUnitRes.data.nm_config as NMUnitConfig);
        } else if (unitRes.data?.nm_config) {
          setNmConfig(unitRes.data.nm_config as NMUnitConfig);
        }
      }

      setLoading(false);
    }
    load();
  }, [unitId, classId]);

  // -----------------------------------------------------------------------
  // Load progress data (lazy — only when Progress tab is active)
  // -----------------------------------------------------------------------
  const loadProgressData = useCallback(async () => {
    if (progressLoaded || progressLoading) return;
    setProgressLoading(true);

    const supabase = createClient();
    const studentIds = students.map((s) => s.id);

    if (studentIds.length > 0) {
      const { data: progress } = await supabase
        .from("student_progress")
        .select("*")
        .eq("unit_id", unitId)
        .in("student_id", studentIds);

      const map: StudentProgressMap = {};
      (progress || []).forEach((p: StudentProgress) => {
        if (!map[p.student_id]) map[p.student_id] = {};
        const raw = p as unknown as Record<string, unknown>;
        const integrityMeta = raw.integrity_metadata;
        const hasIntegrityData =
          integrityMeta !== null &&
          integrityMeta !== undefined &&
          typeof integrityMeta === "object" &&
          Object.keys(integrityMeta as Record<string, unknown>).length > 0;
        // Round 8 — compute the worst level across all sections so the
        // dot only renders for actual concerns, not "we collected data".
        const integrityLevel = hasIntegrityData
          ? worstIntegrityLevel(
              integrityMeta as Record<string, IntegrityMetadata>
            )
          : null;
        map[p.student_id][p.page_id] = {
          status: p.status as "not_started" | "in_progress" | "complete",
          hasResponses:
            p.responses !== null &&
            typeof p.responses === "object" &&
            Object.keys(p.responses as Record<string, unknown>).length > 0,
          timeSpent: p.time_spent || 0,
          hasIntegrityData,
          integrityLevel,
        };
      });
      setProgressMap(map);
    }

    // Grading status
    try {
      const assessRes = await fetch(`/api/teacher/assessments?classId=${classId}&unitId=${unitId}`);
      if (assessRes.ok) {
        const { assessments } = (await assessRes.json()) as { assessments: AssessmentRecordRow[] };
        const statusMap: Record<string, GradingStatus> = {};
        for (const a of assessments) statusMap[a.student_id] = a.is_draft ? "draft" : "published";
        setGradingStatusMap(statusMap);
      }
    } catch { /* non-critical */ }

    // Open Studio statuses managed in Open Studio tab (OpenStudioClassView)

    // Badge requirements + status
    try {
      const badgeRes = await fetch(`/api/teacher/badges/class-status?classId=${classId}&unitId=${unitId}`);
      if (badgeRes.ok) {
        const badgeData = await badgeRes.json();
        setBadgeRequirements(badgeData.requirements || []);
        setBadgeStatusMap(badgeData.student_status || {});
      }
    } catch { /* non-critical */ }

    setProgressLoading(false);
    setProgressLoaded(true);
  }, [students, unitId, classId, progressLoaded, progressLoading]);

  // DT canvas (Phase 3.1) — student grid is always-mounted in the main
  // column, so progress data loads unconditionally once the shared loader
  // has resolved the roster. No tab gate any more.
  useEffect(() => {
    if (!loading && students.length > 0 && !progressLoaded) {
      loadProgressData();
    }
  }, [loading, students, progressLoaded, loadProgressData]);

  // -----------------------------------------------------------------------
  // Schedule loading (for Settings tab)
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function loadSchedule() {
      const term = terms.find((t) => t.id === selectedTermId) as any;
      if (!term?.start_date || !term?.end_date) { setScheduleInfo(null); return; }

      setScheduleLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const fromDate = term.start_date > today ? term.start_date : today;

        const [countRes, nextRes] = await Promise.all([
          fetch(`/api/teacher/schedule/lessons?classId=${classId}&mode=count&from=${term.start_date}&to=${term.end_date}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/teacher/schedule/lessons?classId=${classId}&mode=next&from=${fromDate}&count=1`).then((r) => (r.ok ? r.json() : null)),
        ]);

        const nextLesson = nextRes?.lessons?.[0] || null;
        setScheduleInfo({
          lessonCount: countRes?.lessonCount ?? null,
          nextClass: nextLesson ? {
            dateISO: nextLesson.dateISO, dayOfWeek: nextLesson.dayOfWeek, cycleDay: nextLesson.cycleDay,
            periodNumber: nextLesson.periodNumber, room: nextLesson.room,
            formatted: `${nextLesson.dayOfWeek} ${nextLesson.dateISO} (Day ${nextLesson.cycleDay}${nextLesson.periodNumber ? `, P${nextLesson.periodNumber}` : ""})`,
            short: `Day ${nextLesson.cycleDay}${nextLesson.periodNumber ? `, P${nextLesson.periodNumber}` : ""} — ${nextLesson.dayOfWeek?.slice(0, 3)}`,
          } : null,
          reason: nextRes?.lessons?.length === 0 ? "no_meetings" : undefined,
        });
      } catch { setScheduleInfo(null); }
      finally { setScheduleLoading(false); }
    }
    loadSchedule();
  }, [selectedTermId, classId, terms]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  async function handleTermChange(termId: string | null) {
    setSelectedTermId(termId);
    setSavingTerm(true);
    setTermMessage("");
    try {
      const res = await fetch("/api/teacher/class-units", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, unitId, term_id: termId }),
      });
      if (!res.ok) { const data = await res.json(); setTermMessage(data.error || "Failed to save term"); return; }
      setTermMessage("Term assigned!");
      setTimeout(() => setTermMessage(""), 3000);
    } catch { setTermMessage("Network error. Please try again."); }
    finally { setSavingTerm(false); }
  }

  function getStudentCompletion(studentId: string): number {
    const sp = progressMap[studentId];
    if (!sp) return 0;
    return Object.values(sp).filter((c) => c.status === "complete").length;
  }

  function getPageCompletion(pageId: string): number {
    let count = 0;
    students.forEach((s) => {
      if (progressMap[s.id]?.[pageId]?.status === "complete") count++;
    });
    return count;
  }

  function getStatusColor(status: string | undefined) {
    switch (status) {
      case "complete": return "bg-accent-green text-white";
      case "in_progress": return "bg-amber-400 text-white";
      default: return "bg-gray-100 text-gray-400";
    }
  }

  function getStatusIcon(status: string | undefined) {
    switch (status) { case "complete": return "✓"; case "in_progress": return "●"; default: return "—"; }
  }

  async function loadStudentDetail(student: { id: string; name: string }, pageId: string) {
    setSelectedDetailStudent(student);
    setSelectedDetailPage(pageId);
    setDetailLoading(true);
    setDetailResponses(null);
    setDetailIntegrity(null);

    const supabase = createClient();
    const { data } = await supabase
      .from("student_progress")
      .select("responses, integrity_metadata")
      .eq("student_id", student.id)
      .eq("unit_id", unitId)
      .eq("page_id", pageId)
      .maybeSingle();

    setDetailResponses((data?.responses as Record<string, string>) || {});
    const raw = data as unknown as Record<string, unknown>;
    const intMeta = raw?.integrity_metadata;
    if (intMeta && typeof intMeta === "object" && Object.keys(intMeta as Record<string, unknown>).length > 0) {
      setDetailIntegrity(intMeta as Record<string, IntegrityMetadata>);
    }
    setDetailLoading(false);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-32 bg-gray-50 rounded-xl" />
        </div>
      </main>
    );
  }

  if (!unit) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-text-secondary">Unit not found.</p>
        <Link href="/teacher/units" className="text-accent-blue text-sm mt-2 inline-block">← Back to units</Link>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-4">
        <Link href="/teacher/dashboard" className="hover:text-text-primary transition">Dashboard</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <Link href={`/teacher/classes/${classId}`} className="hover:text-text-primary transition">{className}</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="text-text-primary font-medium truncate max-w-[200px]">{unit.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-sm font-bold flex-shrink-0">
              {className.charAt(0).toUpperCase()}
            </div>
            {className}
            <span className="text-text-tertiary font-normal">·</span>
            <span className="text-text-secondary font-normal truncate max-w-[300px]">{unit.title}</span>
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {students.length} student{students.length !== 1 ? "s" : ""} · {pages.length} page{pages.length !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-2">
          <Link
            href={`/teacher/teach/${unitId}?classId=${classId}`}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium text-sm hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Teach
          </Link>
          <Link
            href={`/teacher/units/${unitId}/class/${classId}/edit`}
            className="px-4 py-2 rounded-xl border border-border text-text-primary font-medium text-sm hover:bg-surface-alt transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </Link>
          {/* Canvas-header kebab. Stub for Phase 3.1 — opens nothing yet.
              Phase 3.4 wires the dropdown contents: Unit (Edit / View as
              student / Change unit / Past units) + Class (Class settings /
              Roll over / Duplicate / Archive / Delete). Mockup view 2,
              kebab-menu block (~line 1478). */}
          <button
            type="button"
            data-testid="canvas-header-kebab"
            aria-label="Class and unit actions"
            title="Class and unit actions (coming in Phase 3.4)"
            disabled
            className="w-10 h-10 rounded-xl border border-border text-text-secondary opacity-50 cursor-not-allowed flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1.2" />
              <circle cx="12" cy="12" r="1.2" />
              <circle cx="12" cy="19" r="1.2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CANVAS GRID — main column (lesson hero + student grid + gallery) */}
      {/*               + 360px sticky side rail (Marking / Open Studio / */}
      {/*               Class Metrics / Safety summary cards).             */}
      {/* Each section starts as an empty placeholder; subsequent Phase    */}
      {/* 3.x sub-phases fill them in (3.1 = student grid, 3.2 = side     */}
      {/* rail, 3.3 = lesson hero, 3.5 = gallery strip).                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div
        data-testid="dt-canvas-grid"
        className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start"
      >
        {/* MAIN COLUMN */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Lesson hero placeholder — Phase 3.3 fills this with the
              Today's-lesson card (Workshop Model outline + Change unit
              affordance + Teach CTA). Empty in 3.1. */}
          <section
            data-testid="canvas-lesson-hero"
            data-placeholder="phase-3-3"
            className="hidden"
            aria-hidden="true"
          />

          {/* Student grid placeholder — Phase 3.1 (Step 3) fills this
              with the new student × column matrix + filter chips. */}
          <section
            data-testid="canvas-student-grid"
            data-placeholder="phase-3-1-step-3"
            className="bg-white rounded-2xl border border-border p-8 text-sm text-text-secondary"
          >
            Student grid lands in the next commit (Phase 3.1 step 3).
          </section>

          {/* Gallery strip placeholder — Phase 3.5 fills this with the
              recent-work thumbnail tiles + "Open gallery ›" link. */}
          <section
            data-testid="canvas-gallery-strip"
            data-placeholder="phase-3-5"
            className="hidden"
            aria-hidden="true"
          />
        </div>

        {/* SIDE RAIL — Phase 3.2 fills each card with summary count + sub
            + CTA. Empty cards in 3.1 so the layout doesn't reflow on the
            3.2 land. Sticky positioning matches the mockup's
            .canvas-side rule (top: 130px). */}
        <aside
          data-testid="canvas-side-rail"
          className="flex flex-col gap-4 lg:sticky lg:top-32"
        >
          <div
            data-testid="canvas-rail-card-marking"
            data-placeholder="phase-3-2"
            className="bg-white rounded-2xl border border-border p-5"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Marking queue
            </div>
            <div className="mt-2 text-xs text-text-secondary">
              Summary lands in Phase 3.2.
            </div>
          </div>

          <div
            data-testid="canvas-rail-card-studio"
            data-placeholder="phase-3-2"
            className="bg-white rounded-2xl border border-border p-5"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Open Studio
            </div>
            <div className="mt-2 text-xs text-text-secondary">
              Summary lands in Phase 3.2.
            </div>
          </div>

          <div
            data-testid="canvas-rail-card-metrics"
            data-placeholder="phase-3-2"
            className="bg-white rounded-2xl border border-border p-5"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Class metrics · this unit
            </div>
            <div className="mt-2 text-xs text-text-secondary">
              Summary lands in Phase 3.2.
            </div>
          </div>

          <div
            data-testid="canvas-rail-card-safety"
            data-placeholder="phase-3-2"
            className="bg-white rounded-2xl border border-border p-5"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Safety &amp; badges
            </div>
            <div className="mt-2 text-xs text-text-secondary">
              Summary lands in Phase 3.2.
            </div>
          </div>
        </aside>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Student Drawer                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {drawerStudent && (
        <StudentDrawer
          studentId={drawerStudent.id}
          studentName={drawerStudent.name}
          unitId={unitId}
          classId={classId}
          onClose={() => setDrawerStudent(null)}
        />
      )}

      {/* NM Observation Snap modal */}
      {nmObserveStudent && nmConfig?.enabled && (
        <ObservationSnap
          studentId={nmObserveStudent.id}
          studentName={nmObserveStudent.name}
          unitId={unitId}
          classId={classId}
          elements={
            AGENCY_ELEMENTS
              .filter((e) => nmConfig.elements.includes(e.id))
              .map((e) => ({ id: e.id, name: e.name, definition: e.definition, color: e.color, studentDescription: e.studentDescription }))
          }
          onComplete={() => setNmObserveStudent(null)}
          onClose={() => setNmObserveStudent(null)}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Students Tab — manage class enrollment
// ---------------------------------------------------------------------------

function StudentsTab({
  classId,
  students,
  setStudents,
}: {
  classId: string;
  students: Array<{ id: string; display_name: string; username: string; graduation_year?: string | null }>;
  setStudents: React.Dispatch<React.SetStateAction<Array<{ id: string; display_name: string; username: string; graduation_year?: string | null }>>>;
}) {
  const [addMode, setAddMode] = useState(false);
  const [addTab, setAddTab] = useState<"existing" | "new">("existing");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  // Existing students state
  const [existingStudents, setExistingStudents] = useState<Array<{ id: string; display_name: string; username: string; graduation_year?: string | null }>>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [enrollingIds, setEnrollingIds] = useState<Set<string>>(new Set());

  // Load teacher's existing students when "Add Existing" tab is shown
  useEffect(() => {
    if (!addMode || addTab !== "existing") return;
    let cancelled = false;
    async function loadExisting() {
      setLoadingExisting(true);
      try {
        const supabase = createClient();
        // Get current user (teacher)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // Get all students owned by this teacher
        const { data: allStudents } = await supabase
          .from("students")
          .select("id, display_name, username, graduation_year")
          .eq("author_teacher_id", user.id)
          .order("display_name", { ascending: true });

        if (cancelled || !allStudents) return;

        // Filter out students already in this class
        const enrolledIds = new Set(students.map((s) => s.id));
        const available = allStudents.filter((s) => !enrolledIds.has(s.id));
        setExistingStudents(available);
      } catch (e) {
        console.error("[StudentsTab] Failed to load existing students:", e);
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    }
    loadExisting();
    return () => { cancelled = true; };
  }, [addMode, addTab, classId, students]);

  async function enrollExistingStudent(student: { id: string; display_name: string; username: string; graduation_year?: string | null }) {
    setEnrollingIds((prev) => new Set(prev).add(student.id));
    setError("");
    try {
      const supabase = createClient();
      const { error: enrollErr } = await supabase.from("class_students").insert({
        student_id: student.id,
        class_id: classId,
        is_active: true,
      });

      if (enrollErr) {
        // Might be duplicate — try reactivating
        if (enrollErr.code === "23505") {
          await supabase
            .from("class_students")
            .update({ is_active: true })
            .eq("student_id", student.id)
            .eq("class_id", classId);
        } else {
          throw enrollErr;
        }
      }

      setStudents((prev) => [...prev, student].sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username)));
      setExistingStudents((prev) => prev.filter((s) => s.id !== student.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to enrol student");
    } finally {
      setEnrollingIds((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
    }
  }

  async function addStudent() {
    if (!newDisplayName.trim() && !newUsername.trim()) return;
    setSaving(true);
    setError("");
    try {
      // FU-AV2-UI-STUDENT-INSERT-REFACTOR (30 Apr 2026): create + enroll
      // via POST /api/teacher/students. Atomic INSERT + auth.users
      // provision + class_students enrollment.
      const res = await fetch("/api/teacher/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username:
            newUsername.trim() ||
            newDisplayName.trim().toLowerCase().replace(/\s+/g, "_"),
          displayName: newDisplayName.trim(),
          classId,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Failed to create student");
      }
      // Coerce route response (display_name: string|null, graduation_year:
      // number|null) to the local state's expected shape.
      const routeStudent = body.student as {
        id: string;
        display_name: string | null;
        username: string;
        graduation_year: number | null;
      };
      const newStudent = {
        id: routeStudent.id,
        display_name: routeStudent.display_name ?? "",
        username: routeStudent.username,
        graduation_year: routeStudent.graduation_year != null
          ? String(routeStudent.graduation_year)
          : null,
      };

      setStudents((prev) => [...prev, newStudent].sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username)));
      setNewDisplayName("");
      setNewUsername("");
      setAddMode(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add student");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(studentId: string) {
    if (!editName.trim() && !editUsername.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from("students").update({
        display_name: editName.trim(),
        username: editUsername.trim(),
      }).eq("id", studentId);

      setStudents((prev) => prev.map((s) =>
        s.id === studentId ? { ...s, display_name: editName.trim(), username: editUsername.trim() } : s
      ));
      setEditingId(null);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function removeStudent(studentId: string) {
    setRemoving(true);
    try {
      // Use server API — handles deactivation + session invalidation
      const res = await fetch("/api/teacher/class-students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, classId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("[removeStudent] Error:", data.error);
        return;
      }

      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setRemoveConfirmId(null);
    } catch {
      // silent
    } finally {
      setRemoving(false);
    }
  }

  const filteredExisting = searchQuery.trim()
    ? existingStudents.filter((s) =>
        (s.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.username || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : existingStudents;

  return (
    <div className="max-w-2xl">
      {/* Header with add button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">{students.length} student{students.length !== 1 ? "s" : ""} enrolled</p>
        <button
          onClick={() => { setAddMode(true); setAddTab("existing"); setError(""); setSearchQuery(""); }}
          className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Student
        </button>
      </div>

      {/* Add student panel */}
      {addMode && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
          {/* Tab toggle */}
          <div className="flex gap-1 mb-3 bg-purple-100 rounded-lg p-0.5">
            <button
              onClick={() => { setAddTab("existing"); setError(""); }}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                addTab === "existing" ? "bg-white text-purple-700 shadow-sm" : "text-purple-600 hover:text-purple-800"
              }`}
            >
              Add Existing
            </button>
            <button
              onClick={() => { setAddTab("new"); setError(""); }}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                addTab === "new" ? "bg-white text-purple-700 shadow-sm" : "text-purple-600 hover:text-purple-800"
              }`}
            >
              Create New
            </button>
          </div>

          {addTab === "existing" ? (
            /* Enrol existing students */
            <div>
              <input
                id="student-search"
                name="student-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your students..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                autoFocus
              />
              {loadingExisting ? (
                <p className="text-xs text-gray-500 py-4 text-center">Loading students...</p>
              ) : filteredExisting.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-gray-500">
                    {existingStudents.length === 0
                      ? "No other students found. All your students are already in this class, or create a new one below."
                      : "No students match your search."}
                  </p>
                  {existingStudents.length === 0 && (
                    <button onClick={() => setAddTab("new")} className="text-xs text-purple-600 font-medium mt-1 hover:underline">
                      Create a new student instead
                    </button>
                  )}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                  {filteredExisting.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {(s.display_name || s.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.display_name || s.username}</p>
                        {s.display_name && s.username && s.display_name !== s.username && (
                          <p className="text-[10px] text-gray-400 font-mono">{s.username}</p>
                        )}
                      </div>
                      <button
                        onClick={() => enrollExistingStudent(s)}
                        disabled={enrollingIds.has(s.id)}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50 flex-shrink-0"
                      >
                        {enrollingIds.has(s.id) ? "Adding..." : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Create new student */
            <div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label htmlFor="new-student-name" className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    id="new-student-name"
                    name="new-student-name"
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="e.g. Sarah Chen"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="new-student-username" className="block text-xs font-medium text-gray-700 mb-1">Username</label>
                  <input
                    id="new-student-username"
                    name="new-student-username"
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="auto-generated if blank"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addStudent} disabled={saving || (!newDisplayName.trim() && !newUsername.trim())}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50">
                  {saving ? "Creating..." : "Create & Add"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          <div className="flex justify-end mt-3">
            <button onClick={() => { setAddMode(false); setError(""); setSearchQuery(""); }} className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition">
              Done
            </button>
          </div>
        </div>
      )}

      {/* Student list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {students.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">No students in this class yet.</p>
            <p className="text-xs mt-1">Add students above or share the class code for students to join.</p>
          </div>
        ) : (
          students.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-gray-50 transition">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {(s.display_name || s.username || "?").charAt(0).toUpperCase()}
              </div>

              {editingId === s.id ? (
                /* Edit mode */
                <div className="flex-1 flex items-center gap-2">
                  <input id="edit-student-name" name="edit-student-name" type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  <input id="edit-student-username" name="edit-student-username" type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)}
                    className="w-32 px-2 py-1 rounded border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  <button onClick={() => saveEdit(s.id)} disabled={saving}
                    className="px-2 py-1 rounded bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50">Save</button>
                  <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                </div>
              ) : (
                /* Display mode */
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.display_name || s.username}</p>
                    {s.display_name && s.username && s.display_name !== s.username && (
                      <p className="text-xs text-gray-400 font-mono">{s.username}</p>
                    )}
                  </div>
                  {s.graduation_year && (
                    <span className="text-xs text-gray-400 font-mono">Y{getYearLevelNumber(typeof s.graduation_year === "number" ? s.graduation_year : parseInt(s.graduation_year, 10) || null)}</span>
                  )}

                  {/* Action buttons — visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { setEditingId(s.id); setEditName(s.display_name); setEditUsername(s.username); }}
                      className="p-1.5 rounded-lg hover:bg-gray-200 transition" title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>

                    {removeConfirmId === s.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => removeStudent(s.id)} disabled={removing}
                          className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-medium hover:bg-red-700 transition disabled:opacity-50">
                          {removing ? "..." : "Remove"}
                        </button>
                        <button onClick={() => setRemoveConfirmId(null)} className="px-2 py-1 rounded border border-gray-300 text-[10px] text-gray-600 hover:bg-gray-50 transition">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setRemoveConfirmId(s.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition" title="Remove from class">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
