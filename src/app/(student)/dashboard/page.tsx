"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useStudent } from "../student-context";
import { CRITERIA, type CriterionKey } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import { timeAgo, getDomain } from "@/lib/utils";
import { QuickCaptureFAB } from "@/components/portfolio/QuickCaptureFAB";
import { ToolModal } from "@/components/toolkit/ToolModal";
import { UnitThumbnail } from "@/components/shared/UnitThumbnail";
import { JourneyMap } from "@/components/student/JourneyMap";
import { DueThisWeek } from "@/components/student/DueThisWeek";
import { BadgeIcon } from "@/components/safety/BadgeIcon";
import type { Unit, StudentProgress, PortfolioEntry, UnitPage } from "@/types";

interface ToolSession {
  id: string;
  tool_id: string;
  challenge: string;
  status: "in_progress" | "completed";
  started_at: string;
  completed_at: string | null;
  version: number;
}

interface UnitWithProgress extends Unit {
  progress: StudentProgress[];
  page_due_dates?: Record<string, string>;
  class_id?: string | null;
  class_name?: string | null;
  class_subject?: string | null;
  class_grade_level?: string | null;
}

export default function StudentDashboard() {
  const { student, classInfo } = useStudent();
  const [units, setUnits] = useState<UnitWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentEntries, setRecentEntries] = useState<PortfolioEntry[]>([]);
  const [recentToolSessions, setRecentToolSessions] = useState<ToolSession[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [openStudioUnits, setOpenStudioUnits] = useState<Set<string>>(new Set());
  const [pendingBadges, setPendingBadges] = useState<Array<{
    badge_id: string;
    badge_name: string;
    badge_slug: string;
    badge_description: string;
    badge_icon: string;
    badge_color: string;
    pass_threshold: number;
    question_count: number;
    unit_title: string;
    student_status: "not_started" | "cooldown" | "expired";
    cooldown_until?: string;
  }>>([]);
  const [earnedBadges, setEarnedBadges] = useState<Array<{
    badge_id: string;
    badge_name: string;
    badge_slug: string;
    badge_icon: string;
    badge_color: string;
    earned_at: string;
    expires_at: string | null;
  }>>([]);
  const [nextClass, setNextClass] = useState<{
    dateISO: string;
    dayOfWeek: string;
    cycleDay: number;
    periodNumber?: number;
    room?: string;
    formatted: string;
    short: string;
  } | null>(null);

  const loadPortfolio = useCallback(async () => {
    try {
      const res = await fetch("/api/student/portfolio?limit=10");
      if (res.ok) {
        const data = await res.json();
        setRecentEntries(data.entries || []);
      }
    } catch { /* silent */ }
  }, []);

  const loadToolSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/student/tool-sessions?limit=50");
      if (res.ok) {
        const data = await res.json();
        setRecentToolSessions(data.sessions || []);
      }
    } catch { /* silent */ }
  }, []);

  const loadOpenStudioStatus = useCallback(async (unitList: UnitWithProgress[]) => {
    const unlocked = new Set<string>();
    await Promise.all(
      unitList.map(async (unit) => {
        try {
          const res = await fetch(`/api/student/open-studio/status?unitId=${unit.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.unlocked) unlocked.add(unit.id);
          }
        } catch { /* silent */ }
      })
    );
    setOpenStudioUnits(unlocked);
  }, []);

  const loadPendingBadges = useCallback(async () => {
    try {
      const res = await fetch("/api/student/safety/pending");
      if (res.ok) {
        const data = await res.json();
        setPendingBadges(data.pending || []);
        setEarnedBadges(data.earned || []);
      }
    } catch { /* silent */ }
  }, []);

  const loadNextClass = useCallback(async (unitId: string) => {
    try {
      const res = await fetch(`/api/student/next-class?unitId=${unitId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.nextClass) setNextClass(data.nextClass);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    async function loadAll() {
      if (!student) return;
      try {
        const res = await fetch("/api/student/units");
        if (res.ok) {
          const data = await res.json();
          const unitList = data.units || [];
          setUnits(unitList);
          loadOpenStudioStatus(unitList);
          // Load next class for the first in-progress unit
          const inProg = unitList.find((u: UnitWithProgress) => {
            const pages = getPageList(u.content_data);
            if (pages.length === 0) return false;
            const complete = u.progress.filter((p: StudentProgress) => p.status === "complete").length;
            const pct = Math.round((complete / pages.length) * 100);
            return pct > 0 && pct < 100;
          });
          if (inProg) loadNextClass(inProg.id);
          else if (unitList.length > 0) loadNextClass(unitList[0].id);
        }
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    loadPortfolio();
    loadToolSessions();
    loadPendingBadges();
  }, [student, loadPortfolio, loadToolSessions, loadOpenStudioStatus, loadPendingBadges, loadNextClass]);

  // === Helpers ===

  function getCompletionPercent(unit: Unit, progress: StudentProgress[]): number {
    const unitPages = getPageList(unit.content_data);
    if (unitPages.length === 0) return 0;
    const complete = progress.filter((p) => p.status === "complete").length;
    return Math.round((complete / unitPages.length) * 100);
  }

  function getCriterionProgress(unitPages: UnitPage[], progress: StudentProgress[], criterion: string) {
    const criterionPages = unitPages.filter((p) => p.type === "strand" && p.criterion === criterion);
    if (criterionPages.length === 0) return null;
    const completed = criterionPages.filter((p) =>
      progress.some((pr) => pr.page_id === p.id && pr.status === "complete")
    ).length;
    return { completed, total: criterionPages.length };
  }

  function getUnitTitle(unitId: string): string {
    return units.find((u) => u.id === unitId)?.title || "Unknown Unit";
  }

  // === Due dates computation ===

  const dueItems = useMemo(() => {
    const now = new Date();
    const items: Array<{
      unitId: string;
      unitTitle: string;
      pageId: string;
      pageTitle: string;
      dueDate: string;
      isOverdue: boolean;
      isComplete: boolean;
    }> = [];

    for (const unit of units) {
      const dueDates = unit.page_due_dates || {};
      if (Object.keys(dueDates).length === 0) continue;
      const unitPages = getPageList(unit.content_data);
      for (const [pageId, dateStr] of Object.entries(dueDates)) {
        if (!dateStr) continue;
        const dueDate = new Date(dateStr);
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 14) {
          const page = unitPages.find((p) => p.id === pageId);
          const isComplete = unit.progress.some(
            (p) => p.page_id === pageId && p.status === "complete"
          );
          items.push({
            unitId: unit.id,
            unitTitle: unit.title,
            pageId,
            pageTitle: page?.title || `Page ${pageId}`,
            dueDate: dateStr,
            isOverdue: diffDays < 0 && !isComplete,
            isComplete,
          });
        }
      }
    }
    return items;
  }, [units]);

  // Find the most recent in-progress unit
  const inProgressUnit = units.find((u) => {
    const percent = getCompletionPercent(u, u.progress);
    return percent > 0 && percent < 100;
  });

  // === Journey Map zones for the in-progress (or first) unit ===
  const journeyUnit = inProgressUnit || units[0];
  const journeyZones = useMemo(() => {
    if (!journeyUnit) return [];
    const unitPages = getPageList(journeyUnit.content_data);
    const criterionKeys: CriterionKey[] = ["A", "B", "C", "D"];
    let currentCriterion: CriterionKey | null = null;
    for (const key of criterionKeys) {
      const cp = getCriterionProgress(unitPages, journeyUnit.progress, key);
      if (cp && cp.completed < cp.total) {
        currentCriterion = key;
        break;
      }
    }
    return criterionKeys.map((key) => {
      const cp = getCriterionProgress(unitPages, journeyUnit.progress, key);
      return {
        criterion: key,
        name: CRITERIA[key].name,
        color: CRITERIA[key].color,
        pagesComplete: cp?.completed || 0,
        pagesTotal: cp?.total || 0,
        isCurrent: key === currentCriterion,
      };
    });
  }, [journeyUnit]);

  // Badge icon helper — uses shared BadgeIcon component
  function badgeIconEl(icon: string, color: string) {
    return <BadgeIcon iconName={icon} size={20} color={color} />;
  }

  // Subject/class → gradient color mapping for card headers
  const SUBJECT_GRADIENTS: Record<string, string> = {
    // MYP subject groups
    "design": "from-teal-500 to-emerald-400",
    "product design": "from-teal-500 to-emerald-400",
    "digital design": "from-cyan-500 to-blue-400",
    "service": "from-pink-400 to-rose-300",
    "service as action": "from-pink-400 to-rose-300",
    "community": "from-pink-400 to-rose-300",
    "personal project": "from-violet-500 to-purple-400",
    "pp": "from-violet-500 to-purple-400",
    "pypx": "from-amber-400 to-yellow-300",
    "exhibition": "from-amber-400 to-yellow-300",
    // General subjects
    "technology": "from-sky-500 to-blue-400",
    "art": "from-fuchsia-500 to-pink-400",
    "science": "from-green-500 to-emerald-400",
    "math": "from-orange-500 to-amber-400",
    "english": "from-red-400 to-rose-300",
  };

  function getSubjectGradient(unit: UnitWithProgress): string {
    // Try class subject first
    const subject = unit.class_subject?.toLowerCase()?.trim();
    if (subject) {
      for (const [key, gradient] of Object.entries(SUBJECT_GRADIENTS)) {
        if (subject.includes(key)) return gradient;
      }
    }
    // Deterministic fallback based on unit ID
    const fallbacks = [
      "from-teal-500 to-emerald-400",
      "from-violet-500 to-purple-400",
      "from-pink-400 to-rose-300",
      "from-sky-500 to-blue-400",
      "from-amber-400 to-yellow-300",
      "from-fuchsia-500 to-pink-400",
    ];
    let hash = 0;
    for (let i = 0; i < unit.id.length; i++) hash = ((hash << 5) - hash + unit.id.charCodeAt(i)) | 0;
    return fallbacks[Math.abs(hash) % fallbacks.length];
  }

  function getSubjectLabel(unit: UnitWithProgress): string | null {
    if (unit.class_subject) return unit.class_subject.toUpperCase();
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      {/* Tool Modal */}
      {selectedToolId && (
        <ToolModal
          toolId={selectedToolId}
          onClose={() => setSelectedToolId(null)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ============ Compact Header ============ */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {student?.display_name || student?.username}
            </h1>
            {nextClass && (
              <p className="text-sm text-gray-500">
                <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Next: {nextClass.short}
                  {nextClass.room && <span className="text-gray-400 font-normal"> &middot; {nextClass.room}</span>}
                </span>
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl animate-pulse h-64 shadow-sm border border-gray-200/60" />
            <div className="bg-white rounded-2xl animate-pulse h-48 shadow-sm border border-gray-200/60" />
          </div>
        ) : (
          <>
            {/* ============ Two-Column Layout ============ */}
            <div className="space-y-5">
              {/* ── Unit Cards ── */}
              <div>
                {units.length === 0 ? (
                  <div className="bg-white rounded-2xl p-16 text-center border border-gray-200/60 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                      </svg>
                    </div>
                    <p className="text-gray-900 text-lg font-semibold mb-1">No units assigned yet</p>
                    <p className="text-gray-500 text-sm">Your teacher will assign units for you to work on.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {units.map((unit) => {
                      const unitPages = getPageList(unit.content_data);
                      const firstPageId = unitPages.length > 0 ? unitPages[0].id : null;
                      const unitLink = firstPageId ? `/unit/${unit.id}/${firstPageId}` : `/unit/${unit.id}/narrative`;
                      const percent = getCompletionPercent(unit, unit.progress);
                      const hasStudio = openStudioUnits.has(unit.id);
                      const isComplete = percent === 100;
                      const gradient = getSubjectGradient(unit);
                      const subjectLabel = getSubjectLabel(unit);

                      return (
                        <div key={unit.id} className="flex flex-col">
                        <Link
                          href={unitLink}
                          className={`rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col ${
                            "border border-gray-200/60"
                          }`}
                        >
                          {/* Colored gradient header with subject label + progress ring */}
                          <div className={`relative bg-gradient-to-r ${gradient} px-4 py-5`}>
                            {subjectLabel && (
                              <span className="text-white/90 text-[11px] font-bold tracking-wider uppercase">
                                {subjectLabel}
                              </span>
                            )}
                            {/* Thumbnail overlay (subtle) */}
                            {unit.thumbnail_url && (
                              <div className="absolute inset-0 opacity-20">
                                <UnitThumbnail
                                  thumbnailUrl={unit.thumbnail_url}
                                  title={unit.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            {/* Progress ring */}
                            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-0.5 shadow-md">
                              <div className="relative" style={{ width: 36, height: 36 }}>
                                <svg width="36" height="36" className="transform -rotate-90">
                                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" />
                                  <circle
                                    cx="18" cy="18" r="14" fill="none"
                                    stroke={isComplete ? "#10b981" : "#fff"}
                                    strokeWidth="2.5"
                                    strokeDasharray={2 * Math.PI * 14}
                                    strokeDashoffset={2 * Math.PI * 14 * (1 - percent / 100)}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  {isComplete ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#10b981">
                                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                    </svg>
                                  ) : (
                                    <span className="text-[10px] font-bold text-gray-700">{percent}%</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="p-4 flex-1 flex flex-col">
                            <h2 className="font-bold text-base text-gray-900 mb-1 line-clamp-2">
                              {unit.title}
                            </h2>
                            <p className="text-sm text-gray-500">
                              {percent === 0 ? "Start this unit" : isComplete ? "Complete" : "Continue where you left off"} &rarr;
                            </p>
                          </div>

                          {/* Open Studio strip */}
                          {hasStudio && (
                            <div className="bg-violet-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 py-1.5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0" />
                              </svg>
                              Open Studio
                            </div>
                          )}
                        </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Earned Badges — horizontal strip ── */}
              {earnedBadges.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-100 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7" />
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7" />
                      <path d="M4 22h16" />
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                    <h2 className="text-xs font-bold text-purple-800">My Badges</h2>
                    <span className="ml-auto text-[10px] font-semibold text-purple-500 bg-purple-100 px-1.5 py-0.5 rounded-full">
                      {earnedBadges.length}
                    </span>
                  </div>
                  <div className="px-3 py-2.5 overflow-hidden">
                    <div className="flex gap-4 overflow-x-auto">
                      {earnedBadges.map((b) => (
                        <Link
                          key={b.badge_id}
                          href={`/safety/${b.badge_id}`}
                          className="group flex flex-col items-center gap-1 w-[60px] flex-shrink-0 text-center"
                        >
                          <div
                            className="relative w-11 h-11 rounded-full flex items-center justify-center text-lg group-hover:scale-110 transition-transform duration-200"
                            style={{
                              background: `linear-gradient(135deg, ${b.badge_color}30, ${b.badge_color}60)`,
                              border: `2px solid ${b.badge_color}`,
                            }}
                          >
                            {badgeIconEl(b.badge_icon, b.badge_color)}
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-[1.5px] border-white flex items-center justify-center">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          </div>
                          <span className="text-[9px] font-semibold text-gray-500 leading-tight line-clamp-2">
                            {b.badge_name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Pending Safety Tests — grid of cards ── */}
              {pendingBadges.length > 0 && (
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-amber-100/80 border-b border-amber-200 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <h2 className="text-sm font-bold text-amber-800">
                      Safety Tests ({pendingBadges.length})
                    </h2>
                  </div>
                  <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pendingBadges.map((badge) => {
                      const isCooldown = badge.student_status === "cooldown";
                      return (
                        <Link
                          key={badge.badge_id}
                          href={isCooldown ? "#" : `/safety/${badge.badge_id}`}
                          onClick={(e) => isCooldown && e.preventDefault()}
                          className={`block rounded-xl p-3 border transition-all ${
                            isCooldown
                              ? "bg-gray-50 border-gray-200 cursor-not-allowed"
                              : "bg-white border-amber-200/60 hover:border-amber-400 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                              style={{ backgroundColor: badge.badge_color + "20", border: `2px solid ${badge.badge_color}` }}
                            >
                              {badgeIconEl(badge.badge_icon, badge.badge_color)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900 leading-tight">{badge.badge_name}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {badge.question_count}q · {badge.pass_threshold}% to pass
                              </p>
                              {isCooldown && badge.cooldown_until && (
                                <p className="text-[11px] text-amber-600 mt-0.5 font-medium">Retake {timeAgo(badge.cooldown_until)}</p>
                              )}
                              {badge.student_status === "expired" && (
                                <p className="text-[11px] text-red-600 mt-0.5 font-medium">Expired — retake required</p>
                              )}
                            </div>
                          </div>
                          <div className={`mt-2 text-center py-1.5 rounded-lg text-xs font-semibold ${
                            isCooldown
                              ? "bg-gray-100 text-gray-400"
                              : "bg-amber-500 text-white"
                          }`}>
                            {isCooldown ? "Cooldown" : badge.student_status === "expired" ? "Retake" : "Take Test"}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ============ Due This Week ============ */}
            {dueItems.length > 0 && (
              <div className="mt-5">
                <DueThisWeek items={dueItems} />
              </div>
            )}

            {/* ============ My Tools (compact) ============ */}
            {recentToolSessions.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-gray-700">My Tools</h2>
                  <Link href="/my-tools" className="text-xs text-purple-600 hover:text-purple-700 font-semibold">
                    View all &rarr;
                  </Link>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {recentToolSessions.slice(0, 8).map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedToolId(session.tool_id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-purple-50 hover:border-purple-200 transition-colors text-xs font-medium text-gray-700"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: session.status === "in_progress" ? "#10b981" : "#d1d5db" }}
                      />
                      <span className="capitalize">{session.tool_id.replace(/-/g, " ")}</span>
                      {session.version > 1 && (
                        <span className="text-gray-400">v{session.version}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ============ Recent Portfolio Activity (collapsed) ============ */}
            {recentEntries.length > 0 && (
              <div className="mt-5">
                <details className="group">
                  <summary className="cursor-pointer text-sm font-bold text-gray-700 flex items-center gap-2 hover:text-purple-600 transition">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-100 text-purple-600 group-open:rotate-90 transition-transform">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </span>
                    Recent Portfolio Activity
                  </summary>
                  <div className="bg-white rounded-xl border border-gray-200/60 shadow-sm divide-y divide-gray-100 mt-2">
                    {recentEntries.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                        {entry.type === "entry" ? (
                          entry.media_url ? (
                            <img src={entry.media_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E86AB" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                            </div>
                          )
                        ) : entry.type === "photo" && entry.media_url ? (
                          <img src={entry.media_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                        ) : entry.type === "link" ? (
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <img src={`https://www.google.com/s2/favicons?domain=${getDomain(entry.link_url || "")}&sz=16`} alt="" className="w-4 h-4" />
                          </div>
                        ) : entry.type === "mistake" ? (
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E86F2C" strokeWidth="2">
                              <path d="M9 18h6" />
                              <path d="M10 22h4" />
                              <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-900 truncate">
                            {entry.type === "entry"
                              ? (entry.content || (entry.link_url ? getDomain(entry.link_url) : "Photo"))
                              : entry.type === "link"
                                ? (entry.link_title || getDomain(entry.link_url || ""))
                                : entry.type === "photo"
                                  ? "Photo added"
                                  : entry.content}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-medium">
                              {getUnitTitle(entry.unit_id)}
                            </span>
                            <span>{timeAgo(entry.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </>
        )}

        {/* Quick Capture FAB */}
        {units.length > 0 && (
          <QuickCaptureFAB
            availableUnits={units.map((u) => ({ id: u.id, title: u.title }))}
            onEntryCreated={loadPortfolio}
          />
        )}
      </div>
    </main>
  );
}
