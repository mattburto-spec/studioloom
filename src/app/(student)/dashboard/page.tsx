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

  useEffect(() => {
    async function loadUnits() {
      if (!student) return;
      try {
        const res = await fetch("/api/student/units");
        if (res.ok) {
          const data = await res.json();
          setUnits(data.units || []);
        }
      } finally {
        setLoading(false);
      }
    }
    loadUnits();
    loadPortfolio();
    loadToolSessions();
  }, [student, loadPortfolio, loadToolSessions]);

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

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      {/* Tool Modal */}
      {selectedToolId && (
        <ToolModal
          toolId={selectedToolId}
          onClose={() => setSelectedToolId(null)}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">
          Welcome back, {student?.display_name || student?.username}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          {classInfo?.name} — Choose a unit to continue
        </p>
      </div>

      {/* Unit Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 animate-pulse h-48 shadow-sm border border-border" />
          ))}
        </div>
      ) : units.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-border shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-purple/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </div>
          <p className="text-text-primary text-lg font-semibold">No units assigned yet</p>
          <p className="text-text-secondary text-sm mt-2 max-w-xs mx-auto">
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

            return (
              <Link
                key={unit.id}
                href={`/unit/${unit.id}/${firstPageId}`}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-border hover:shadow-md hover:border-brand-purple/20 transition-all duration-200 group"
              >
                {/* Thumbnail */}
                {unit.thumbnail_url && (
                  <div className="w-full h-36 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={unit.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h2 className="font-semibold text-base text-text-primary group-hover:text-brand-purple transition mb-1.5">
                    {unit.title}
                  </h2>
                  {unit.description && (
                    <p className="text-text-secondary text-sm mb-4 line-clamp-2 leading-relaxed">
                      {unit.description}
                    </p>
                  )}

                  {/* Criterion progress bars */}
                  <div className="flex gap-1.5 mb-2.5">
                    {criterionKeys.length > 0 ? criterionKeys.map((key) => {
                      const cp = getCriterionProgress(unitPages, unit.progress, key);
                      if (!cp) return null;
                      const fillPercent = (cp.completed / cp.total) * 100;
                      return (
                        <div
                          key={key}
                          className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden"
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
                    }) : (
                      <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${unitPages.length > 0 ? (unit.progress.filter(p => p.status === "complete").length / unitPages.length) * 100 : 0}%`,
                            background: "linear-gradient(90deg, #7B2FF2, #A855F7)",
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-text-secondary font-medium">
                      {percent}% complete
                    </p>
                    {percent === 100 && (
                      <span className="text-xs font-semibold text-accent-green bg-accent-green/10 px-2 py-0.5 rounded-full">
                        Done
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Open Studio Readiness — shows criteria progress */}
      <div className="mt-10">
        <ReadinessIndicator unlocked={false} compact={false} />
      </div>

      {/* My Tools Section */}
      {recentToolSessions.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">My Tools</h2>
            <Link
              href="/tools"
              className="text-xs text-brand-purple hover:underline font-medium"
            >
              View all
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-border shadow-sm divide-y divide-border/50">
            {recentToolSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedToolId(session.tool_id)}
                className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-surface-alt/50 transition group"
              >
                {/* Tool icon */}
                <div className="w-10 h-10 rounded-xl bg-brand-purple/8 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l7.853 2.646a2 2 0 011.147 1.147L22 12l-2.646 7.853a2 2 0 01-1.147 1.147L12 22l-7.853-2.646a2 2 0 01-1.147-1.147L2 12l2.646-7.853a2 2 0 011.147-1.147L12 2z" />
                    <path d="M12 7v5l3.5 2" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary group-hover:text-brand-purple transition capitalize">
                    {session.tool_id.replace(/-/g, " ")}
                    {session.version > 1 && (
                      <span className="text-text-secondary text-xs ml-2">v{session.version}</span>
                    )}
                  </p>
                  <p className="text-xs text-text-secondary line-clamp-1 mt-0.5">
                    {session.challenge}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: session.status === "in_progress" ? "#059669" : "#6B7280",
                      background: session.status === "in_progress" ? "rgba(5,150,105,0.1)" : "rgba(107,114,128,0.1)",
                    }}
                  >
                    {session.status === "in_progress" ? "In progress" : "Done"}
                  </span>
                  <span className="text-xs text-text-secondary/50">{timeAgo(session.started_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Portfolio Activity */}
      {recentEntries.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-text-primary tracking-tight mb-4">
            Recent Portfolio Activity
          </h2>
          <div className="bg-white rounded-2xl border border-border shadow-sm divide-y divide-border/50">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-5 py-3.5"
              >
                {/* Icon / thumbnail */}
                {entry.type === "entry" ? (
                  entry.media_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.media_url}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E86AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                  )
                ) : entry.type === "photo" && entry.media_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.media_url}
                    alt=""
                    className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                    loading="lazy"
                  />
                ) : entry.type === "link" ? (
                  <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${getDomain(entry.link_url || "")}&sz=20`}
                      alt=""
                      className="w-5 h-5"
                    />
                  </div>
                ) : entry.type === "mistake" ? (
                  <div className="w-10 h-10 rounded-xl bg-accent-orange/10 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E86F2C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18h6" /><path d="M10 22h4" />
                      <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-surface-alt flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
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
                        <p className="text-xs text-brand-purple truncate mt-0.5">
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
                      <span className="text-accent-orange font-semibold">Learning</span>
                    )}
                    <span className="bg-surface-alt px-2 py-0.5 rounded-md text-text-secondary text-xs font-medium">
                      {getUnitTitle(entry.unit_id)}
                    </span>
                    <span>{timeAgo(entry.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Capture FAB */}
      {units.length > 0 && (
        <QuickCaptureFAB
          availableUnits={units.map((u) => ({ id: u.id, title: u.title }))}
          onEntryCreated={loadPortfolio}
        />
      )}
    </main>
  );
}
