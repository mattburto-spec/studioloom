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
import { SkillsCerts, type SkillCert } from "@/components/student/BadgeWall";
import { StatsStrip } from "@/components/student/StatsStrip";
import { computeStats, type BadgeInput } from "@/lib/badges/compute-badges";
import { DueThisWeek } from "@/components/student/DueThisWeek";
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
}

export default function StudentDashboard() {
  const { student, classInfo } = useStudent();
  const [units, setUnits] = useState<UnitWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentEntries, setRecentEntries] = useState<PortfolioEntry[]>([]);
  const [recentToolSessions, setRecentToolSessions] = useState<ToolSession[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [openStudioUnits, setOpenStudioUnits] = useState<Set<string>>(new Set());
  const [safetyCerts, setSafetyCerts] = useState<Array<{ cert_type: string; granted_at: string }>>([]);

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
    const statuses: Array<{ unit_id: string; status: string }> = [];
    await Promise.all(
      unitList.map(async (unit) => {
        try {
          const res = await fetch(`/api/student/open-studio/status?unitId=${unit.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.unlocked) unlocked.add(unit.id);
            statuses.push({ unit_id: unit.id, status: data.unlocked ? "unlocked" : "locked" });
          }
        } catch { /* silent */ }
      })
    );
    setOpenStudioUnits(unlocked);
    return statuses;
  }, []);

  const loadSafetyCerts = useCallback(async () => {
    try {
      const res = await fetch("/api/student/safety-certs");
      if (res.ok) {
        const data = await res.json();
        setSafetyCerts(data.certs || []);
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
        }
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    loadPortfolio();
    loadToolSessions();
    loadSafetyCerts();
  }, [student, loadPortfolio, loadToolSessions, loadOpenStudioStatus, loadSafetyCerts]);

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

  // Find the most recent in-progress unit
  const inProgressUnit = units.find((u) => {
    const percent = getCompletionPercent(u, u.progress);
    return percent > 0 && percent < 100;
  });

  // === Stats computation ===

  const statsInput: BadgeInput = useMemo(() => {
    const allProgress = units.flatMap((unit) => {
      const pages = getPageList(unit.content_data);
      return unit.progress.map((p) => {
        const page = pages.find((pg) => pg.id === p.page_id);
        return {
          page_id: p.page_id,
          criterion: page?.criterion,
          status: p.status,
          time_spent: p.time_spent,
          updated_at: p.updated_at,
        };
      });
    });
    return {
      progress: allProgress,
      toolSessions: recentToolSessions.map((s) => ({
        tool_id: s.tool_id,
        status: s.status,
        version: s.version,
        completed_at: s.completed_at || null,
      })),
      safetyCerts: [],
      studioStatus: [],
      studioSessions: [],
      studioProfiles: [],
    };
  }, [units, recentToolSessions]);

  const stats = useMemo(() => computeStats(statsInput), [statsInput]);

  // === Workshop skill certs (teacher-granted) ===

  const WORKSHOP_SKILLS: Array<{ id: string; name: string; icon: string }> = [
    { id: "general-workshop", name: "Workshop Safety", icon: "🛡️" },
    { id: "laser-cutter", name: "Laser Cutter", icon: "⚡" },
    { id: "3d-printer", name: "3D Printer", icon: "🖨️" },
    { id: "soldering", name: "Soldering", icon: "🔥" },
    { id: "hand-tools", name: "Hand Tools", icon: "🔧" },
    { id: "power-tools", name: "Power Tools", icon: "⚙️" },
    { id: "cad-101", name: "CAD Modelling", icon: "📐" },
    { id: "sewing-machine", name: "Sewing Machine", icon: "🧵" },
  ];

  const skillCerts: SkillCert[] = useMemo(() => {
    return WORKSHOP_SKILLS.map((skill) => {
      const cert = safetyCerts.find((c) => c.cert_type === skill.id);
      return {
        id: skill.id,
        name: skill.name,
        icon: skill.icon,
        earned: !!cert,
        grantedAt: cert?.granted_at || null,
      };
    });
  }, [safetyCerts]);

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

        // Show items due within 14 days or overdue
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

  // === Journey Map zones for the first in-progress (or first) unit ===

  const journeyUnit = inProgressUnit || units[0];
  const journeyZones = useMemo(() => {
    if (!journeyUnit) return [];
    const unitPages = getPageList(journeyUnit.content_data);
    const criterionKeys: CriterionKey[] = ["A", "B", "C", "D"];

    // Find which criterion the student is currently on (first incomplete criterion with pages)
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      {/* Tool Modal */}
      {selectedToolId && (
        <ToolModal
          toolId={selectedToolId}
          onClose={() => setSelectedToolId(null)}
        />
      )}

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ============ Greeting ============ */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-purple-600 tracking-wider uppercase mb-1">My Design Journey</p>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {student?.display_name || student?.username}
          </h1>
          <p className="text-base text-text-secondary mt-1">
            {classInfo?.name || "Your class"}
          </p>
        </div>

        {loading ? (
          <>
            <div className="mb-6 h-40 rounded-2xl bg-white animate-pulse border border-border shadow-sm" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl animate-pulse h-56 shadow-sm border border-border" />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* ============ Continue Card (primary CTA) ============ */}
            {inProgressUnit && (
              <div className="mb-6">
                <div className="rounded-2xl bg-white border border-purple-200/60 overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
                  <div className="md:flex">
                    <div className="md:w-1/3 flex-shrink-0">
                      <div className="h-44 md:h-full w-full overflow-hidden bg-gradient-to-br from-purple-200 to-blue-200">
                        <UnitThumbnail
                          thumbnailUrl={inProgressUnit.thumbnail_url}
                          title={inProgressUnit.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="p-6 md:w-2/3 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1.5">Continue where you left off</p>
                        <h2 className="text-xl font-bold text-text-primary mb-2">
                          {inProgressUnit.title}
                        </h2>
                        {inProgressUnit.description && (
                          <p className="text-text-secondary text-sm mb-3 line-clamp-2">
                            {inProgressUnit.description}
                          </p>
                        )}
                        {/* Phase progress pills (non-linear) */}
                        {journeyZones.length > 0 && (
                          <div className="mb-4">
                            <JourneyMap zones={journeyZones} />
                          </div>
                        )}
                      </div>
                      <Link
                        href={`/unit/${inProgressUnit.id}/${
                          getPageList(inProgressUnit.content_data).length > 0
                            ? getPageList(inProgressUnit.content_data)[0].id
                            : "A1"
                        }`}
                        className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg w-fit text-sm"
                      >
                        Continue →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============ Stats + Certs + Due Dates ============ */}
            <div className="mb-5">
              <StatsStrip stats={stats} />
            </div>
            <div className="mb-5">
              <SkillsCerts certs={skillCerts} />
            </div>
            {dueItems.length > 0 && (
              <div className="mb-6">
                <DueThisWeek items={dueItems} />
              </div>
            )}

            {/* Your Units */}
            <div className="mb-10">
              <h2 className="text-xl font-bold text-text-primary mb-5">Your Units</h2>
              {units.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 text-center border border-purple-200/40 shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-5">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                  </div>
                  <p className="text-text-primary text-xl font-semibold mb-2">No units assigned yet</p>
                  <p className="text-text-secondary text-base">
                    Your teacher will assign units for you to work on.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {units.map((unit) => {
                    const unitPages = getPageList(unit.content_data);
                    const firstPageId = unitPages.length > 0 ? unitPages[0].id : "A1";
                    const percent = getCompletionPercent(unit, unit.progress);
                    const criterionKeys = [...new Set(
                      unitPages
                        .filter((p) => p.type === "strand" && p.criterion)
                        .map((p) => p.criterion as CriterionKey)
                    )];
                    const hasStudio = openStudioUnits.has(unit.id);
                    const isComplete = percent === 100;

                    return (
                      <div
                        key={unit.id}
                        className={`rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 flex flex-col border-t-4 ${
                          isComplete ? "border-t-accent-green opacity-80 hover:opacity-100" : "border-t-purple-500"
                        }`}
                        style={{ display: "flex", flexDirection: "column" }}
                      >
                        <Link
                          href={`/unit/${unit.id}/${firstPageId}`}
                          className="bg-white flex-1 group"
                          style={{ display: "block" }}
                        >
                          <div className="w-full h-40 overflow-hidden bg-gradient-to-br from-purple-200 to-blue-200">
                            <div className="group-hover:scale-110 transition-transform duration-300 w-full h-full">
                              <UnitThumbnail
                                thumbnailUrl={unit.thumbnail_url}
                                title={unit.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                          <div className="p-5">
                            <div className="flex items-start justify-between mb-2">
                              <h2 className="font-bold text-base text-text-primary group-hover:text-purple-600 transition flex-1">
                                {unit.title}
                              </h2>
                              {isComplete && (
                                <span className="flex-shrink-0 ml-2 inline-flex items-center gap-1 text-xs font-bold text-white bg-accent-green rounded-full px-2 py-1">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                  </svg>
                                  Done
                                </span>
                              )}
                            </div>
                            {unit.description && (
                              <p className="text-text-secondary text-xs mb-4 line-clamp-2 leading-relaxed">
                                {unit.description}
                              </p>
                            )}

                            {/* Criterion progress bars */}
                            <div className="flex gap-1.5 mb-3">
                              {criterionKeys.length > 0
                                ? criterionKeys.map((key) => {
                                    const cp = getCriterionProgress(unitPages, unit.progress, key);
                                    if (!cp) return null;
                                    const fillPercent = (cp.completed / cp.total) * 100;
                                    return (
                                      <div
                                        key={key}
                                        className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"
                                        title={`Criterion ${key}: ${cp.completed}/${cp.total}`}
                                      >
                                        <div
                                          className="h-full rounded-full transition-all duration-500"
                                          style={{ width: `${fillPercent}%`, backgroundColor: CRITERIA[key].color }}
                                        />
                                      </div>
                                    );
                                  })
                                : (
                                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width: `${
                                          unitPages.length > 0
                                            ? (unit.progress.filter((p) => p.status === "complete").length / unitPages.length) * 100
                                            : 0
                                        }%`,
                                        background: "linear-gradient(90deg, #7B2FF2, #A855F7)",
                                      }}
                                    />
                                  </div>
                                )}
                            </div>

                            <p className="text-xs font-semibold text-purple-600">
                              {percent}% complete
                            </p>
                          </div>
                        </Link>

                        {/* Open Studio link */}
                        {hasStudio && (
                          <Link
                            href={`/open-studio/${unit.id}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              padding: "12px 16px",
                              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                              color: "white",
                              fontSize: "13px",
                              fontWeight: 600,
                              textDecoration: "none",
                              letterSpacing: "0.01em",
                              transition: "filter 0.15s",
                            }}
                            className="hover:brightness-110"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0" />
                            </svg>
                            Enter Open Studio
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My Tools Section */}
            {recentToolSessions.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-text-primary">My Tools</h2>
                  <Link
                    href="/my-tools"
                    className="text-xs text-purple-600 hover:text-purple-700 font-semibold"
                  >
                    View all →
                  </Link>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {recentToolSessions.slice(0, 8).map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedToolId(session.tool_id)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-200 bg-white hover:bg-purple-50 transition-colors text-sm font-medium text-text-primary group"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: session.status === "in_progress" ? "#10b981" : "#d1d5db" }}
                      />
                      <span className="capitalize">{session.tool_id.replace(/-/g, " ")}</span>
                      {session.version > 1 && (
                        <span className="text-xs text-text-secondary">v{session.version}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Portfolio Activity */}
            {recentEntries.length > 0 && (
              <div className="mb-10">
                <details className="group">
                  <summary className="cursor-pointer text-base font-bold text-text-primary flex items-center gap-2 mb-3 hover:text-purple-600 transition">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-600 group-open:rotate-90 transition-transform">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </span>
                    Recent Portfolio Activity
                  </summary>
                  <div className="bg-white rounded-2xl border border-purple-200/40 shadow-sm divide-y divide-border/50 mt-3">
                    {recentEntries.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                        {/* Icon */}
                        {entry.type === "entry" ? (
                          entry.media_url ? (
                            <img src={entry.media_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" loading="lazy" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E86AB" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                            </div>
                          )
                        ) : entry.type === "photo" && entry.media_url ? (
                          <img src={entry.media_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" loading="lazy" />
                        ) : entry.type === "link" ? (
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <img src={`https://www.google.com/s2/favicons?domain=${getDomain(entry.link_url || "")}&sz=20`} alt="" className="w-5 h-5" />
                          </div>
                        ) : entry.type === "mistake" ? (
                          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E86F2C" strokeWidth="2">
                              <path d="M9 18h6" />
                              <path d="M10 22h4" />
                              <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </div>
                        )}
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {entry.type === "entry" ? (
                            <>
                              {entry.content && <p className="text-sm text-text-primary line-clamp-2">{entry.content}</p>}
                              {entry.link_url && <p className="text-xs text-purple-600 truncate mt-0.5">{getDomain(entry.link_url)}</p>}
                              {!entry.content && !entry.link_url && entry.media_url && <p className="text-sm text-text-primary">Photo added</p>}
                            </>
                          ) : (
                            <p className="text-sm text-text-primary truncate">
                              {entry.type === "link"
                                ? entry.link_title || getDomain(entry.link_url || "")
                                : entry.type === "photo"
                                  ? "Photo added"
                                  : entry.content}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-text-secondary/60 mt-1">
                            {entry.type === "mistake" && <span className="text-orange-600 font-semibold">Learning</span>}
                            <span className="bg-gray-100 px-2 py-0.5 rounded-md text-text-secondary text-xs font-medium">
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
