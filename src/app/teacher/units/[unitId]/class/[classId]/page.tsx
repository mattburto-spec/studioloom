"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
// Lever-MM (4 May 2026): NMConfigPanel no longer mounted from this surface
// — configuration moved to the lesson editor's New Metrics block category.
// Component kept in @/components/nm/index for potential reuse.
import { NMResultsPanel, ObservationSnap } from "@/components/nm";
import { BadgesTab } from "@/components/teacher/class-hub/BadgesTab";
import { LessonSchedule } from "@/components/teacher/LessonSchedule";
import type { ScheduleOverrides } from "@/components/teacher/LessonSchedule";
import type { NMUnitConfig } from "@/lib/nm/constants";
import { DEFAULT_NM_CONFIG, AGENCY_ELEMENTS } from "@/lib/nm/constants";
import { getPageList, isV3 } from "@/lib/unit-adapter";
import { getCriterionKeys, getCriterion, getGradingScale } from "@/lib/constants";
import { getPageColor, CRITERIA, GRADING_SCALES, type CriterionKey, type GradingScale } from "@/lib/constants";
import { getCriterionLabels } from "@/lib/frameworks/adapter";
import type { FrameworkId } from "@/lib/frameworks/adapter";
import { getCriterionColor } from "@/lib/frameworks/render-helpers";
import type { Unit, UnitPage, UnitContentData, Student, StudentProgress } from "@/types";
import type { AssessmentRecordRow } from "@/types/assessment";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { OpenStudioClassView } from "@/components/open-studio";
import { PaceFeedbackSummary } from "@/components/teacher/PaceFeedbackSummary";
import IntegrityReport from "@/components/teacher/IntegrityReport";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";
import { analyzeIntegrity } from "@/lib/integrity/analyze-integrity";
import { ClassProfileOverview } from "@/components/teacher/ClassProfileOverview";
import { GalleryRoundCreator, GalleryMonitor, GalleryRoundCard, GalleryCanvasModal } from "@/components/gallery";
import { getYearLevelNumber } from "@/lib/utils/year-level";
import StudentDrawer from "@/components/teacher/class-hub/StudentDrawer";

// ---------------------------------------------------------------------------
// Class Hub — Central teacher command centre for a class+unit
// ---------------------------------------------------------------------------
// Tabs: Progress (default) | Grade | Settings
// Student Drawer opens from any student name click.
// URL: /teacher/units/[unitId]/class/[classId]
// ---------------------------------------------------------------------------

type HubTab = "progress" | "grade" | "students" | "gallery" | "studio" | "metrics" | "badges" | "settings";

const TABS: { id: HubTab; label: string; icon: string }[] = [
  { id: "progress", label: "Progress", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "grade", label: "Grade", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { id: "students", label: "Students", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { id: "gallery", label: "Gallery", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { id: "studio", label: "Open Studio", icon: "M3 11h18M3 11v8a2 2 0 002 2h14a2 2 0 002-2v-8M7 11V7a5 5 0 0110 0v4" },
  { id: "metrics", label: "New Metrics", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { id: "badges", label: "Badges", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { id: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
];

// ---------------------------------------------------------------------------
// Progress tab types
// ---------------------------------------------------------------------------

interface ProgressCell {
  status: "not_started" | "in_progress" | "complete";
  hasResponses: boolean;
  timeSpent: number;
  hasIntegrityData: boolean;
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

  // Tab state (from URL or default)
  const [activeTab, setActiveTab] = useState<HubTab>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const tab = sp.get("tab");
      if (tab === "progress" || tab === "grade" || tab === "students" || tab === "gallery" || tab === "studio" || tab === "metrics" || tab === "badges" || tab === "settings") return tab;
      if (tab === "safety") return "badges"; // backward compat
      if (tab === "open-studio") return "studio"; // backward compat
    }
    return "progress";
  });

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

  // Grade tab state
  const [assessments, setAssessments] = useState<Map<string, any>>(new Map());
  const [assessmentIds, setAssessmentIds] = useState<Map<string, string>>(new Map());
  const [selectedStudentForGrading, setSelectedStudentForGrading] = useState<string | null>(null);
  const [currentScores, setCurrentScores] = useState<Map<string, any>>(new Map());
  const [teacherComments, setTeacherComments] = useState("");
  const [overallGrade, setOverallGrade] = useState<number | undefined>();
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeSaving, setGradeSaving] = useState(false);
  const [gradeSaved, setGradeSaved] = useState(false);
  const [gradeDirty, setGradeDirty] = useState(false);
  const [unitCriteriaForGrade, setUnitCriteriaForGrade] = useState<string[]>([]);
  const gradeDataLoadedRef = useRef(false);
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
  // Update URL when tab changes
  // -----------------------------------------------------------------------
  function switchTab(tab: HubTab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }

  // -----------------------------------------------------------------------
  // Load shared data (unit, class, students, pages, settings)
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [unitRes, classRes, studentsRes, classUnitRes, termsRes] = await Promise.all([
        supabase.from("units").select("*").eq("id", unitId).single(),
        supabase.from("classes").select("name, code, framework").eq("id", classId).single(),
        supabase.from("class_students").select("student_id, students(id, display_name, username, graduation_year)").eq("class_id", classId).eq("is_active", true),
        supabase.from("class_units").select("term_id, schedule_overrides, content_data, forked_at, forked_from_version, nm_config").eq("class_id", classId).eq("unit_id", unitId).single(),
        fetch("/api/teacher/school-calendar").then((r) => (r.ok ? r.json() : Promise.resolve({ terms: [] }))),
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
        setSelectedTermId(classUnitRes.data.term_id || null);
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
        map[p.student_id][p.page_id] = {
          status: p.status as "not_started" | "in_progress" | "complete",
          hasResponses: p.responses !== null && typeof p.responses === "object" && Object.keys(p.responses as Record<string, unknown>).length > 0,
          timeSpent: p.time_spent || 0,
          hasIntegrityData: integrityMeta !== null && integrityMeta !== undefined && typeof integrityMeta === "object" && Object.keys(integrityMeta as Record<string, unknown>).length > 0,
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

  useEffect(() => {
    if (activeTab === "progress" && !loading && students.length > 0 && !progressLoaded) {
      loadProgressData();
    }
  }, [activeTab, loading, students, progressLoaded, loadProgressData]);

  // -----------------------------------------------------------------------
  // Load grading data (lazy — only when Grade tab is active)
  // -----------------------------------------------------------------------
  const loadGradeData = useCallback(async () => {
    if (!unit) return;
    setGradeLoading(true);

    try {
      // Determine criteria to grade against — via FrameworkAdapter.
      const gradeFwId: FrameworkId =
        (classFramework as FrameworkId | null | undefined) ?? "IB_MYP";
      const fwLabels = getCriterionLabels(gradeFwId);
      let criteria: string[];

      if (fwLabels.length > 0) {
        criteria = fwLabels.map((l) => l.short);
      } else {
        // Fallback: extract from unit content
        const uniqueCriteria = new Set<string>();
        unitPages.forEach((p) => {
          (p.content?.sections || []).forEach((s: any) => {
            (s.criterionTags || []).forEach((t: string) => uniqueCriteria.add(t));
          });
        });
        unitPages.filter((p) => p.type === "strand" && p.criterion).forEach((p) => {
          if (p.criterion) uniqueCriteria.add(p.criterion);
        });
        unitPages.forEach((p) => {
          if (p.criterion) uniqueCriteria.add(p.criterion);
        });
        criteria = Array.from(uniqueCriteria);
      }
      setUnitCriteriaForGrade(criteria);

      // Fetch assessments
      const assessRes = await fetch(`/api/teacher/assessments?classId=${classId}&unitId=${unitId}`);
      if (assessRes.ok) {
        const { assessments: rows } = (await assessRes.json()) as { assessments: AssessmentRecordRow[] };
        const assessMap = new Map<string, any>();
        const idMap = new Map<string, string>();
        for (const row of rows) {
          assessMap.set(row.student_id, row.data);
          idMap.set(row.student_id, row.id);
        }
        setAssessments(assessMap);
        setAssessmentIds(idMap);
      }

      // Auto-select first student if not already selected
      if (!selectedStudentForGrading && students.length > 0) {
        setSelectedStudentForGrading(students[0].id);
      }
    } catch {
      // silently fail
    } finally {
      setGradeLoading(false);
    }
  }, [unit, unitId, classId, unitPages, students, selectedStudentForGrading]);

  useEffect(() => {
    if (activeTab === "grade" && !loading && unit && unitPages.length > 0 && !gradeDataLoadedRef.current) {
      gradeDataLoadedRef.current = true;
      loadGradeData();
    }
    // Reset loaded ref when tab changes away so re-entering refreshes
    if (activeTab !== "grade") {
      gradeDataLoadedRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loading, unit, unitPages]);

  // Load assessment form when selected student changes
  useEffect(() => {
    if (!selectedStudentForGrading) return;
    const existing = assessments.get(selectedStudentForGrading);
    if (existing) {
      const scoreMap = new Map<string, any>();
      for (const cs of existing.criterion_scores || []) {
        scoreMap.set(cs.criterion_key, cs);
      }
      setCurrentScores(scoreMap);
      setOverallGrade(existing.overall_grade);
      setTeacherComments(existing.teacher_comments || "");
    } else {
      setCurrentScores(new Map());
      setOverallGrade(undefined);
      setTeacherComments("");
    }
    setGradeDirty(false);
  }, [selectedStudentForGrading, assessments]);

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
  // Grade tab helpers
  // -----------------------------------------------------------------------

  function getCriterionScore(key: string): any {
    return currentScores.get(key) || { criterion_key: key, level: 0 };
  }

  function updateCriterionScore(key: string, updates: any) {
    setCurrentScores((prev) => {
      const next = new Map(prev);
      const existing = next.get(key) || { criterion_key: key, level: 0 };
      next.set(key, { ...existing, ...updates });
      return next;
    });
    setGradeDirty(true);
  }

  function getGradeStatus(studentId: string): GradingStatus {
    const a = assessments.get(studentId);
    if (!a) return "ungraded";
    return a.is_draft ? "draft" : "published";
  }

  async function saveGradeAssessment(isDraft: boolean) {
    if (!selectedStudentForGrading) return;
    setGradeSaving(true);

    const record = {
      id: assessmentIds.get(selectedStudentForGrading) || crypto.randomUUID(),
      student_id: selectedStudentForGrading,
      unit_id: unitId,
      class_id: classId,
      teacher_id: "",
      criterion_scores: Array.from(currentScores.values()).filter((cs) => cs.level > 0),
      overall_grade: overallGrade,
      teacher_comments: teacherComments || undefined,
      assessed_at: new Date().toISOString(),
      is_draft: isDraft,
    };

    try {
      const res = await fetch("/api/teacher/assessments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudentForGrading,
          unit_id: unitId,
          class_id: classId,
          data: record,
          is_draft: isDraft,
        }),
      });

      if (res.ok) {
        const { assessment } = await res.json();
        setAssessments((prev) => {
          const next = new Map(prev);
          next.set(selectedStudentForGrading, assessment.data);
          return next;
        });
        setAssessmentIds((prev) => {
          const next = new Map(prev);
          next.set(selectedStudentForGrading, assessment.id);
          return next;
        });
        setGradeDirty(false);
        setGradeSaved(true);
        setTimeout(() => setGradeSaved(false), 2000);
      }
    } catch {
      // silently fail
    }

    setGradeSaving(false);
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
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PROGRESS TAB (inline matrix)                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "progress" && (
        <div>
          {progressLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 bg-gray-200 rounded" />
              <div className="h-64 bg-gray-200 rounded" />
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <p className="text-text-secondary">No students in this class yet.</p>
            </div>
          ) : (
            <>
              {/* Student Learning Profiles */}
              <div className="mb-4">
                <ClassProfileOverview classId={classId} />
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-gray-400">—</div>
                  <span className="text-text-secondary">Not started</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-amber-400 flex items-center justify-center text-white">●</div>
                  <span className="text-text-secondary">In progress</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-accent-green flex items-center justify-center text-white">✓</div>
                  <span className="text-text-secondary">Complete</span>
                </div>
              </div>

              {/* Student × Page matrix */}
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-xs font-medium text-text-secondary min-w-[180px]">
                          Student
                        </th>
                        {badgeRequirements.length > 0 && (
                          <th className="px-2 py-2 text-center text-xs font-medium text-amber-700 min-w-[60px] bg-amber-50 border-b-2 border-amber-400" title="Safety badge status">
                            <span className="flex items-center justify-center gap-1">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                              Safety
                            </span>
                          </th>
                        )}
                        {unitPages.map((page) => {
                          const color = getPageColor(page);
                          const completion = getPageCompletion(page.id);
                          const pct = students.length > 0 ? Math.round((completion / students.length) * 100) : 0;
                          return (
                            <th key={page.id} className="px-1 py-2 text-center text-xs font-medium min-w-[36px] cursor-default border-b-2"
                              title={`${page.id}: ${page.title}\n${completion}/${students.length} complete (${pct}%)`}
                              style={{ color, borderBottomColor: color }}>
                              {page.id.replace(/^L0?/, "")}
                            </th>
                          );
                        })}
                        <th className="px-2 py-2 text-center text-xs font-medium text-text-secondary min-w-[48px]">
                          /{unitPages.length}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => {
                        const completed = getStudentCompletion(student.id);
                        const studentName = student.display_name || student.username;
                        return (
                          <tr key={student.id} className="border-b border-border/50 last:border-0 hover:bg-surface-alt/50">
                            <td className="sticky left-0 z-10 bg-white px-4 py-2">
                              <div className="flex flex-col">
                                <button
                                  onClick={() => setDrawerStudent({ id: student.id, name: studentName })}
                                  className="text-sm font-medium text-text-primary hover:text-purple-700 transition text-left truncate max-w-[160px] flex items-center gap-1.5"
                                >
                                  {studentName}
                                  {(() => {
                                    const gy = student.graduation_year;
                                    const ylNum = getYearLevelNumber(typeof gy === 'number' ? gy : gy ? parseInt(gy, 10) || null : null);
                                    return ylNum ? <span className="text-[9px] font-bold text-indigo-400" title={`Year ${ylNum}`}>{ylNum}</span> : null;
                                  })()}
                                  {gradingStatusMap[student.id] === "published" && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-accent-green" title="Graded" />
                                  )}
                                  {gradingStatusMap[student.id] === "draft" && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="Draft grade" />
                                  )}
                                </button>
                                {student.display_name && (
                                  <span className="text-xs text-text-secondary font-mono">{student.username}</span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-1">
                                {nmConfig?.enabled && (
                                  <button
                                    onClick={() => setNmObserveStudent({ id: student.id, name: studentName })}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                                    title="Record NM observation"
                                  >
                                    NM
                                  </button>
                                )}
                              </div>
                            </td>
                            {badgeRequirements.length > 0 && (
                              <td className="px-2 py-2 text-center bg-amber-50/50">
                                {(() => {
                                  const statuses = badgeStatusMap[student.id] || [];
                                  const allEarned = statuses.length > 0 && statuses.every((s) => s.status === "earned");
                                  const anyFailed = statuses.some((s) => s.status === "failed");
                                  const noneAttempted = statuses.every((s) => s.status === "not_attempted");

                                  if (allEarned) return <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-emerald-100 text-emerald-600" title={`All ${statuses.length} badge(s) earned`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg></span>;
                                  if (anyFailed) return <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-red-100 text-red-600 text-xs font-bold" title={`${statuses.filter((s) => s.status === "failed").length} badge(s) failed`}>✗</span>;
                                  if (noneAttempted) return <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-gray-100 text-gray-400 text-xs" title="Not attempted">—</span>;
                                  const earnedCount = statuses.filter((s) => s.status === "earned").length;
                                  return <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-amber-100 text-amber-700 text-[10px] font-bold" title={`${earnedCount}/${statuses.length} badges earned`}>{earnedCount}/{statuses.length}</span>;
                                })()}
                              </td>
                            )}
                            {unitPages.map((page) => {
                              const cell = progressMap[student.id]?.[page.id];
                              return (
                                <td key={page.id} className="px-1 py-2 text-center">
                                  <div className="relative inline-block">
                                    <button
                                      onClick={() => loadStudentDetail({ id: student.id, name: studentName }, page.id)}
                                      className={`w-7 h-7 rounded text-xs font-medium transition hover:scale-110 ${getStatusColor(cell?.status)}`}
                                      title={`${studentName} - ${page.id}: ${cell?.status || "not_started"}${cell?.hasIntegrityData ? " • Integrity data collected" : ""}`}
                                    >
                                      {getStatusIcon(cell?.status)}
                                    </button>
                                    {cell?.hasIntegrityData && (
                                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 ring-1 ring-white" title="Integrity monitoring data available" />
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-center">
                              <span className={`text-sm font-medium ${completed === unitPages.length ? "text-accent-green" : completed > 0 ? "text-text-primary" : "text-text-secondary"}`}>
                                {completed}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-surface-alt/30">
                        <td className="sticky left-0 z-10 bg-surface-alt/30 px-4 py-2 text-xs font-medium text-text-secondary">Class completion</td>
                        {badgeRequirements.length > 0 && (
                          <td className="px-2 py-2 text-center text-xs text-amber-700 bg-amber-50/30">
                            {(() => {
                              if (students.length === 0) return "—";
                              let allEarnedCount = 0;
                              for (const s of students) {
                                const statuses = badgeStatusMap[s.id] || [];
                                if (statuses.length > 0 && statuses.every((st) => st.status === "earned")) allEarnedCount++;
                              }
                              return `${Math.round((allEarnedCount / students.length) * 100)}%`;
                            })()}
                          </td>
                        )}
                        {unitPages.map((page) => {
                          const completion = getPageCompletion(page.id);
                          const pct = students.length > 0 ? Math.round((completion / students.length) * 100) : 0;
                          return (
                            <td key={page.id} className="px-1 py-2 text-center text-xs text-text-secondary" title={`${completion}/${students.length} complete`}>
                              {pct}%
                            </td>
                          );
                        })}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Pace Feedback Summary */}
              <div className="mt-6 p-5 bg-white rounded-xl border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-text-primary">Lesson Pace Feedback</h2>
                  <span className="text-xs text-text-secondary ml-auto">From student post-lesson surveys</span>
                </div>
                <PaceFeedbackSummary unitId={unitId} />
              </div>

              {/* Open Studio management moved to dedicated Open Studio tab */}
            </>
          )}

          {/* Student detail modal */}
          {selectedDetailStudent && selectedDetailPage !== null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{selectedDetailStudent.name}</h2>
                    <p className="text-sm text-text-secondary">{selectedDetailPage}: {unitPages.find((p) => p.id === selectedDetailPage)?.title}</p>
                  </div>
                  <button onClick={() => { setSelectedDetailStudent(null); setSelectedDetailPage(null); setDetailResponses(null); setDetailIntegrity(null); }} className="w-8 h-8 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-secondary">✕</button>
                </div>
                <div className="px-6 py-4 overflow-y-auto flex-1">
                  {detailLoading ? (
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-20 bg-gray-200 rounded" />
                    </div>
                  ) : !detailResponses || Object.keys(detailResponses).length === 0 ? (
                    <p className="text-text-secondary text-center py-8">No responses yet for this page.</p>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const selectedUnitPage = unitPages.find((p) => p.id === selectedDetailPage);
                        const page = selectedUnitPage?.content as { sections?: { prompt: string }[]; reflection?: { type: string; items: string[] } } | undefined;
                        const sections = page?.sections || [];
                        return Object.entries(detailResponses).filter(([key]) => !key.startsWith("_tracking_")).map(([key, value]) => {
                          let label = key;
                          if (key.startsWith("section_")) { const idx = parseInt(key.replace("section_", "")); label = sections[idx]?.prompt || `Section ${idx + 1}`; }
                          else if (key.startsWith("activity_")) { const actSection = sections.find((s: any) => s.activityId === key.replace("activity_", "")); label = actSection?.prompt || key; }
                          else if (key.startsWith("check_")) { const idx = parseInt(key.replace("check_", "")); label = page?.reflection?.items?.[idx] || `Checklist item ${idx + 1}`; }
                          else if (key.startsWith("reflection_")) { label = `Reflection ${parseInt(key.replace("reflection_", "")) + 1}`; }
                          else if (key === "freeform") { label = "Freeform notes"; }

                          // Find matching integrity data for this response key
                          const integrityMeta = detailIntegrity?.[key];

                          return (
                            <div key={key}>
                              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">{label}</p>
                              <div className="bg-surface-alt rounded-lg p-3">
                                <p className="text-sm text-text-primary whitespace-pre-wrap">{value === "true" ? "✓ Checked" : value === "false" ? "☐ Not checked" : typeof value === "string" ? value || "—" : JSON.stringify(value)}</p>
                              </div>
                              {integrityMeta && (
                                <div className="mt-2">
                                  <IntegrityReport metadata={integrityMeta} />
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}

                      {/* Aggregate integrity summary when data exists */}
                      {detailIntegrity && Object.keys(detailIntegrity).length > 0 && (
                        <div className="mt-6 pt-4 border-t border-border">
                          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Writing Integrity Summary</h3>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(detailIntegrity).map(([key, meta]) => {
                              const analysis = analyzeIntegrity(meta);
                              const scoreColor = analysis.score >= 70 ? "bg-green-100 text-green-800" : analysis.score >= 40 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
                              return (
                                <span key={key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${scoreColor}`}>
                                  {key.replace("section_", "S").replace("activity_", "A:")} — {analysis.score}%
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* GRADE TAB                                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "grade" && (
        <div className="space-y-4">
          {gradeLoading ? (
            <div className="bg-white rounded-xl border border-border p-6 animate-pulse">
              <div className="h-40 bg-gray-200 rounded" />
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-6 text-center">
              <p className="text-text-secondary">No students in this class yet.</p>
            </div>
          ) : unitCriteriaForGrade.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-6 text-center">
              <p className="text-text-secondary mb-3">No criteria found in this unit.</p>
              <Link href={`/teacher/classes/${classId}/grading/${unitId}`} className="text-accent-blue text-sm font-medium hover:underline">
                Open Full Grading View →
              </Link>
            </div>
          ) : (
            <>
              {/* Student List & Grading Form */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Student List Sidebar */}
                <div className="bg-white rounded-xl border border-border overflow-hidden lg:col-span-1">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-xs font-semibold text-text-secondary uppercase">Students</h3>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/50">
                    {students.map((s) => {
                      const status = getGradeStatus(s.id);
                      const isSelected = s.id === selectedStudentForGrading;
                      const statusColors = {
                        "ungraded": "bg-gray-50 text-gray-600",
                        "draft": "bg-blue-50 text-blue-600",
                        "published": "bg-green-50 text-green-600",
                      };
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedStudentForGrading(s.id)}
                          className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition ${
                            isSelected
                              ? "bg-accent-blue/5 border-l-2 border-accent-blue"
                              : "hover:bg-surface-alt border-l-2 border-transparent"
                          }`}
                        >
                          <span className="text-xs font-medium text-text-primary truncate flex-1">
                            {s.display_name || s.username}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${statusColors[status]}`}>
                            {status === "ungraded" ? "—" : status === "draft" ? "Draft" : "✓"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grading Form */}
                <div className="bg-white rounded-xl border border-border p-5 lg:col-span-3 space-y-4">
                  {selectedStudentForGrading && (() => {
                    const student = students.find((s) => s.id === selectedStudentForGrading);
                    const scale = getGradingScale(classFramework);
                    return (
                      <>
                        {/* Student header */}
                        <div className="flex items-center justify-between pb-3 border-b border-border">
                          <h3 className="text-sm font-semibold text-text-primary">
                            {student?.display_name || student?.username}
                          </h3>
                          {gradeSaved && (
                            <span className="text-xs text-accent-green font-medium">✓ Saved</span>
                          )}
                        </div>

                        {/* Student Work Quick-View */}
                        {unitPages.length > 0 && (
                          <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Student Work</span>
                              <span className="text-[10px] text-blue-400">Click to view responses & integrity</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {unitPages.map((page) => {
                                const progress = progressMap[selectedStudentForGrading]?.[page.id];
                                const hasResponses = progress?.hasResponses ?? false;
                                const rawP = progress as unknown as Record<string, unknown>;
                                const hasIntegrity = rawP?.integrity_metadata && typeof rawP.integrity_metadata === "object" && Object.keys(rawP.integrity_metadata as Record<string, unknown>).length > 0;
                                return (
                                  <button
                                    key={page.id}
                                    onClick={() => loadStudentDetail({ id: selectedStudentForGrading, name: student?.display_name || student?.username || "" }, page.id)}
                                    className={`relative px-2 py-1 rounded text-[11px] font-medium transition border ${
                                      hasResponses
                                        ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                        : "bg-gray-50 border-gray-200 text-gray-400"
                                    }`}
                                    title={`${page.title || page.id}${hasIntegrity ? " • Has integrity data" : ""}`}
                                  >
                                    {page.title ? (page.title.length > 20 ? page.title.slice(0, 18) + "…" : page.title) : page.id}
                                    {hasIntegrity ? (
                                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 ring-1 ring-white" />
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Criteria sections */}
                        <div className="space-y-4">
                          {unitCriteriaForGrade.map((criterionKey) => {
                            const gradeCriterion = (() => {
                              const fwId: FrameworkId =
                                (classFramework as FrameworkId | null | undefined) ?? "IB_MYP";
                              const labels = getCriterionLabels(fwId);
                              const match = labels.find((l) => l.short === criterionKey);
                              const color = getCriterionColor(criterionKey, fwId);
                              return match
                                ? { key: criterionKey, name: match.name, color }
                                : { key: criterionKey, name: criterionKey, color: "#6366F1" };
                            })();
                            const criterion = gradeCriterion;
                            if (!criterion) return null;
                            const score = getCriterionScore(criterionKey);

                            return (
                              <div key={criterionKey} className="p-3 bg-gray-50 rounded-lg space-y-2">
                                {/* Criterion header */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: criterion.color }}
                                  >
                                    {criterionKey}
                                  </span>
                                  <span className="text-xs font-semibold text-text-primary flex-1">
                                    {criterion.name}
                                  </span>
                                  {score.level > 0 && (
                                    <span className="text-xs font-bold" style={{ color: criterion.color }}>
                                      {scale.formatDisplay(score.level)}
                                    </span>
                                  )}
                                </div>

                                {/* Level picker */}
                                {(scale.max - scale.min) > 20 ? (
                                  /* Percentage/large-range: number input */
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={scale.min}
                                      max={scale.max}
                                      step={scale.step}
                                      value={score.level || ""}
                                      onChange={(e) => {
                                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                                        if (val > scale.max) return;
                                        updateCriterionScore(criterionKey, { level: val });
                                      }}
                                      placeholder={scale.formatDisplay(scale.min)}
                                      className="w-20 px-2 py-1 border rounded font-semibold text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                                      style={{ borderColor: criterion.color + "60" }}
                                    />
                                    <span className="text-xs text-gray-500">
                                      {score.level > 0 ? scale.formatDisplay(score.level) : `${scale.min}–${scale.max}`}
                                    </span>
                                    {score.level > 0 && (
                                      <button
                                        onClick={() => updateCriterionScore(criterionKey, { level: 0 })}
                                        className="w-7 h-7 rounded-lg bg-gray-200 text-gray-400 hover:bg-gray-300 transition text-xs font-semibold"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  /* Discrete scales: button picker */
                                  <div className="flex gap-1 flex-wrap">
                                    {Array.from({ length: Math.round((scale.max - scale.min) / scale.step) + 1 }, (_, i) => scale.min + i * scale.step).map((v) => {
                                      const isSelected = v === score.level;
                                      return (
                                        <button
                                          key={v}
                                          onClick={() => updateCriterionScore(criterionKey, { level: v })}
                                          className="w-7 h-7 rounded-lg font-semibold text-xs transition min-w-[1.75rem]"
                                          style={{
                                            backgroundColor: isSelected ? criterion.color : "#e5e7eb",
                                            color: isSelected ? "white" : "#9ca3af",
                                          }}
                                        >
                                          {scale.formatDisplay(v)}
                                        </button>
                                      );
                                    })}
                                    {score.level > 0 && (
                                      <button
                                        onClick={() => updateCriterionScore(criterionKey, { level: 0 })}
                                        className="w-7 h-7 rounded-lg bg-gray-200 text-gray-400 hover:bg-gray-300 transition text-xs font-semibold"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                )}

                                {/* Criterion comment */}
                                <textarea
                                  value={score.comment || ""}
                                  onChange={(e) => updateCriterionScore(criterionKey, { comment: e.target.value })}
                                  placeholder={`Comment on ${criterionKey}...`}
                                  rows={1}
                                  className="w-full px-2 py-1.5 border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-accent-blue/30 resize-none"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Overall assessment */}
                        <div className="p-3 bg-indigo-50 rounded-lg space-y-2 border border-indigo-200">
                          <label className="block text-xs font-semibold text-indigo-900">
                            Overall Grade {scale.type === "percentage" ? `(${scale.min}-${scale.max}%)` : ""}
                          </label>
                          {(scale.max - scale.min) > 20 ? (
                            /* Percentage/large-range scales: number input */
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={scale.min}
                                max={scale.max}
                                step={scale.step}
                                value={overallGrade ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? undefined : Number(e.target.value);
                                  if (val !== undefined && (val < scale.min || val > scale.max)) return;
                                  setOverallGrade(val);
                                  setGradeDirty(true);
                                }}
                                placeholder={scale.formatDisplay(scale.min)}
                                className="w-24 px-3 py-1.5 border border-indigo-300 rounded font-semibold text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                              />
                              <span className="text-xs text-gray-500">
                                {overallGrade !== undefined ? scale.formatDisplay(overallGrade) : `${scale.min}–${scale.max}`}
                              </span>
                              {overallGrade !== undefined && (
                                <button
                                  onClick={() => { setOverallGrade(undefined); setGradeDirty(true); }}
                                  className="px-2 py-1.5 rounded bg-gray-200 text-gray-400 hover:bg-gray-300 transition text-xs font-semibold"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Discrete scales (MYP 1-8, PLTW 1-4): button picker */
                            <div className="flex gap-1 flex-wrap">
                              {Array.from({ length: Math.round((scale.max - scale.min) / scale.step) + 1 }, (_, i) => scale.min + i * scale.step).map((v) => {
                                const isSelected = v === overallGrade;
                                return (
                                  <button
                                    key={v}
                                    onClick={() => { setOverallGrade(v); setGradeDirty(true); }}
                                    className="flex-1 py-1.5 rounded font-semibold text-xs transition min-w-[2rem]"
                                    style={{
                                      backgroundColor: isSelected ? "#6366f1" : "#e0e7ff",
                                      color: isSelected ? "white" : "#6b7280",
                                    }}
                                  >
                                    {scale.formatDisplay(v)}
                                  </button>
                                );
                              })}
                              {overallGrade !== undefined && (
                                <button
                                  onClick={() => { setOverallGrade(undefined); setGradeDirty(true); }}
                                  className="px-2 py-1.5 rounded bg-gray-200 text-gray-400 hover:bg-gray-300 transition text-xs font-semibold"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Teacher comments */}
                        <div>
                          <label className="block text-xs font-semibold text-text-secondary mb-1">
                            Teacher Comments
                          </label>
                          <textarea
                            value={teacherComments}
                            onChange={(e) => { setTeacherComments(e.target.value); setGradeDirty(true); }}
                            placeholder="Overall feedback and next steps..."
                            rows={3}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/30 resize-none"
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => saveGradeAssessment(true)}
                            disabled={gradeSaving || !gradeDirty}
                            className="flex-1 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium text-sm hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {gradeSaving ? "Saving..." : "Save as Draft"}
                          </button>
                          <button
                            onClick={() => saveGradeAssessment(false)}
                            disabled={gradeSaving || !gradeDirty}
                            className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {gradeSaving ? "Saving..." : "Publish"}
                          </button>
                        </div>

                        {/* Link to full grading view */}
                        <div className="pt-2 border-t border-border">
                          <Link
                            href={`/teacher/classes/${classId}/grading/${unitId}`}
                            className="text-accent-blue text-xs font-medium hover:underline inline-flex items-center gap-1"
                          >
                            ↗ Open Full Grading View
                          </Link>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STUDENTS TAB                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "students" && (
        <StudentsTab classId={classId} students={students} setStudents={setStudents} />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* NEW METRICS TAB — Lever-MM (4 May 2026):                         */}
      {/* Configuration moved to the lesson editor's "New Metrics" block   */}
      {/* category. This tab now hosts the RESULTS view only.              */}
      {/* NMConfigPanel.tsx kept in repo for reuse but no longer mounted.  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "metrics" && (
        <div>
          {globalNmEnabled ? (
            <>
              {/* Where-do-I-configure banner — points teachers at the new
                  location. Renders unconditionally above the results so
                  even teachers WITHOUT any checkpoints yet learn how to
                  add them. */}
              <div className="mb-6 px-4 py-3 rounded-xl border border-yellow-200 bg-yellow-50 flex items-start gap-3">
                <span className="text-yellow-700 text-lg flex-shrink-0">🎯</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-primary text-sm mb-0.5">
                    Configure NM checkpoints in the lesson editor
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Open any lesson, expand the <strong>New Metrics</strong> block category in the Blocks pane (gold dot), and click an element to register a checkpoint on that lesson. Results from teacher observations and student self-assessments display below.
                  </p>
                </div>
              </div>
              {/* Results panel — unchanged. Renders whether or not nm_config.enabled
                  is true, so teachers see "no results yet" state on a fresh class. */}
              <div className="mb-6">
                <NMResultsPanel unitId={unitId} classId={classId} />
              </div>
            </>
          ) : (
            <div className="p-6 bg-gray-50 rounded-xl border border-border text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <h3 className="font-semibold text-text-primary mb-1">New Metrics</h3>
              <p className="text-sm text-text-secondary mb-3">
                Enable New Metrics in your school settings to configure competency assessments for this class.
              </p>
              <Link href="/teacher/settings?tab=school" className="text-purple-600 text-sm font-medium hover:underline">Go to Settings →</Link>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* GALLERY TAB (Pin-Up Crits & Peer Review)                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "gallery" && (
        <GalleryTab unitId={unitId} classId={classId} unitPages={unitPages} />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* OPEN STUDIO TAB                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "studio" && (
        <div className="max-w-4xl space-y-6">
          {/* Open Studio Class View — unlock/revoke/status for all students */}
          <OpenStudioClassView unitId={unitId} classId={classId} />

          {/* Info card about Open Studio */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
            <h3 className="font-semibold text-violet-900 flex items-center gap-2 mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              About Open Studio
            </h3>
            <p className="text-sm text-violet-700 leading-relaxed mb-3">
              Open Studio gives students self-directed working time. When unlocked, the AI mentor switches from guided Socratic tutor to studio critic mode — asking deeper questions and encouraging independent decision-making.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-white/70 rounded-lg p-3 border border-violet-100">
                <div className="font-semibold text-violet-800 mb-1">Check-ins</div>
                <p className="text-violet-600 text-xs">Students receive periodic check-ins (configurable interval) to stay on track.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-violet-100">
                <div className="font-semibold text-violet-800 mb-1">Drift Detection</div>
                <p className="text-violet-600 text-xs">3-level escalation: gentle nudge → direct question → silent flag to you.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-violet-100">
                <div className="font-semibold text-violet-800 mb-1">Auto-Revocation</div>
                <p className="text-violet-600 text-xs">2 consecutive sessions with drift flags triggers automatic revocation.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* BADGES TAB                                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "badges" && (
        <BadgesTab
          unitId={unitId}
          classId={classId}
          students={students.map((s) => ({ id: s.id, display_name: s.display_name, username: s.username }))}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SETTINGS TAB                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <div className="max-w-3xl">
          {/* Term Assignment */}
          <div className="mb-6 bg-surface-alt rounded-xl p-4 border border-border">
            <label className="block text-xs font-semibold text-text-primary mb-2">Assign to Term</label>
            {terms.length === 0 ? (
              <div className="text-sm text-text-secondary">
                <p className="mb-2">No school calendar set up yet.</p>
                <Link href="/teacher/settings?tab=school" className="text-accent-blue text-xs font-medium hover:underline">Set up your school calendar →</Link>
              </div>
            ) : (
              <select value={selectedTermId || ""} onChange={(e) => handleTermChange(e.target.value || null)} disabled={savingTerm}
                className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50">
                <option value="">— No term assigned —</option>
                {Array.from(new Map(terms.map((t) => [t.academic_year, t])).keys()).map((year) => (
                  <optgroup key={year} label={year}>
                    {terms.filter((t) => t.academic_year === year).sort((a, b) => a.term_order - b.term_order).map((term) => (
                      <option key={term.id} value={term.id}>{term.term_name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            {termMessage && <p className={`mt-2 text-xs font-medium ${termMessage.includes("assigned") ? "text-accent-green" : "text-amber-600"}`}>{termMessage}</p>}
          </div>

          {/* Schedule Info */}
          {selectedTermId && (
            <div className="mb-6 bg-surface-alt rounded-xl p-4 border border-border">
              <h3 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Schedule
              </h3>
              {scheduleLoading ? (
                <div className="animate-pulse flex gap-4">
                  <div className="h-14 bg-gray-200 rounded-lg flex-1" />
                  <div className="h-14 bg-gray-200 rounded-lg flex-1" />
                </div>
              ) : scheduleInfo?.lessonCount != null ? (
                <div className="flex gap-3">
                  <div className="flex-1 bg-white rounded-lg p-3 border border-border">
                    <div className="text-2xl font-bold text-purple-600">{scheduleInfo.lessonCount}</div>
                    <div className="text-xs text-text-secondary mt-0.5">lessons this term</div>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-3 border border-border">
                    {scheduleInfo.nextClass ? (
                      <>
                        <div className="text-sm font-semibold text-text-primary">{scheduleInfo.nextClass.short}</div>
                        <div className="text-xs text-text-secondary mt-0.5">Next: {scheduleInfo.nextClass.dayOfWeek} {scheduleInfo.nextClass.dateISO}</div>
                        {scheduleInfo.nextClass.room && <div className="text-xs text-text-tertiary mt-0.5">Room {scheduleInfo.nextClass.room}</div>}
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-text-secondary">—</div>
                        <div className="text-xs text-text-tertiary mt-0.5">No upcoming classes</div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">
                  No timetable set up yet. <Link href="/teacher/settings?tab=school" className="text-purple-600 text-xs font-medium hover:underline">Set up your timetable →</Link>
                </p>
              )}
            </div>
          )}

          {/* Lesson Schedule */}
          {(() => {
            const term = terms.find((t) => t.id === selectedTermId) as any;
            return (
              <div className="mb-6">
                <LessonSchedule unitId={unitId} classId={classId} pages={pages} termStart={term?.start_date} termEnd={term?.end_date}
                  overrides={scheduleOverrides} onOverridesChange={setScheduleOverrides}
                  onSave={async (newOverrides) => {
                    const res = await fetch("/api/teacher/class-units", {
                      method: "PATCH", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ classId, unitId, schedule_overrides: newOverrides }),
                    });
                    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "Save failed"); }
                  }}
                />
              </div>
            );
          })()}

          {/* Class code */}
          {classCode && (
            <div className="mb-6 bg-surface-alt rounded-xl p-4 border border-border">
              <label className="block text-xs font-semibold text-text-primary mb-2">Class Code</label>
              <p className="text-lg font-mono font-bold text-purple-600">{classCode}</p>
              <p className="text-xs text-text-secondary mt-1">Students use this code to join this class.</p>
            </div>
          )}
        </div>
      )}

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
