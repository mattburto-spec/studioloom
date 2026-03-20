"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPageList, normalizeContentData, isV3, isV4 } from "@/lib/unit-adapter";
import { computeLessonBoundaries } from "@/lib/timeline";
import PhaseTimer from "@/components/teach/PhaseTimer";
import TeachingToolbar from "@/components/teach/TeachingToolbar";
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
  not_started: { label: "Not Started", color: "#9CA3AF", bg: "#1F1F2E", ring: "#2A2A3E" },
  in_progress: { label: "Working", color: "#3B82F6", bg: "#1E293B", ring: "#334155" },
  complete: { label: "Done", color: "#10B981", bg: "#1E3A2F", ring: "#2D5447" },
};

const PHASE_COLORS: Record<PhaseId, string> = {
  opening: "#7C3AED",
  miniLesson: "#2563EB",
  workTime: "#10B981",
  debrief: "#F59E0B",
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
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState<number>(0);

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
  const [classNmConfig, setClassNmConfig] = useState<NMUnitConfig | null>(null);

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
  // Load class-specific NM config when class selection changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!selectedClassId || !unit) {
      setClassNmConfig(null);
      return;
    }
    async function loadClassNm() {
      try {
        const res = await fetch(`/api/teacher/nm-config?unitId=${unitId}&classId=${selectedClassId}`);
        if (res.ok) {
          const data = await res.json();
          setClassNmConfig(data.config || null);
        }
      } catch {
        // Fallback to unit-level
        setClassNmConfig(null);
      }
    }
    loadClassNm();
  }, [selectedClassId, unitId, unit]);

  // Resolved NM config: class-specific if available, otherwise unit-level
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolvedNmConfig = classNmConfig || ((unit as any)?.nm_config as NMUnitConfig | null) || null;

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
      <main style={{ minHeight: "100vh", background: "#0D0D17", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px", height: "48px", border: "4px solid rgba(139, 92, 246, 0.2)",
            borderTop: "4px solid #8B5CF6", borderRadius: "50%", margin: "0 auto",
            animation: "spin 1s linear infinite"
          }} />
          <p style={{ fontSize: "14px", color: "#9CA3AF", fontWeight: 500, marginTop: "12px" }}>Loading lesson...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  if (!unit) {
    return (
      <main style={{ minHeight: "100vh", background: "#0D0D17", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#9CA3AF" }}>Unit not found.</p>
          <Link href="/teacher/units" style={{ color: "#3B82F6", fontSize: "14px", marginTop: "8px", display: "inline-block" }}>
            ← Back to units
          </Link>
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
    <main style={{ minHeight: "100vh", background: "#0D0D17" }}>
      {/* ================================================================= */}
      {/* TOP BAR — Dark frosted glass header with unit title + controls     */}
      {/* ================================================================= */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(13, 13, 23, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          padding: "16px",
        }}
      >
        <div style={{ maxWidth: "1600px", margin: "0 auto", display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Back button */}
          <Link
            href={`/teacher/units/${unitId}`}
            style={{
              color: "#6B7280", transition: "color 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "24px", height: "24px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#9CA3AF")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6B7280")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>

          {/* Title section */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#F3F4F6", margin: 0, marginBottom: "4px" }}>
              {unit.title}
            </h1>
            <p style={{ fontSize: "11px", color: "#6B7280", fontWeight: 500, margin: 0 }}>
              Teaching Mode {currentPage ? `— ${currentPage.title}` : ""}
            </p>
          </div>

          {/* Class selector — dark glass dropdown */}
          {classes.length > 0 && (
            <select
              value={selectedClassId || ""}
              onChange={(e) => setSelectedClassId(e.target.value)}
              style={{
                fontSize: "13px", fontWeight: 600, color: "#F3F4F6",
                background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px", padding: "8px 12px",
                cursor: "pointer", transition: "all 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
              }}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id} style={{ background: "#1F1F2E", color: "#F3F4F6" }}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}

          {/* Live indicator pulse */}
          {summary && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "6px 12px", borderRadius: "20px",
              background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)",
            }}>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: "#10B981", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#10B981" }}>
                {summary.onlineCount} online
              </span>
              <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
            </div>
          )}

          {/* Projector button */}
          <button
            onClick={() => {
              const url = `/teacher/teach/${unitId}/projector${selectedPageId ? `?pageId=${selectedPageId}` : ""}`;
              window.open(url, "studioloom-projector", "width=1280,height=720");
            }}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 16px", borderRadius: "8px",
              background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.3)",
              color: "#C4B5FD", fontSize: "12px", fontWeight: 700,
              cursor: "pointer", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(139, 92, 246, 0.25)";
              e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(139, 92, 246, 0.15)";
              e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Projector
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MAIN CONTENT — 3-column dark glass layout                         */}
      {/* ================================================================= */}
      <div style={{
        maxWidth: "1600px", margin: "0 auto", padding: "16px",
        display: "grid", gridTemplateColumns: "240px 1fr 320px", gap: "16px",
        minHeight: "calc(100vh - 80px)", paddingBottom: "80px",
      }}>

        {/* ============================================================= */}
        {/* LEFT SIDEBAR — Dark glass lesson navigator with glow borders  */}
        {/* ============================================================= */}
        <aside style={{
          display: "flex", flexDirection: "column", gap: "12px",
          overflowY: "auto", maxHeight: "calc(100vh - 112px)", paddingRight: "8px",
        }}>
          <p style={{ fontSize: "9px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0", padding: "0 8px" }}>
            Lessons
          </p>
          {pages.map((page, i) => {
            const isActive = page.id === selectedPageId;
            const hasPhases = !!page.content?.workshopPhases;
            return (
              <button
                key={page.id}
                onClick={() => setSelectedPageId(page.id)}
                style={{
                  width: "100%", textAlign: "left", padding: "12px",
                  borderRadius: "10px", fontSize: "12px", transition: "all 0.2s",
                  border: isActive ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid rgba(255, 255, 255, 0.05)",
                  background: isActive ? "rgba(139, 92, 246, 0.1)" : "rgba(255, 255, 255, 0.02)",
                  color: isActive ? "#F3F4F6" : "#9CA3AF",
                  fontWeight: isActive ? 700 : 500,
                  boxShadow: isActive ? "inset 0 0 16px rgba(139, 92, 246, 0.1)" : "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "9px", color: "#4B5563", fontFamily: "'Monaco', 'Courier New', monospace", width: "20px" }}>
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {page.title}
                  </span>
                </div>
                {hasPhases && (
                  <div style={{ display: "flex", gap: "2px", marginTop: "8px", marginLeft: "28px" }}>
                    {(["opening", "miniLesson", "workTime", "debrief"] as const).map((phase) => {
                      const dur = page.content?.workshopPhases?.[phase]?.durationMinutes || 0;
                      return (
                        <div
                          key={phase}
                          style={{
                            height: "3px", borderRadius: "2px",
                            flex: dur,
                            background: PHASE_COLORS[phase],
                            opacity: 0.5,
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
        {/* CENTER — Phase Timer + Student monitoring grid                */}
        {/* ============================================================= */}
        <div style={{
          display: "flex", flexDirection: "column", gap: "16px",
          overflowY: "auto", maxHeight: "calc(100vh - 112px)",
        }}>

          {/* Phase Timer — dark glass with gradient border */}
          {workshopPhases ? (
            <div style={{
              borderRadius: "16px", padding: "20px",
              background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(139, 92, 246, 0.2)",
              boxShadow: "0 0 32px rgba(139, 92, 246, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.05)",
            }}>
              <PhaseTimer
                workshopPhases={workshopPhases}
                onPhaseChange={(phase) => setCurrentPhase(phase)}
              />
            </div>
          ) : (
            <div style={{
              borderRadius: "16px", padding: "20px", textAlign: "center",
              background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)",
            }}>
              <p style={{ fontSize: "13px", color: "#9CA3AF", margin: 0 }}>
                No Workshop Model timing for this lesson.
              </p>
              <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "8px", margin: 0 }}>
                Regenerate this lesson to add timing phases.
              </p>
            </div>
          )}

          {/* Needs Help Alert — amber glow */}
          {needsHelpStudents.length > 0 && (
            <div style={{
              borderRadius: "12px", padding: "12px", display: "flex", gap: "12px",
              background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)",
            }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>🖐</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#F59E0B", margin: 0, marginBottom: "4px" }}>
                  {needsHelpStudents.length} student{needsHelpStudents.length > 1 ? "s" : ""} may need help
                </p>
                <p style={{ fontSize: "11px", color: "#D97706", margin: 0 }}>
                  No activity for 3+ minutes: {needsHelpStudents.map((s) => s.name).join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* KPI Summary — elegant dark pills */}
          {summary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
              {[
                { label: "Not Started", value: summary.notStarted, color: "#9CA3AF", bgColor: "rgba(156, 163, 175, 0.08)" },
                { label: "Working", value: summary.inProgress, color: "#3B82F6", bgColor: "rgba(59, 130, 246, 0.08)" },
                { label: "Complete", value: summary.complete, color: "#10B981", bgColor: "rgba(16, 185, 129, 0.08)" },
                { label: "Need Help", value: summary.needsHelpCount, color: "#F59E0B", bgColor: "rgba(245, 158, 11, 0.08)" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderRadius: "12px", padding: "12px", textAlign: "center",
                    background: item.bgColor, border: `1px solid rgba(${
                      item.label === "Working" ? "59, 130, 246" :
                      item.label === "Complete" ? "16, 185, 129" :
                      item.label === "Need Help" ? "245, 158, 11" :
                      "156, 163, 175"
                    }, 0.2)`,
                  }}
                >
                  <div style={{ fontSize: "24px", fontWeight: 900, color: item.color }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: item.color, opacity: 0.7, marginTop: "4px" }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Student Grid — dark glass cards */}
          <div style={{
            borderRadius: "16px", overflow: "hidden",
            background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)",
          }}>
            {/* Header bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "12px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              background: "rgba(255, 255, 255, 0.02)",
            }}>
              <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B7280", flex: 1, margin: 0 }}>
                Students ({students.length})
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["help", "status", "name"] as const).map((sort) => (
                  <button
                    key={sort}
                    onClick={() => setStudentSort(sort)}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                      transition: "all 0.2s", border: "none", cursor: "pointer",
                      background: studentSort === sort ? "rgba(139, 92, 246, 0.2)" : "transparent",
                      color: studentSort === sort ? "#C4B5FD" : "#6B7280",
                    }}
                    onMouseEnter={(e) => {
                      if (studentSort !== sort) e.currentTarget.style.color = "#9CA3AF";
                    }}
                    onMouseLeave={(e) => {
                      if (studentSort !== sort) e.currentTarget.style.color = "#6B7280";
                    }}
                  >
                    {sort === "help" ? "Needs Help" : sort === "status" ? "Status" : "Name"}
                  </button>
                ))}
              </div>
            </div>

            {/* Student rows */}
            <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
              {sortedStudents.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "#6B7280", fontSize: "13px" }}>
                  {selectedClassId ? "No students in this class yet." : "Select a class to see students."}
                </div>
              ) : (
                sortedStudents.map((s) => {
                  const config = STATUS_CONFIG[s.status];
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                        background: s.needsHelp ? "rgba(245, 158, 11, 0.05)" : "transparent",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (!s.needsHelp) e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                      }}
                      onMouseLeave={(e) => {
                        if (!s.needsHelp) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {/* Avatar */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div
                          style={{
                            width: "32px", height: "32px", borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "11px", fontWeight: 700, color: "#FFF",
                            background: config.color,
                            border: `2px solid ${config.ring}`,
                          }}
                        >
                          {s.avatar ? (
                            <img src={s.avatar} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            s.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        {s.isOnline && (
                          <span style={{
                            position: "absolute", bottom: "-2px", right: "-2px",
                            width: "12px", height: "12px", borderRadius: "50%",
                            background: "#10B981", border: "2px solid #0D0D17"
                          }} />
                        )}
                      </div>

                      {/* Name + badges */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#F3F4F6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {s.name}
                          </span>
                          {s.needsHelp && (
                            <span style={{
                              padding: "2px 8px", borderRadius: "4px",
                              fontSize: "7px", fontWeight: 700, color: "#F59E0B",
                              background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)"
                            }}>
                              HELP?
                            </span>
                          )}
                          {s.ellLevel && s.ellLevel !== "none" && (
                            <span style={{
                              padding: "2px 8px", borderRadius: "4px",
                              fontSize: "7px", fontWeight: 700, color: "#3B82F6",
                              background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)"
                            }}>
                              ELL{String(s.ellLevel).replace(/ell/i, "")}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: "10px", color: "#6B7280", margin: 0 }}>
                          {s.responseCount > 0 ? `${s.responseCount} responses` : "No responses yet"}
                          {s.lastActive ? ` · ${timeSince(s.lastActive)}` : ""}
                        </p>
                      </div>

                      {/* Status badge */}
                      <span style={{
                        padding: "4px 12px", borderRadius: "12px",
                        fontSize: "10px", fontWeight: 700,
                        background: config.bg, color: config.color,
                        whiteSpace: "nowrap",
                      }}>
                        {config.label}
                      </span>

                      {/* NM button */}
                      {resolvedNmConfig?.enabled && (
                        <button
                          onClick={() => setNmObsStudent({ id: s.id, name: s.name })}
                          title={`NM Observation for ${s.name}`}
                          style={{
                            width: "28px", height: "28px", borderRadius: "6px",
                            border: "2px solid #1a1a1a", background: "#FF2D78",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", boxShadow: "2px 2px 0 #1a1a1a",
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
        {/* RIGHT SIDEBAR — Dark glass panels (Notes, Extensions, Content) */}
        {/* ============================================================= */}
        <aside style={{
          display: "flex", flexDirection: "column", gap: "12px",
          overflowY: "auto", maxHeight: "calc(100vh - 112px)",
        }}>

          {/* Teaching Notes */}
          <div style={{
            borderRadius: "16px", overflow: "hidden",
            background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)",
          }}>
            <button
              onClick={() => setShowNotes(!showNotes)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", textAlign: "left",
                background: "transparent", border: "none",
                color: "#F3F4F6", fontSize: "12px", fontWeight: 700,
                cursor: "pointer", transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span>📋 Teaching Notes</span>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" style={{ transition: "transform 0.2s", transform: showNotes ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showNotes && (
              <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", flexDirection: "column", gap: "12px" }}>
                {currentContent?.learningGoal && (
                  <div style={{ borderRadius: "8px", padding: "10px", background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)" }}>
                    <p style={{ fontSize: "9px", fontWeight: 700, color: "#A78BFA", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px", marginBottom: "4px" }}>
                      Learning Goal
                    </p>
                    <p style={{ fontSize: "11px", color: "#E9D5FF", lineHeight: 1.4, margin: 0 }}>
                      {currentContent.learningGoal}
                    </p>
                  </div>
                )}

                {workshopPhases?.opening?.hook && (
                  <div style={{ borderLeft: "3px solid #7C3AED", borderRadius: "8px", padding: "10px", background: "rgba(139, 92, 246, 0.05)" }}>
                    <p style={{ fontSize: "9px", fontWeight: 700, color: "#A78BFA", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                      Opening Hook
                    </p>
                    <p style={{ fontSize: "11px", color: "#D1C7F4", lineHeight: 1.4, margin: 0 }}>
                      {workshopPhases.opening.hook}
                    </p>
                  </div>
                )}

                {workshopPhases?.miniLesson?.focus && (
                  <div style={{ borderLeft: "3px solid #2563EB", borderRadius: "8px", padding: "10px", background: "rgba(37, 99, 235, 0.05)" }}>
                    <p style={{ fontSize: "9px", fontWeight: 700, color: "#93C5FD", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                      Mini-Lesson Focus
                    </p>
                    <p style={{ fontSize: "11px", color: "#BFDBFE", lineHeight: 1.4, margin: 0 }}>
                      {workshopPhases.miniLesson.focus}
                    </p>
                  </div>
                )}

                {(workshopPhases?.debrief?.protocol || workshopPhases?.debrief?.prompt) && (
                  <div style={{ borderLeft: "3px solid #F59E0B", borderRadius: "8px", padding: "10px", background: "rgba(245, 158, 11, 0.05)" }}>
                    <p style={{ fontSize: "9px", fontWeight: 700, color: "#FCD34D", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                      Debrief Protocol
                    </p>
                    <p style={{ fontSize: "11px", color: "#FDE68A", lineHeight: 1.4, margin: 0 }}>
                      {workshopPhases.debrief.protocol || workshopPhases.debrief.prompt}
                    </p>
                  </div>
                )}

                {teacherNotes.length > 0 && (
                  <div>
                    <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B7280", margin: "0 0 8px" }}>
                      Activity Notes
                    </p>
                    {teacherNotes.map((note, i) => (
                      <div key={i} style={{ borderRadius: "8px", padding: "8px", background: "rgba(255, 255, 255, 0.02)", marginBottom: "6px", borderLeft: "2px solid #4B5563" }}>
                        <p style={{ fontSize: "11px", color: "#D1D5DB", lineHeight: 1.4, margin: 0 }}>{note}</p>
                      </div>
                    ))}
                  </div>
                )}

                {currentContent?.vocabWarmup?.terms && currentContent.vocabWarmup.terms.length > 0 && (
                  <div>
                    <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B7280", margin: "0 0 8px" }}>
                      Key Vocabulary
                    </p>
                    {currentContent.vocabWarmup.terms.map((term, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", fontSize: "11px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600, color: "#F3F4F6", whiteSpace: "nowrap" }}>{term.term}:</span>
                        <span style={{ color: "#D1D5DB" }}>{term.definition}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!currentContent?.learningGoal && !workshopPhases && teacherNotes.length === 0 && (
                  <p style={{ fontSize: "11px", color: "#6B7280", margin: 0 }}>
                    No teaching notes. Notes are generated when lessons include Workshop Model timing.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Extensions */}
          {extensions.length > 0 && (
            <div style={{
              borderRadius: "16px", overflow: "hidden",
              background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)",
            }}>
              <button
                onClick={() => setShowExtensions(!showExtensions)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", textAlign: "left",
                  background: "transparent", border: "none",
                  color: "#F3F4F6", fontSize: "12px", fontWeight: 700,
                  cursor: "pointer", transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span>🚀 Extensions ({extensions.length})</span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" style={{ transition: "transform 0.2s", transform: showExtensions ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showExtensions && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {extensions.map((ext, i) => (
                    <div key={i} style={{ borderRadius: "8px", padding: "10px", background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderLeft: "3px solid #10B981" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#D1FAE5" }}>{ext.title}</span>
                        <span style={{ fontSize: "9px", color: "#6EE7B7", fontFamily: "'Monaco', 'Courier New', monospace" }}>
                          ~{ext.durationMinutes}m
                        </span>
                      </div>
                      <p style={{ fontSize: "10px", color: "#A7F3D0", lineHeight: 1.4, margin: 0 }}>
                        {ext.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Lesson Activities */}
          {currentContent?.sections && currentContent.sections.length > 0 && (
            <div style={{
              borderRadius: "16px", overflow: "hidden",
              background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)",
            }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#F3F4F6" }}>📝 Lesson Activities</span>
              </div>
              <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {currentContent.sections.map((section, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", fontSize: "11px" }}>
                    <span style={{ color: "#4B5563", fontFamily: "'Monaco', 'Courier New', monospace", width: "18px", textAlign: "right", flexShrink: 0, marginTop: "2px" }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#D1D5DB", lineHeight: 1.4, margin: "0 0 4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {section.prompt}
                      </p>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {section.responseType && (
                          <span style={{
                            fontSize: "8px", padding: "2px 8px", borderRadius: "4px",
                            background: "rgba(255, 255, 255, 0.05)", color: "#9CA3AF",
                            fontWeight: 500, border: "1px solid rgba(255, 255, 255, 0.08)"
                          }}>
                            {section.responseType}
                          </span>
                        )}
                        {section.durationMinutes && (
                          <span style={{
                            fontSize: "8px", padding: "2px 8px", borderRadius: "4px",
                            background: "rgba(255, 255, 255, 0.05)", color: "#9CA3AF",
                            fontWeight: 500, border: "1px solid rgba(255, 255, 255, 0.08)"
                          }}>
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

      {/* NM Observation Modal — dark overlay */}
      {nmObsStudent && resolvedNmConfig?.enabled && (() => {
        const nmCfg = resolvedNmConfig;
        const nmElements = (nmCfg.elements || [])
          .map((eid: string) => AGENCY_ELEMENT_MAP[eid])
          .filter(Boolean);
        if (nmElements.length === 0) return null;
        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "20px",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setNmObsStudent(null); }}
          >
            <div style={{ maxWidth: "520px", width: "100%" }}>
              <ObservationSnap
                studentId={nmObsStudent.id}
                studentName={nmObsStudent.name}
                unitId={unitId}
                classId={selectedClassId || undefined}
                elements={nmElements}
                onComplete={() => setNmObsStudent(null)}
                onClose={() => setNmObsStudent(null)}
              />
            </div>
          </div>
        );
      })()}
      {/* ─── Floating Teaching Toolbar ─── */}
      <TeachingToolbar
        unitId={unitId}
        pageId={selectedPageId || ""}
        classId={selectedClassId || ""}
        studentCount={students.length}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
        currentPhase={currentPhase}
        phaseTimeRemaining={phaseTimeRemaining}
        lessonContent={currentContent}
        onPhaseSkip={() => {
          const phases: PhaseId[] = ["opening", "miniLesson", "workTime", "debrief"];
          const idx = phases.indexOf(currentPhase);
          if (idx < phases.length - 1) {
            setCurrentPhase(phases[idx + 1]);
          }
        }}
        onProjectToScreen={(data) => {
          // postMessage to projector window
          const msg = { type: "toolbar-action", ...data };
          window.postMessage(msg, "*");
        }}
        onLessonEdited={() => {
          // Refetch unit data on edit
          window.location.reload();
        }}
      />
    </main>
  );
}
