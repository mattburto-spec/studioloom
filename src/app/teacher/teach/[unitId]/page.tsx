"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPageList, normalizeContentData, isV3, isV4 } from "@/lib/unit-adapter";
import { computeLessonBoundaries } from "@/lib/timeline";
import PhaseTimer from "@/components/teach/PhaseTimer";
import TeachingToolbar from "@/components/teach/TeachingToolbar";
import { CheckInRow } from "@/components/teach/CheckInRow";
import { getLiveStatusLabel } from "@/lib/teaching-mode/live-status-label";
import { scaleWorkshopPhases } from "@/lib/teaching-mode/scale-phases";
import { ObservationSnap } from "@/components/nm";
import { AGENCY_ELEMENT_MAP } from "@/lib/nm/constants";
import type { NMUnitConfig } from "@/lib/nm/constants";
import type {
  Unit, UnitPage, UnitContentData, UnitContentDataV4, TimelineActivity,
  ComputedLesson, WorkshopPhases, LessonExtension, PageContent,
} from "@/types";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { pickTodaysLessonId } from "@/lib/scheduling/pick-todays-lesson";
import { composedPromptText } from "@/lib/lever-1/compose-prompt";

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
  paceZ: number | null;
}

interface LiveSummary {
  total: number;
  notStarted: number;
  inProgress: number;
  complete: number;
  avgTimeSpent: number;
  needsHelpCount: number;
  onlineCount: number;
  cohortStats: {
    inProgressCount: number;
    medianResponses: number;
    meanResponses: number;
    stddevResponses: number;
  } | null;
}

type PhaseId = "opening" | "miniLesson" | "workTime" | "debrief";

const PHASE_COLORS: Record<PhaseId, string> = {
  opening: "#7C3AED",
  miniLesson: "#2563EB",
  workTime: "#10B981",
  debrief: "#F59E0B",
};

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
  const classContentRef = useRef<Record<string, unknown>>({});

  // UI state
  const [showNotes, setShowNotes] = useState(true);
  const [showExtensions, setShowExtensions] = useState(false);
  const [studentSort, setStudentSort] = useState<"name" | "status" | "help">("help");
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());

  // Teacher's configured period length (school setting). Scales the baked
  // workshopPhases to fit at render time — unit may have been generated
  // before this value was set or with a different value.
  const [typicalPeriodMinutes, setTypicalPeriodMinutes] = useState<number | null>(null);

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
        // Filter is_active so soft-removed class assignments don't show
        // up in the teach-mode class picker. Matt smoke caught this on
        // the unit page after unassigning — same root cause as PRs
        // #189/#196/#199 — FU-CLASS-UNITS-IS-ACTIVE-AUDIT.
        supabase
          .from("class_units")
          .select("class_id, content_data, classes(id, name, code)")
          .eq("unit_id", unitId)
          .eq("is_active", true),
      ]);

      setUnit(unitRes.data);

      // Build class list + store class-unit content for resolution
      const cuList = classesRes.data || [];
      const classList = cuList
        .map((cu: Record<string, unknown>) => cu.classes as { id: string; name: string; code: string } | null)
        .filter((c): c is { id: string; name: string; code: string } => c !== null);

      // Store class-unit content_data map for resolution
      const cuContentMap: Record<string, unknown> = {};
      cuList.forEach((cu: Record<string, unknown>) => {
        const cls = cu.classes as { id: string } | null;
        if (cls && cu.content_data) {
          cuContentMap[cls.id] = cu.content_data;
        }
      });
      classContentRef.current = cuContentMap;

      setClasses(classList);
      const effectiveClassId = initialClassId || (classList.length > 0 ? classList[0].id : null);
      if (effectiveClassId && !initialClassId) {
        setSelectedClassId(effectiveClassId);
      }

      // Default-page selection. Tier 2 (13 May 2026): if the teacher
      // has set a per-class schedule, jump to the lesson scheduled
      // closest to today. Otherwise fall back to the first page.
      if (unitRes.data) {
        const masterContent = unitRes.data.content_data as UnitContentData;
        const classContent = effectiveClassId ? cuContentMap[effectiveClassId] as UnitContentData | undefined : undefined;
        const resolvedContent = resolveClassUnitContent(masterContent, classContent);
        const pages = getPageList(resolvedContent);
        if (pages.length > 0) {
          let defaultPageId: string = pages[0].id;
          if (effectiveClassId) {
            try {
              const schedRes = await fetch(
                `/api/teacher/classes/${effectiveClassId}/lesson-schedule?unitId=${unitId}`,
                { credentials: "same-origin", cache: "no-store" },
              );
              if (schedRes.ok) {
                const body = (await schedRes.json()) as {
                  schedule: Array<{ page_id: string; scheduled_date: string }>;
                };
                const picked = pickTodaysLessonId(pages, body.schedule);
                if (picked) defaultPageId = picked;
              }
            } catch {
              // Non-fatal — fall back to first page on any error.
            }
          }
          setSelectedPageId(defaultPageId);
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

  // Clear snoozes when lesson changes — snooze is per-lesson, not global
  useEffect(() => {
    setSnoozed(new Set());
  }, [selectedPageId]);

  // Fetch teacher's typical_period_minutes once on mount. Used to scale
  // the baked workshopPhases at render time when the unit was generated
  // for a different period length.
  useEffect(() => {
    async function loadPeriod() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("teacher_profiles")
          .select("typical_period_minutes")
          .eq("teacher_id", user.id)
          .maybeSingle();
        if (data?.typical_period_minutes) {
          setTypicalPeriodMinutes(data.typical_period_minutes);
        }
      } catch {
        // Non-blocking — fall back to baked phases.
      }
    }
    loadPeriod();
  }, []);

  useEffect(() => {
    fetchLiveStatus();
    pollRef.current = setInterval(() => {
      // Pause polling when tab is hidden or browser is offline
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      fetchLiveStatus();
    }, 30000); // Poll every 30s (was 8s — reduced from 450 to ~60 req/hr per teacher)

    // Resume polling immediately when tab becomes visible again
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchLiveStatus();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchLiveStatus]);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px", height: "48px", border: "4px solid #E5E7EB",
            borderTop: "4px solid #7C3AED", borderRadius: "50%", margin: "0 auto",
            animation: "spin 1s linear infinite"
          }} />
          <p style={{ fontSize: "16px", color: "#9CA3AF", fontWeight: 500, marginTop: "12px" }}>Loading lesson...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  if (!unit) {
    return (
      <main style={{ minHeight: "100vh", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#9CA3AF" }}>Unit not found.</p>
          <Link href="/teacher/units" style={{ color: "#1E40AF", fontSize: "14px", marginTop: "8px", display: "inline-block" }}>
            ← Back to units
          </Link>
        </div>
      </main>
    );
  }

  // Resolve content: class-local fork if exists, otherwise master
  const classForkedContent = selectedClassId
    ? classContentRef.current[selectedClassId] as UnitContentData | undefined
    : undefined;
  const resolvedContent = resolveClassUnitContent(
    unit.content_data as UnitContentData,
    classForkedContent
  );
  const pages = getPageList(resolvedContent);
  const normalized = normalizeContentData(resolvedContent);
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

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <main style={{ minHeight: "100vh", background: "#F8F9FB" }}>
      {/* ================================================================= */}
      {/* TOP BAR — Light frosted glass header with unit title + controls     */}
      {/* ================================================================= */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #E5E7EB",
          padding: "16px",
        }}
      >
        <div style={{ maxWidth: "1600px", margin: "0 auto", display: "flex", alignItems: "center", gap: "20px" }}>
          {/* Back button */}
          <Link
            href={`/teacher/units/${unitId}`}
            style={{
              color: "#9CA3AF", transition: "color 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "24px", height: "24px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#6B7280")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>

          {/* Title section */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", margin: 0, marginBottom: "4px" }}>
              {unit.title}
            </h1>
            <p style={{ fontSize: "14px", color: "#9CA3AF", fontWeight: 500, margin: 0 }}>
              Teaching Mode {currentPage ? `— ${currentPage.title}` : ""}
            </p>
          </div>

          {/* Class selector — dark glass dropdown */}
          {classes.length > 0 && (
            <select
              value={selectedClassId || ""}
              onChange={(e) => setSelectedClassId(e.target.value)}
              style={{
                fontSize: "14px", fontWeight: 600, color: "#111827",
                background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px", padding: "8px 12px",
                cursor: "pointer", transition: "all 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = "#F3F4F6";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
              }}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id} style={{ background: "#FFFFFF", color: "#111827" }}>
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
              background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)",
            }}>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: "#10B981", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#059669" }}>
                {summary.onlineCount} online
              </span>
              <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
            </div>
          )}

          {/* Projector button */}
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (selectedPageId) params.set("pageId", selectedPageId);
              if (selectedClassId) params.set("classId", selectedClassId);
              const qs = params.toString();
              const url = `/teacher/teach/${unitId}/projector${qs ? `?${qs}` : ""}`;
              window.open(url, "studioloom-projector", "width=1280,height=720");
            }}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 16px", borderRadius: "8px",
              background: "rgba(139, 92, 246, 0.06)", border: "1px solid rgba(139, 92, 246, 0.15)",
              color: "#7C3AED", fontSize: "14px", fontWeight: 700,
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
        display: "grid", gridTemplateColumns: "240px 1fr 320px", gap: "20px",
        minHeight: "calc(100vh - 80px)", paddingBottom: "80px",
      }}>

        {/* ============================================================= */}
        {/* LEFT SIDEBAR — Dark glass lesson navigator with glow borders  */}
        {/* ============================================================= */}
        <aside style={{
          display: "flex", flexDirection: "column", gap: "12px",
          overflowY: "auto", maxHeight: "calc(100vh - 112px)", paddingRight: "8px", paddingBottom: "80px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }}>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
              Lessons
            </p>
            {selectedClassId && (
              <Link
                href={`/teacher/classes/${selectedClassId}/schedule/${unitId}`}
                style={{ fontSize: "11px", color: "#7C3AED", fontWeight: 600, textDecoration: "none" }}
                title="Set the date for each lesson — Teaching Mode will auto-open today's class"
              >
                📅 Set dates
              </Link>
            )}
          </div>
          {pages.map((page, i) => {
            const isActive = page.id === selectedPageId;
            const hasPhases = !!page.content?.workshopPhases;
            return (
              <button
                key={page.id}
                onClick={() => setSelectedPageId(page.id)}
                style={{
                  width: "100%", textAlign: "left", padding: "14px",
                  borderRadius: "10px", fontSize: "14px", transition: "all 0.2s",
                  border: isActive ? "1px solid #C4B5FD" : "1px solid #E5E7EB",
                  background: isActive ? "#F0ECFF" : "#FFFFFF",
                  color: isActive ? "#5B21B6" : "#6B7280",
                  fontWeight: isActive ? 700 : 500,
                  boxShadow: isActive ? "inset 0 0 16px rgba(139, 92, 246, 0.08)" : "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#F3F4F6";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#FFFFFF";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px", color: "#4B5563", fontFamily: "'Monaco', 'Courier New', monospace", width: "20px" }}>
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
                            height: "4px", borderRadius: "2px",
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
          display: "flex", flexDirection: "column", gap: "20px",
        }}>

          {/* Check-in row — surfaces up to 3 students who need attention */}
          <CheckInRow
            students={students}
            cohortStats={summary?.cohortStats ?? null}
            onlineCount={summary?.onlineCount ?? 0}
            snoozed={snoozed}
            onSnooze={(id) => setSnoozed((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            })}
          />

          {/* Phase Timer — compact mode keeps the centerpiece light.
              Scale baked phases to teacher's typical_period_minutes if
              the totals don't match (e.g. unit baked for 45min but the
              school runs 60min classes). */}
          {workshopPhases ? (
            <div style={{
              borderRadius: "12px", padding: "12px 14px",
              background: "#FFFFFF", border: "1px solid #E5E7EB",
            }}>
              <PhaseTimer
                workshopPhases={
                  typicalPeriodMinutes
                    ? scaleWorkshopPhases(workshopPhases, typicalPeriodMinutes)
                    : workshopPhases
                }
                onPhaseChange={(phase) => setCurrentPhase(phase)}
                compact
              />
            </div>
          ) : (
            <div style={{
              borderRadius: "12px", padding: "12px 14px", textAlign: "center",
              background: "#FFFFFF", border: "1px solid #E5E7EB",
            }}>
              <p style={{ fontSize: "13px", color: "#9CA3AF", margin: 0 }}>
                No Workshop Model timing for this lesson.
              </p>
            </div>
          )}

          {/* KPI Summary — elegant dark pills */}
          {summary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
              {[
                { label: "Not Started", value: summary.notStarted, color: "#9CA3AF", bgColor: "#F9FAFB" },
                { label: "Working", value: summary.inProgress, color: "#2563EB", bgColor: "#EFF6FF" },
                { label: "Complete", value: summary.complete, color: "#059669", bgColor: "#ECFDF5" },
                { label: "Need Help", value: summary.needsHelpCount, color: "#92400E", bgColor: "#FFFBEB" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderRadius: "12px", padding: "14px", textAlign: "center",
                    background: item.bgColor, border: `1px solid ${
                      item.label === "Working" ? "#BFDBFE" :
                      item.label === "Complete" ? "#A7F3D0" :
                      item.label === "Need Help" ? "#FDE68A" :
                      "#E5E7EB"
                    }`,
                  }}
                >
                  <div style={{ fontSize: "32px", fontWeight: 900, color: item.color }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: item.color, opacity: 0.7, marginTop: "4px" }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Student Grid — dark glass cards */}
          <div style={{
            borderRadius: "16px", overflow: "hidden",
            background: "#FFFFFF", border: "1px solid #E5E7EB",
          }}>
            {/* Header bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "14px 16px", borderBottom: "1px solid #E5E7EB",
              background: "#F9FAFB",
            }}>
              <p style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", flex: 1, margin: 0 }}>
                Students ({students.length})
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["help", "status", "name"] as const).map((sort) => (
                  <button
                    key={sort}
                    onClick={() => setStudentSort(sort)}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700,
                      transition: "all 0.2s", border: "none", cursor: "pointer",
                      background: studentSort === sort ? "rgba(139, 92, 246, 0.08)" : "transparent", color: studentSort === sort ? "#5B21B6" : "#6B7280",
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
            <div style={{ borderTop: "1px solid #E5E7EB" }}>
              {sortedStudents.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "#9CA3AF", fontSize: "13px" }}>
                  {selectedClassId ? "No students in this class yet." : "Select a class to see students."}
                </div>
              ) : (
                sortedStudents.map((s) => {
                  const liveLabel = getLiveStatusLabel({
                    status: s.status,
                    isOnline: s.isOnline,
                    lastActive: s.lastActive,
                  });
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px",
                        borderBottom: "1px solid #F3F4F6",
                        background: s.needsHelp ? "#FFFBEB" : "transparent",
                        transition: "background 0.15s",
                        minHeight: "44px",
                      }}
                      onMouseEnter={(e) => {
                        if (!s.needsHelp) e.currentTarget.style.background = "#FAFAFA";
                      }}
                      onMouseLeave={(e) => {
                        if (!s.needsHelp) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {/* Avatar */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div
                          style={{
                            width: "28px", height: "28px", borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "11px", fontWeight: 700, color: "#FFF",
                            background: liveLabel.color,
                            border: `1.5px solid ${liveLabel.ring}`,
                          }}
                        >
                          {s.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.avatar} alt="" style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            s.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        {s.isOnline && (
                          <span style={{
                            position: "absolute", bottom: "-1px", right: "-1px",
                            width: "10px", height: "10px", borderRadius: "50%",
                            background: "#10B981", border: "2px solid #FFFFFF"
                          }} />
                        )}
                      </div>

                      {/* Name + meta (single line) */}
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>
                          {s.name}
                        </span>
                        {s.needsHelp && (
                          <span style={{
                            padding: "1px 6px", borderRadius: "4px",
                            fontSize: "9px", fontWeight: 700, color: "#92400E",
                            background: "#FFFBEB", border: "1px solid #FDE68A",
                            lineHeight: 1.4,
                          }}>
                            HELP?
                          </span>
                        )}
                        {s.ellLevel && s.ellLevel !== "none" && (
                          <span style={{
                            padding: "1px 6px", borderRadius: "4px",
                            fontSize: "9px", fontWeight: 700, color: "#1E40AF",
                            background: "#EFF6FF", border: "1px solid #BFDBFE",
                            lineHeight: 1.4,
                          }}>
                            ELL{String(s.ellLevel).replace(/ell/i, "")}
                          </span>
                        )}
                        <span style={{ fontSize: "12px", color: "#9CA3AF", whiteSpace: "nowrap" }}>
                          {s.responseCount > 0 ? `${s.responseCount} responses` : "No responses yet"}
                        </span>
                      </div>

                      {/* Status badge (live-aware) */}
                      <span style={{
                        padding: "3px 10px", borderRadius: "10px",
                        fontSize: "11px", fontWeight: 700,
                        background: liveLabel.bg, color: liveLabel.color,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}>
                        {liveLabel.label}
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
                            cursor: "pointer", boxShadow: "1px 1px 0 #1a1a1a",
                            fontSize: "9px", fontWeight: 900, color: "#fff",
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
          paddingBottom: "80px", // Room for fixed TeachingToolbar at bottom
        }}>

          {/* Teaching Notes */}
          <div style={{
            borderRadius: "16px", overflow: "hidden",
            background: "#FFFFFF", border: "1px solid #E5E7EB",
          }}>
            <button
              onClick={() => setShowNotes(!showNotes)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", textAlign: "left",
                background: "transparent", border: "none",
                color: "#111827", fontSize: "14px", fontWeight: 700,
                cursor: "pointer", transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FFFFFF")}
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
              <div style={{ padding: "0 16px 16px", borderTop: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: "12px" }}>
                {currentContent?.learningGoal && (
                  <div style={{ borderRadius: "8px", padding: "10px", background: "#F0ECFF", border: "1px solid #C4B5FD" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#5B21B6", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px", marginBottom: "4px" }}>
                      Learning Goal
                    </p>
                    <p style={{ fontSize: "13px", color: "#4C1D95", lineHeight: 1.4, margin: 0 }}>
                      {currentContent.learningGoal}
                    </p>
                  </div>
                )}

                {workshopPhases?.opening?.hook && (
                  <div style={{ borderLeft: "3px solid #7C3AED", borderRadius: "8px", padding: "10px", background: "rgba(139, 92, 246, 0.06)", border: "1px solid rgba(139, 92, 246, 0.15)" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#5B21B6", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                      Opening Hook
                    </p>
                    <p style={{ fontSize: "13px", color: "#4C1D95", lineHeight: 1.4, margin: 0 }}>
                      {workshopPhases.opening.hook}
                    </p>
                  </div>
                )}

                {workshopPhases?.miniLesson?.focus && (
                  <div style={{ borderLeft: "3px solid #2563EB", borderRadius: "8px", padding: "10px", background: "rgba(37, 99, 235, 0.06)", border: "1px solid rgba(37, 99, 235, 0.15)" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                      Mini-Lesson Focus
                    </p>
                    <p style={{ fontSize: "13px", color: "#1E3A8A", lineHeight: 1.4, margin: 0 }}>
                      {workshopPhases.miniLesson.focus}
                    </p>
                  </div>
                )}

                {(workshopPhases?.debrief?.protocol || workshopPhases?.debrief?.prompt) && (
                  <div style={{ borderLeft: "3px solid #F59E0B", borderRadius: "8px", padding: "10px", background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.15)" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                      Debrief Protocol
                    </p>
                    <p style={{ fontSize: "13px", color: "#78350F", lineHeight: 1.4, margin: 0 }}>
                      {workshopPhases.debrief.protocol || workshopPhases.debrief.prompt}
                    </p>
                  </div>
                )}

                {teacherNotes.length > 0 && (
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", margin: "0 0 8px" }}>
                      Activity Notes
                    </p>
                    {teacherNotes.map((note, i) => (
                      <div key={i} style={{ borderRadius: "8px", padding: "8px", background: "#F9FAFB", marginBottom: "6px", borderLeft: "2px solid #4B5563" }}>
                        <p style={{ fontSize: "13px", color: "#D1D5DB", lineHeight: 1.4, margin: 0 }}>{note}</p>
                      </div>
                    ))}
                  </div>
                )}

                {currentContent?.vocabWarmup?.terms && currentContent.vocabWarmup.terms.length > 0 && (
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", margin: "0 0 8px" }}>
                      Key Vocabulary
                    </p>
                    {currentContent.vocabWarmup.terms.map((term, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", fontSize: "13px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{term.term}:</span>
                        <span style={{ color: "#D1D5DB" }}>{term.definition}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!currentContent?.learningGoal && !workshopPhases && teacherNotes.length === 0 && (
                  <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>
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
              background: "#FFFFFF", border: "1px solid #E5E7EB",
            }}>
              <button
                onClick={() => setShowExtensions(!showExtensions)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", textAlign: "left",
                  background: "transparent", border: "none",
                  color: "#111827", fontSize: "14px", fontWeight: 700,
                  cursor: "pointer", transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#FFFFFF")}
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
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {extensions.map((ext, i) => (
                    <div key={i} style={{ borderRadius: "8px", padding: "10px", background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.25)", borderLeft: "3px solid #10B981" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#065F46" }}>{ext.title}</span>
                        <span style={{ fontSize: "14px", color: "#6EE7B7", fontFamily: "'Monaco', 'Courier New', monospace" }}>
                          ~{ext.durationMinutes}m
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#064E3B", lineHeight: 1.4, margin: 0 }}>
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
              background: "#FFFFFF", border: "1px solid #E5E7EB",
            }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #E5E7EB" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>📝 Lesson Activities</span>
              </div>
              <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {currentContent.sections.map((section, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", fontSize: "13px" }}>
                    <span style={{ color: "#4B5563", fontFamily: "'Monaco', 'Courier New', monospace", width: "18px", textAlign: "right", flexShrink: 0, marginTop: "2px" }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      {/* Lever 1: composed text — slot fields take priority over legacy prompt */}
                      <p style={{ color: "#D1D5DB", lineHeight: 1.4, margin: "0 0 4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {composedPromptText(section)}
                      </p>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {section.responseType && (
                          <span style={{
                            fontSize: "10px", padding: "2px 8px", borderRadius: "4px",
                            background: "rgba(255, 255, 255, 0.05)", color: "#9CA3AF",
                            fontWeight: 500, border: "1px solid rgba(255, 255, 255, 0.08)"
                          }}>
                            {section.responseType}
                          </span>
                        )}
                        {section.durationMinutes && (
                          <span style={{
                            fontSize: "10px", padding: "2px 8px", borderRadius: "4px",
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
