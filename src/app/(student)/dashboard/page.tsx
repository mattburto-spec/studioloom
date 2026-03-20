"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useStudent } from "../student-context";
import { CRITERIA, type CriterionKey } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import { timeAgo, getDomain } from "@/lib/utils";
import { QuickCaptureFAB } from "@/components/portfolio/QuickCaptureFAB";
import { ToolModal } from "@/components/toolkit/ToolModal";
import { ReadinessIndicator } from "@/components/open-studio";
import { UnitThumbnail } from "@/components/shared/UnitThumbnail";
import type { Unit, StudentProgress, PortfolioEntry, UnitPage } from "@/types";

interface ToolSession {
  id: string;
  tool_id: string;
  challenge: string;
  status: "in_progress" | "completed";
  started_at: string;
  version: number;
}

interface UnitWithProgress extends Unit {
  progress: StudentProgress[];
}

export default function StudentDashboard() {
  const { student, classInfo } = useStudent();
  const [units, setUnits] = useState<UnitWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentEntries, setRecentEntries] = useState<PortfolioEntry[]>([]);
  const [recentToolSessions, setRecentToolSessions] = useState<ToolSession[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [openStudioUnits, setOpenStudioUnits] = useState<Set<string>>(new Set());

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
      const res = await fetch("/api/student/tool-sessions?limit=5");
      if (res.ok) {
        const data = await res.json();
        setRecentToolSessions(data.sessions || []);
      }
    } catch { /* silent */ }
  }, []);

  const loadOpenStudioStatus = useCallback(async (unitList: UnitWithProgress[]) => {
    // Check Open Studio status for each unit
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

  useEffect(() => {
    async function loadUnits() {
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
    loadUnits();
    loadPortfolio();
    loadToolSessions();
  }, [student, loadPortfolio, loadToolSessions, loadOpenStudioStatus]);

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

  // Find the most recent in-progress unit (progress > 0 && < 100%)
  const inProgressUnit = units.find((u) => {
    const percent = getCompletionPercent(u, u.progress);
    return percent > 0 && percent < 100;
  });

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
        {/* Hero Greeting Section */}
        <div className="mb-12 rounded-3xl bg-gradient-to-r from-purple-500/15 via-blue-500/15 to-indigo-500/15 border border-purple-200/40 px-8 py-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-purple-600 tracking-wider uppercase mb-2">Welcome</p>
            <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-2 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {student?.display_name || student?.username}
            </h1>
            <p className="text-lg text-text-secondary">
              {classInfo?.name || "Your class"}
            </p>
          </div>
        </div>

        {loading ? (
          <>
            {/* Continue card skeleton */}
            <div className="mb-10 h-48 rounded-3xl bg-white animate-pulse border border-border shadow-sm" />
            {/* Units skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl animate-pulse h-56 shadow-sm border border-border" />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Continue Where You Left Off */}
            {inProgressUnit && (
              <div className="mb-12">
                <div className="rounded-3xl bg-white border-2 border-purple-300/50 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="md:flex">
                    {/* Left: Thumbnail */}
                    <div className="md:w-2/5 flex-shrink-0">
                      <div className="h-48 md:h-full w-full overflow-hidden bg-gradient-to-br from-purple-200 to-blue-200">
                        <UnitThumbnail
                          thumbnailUrl={inProgressUnit.thumbnail_url}
                          title={inProgressUnit.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    {/* Right: Content */}
                    <div className="p-8 md:w-3/5 flex flex-col justify-between">
                      <div>
                        <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-2">Continue where you left off</p>
                        <h2 className="text-3xl font-bold text-text-primary mb-3">
                          {inProgressUnit.title}
                        </h2>
                        {inProgressUnit.description && (
                          <p className="text-text-secondary text-base mb-5 line-clamp-2">
                            {inProgressUnit.description}
                          </p>
                        )}
                        {/* Progress indicator */}
                        <div className="mb-6">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-medium text-text-secondary">Progress</p>
                            <p className="text-sm font-bold text-purple-600">
                              {getCompletionPercent(inProgressUnit, inProgressUnit.progress)}% complete
                            </p>
                          </div>
                          <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                              style={{
                                width: `${getCompletionPercent(inProgressUnit, inProgressUnit.progress)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/unit/${inProgressUnit.id}/${
                          getPageList(inProgressUnit.content_data).length > 0
                            ? getPageList(inProgressUnit.content_data)[0].id
                            : "A1"
                        }`}
                        className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl w-fit"
                      >
                        Continue →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Your Units */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Your Units</h2>
              {units.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 text-center border border-purple-200/40 shadow-sm">
                  <div className="w-20 h-20 rounded-3xl bg-purple-100 flex items-center justify-center mx-auto mb-6">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                  </div>
                  <p className="text-text-primary text-xl font-semibold mb-2">No units assigned yet</p>
                  <p className="text-text-secondary text-base">
                    Your teacher will assign units for you to work on.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                          isComplete
                            ? "border-t-accent-green opacity-80 hover:opacity-100"
                            : "border-t-purple-500"
                        }`}
                        style={{ display: "flex", flexDirection: "column" }}
                      >
                        {/* Main card */}
                        <Link
                          href={`/unit/${unit.id}/${firstPageId}`}
                          className="bg-white flex-1 group"
                          style={{ display: "block" }}
                        >
                          {/* Thumbnail */}
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
                                          style={{
                                            width: `${fillPercent}%`,
                                            backgroundColor: CRITERIA[key].color,
                                          }}
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
                                            ? (unit.progress.filter((p) => p.status === "complete").length /
                                                unitPages.length) *
                                              100
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
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
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
          </>
        )}

        {/* My Tools Section */}
        {recentToolSessions.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-text-primary">My Tools</h2>
              <Link
                href="/tools"
                className="text-xs text-purple-600 hover:text-purple-700 font-semibold"
              >
                View all →
              </Link>
            </div>
            <div className="flex gap-2 flex-wrap">
              {recentToolSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedToolId(session.tool_id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-200 bg-white hover:bg-purple-50 transition-colors text-sm font-medium text-text-primary group"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: session.status === "in_progress" ? "#10b981" : "#d1d5db",
                    }}
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

        {/* Recent Portfolio Activity — Collapsible */}
        {recentEntries.length > 0 && (
          <div className="mb-12">
            <details className="group">
              <summary className="cursor-pointer text-lg font-bold text-text-primary flex items-center gap-2 mb-4 hover:text-purple-600 transition">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-600 group-open:rotate-90 transition-transform">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
                Recent Portfolio Activity
              </summary>
              <div className="bg-white rounded-2xl border border-purple-200/40 shadow-sm divide-y divide-border/50 mt-4">
                {recentEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                    {/* Icon */}
                    {entry.type === "entry" ? (
                      entry.media_url ? (
                        <img
                          src={entry.media_url}
                          alt=""
                          className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                          loading="lazy"
                        />
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
                      <img
                        src={entry.media_url}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                        loading="lazy"
                      />
                    ) : entry.type === "link" ? (
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${getDomain(entry.link_url || "")}&sz=20`}
                          alt=""
                          className="w-5 h-5"
                        />
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
                          {entry.content && (
                            <p className="text-sm text-text-primary line-clamp-2">{entry.content}</p>
                          )}
                          {entry.link_url && (
                            <p className="text-xs text-purple-600 truncate mt-0.5">
                              {getDomain(entry.link_url)}
                            </p>
                          )}
                          {!entry.content && !entry.link_url && entry.media_url && (
                            <p className="text-sm text-text-primary">Photo added</p>
                          )}
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
                        {entry.type === "mistake" && (
                          <span className="text-orange-600 font-semibold">Learning</span>
                        )}
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
