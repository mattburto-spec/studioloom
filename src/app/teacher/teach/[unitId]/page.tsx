"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPageList, normalizeContentData, isV3, isV4 } from "@/lib/unit-adapter";
import { computeLessonBoundaries } from "@/lib/timeline";
import PhaseTimer from "@/components/teach/PhaseTimer";
import { ObservationSnap } from "@/components/nm";
import { AGENCY_ELEMENT_MAP } from "@/lib/nm/constants";
import type { NMUnitConfig } from "@/lib/nm/constants";
import type {
  Unit, UnitPage, UnitContentDataV4, TimelineActivity,
  ComputedLesson, WorkshopPhases, LessonExtension, PageContent,
} from "@/types";

// =========================================================================
// Types
// =========================================================================

interface StudentLiveStatus {
  id: string;
  name: string;
  avatar: string | null;
  ellLevel: string;
  isOnline: boolean;
  status: "not_started" | "in_progress" | "complete";
  timeSpent: number;
  lastActive: string | null;
  responseCount: number;
  completionPct: number;
  needsHelp: boolean;
}

interface LiveSummary {
  total: number;
  notStarted: number;
  inProgress: number;
  complete: number;
  avgTimeSpent: number;
  needsHelpCount: number;
  onlineCount: number;
}

type PhaseId = "opening" | "miniLesson" | "workTime" | "debrief";

// =========================================================================
// Status helpers
// =========================================================================

const STATUS_CONFIG = {
  not_started: { label: "Not Started", color: "#9CA3AF", bg: "#F3F4F6", ring: "#D1D5DB" },
  in_progress: { label: "Working", color: "#2563EB", bg: "#DBEAFE", ring: "#93C5FD" },
  complete: { label: "Done", color: "#16A34A", bg: "#DCFCE7", ring: "#86EFAC" },
};

function timeSince(dateStr: string | null): string {
  if (!dateStr) return "—";
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// =========================================================================
// Main page
// =========================================================================

export default function TeachingDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ classId?: string }>;
}) {
  const { unitId } = use(params);
  const { classId: initialClassId } = use(searchParams);

  // Data
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);

  // Teaching state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(initialClassId || null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<PhaseId>("opening");

  // Live status (polled)
  const [students, setStudents] = useState<StudentLiveStatus[]>([]);
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const [showNotes, setShowNotes] = useState(true);
  const [showExtensions, setShowExtensions] = useState(false);
  const [studentSort, setStudentSort] = useState<"name" | "status" | "help">("help");

  // NM Observation state
  const [nmObsStudent, setNmObsStudent] = useState<{ id: string; name: string } | null>(null);

  // -----------------------------------------------------------------------
  // Load unit + classes
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [unitRes, classesRes] = await Promise.all([
        supabase.from("units").select("*").eq("id", unitId).single(),
        supabase
          .from("class_units")
          .select("class_id, classes(id, name, code)")
          .eq("unit_id", unitId),
      ]);

      setUnit(unitRes.data);

      const classList = (classesRes.data || [])
        .map((cu: Record<string, unknown>) => cu.classes as { id: string; name: string; code: string } | null)
        .filter((c): c is { id: string; name: string; code: string } => c !== null);

      setClasses(classList);
      if (classList.length > 0 && !initialClassId) {
        setSelectedClassId(classList[0].id);
      }

      // Default to first page
      if (unitRes.data) {
        const pages = getPageList(unitRes.data.content_data);
        if (pages.length > 0) {
          setSelectedPageId(pages[0].id);
        }
      }

      setLoading(false);
    }
    load();
  }, [unitId]);

  // -----------------------------------------------------------------------
  // Poll live status
  // -----------------------------------------------------------------------
  const fetchLiveStatus = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      const url = `/api/teacher/teach/live-status?classId=${selectedClassId}&unitId=${unitId}${
        selectedPageId ? `&pageId=${selectedPageId}` : ""
      }`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
        setSummary(data.summary || null);
      }
    } catch {
      // Silently fail — will retry next poll
    }
  }, [selectedClassId, unitId, selectedPageId]);

  useEffect(() => {
    fetchLiveStatus();
    pollRef.current = setInterval(fetchLiveStatus, 8000); // Poll every 8s
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchLiveStatus]);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 font-medium">Loading lesson...</p>
        </div>
      </main>
    );
  }

  if (!unit) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Unit not found.</p>
          <Link href="/teacher/units" className="text-blue-600 text-sm mt-2 inline-block">← Back to units</Link>
        </div>
      </main>
    );
  }

  const pages = getPageList(unit.content_data);
  const normalized = normalizeContentData(unit.content_data);
  const isTimeline = isV4(normalized);

  let lessons: ComputedLesson[] = [];
  const activityMap = new Map<string, TimelineActivity>();
  if (isTimeline) {
    const v4 = normalized as UnitContentDataV4;
    lessons = computeLessonBoundaries(v4.timeline, v4.lessonLengthMinutes);
    v4.timeline.forEach((a) => activityMap.set(a.id, a));
  }

  // Current page data
  const currentPage = pages.find((p) => p.id === selectedPageId);
  const currentContent: PageContent | null = currentPage?.content || null;
  const workshopPhases: WorkshopPhases | null = currentContent?.workshopPhases || null;
  const extensions: LessonExtension[] = currentContent?.extensions || [];

  // Teacher notes from activities (v4) or sections
  const teacherNotes: string[] = [];
  if (isTimeline && selectedPageId) {
    const lesson = lessons.find((l) => l.lessonId === selectedPageId);
    if (lesson) {
      lesson.activityIds.forEach((aid) => {
        const act = activityMap.get(aid);
        if (act?.teacherNotes) teacherNotes.push(act.teacherNotes);
      });
    }
  }

  // Sort students
  const sortedStudents = [...students].sort((a, b) => {
    if (studentSort === "help") {
      if (a.needsHelp && !b.needsHelp) return -1;
      if (!a.needsHelp && b.needsHelp) return 1;
      const statusOrder = { not_started: 0, in_progress: 1, complete: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    }
    if (studentSort === "status") {
      const statusOrder = { complete: 0, in_progress: 1, not_started: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.name.localeCompare(b.name);
  });

  const needsHelpStudents = students.filter((s) => s.needsHelp);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-gray-50">
      {/* ================================================================= */}
      {/* TOP BAR — lesson title, class selector, projector button          */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center gap-4">
          {/* Back */}
          <Link
            href={`/teacher/units/${unitId}`}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 truncate">
              {unit.title}
            </h1>
            <p className="text-[10px] text-gray-400 font-medium">
              Teaching Mode {currentPage ? `— ${currentPage.title}` : ""}
            </p>
          </div>

          {/* Class selector */}
          {classes.length > 0 && (
            <select
              value={selectedClassId || ""}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs font-medium bg-gray-100 border-0 rounded-lg px-3 py-2 text-gray-700"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}

          {/* Live indicator */}
          {summary && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-green-700">
                {summary.onlineCount} online
              </span>
            </div>
          )}

          {/* Projector view button */}
          <button
            onClick={() => {
              const url = `/teacher/teach/${unitId}/projector${selectedPageId ? `?pageId=${selectedPageId}` : ""}`;
              window.open(url, "studioloom-projector", "width=1280,height=720");
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Open Projector
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MAIN CONTENT — 3-column layout                                    */}
      {/* ================================================================= */}
      <div className="max-w-[1600px] mx-auto px-4 py-4 grid grid-cols-[240px_1fr_320px] gap-4 min-h-[calc(100vh-64px)]">

        {/* ============================================================= */}
        {/* LEFT SIDEBAR — Lesson navigator                                */}
        {/* ============================================================= */}
        <aside className="space-y-3 overflow-y-auto max-h-[calc(100vh-96px)] pr-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
            Lessons
          </p>
          {pages.map((page, i) => {
            const isActive = page.id === selectedPageId;
            const hasPhases = !!page.content?.workshopPhases;
            return (
              <button
                key={page.id}
                onClick={() => setSelectedPageId(page.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all ${
                  isActive
                    ? "bg-white border border-purple-200 shadow-sm text-gray-900 font-bold"
                    : "text-gray-600 hover:bg-white hover:shadow-sm border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono w-5">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="truncate flex-1">{page.title}</span>
                </div>
                {hasPhases && (
                  <div className="flex gap-0.5 mt-1.5 ml-7">
                    {(["opening", "miniLesson", "workTime", "debrief"] as const).map((phase) => {
                      const dur = page.content?.workshopPhases?.[phase]?.durationMinutes || 0;
                      const colors: Record<string, string> = {
                        opening: "#7C3AED", miniLesson: "#2563EB",
                        workTime: "#16A34A", debrief: "#D97706",
                      };
                      return (
                        <div
                          key={phase}
                          className="h-1 rounded-full"
                          style={{
                            flex: dur,
                            background: colors[phase],
                            opacity: 0.4,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </aside>

        {/* ============================================================= */}
        {/* CENTER — Timer + Student grid                                   */}
        {/* ============================================================= */}
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-96px)]">

          {/* Phase Timer */}
          {workshopPhases ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <PhaseTimer
                workshopPhases={workshopPhases}
                onPhaseChange={(phase) => setCurrentPhase(phase)}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm text-center">
              <p className="text-sm text-gray-400">
                No Workshop Model timing for this lesson.
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Regenerate this lesson to add timing phases.
              </p>
            </div>
          )}

          {/* Needs Help Alert */}
          {needsHelpStudents.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
              <span className="text-lg">🖐</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-800">
                  {needsHelpStudents.length} student{needsHelpStudents.length > 1 ? "s" : ""} may need help
                </p>
                <p className="text-[10px] text-amber-600">
                  No activity for 3+ minutes while marked as working:
                  {" "}{needsHelpStudents.map((s) => s.name).join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Summary bar */}
          {summary && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Not Started", value: summary.notStarted, color: "#9CA3AF", bg: "#F3F4F6" },
                { label: "Working", value: summary.inProgress, color: "#2563EB", bg: "#DBEAFE" },
                { label: "Complete", value: summary.complete, color: "#16A34A", bg: "#DCFCE7" },
                { label: "Need Help", value: summary.needsHelpCount, color: "#D97706", bg: "#FEF3C7" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: item.bg }}
                >
                  <div className="text-2xl font-black" style={{ color: item.color }}>
                    {item.value}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: item.color, opacity: 0.7 }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Student grid */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Sort bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-1">
                Students ({students.length})
              </p>
              <div className="flex gap-1">
                {(["help", "status", "name"] as const).map((sort) => (
                  <button
                    key={sort}
                    onClick={() => setStudentSort(sort)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                      studentSort === sort
                        ? "bg-purple-100 text-purple-700"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {sort === "help" ? "Needs Help" : sort === "status" ? "Status" : "Name"}
                  </button>
                ))}
              </div>
            </div>

            {/* Student rows */}
            <div className="divide-y divide-gray-50">
              {sortedStudents.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  {selectedClassId
                    ? "No students in this class yet."
                    : "Select a class to see students."}
                </div>
              ) : (
                sortedStudents.map((s) => {
                  const config = STATUS_CONFIG[s.status];
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 px-4 py-3 transition ${
                        s.needsHelp ? "bg-amber-50/50" : "hover:bg-gray-50/50"
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: config.color }}
                        >
                          {s.avatar ? (
                            <img src={s.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            s.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        {/* Online dot */}
                        {s.isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                        )}
                      </div>

                      {/* Name + ELL badge */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-gray-900 truncate">
                            {s.name}
                          </span>
                          {s.needsHelp && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-700">
                              HELP?
                            </span>
                          )}
                          {s.ellLevel && s.ellLevel !== "none" && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 text-blue-500">
                              ELL{String(s.ellLevel).replace(/ell/i, "")}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {s.responseCount > 0 ? `${s.responseCount} responses` : "No responses yet"}
                          {s.lastActive ? ` · ${timeSince(s.lastActive)}` : ""}
                        </p>
                      </div>

                      {/* Status pill */}
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                        style={{ background: config.bg, color: config.color }}
                      >
                        {config.label}
                      </span>

                      {/* NM Observation button */}
                      {(unit?.nm_config as NMUnitConfig | null)?.enabled && (
                        <button
                          onClick={() => setNmObsStudent({ id: s.id, name: s.name })}
                          title={`NM Observation for ${s.name}`}
                          style={{
                            width: "26px", height: "26px", borderRadius: "6px",
                            border: "2px solid #1a1a1a", background: "#FF2D78",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", boxShadow: "1px 1px 0 #1a1a1a",
                            fontSize: "8px", fontWeight: 900, color: "#fff",
                            fontFamily: "'Arial Black', sans-serif",
                            flexShrink: 0, transition: "transform 0.1s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        >
                          NM
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* RIGHT SIDEBAR — Notes, extensions, lesson content              */}
        {/* ============================================================= */}
        <aside className="space-y-3 overflow-y-auto max-h-[calc(100vh-96px)]">

          {/* Teacher Notes */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-xs font-bold text-gray-700">📋 Teaching Notes</span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" className={`transition ${showNotes ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showNotes && (
              <div className="px-4 pb-4 space-y-2">
                {/* Learning goal */}
                {currentContent?.learningGoal && (
                  <div className="bg-purple-50 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-0.5">
                      Learning Goal
                    </p>
                    <p className="text-xs text-purple-800 leading-relaxed">
                      {currentContent.learningGoal}
                    </p>
                  </div>
                )}

                {/* Opening hook */}
                {workshopPhases?.opening?.hook && (
                  <div className="bg-violet-50 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-0.5">
                      Opening Hook
                    </p>
                    <p className="text-xs text-violet-800 leading-relaxed">
                      {workshopPhases.opening.hook}
                    </p>
                  </div>
                )}

                {/* Mini-lesson focus */}
                {workshopPhases?.miniLesson?.focus && (
                  <div className="bg-blue-50 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">
                      Mini-Lesson Focus
                    </p>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      {workshopPhases.miniLesson.focus}
                    </p>
                  </div>
                )}

                {/* Debrief protocol */}
                {(workshopPhases?.debrief?.protocol || workshopPhases?.debrief?.prompt) && (
                  <div className="bg-amber-50 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">
                      Debrief Protocol
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      {workshopPhases.debrief.protocol || workshopPhases.debrief.prompt}
                    </p>
                  </div>
                )}

                {/* Activity-level teacher notes (v4) */}
                {teacherNotes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      Activity Notes
                    </p>
                    {teacherNotes.map((note, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-700 leading-relaxed">{note}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Key vocab */}
                {currentContent?.vocabWarmup?.terms && currentContent.vocabWarmup.terms.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      Key Vocabulary
                    </p>
                    {currentContent.vocabWarmup.terms.map((term, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="font-semibold text-gray-800">{term.term}:</span>
                        <span className="text-gray-600">{term.definition}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!currentContent?.learningGoal && !workshopPhases && teacherNotes.length === 0 && (
                  <p className="text-xs text-gray-400 py-2">
                    No teaching notes for this lesson. Notes are generated when lessons include Workshop Model timing.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Extensions (for early finishers) */}
          {extensions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowExtensions(!showExtensions)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-xs font-bold text-gray-700">
                  🚀 Extensions ({extensions.length})
                </span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" className={`transition ${showExtensions ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showExtensions && (
                <div className="px-4 pb-4 space-y-2">
                  {extensions.map((ext, i) => (
                    <div key={i} className="bg-emerald-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-emerald-800">{ext.title}</span>
                        <span className="text-[10px] text-emerald-600 font-mono">
                          ~{ext.durationMinutes}m
                        </span>
                      </div>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        {ext.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Lesson sections preview */}
          {currentContent?.sections && currentContent.sections.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3">
                <span className="text-xs font-bold text-gray-700">📝 Lesson Activities</span>
              </div>
              <div className="px-4 pb-4 space-y-1.5">
                {currentContent.sections.map((section, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-gray-300 font-mono mt-0.5 w-4 text-right">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-gray-700 leading-relaxed line-clamp-2">
                        {section.prompt}
                      </p>
                      <div className="flex gap-1.5 mt-0.5">
                        {section.responseType && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                            {section.responseType}
                          </span>
                        )}
                        {section.durationMinutes && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                            ~{section.durationMinutes}m
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* NM Observation Snap Modal */}
      {nmObsStudent && unit?.nm_config && (unit.nm_config as NMUnitConfig).enabled && (() => {
        const nmCfg = unit.nm_config as NMUnitConfig;
        const nmElements = (nmCfg.elements || [])
          .map((eid: string) => AGENCY_ELEMENT_MAP[eid])
          .filter(Boolean);
        if (nmElements.length === 0) return null;
        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              background: "rgba(0,0,0,0.5)", display: "flex",
              alignItems: "center", justifyContent: "center",
              padding: "20px",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setNmObsStudent(null); }}
          >
            <div style={{ maxWidth: "520px", width: "100%" }}>
              <ObservationSnap
                studentId={nmObsStudent.id}
                studentName={nmObsStudent.name}
                unitId={unitId}
                elements={nmElements}
                onComplete={() => setNmObsStudent(null)}
                onClose={() => setNmObsStudent(null)}
              />
            </div>
          </div>
        );
      })()}
    </main>
  );
}
