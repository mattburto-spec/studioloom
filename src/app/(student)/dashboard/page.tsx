"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useStudent } from "../student-context";
import { CRITERIA, type CriterionKey } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import { timeAgo, getDomain } from "@/lib/utils";
import { QuickCaptureFAB } from "@/components/portfolio/QuickCaptureFAB";
import type { Unit, StudentProgress, PortfolioEntry, UnitPage } from "@/types";

interface UnitWithProgress extends Unit {
  progress: StudentProgress[];
}

export default function StudentDashboard() {
  const { student, classInfo } = useStudent();
  const [units, setUnits] = useState<UnitWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentEntries, setRecentEntries] = useState<PortfolioEntry[]>([]);

  const loadPortfolio = useCallback(async () => {
    try {
      const res = await fetch("/api/student/portfolio?limit=10");
      if (res.ok) {
        const data = await res.json();
        setRecentEntries(data.entries || []);
      }
    } catch {
      // fail silently
    }
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
  }, [student, loadPortfolio]);

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
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome back, {student?.display_name || student?.username}
        </h1>
        <p className="text-text-secondary mt-1">
          {classInfo?.name} — Choose a unit to continue
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-48" />
          ))}
        </div>
      ) : units.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-text-secondary text-lg">No units assigned yet.</p>
          <p className="text-text-secondary/70 text-sm mt-2">
            Your teacher will assign units for you to work on.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {units.map((unit) => {
            const unitPages = getPageList(unit.content_data);
            const firstPageId = unitPages.length > 0 ? unitPages[0].id : "A1";
            const percent = getCompletionPercent(unit, unit.progress);

            // Build criterion bars from actual pages
            const criterionKeys = [...new Set(
              unitPages
                .filter((p) => p.type === "strand" && p.criterion)
                .map((p) => p.criterion as CriterionKey)
            )];

            return (
              <Link
                key={unit.id}
                href={`/unit/${unit.id}/${firstPageId}`}
                className="bg-white rounded-xl overflow-hidden hover:shadow-md transition group"
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
                <div className="p-6">
                <h2 className="font-semibold text-lg text-text-primary group-hover:text-accent-blue transition mb-2">
                  {unit.title}
                </h2>
                {unit.description && (
                  <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                    {unit.description}
                  </p>
                )}

                {/* Criterion progress bars */}
                <div className="flex gap-1.5 mb-3">
                  {criterionKeys.length > 0 ? criterionKeys.map((key) => {
                    const cp = getCriterionProgress(unitPages, unit.progress, key);
                    if (!cp) return null;
                    const fillPercent = (cp.completed / cp.total) * 100;
                    return (
                      <div
                        key={key}
                        className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${fillPercent}%`,
                            backgroundColor: CRITERIA[key].color,
                          }}
                        />
                      </div>
                    );
                  }) : (
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${unitPages.length > 0 ? (unit.progress.filter(p => p.status === "complete").length / unitPages.length) * 100 : 0}%`,
                          backgroundColor: "#2E86AB",
                        }}
                      />
                    </div>
                  )}
                </div>

                <p className="text-xs text-text-secondary">
                  {percent}% complete
                </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Recent Portfolio Activity */}
      {recentEntries.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Recent Portfolio Activity
          </h2>
          <div className="bg-white rounded-xl divide-y divide-border">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-4 py-3"
              >
                {/* Icon / thumbnail */}
                {entry.type === "entry" ? (
                  entry.media_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.media_url}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
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
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    loading="lazy"
                  />
                ) : entry.type === "link" ? (
                  <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${getDomain(entry.link_url || "")}&sz=20`}
                      alt=""
                      className="w-5 h-5"
                    />
                  </div>
                ) : entry.type === "mistake" ? (
                  <div className="w-10 h-10 rounded-lg bg-accent-orange/10 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E86F2C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18h6" /><path d="M10 22h4" />
                      <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-surface-alt flex items-center justify-center flex-shrink-0">
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
                        <p className="text-xs text-accent-blue truncate mt-0.5">
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
                  <div className="flex items-center gap-2 text-xs text-text-secondary/60 mt-0.5">
                    {entry.type === "mistake" && (
                      <span className="text-accent-orange font-medium">Learning</span>
                    )}
                    <span className="bg-surface-alt px-1.5 py-0.5 rounded text-text-secondary text-xs">
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
