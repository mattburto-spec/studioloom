"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NMConfigPanel, NMResultsPanel, ObservationSnap } from "@/components/nm";
import { CertManager } from "@/components/teacher/CertManager";
import { LessonSchedule } from "@/components/teacher/LessonSchedule";
import type { ScheduleOverrides } from "@/components/teacher/LessonSchedule";
import type { NMUnitConfig } from "@/lib/nm/constants";
import { DEFAULT_NM_CONFIG, AGENCY_ELEMENTS } from "@/lib/nm/constants";
import { getPageList } from "@/lib/unit-adapter";
import { getPageColor } from "@/lib/constants";
import type { Unit, UnitPage, UnitContentData, Student, StudentProgress } from "@/types";
import type { AssessmentRecordRow } from "@/types/assessment";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { OpenStudioUnlock, OpenStudioClassView } from "@/components/open-studio";
import { PaceFeedbackSummary } from "@/components/teacher/PaceFeedbackSummary";
import { getYearLevelNumber } from "@/lib/utils/year-level";
import StudentDrawer from "@/components/teacher/class-hub/StudentDrawer";

// ---------------------------------------------------------------------------
// Class Hub — Central teacher command centre for a class+unit
// ---------------------------------------------------------------------------
// Tabs: Progress (default) | Grade | Settings
// Student Drawer opens from any student name click.
// URL: /teacher/units/[unitId]/class/[classId]
// ---------------------------------------------------------------------------

type HubTab = "progress" | "grade" | "settings";

const TABS: { id: HubTab; label: string; icon: string }[] = [
  { id: "progress", label: "Progress", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "grade", label: "Grade", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { id: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
];

// ---------------------------------------------------------------------------
// Progress tab types
// ---------------------------------------------------------------------------

interface ProgressCell {
  status: "not_started" | "in_progress" | "complete";
  hasResponses: boolean;
  timeSpent: number;
}

type GradingStatus = "ungraded" | "draft" | "published";
type StudentProgressMap = Record<string, Record<string, ProgressCell>>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
      if (tab === "progress" || tab === "grade" || tab === "settings") return tab;
    }
    return "progress";
  });

  // Shared data (loaded once)
  const [unit, setUnit] = useState<Unit | null>(null);
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
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
  const [openStudioStatuses, setOpenStudioStatuses] = useState<Record<string, { unlocked_at: string | null }>>({});
  const [badgeRequirements, setBadgeRequirements] = useState<Array<{ badge_id: string; badge_name: string; badge_slug: string; is_required: boolean }>>([]);
  const [badgeStatusMap, setBadgeStatusMap] = useState<Record<string, Array<{ badge_id: string; status: "earned" | "failed" | "not_attempted"; score: number | null }>>>({});
  const [selectedDetailStudent, setSelectedDetailStudent] = useState<{ id: string; name: string } | null>(null);
  const [selectedDetailPage, setSelectedDetailPage] = useState<string | null>(null);
  const [detailResponses, setDetailResponses] = useState<Record<string, string> | null>(null);
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
        supabase.from("classes").select("name, code").eq("id", classId).single(),
        supabase.from("class_students").select("student_id, students(id, display_name, username, graduation_year)").eq("class_id", classId).eq("is_active", true),
        supabase.from("class_units").select("term_id, schedule_overrides, content_data, forked_at, forked_from_version, nm_config").eq("class_id", classId).eq("unit_id", unitId).single(),
        fetch("/api/teacher/school-calendar").then((r) => (r.ok ? r.json() : Promise.resolve({ terms: [] }))),
      ]);

      setUnit(unitRes.data);
      setClassName(classRes.data?.name || "");
      setClassCode(classRes.data?.code || "");

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
        map[p.student_id][p.page_id] = {
          status: p.status as "not_started" | "in_progress" | "complete",
          hasResponses: p.responses !== null && typeof p.responses === "object" && Object.keys(p.responses as Record<string, unknown>).length > 0,
          timeSpent: p.time_spent || 0,
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

    // Open Studio statuses
    try {
      const osRes = await fetch(`/api/teacher/open-studio/status?unitId=${unitId}&classId=${classId}`);
      if (osRes.ok) {
        const data = await osRes.json();
        const statusMap: Record<string, { unlocked_at: string | null }> = {};
        for (const row of data.students || []) {
          if (row.openStudio?.status === "unlocked") {
            statusMap[row.student.id] = { unlocked_at: row.openStudio.unlocked_at };
          }
        }
        setOpenStudioStatuses(statusMap);
      }
    } catch { /* non-critical */ }

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

    const supabase = createClient();
    const { data } = await supabase
      .from("student_progress")
      .select("responses")
      .eq("student_id", student.id)
      .eq("unit_id", unitId)
      .eq("page_id", pageId)
      .single();

    setDetailResponses((data?.responses as Record<string, string>) || {});
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
        <Link href={`/teacher/units/${unitId}`} className="hover:text-text-primary transition truncate max-w-[200px]">{unit.title}</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="text-text-primary font-medium">{className}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-sm font-bold flex-shrink-0">
              {className.charAt(0).toUpperCase()}
            </div>
            {className}
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {unit.title} · {students.length} student{students.length !== 1 ? "s" : ""} · {pages.length} page{pages.length !== 1 ? "s" : ""}
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
                                    const ylNum = getYearLevelNumber(student.graduation_year ?? null);
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
                                <OpenStudioUnlock
                                  studentId={student.id}
                                  studentName={studentName}
                                  classId={classId}
                                  unitId={unitId}
                                  unlocked={!!openStudioStatuses[student.id]}
                                  unlockedAt={openStudioStatuses[student.id]?.unlocked_at}
                                  onUnlocked={() => {
                                    setOpenStudioStatuses((prev) => ({
                                      ...prev,
                                      [student.id]: { unlocked_at: new Date().toISOString() },
                                    }));
                                  }}
                                />
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
                                  <button
                                    onClick={() => loadStudentDetail({ id: student.id, name: studentName }, page.id)}
                                    className={`w-7 h-7 rounded text-xs font-medium transition hover:scale-110 ${getStatusColor(cell?.status)}`}
                                    title={`${studentName} - ${page.id}: ${cell?.status || "not_started"}`}
                                  >
                                    {getStatusIcon(cell?.status)}
                                  </button>
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

              {/* Open Studio Management */}
              <div className="mt-6">
                <OpenStudioClassView unitId={unitId} classId={classId} />
              </div>
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
                  <button onClick={() => { setSelectedDetailStudent(null); setSelectedDetailPage(null); setDetailResponses(null); }} className="w-8 h-8 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-secondary">✕</button>
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
                        return Object.entries(detailResponses).map(([key, value]) => {
                          let label = key;
                          if (key.startsWith("section_")) { const idx = parseInt(key.replace("section_", "")); label = sections[idx]?.prompt || `Section ${idx + 1}`; }
                          else if (key.startsWith("check_")) { const idx = parseInt(key.replace("check_", "")); label = page?.reflection?.items?.[idx] || `Checklist item ${idx + 1}`; }
                          else if (key.startsWith("reflection_")) { label = `Reflection ${parseInt(key.replace("reflection_", "")) + 1}`; }
                          else if (key === "freeform") { label = "Freeform notes"; }
                          return (
                            <div key={key}>
                              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">{label}</p>
                              <div className="bg-surface-alt rounded-lg p-3">
                                <p className="text-sm text-text-primary whitespace-pre-wrap">{value === "true" ? "✓ Checked" : value === "false" ? "☐ Not checked" : value || "—"}</p>
                              </div>
                            </div>
                          );
                        });
                      })()}
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
          <div className="bg-white rounded-xl border border-border p-6 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h3 className="font-semibold text-text-primary mb-1">Grading</h3>
            <p className="text-sm text-text-secondary mb-4">
              Review student submissions and assess against MYP criteria.
            </p>
            <Link
              href={`/teacher/classes/${classId}/grading/${unitId}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open Grading View
            </Link>
          </div>
        </div>
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

          {/* NM Config & Results */}
          {globalNmEnabled ? (
            <>
              <div className="mb-6">
                <NMConfigPanel unitId={unitId} classId={classId} pages={pages} currentConfig={nmConfig}
                  onSave={async (config) => {
                    const res = await fetch("/api/teacher/nm-config", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ unitId, classId, config }),
                    });
                    if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.error || "Save failed"); }
                    setNmConfig(config);
                  }}
                />
              </div>
              {nmConfig.enabled && <div className="mb-6"><NMResultsPanel unitId={unitId} classId={classId} /></div>}
            </>
          ) : (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-border text-sm text-text-secondary">
              New Metrics is turned off. Enable it in <a href="/teacher/settings?tab=school" className="text-purple-600 underline">Settings → School &amp; Teaching</a> to configure competency assessments.
            </div>
          )}

          {/* Safety */}
          <div className="space-y-6">
            <CertManager classId={classId} students={students.map((s) => ({ student_id: s.id, display_name: s.display_name, username: s.username }))} />
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Safety Badge Library
                </h3>
                <p className="text-sm text-gray-500 mt-1">Create new badges, edit questions, and manage unit requirements.</p>
              </div>
              <Link href="/teacher/safety" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-700 font-medium text-sm hover:bg-amber-100 transition shrink-0">
                Manage Badges
              </Link>
            </div>
          </div>
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
