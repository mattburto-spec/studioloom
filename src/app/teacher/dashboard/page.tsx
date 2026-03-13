"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateClassCode, timeAgo } from "@/lib/utils";
import { useTeacher } from "../teacher-context";
import type { DashboardData, StuckStudent, ActivityEvent, DashboardClass } from "@/types/dashboard";

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TeacherDashboard() {
  const { teacher } = useTeacher();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Class creation state (preserved from original)
  const [showCreate, setShowCreate] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadDashboard = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch("/api/teacher/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      const json: DashboardData = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch {
      if (!background) setError("Failed to load dashboard data");
    } finally {
      if (!background) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load + 30s auto-refresh
  useEffect(() => {
    loadDashboard(false);
    const interval = setInterval(() => loadDashboard(true), 30_000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  async function createClass() {
    if (!newClassName.trim() || !teacher) return;
    setCreating(true);

    const supabase = createClient();
    const code = generateClassCode();

    const { error: err } = await supabase.from("classes").insert({
      teacher_id: teacher.id,
      name: newClassName.trim(),
      code,
    });

    if (!err) {
      setNewClassName("");
      setShowCreate(false);
      loadDashboard(true);
    }
    setCreating(false);
  }

  // Loading skeleton
  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-xl" />
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => loadDashboard(false)}
            className="mt-4 px-4 py-2 bg-dark-blue text-white rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const hasClasses = data && data.classes.length > 0;

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary text-sm mt-0.5 flex items-center gap-2">
            {data && (
              <span>
                {data.classes.length} class{data.classes.length !== 1 ? "es" : ""} ·{" "}
                {data.classes.reduce((sum, c) => sum + c.studentCount, 0)} students
              </span>
            )}
            <span className="text-text-secondary/50">·</span>
            <span className="flex items-center gap-1">
              {refreshing && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
              )}
              Updated {timeAgo(lastRefresh.toISOString())}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition"
        >
          + New Class
        </button>
      </div>

      {!hasClasses ? (
        /* Empty state — same as original */
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-text-secondary text-lg">No classes yet.</p>
          <p className="text-text-secondary/70 text-sm mt-2">
            Create your first class to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Top row: Needs Attention + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <NeedsAttentionPanel stuckStudents={data!.stuckStudents} />
            <RecentActivityFeed events={data!.recentActivity} />
          </div>

          {/* Class Overview */}
          <ClassOverviewSection classes={data!.classes} />
        </>
      )}

      {/* Create class modal (preserved from original) */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold mb-4">Create New Class</h2>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g. Grade 8 Design"
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") createClass();
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-alt transition"
              >
                Cancel
              </button>
              <button
                onClick={createClass}
                disabled={!newClassName.trim() || creating}
                className="flex-1 py-2 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition disabled:opacity-40"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Needs Attention Panel
// ---------------------------------------------------------------------------

function NeedsAttentionPanel({ stuckStudents }: { stuckStudents: StuckStudent[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? stuckStudents : stuckStudents.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-500 text-base">⚠</span>
          <h2 className="text-sm font-semibold text-text-primary">Needs Attention</h2>
          {stuckStudents.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
              {stuckStudents.length}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {stuckStudents.length === 0 ? (
          <div className="flex items-center gap-2 py-4 justify-center text-sm text-text-secondary">
            <span className="text-accent-green text-base">✓</span>
            All students active
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((s) => (
              <Link
                key={`${s.studentId}-${s.unitId}-${s.lastPageId}`}
                href={`/teacher/classes/${s.classId}/progress/${s.unitId}`}
                className="flex items-center gap-3 px-2 py-2 -mx-2 rounded-lg hover:bg-surface-alt transition group"
              >
                {/* Avatar initial */}
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold shrink-0">
                  {(s.studentName[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {s.studentName}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {s.className} · {s.unitTitle} · Page {s.lastPageId}
                  </p>
                </div>
                <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                  {formatStuckTime(s.hoursSinceUpdate)}
                </span>
              </Link>
            ))}
            {stuckStudents.length > 5 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-xs text-accent-blue hover:underline py-1"
              >
                {showAll
                  ? "Show less"
                  : `Show ${stuckStudents.length - 5} more`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatStuckTime(hours: number): string {
  if (hours < 24) return `${hours}h inactive`;
  const days = Math.floor(hours / 24);
  return `${days}d inactive`;
}

// ---------------------------------------------------------------------------
// Recent Activity Feed
// ---------------------------------------------------------------------------

function RecentActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <span className="text-base">📋</span>
          Recent Activity
        </h2>
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">
            No activity yet
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {events.map((e, i) => (
              <div
                key={`${e.studentId}-${e.pageId}-${i}`}
                className="px-4 py-2.5 flex items-center gap-3"
              >
                {/* Status dot */}
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    e.status === "complete"
                      ? "bg-accent-green"
                      : "bg-amber-400"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    <span className="font-medium">{e.studentName}</span>
                    <span className="text-text-secondary">
                      {" "}
                      {e.status === "complete" ? "completed" : "saved"}{" "}
                    </span>
                    <PageBadge pageId={e.pageId} />
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {e.className} · {e.unitTitle}
                  </p>
                </div>
                <span className="text-xs text-text-secondary whitespace-nowrap">
                  {timeAgo(e.updatedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Small inline badge for page IDs, colored by criterion */
function PageBadge({ pageId }: { pageId: string }) {
  const criterion = pageId.match(/^([A-D])/)?.[1];
  const colorMap: Record<string, string> = {
    A: "text-[#2E86AB] bg-[#2E86AB]/10",
    B: "text-[#2DA05E] bg-[#2DA05E]/10",
    C: "text-[#E86F2C] bg-[#E86F2C]/10",
    D: "text-[#7B2D8E] bg-[#7B2D8E]/10",
  };
  const classes = criterion && colorMap[criterion]
    ? colorMap[criterion]
    : "text-text-secondary bg-surface-alt";

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold ${classes}`}>
      {pageId}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Class Overview Section
// ---------------------------------------------------------------------------

function ClassOverviewSection({ classes }: { classes: DashboardClass[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <span className="text-base">📊</span>
        Class Overview
      </h2>
      {classes.map((cls) => (
        <ClassCard key={cls.id} cls={cls} />
      ))}
    </div>
  );
}

function ClassCard({ cls }: { cls: DashboardClass }) {
  const [expanded, setExpanded] = useState(true);

  // Overall completion across all units
  const totalCompleted = cls.units.reduce((s, u) => s + u.completedCount, 0);
  const totalCells = cls.units.reduce(
    (s, u) => s + u.completedCount + u.inProgressCount + u.notStartedCount,
    0
  );
  const overallPct =
    totalCells > 0 ? Math.round((totalCompleted / totalCells) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Header — clickable to toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-alt/30 transition"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {cls.name}
          </h3>
          <span className="text-xs text-text-secondary">
            {cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}
          </span>
          <span className="font-mono text-xs font-medium text-accent-blue bg-accent-blue/10 px-1.5 py-0.5 rounded">
            {cls.code}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {cls.units.length > 0 && (
            <span className="text-xs font-medium text-text-primary">
              {overallPct}%
            </span>
          )}
          <svg
            className={`w-4 h-4 text-text-secondary transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Body — unit progress bars */}
      {expanded && (
        <div className="border-t border-border">
          {cls.units.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-secondary">
              No active units.{" "}
              <Link
                href={`/teacher/classes/${cls.id}`}
                className="text-accent-blue hover:underline"
              >
                Assign a unit →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {cls.units.map((unit) => (
                <UnitProgressRow
                  key={unit.unitId}
                  unit={unit}
                  classId={cls.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UnitProgressRow({
  unit,
  classId,
}: {
  unit: DashboardClass["units"][0];
  classId: string;
}) {
  const total =
    unit.completedCount + unit.inProgressCount + unit.notStartedCount;
  const completePct = total > 0 ? (unit.completedCount / total) * 100 : 0;
  const inProgressPct = total > 0 ? (unit.inProgressCount / total) * 100 : 0;

  return (
    <div className="px-4 py-3 flex items-center gap-4">
      {/* Unit title */}
      <div className="w-40 shrink-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {unit.unitTitle}
        </p>
        <p className="text-xs text-text-secondary">
          {unit.totalPages} pages
        </p>
      </div>

      {/* Stacked bar */}
      <div className="flex-1 min-w-0">
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
          {completePct > 0 && (
            <div
              className="bg-accent-green transition-all duration-500"
              style={{ width: `${completePct}%` }}
            />
          )}
          {inProgressPct > 0 && (
            <div
              className="bg-amber-400 transition-all duration-500"
              style={{ width: `${inProgressPct}%` }}
            />
          )}
        </div>
      </div>

      {/* Percentage */}
      <span
        className={`text-sm font-semibold w-12 text-right ${
          unit.completionPct === 100
            ? "text-accent-green"
            : unit.completionPct > 0
            ? "text-text-primary"
            : "text-text-secondary"
        }`}
      >
        {unit.completionPct}%
      </span>

      {/* View link */}
      <Link
        href={`/teacher/classes/${classId}/progress/${unit.unitId}`}
        className="text-xs text-accent-blue hover:underline whitespace-nowrap"
      >
        View →
      </Link>
    </div>
  );
}
