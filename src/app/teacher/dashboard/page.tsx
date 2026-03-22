"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateClassCode, timeAgo } from "@/lib/utils";
import { useTeacher } from "../teacher-context";
import type { DashboardData, StuckStudent, ActivityEvent, DashboardClass } from "@/types/dashboard";
import { TeachingDNA } from "@/components/teacher/TeachingDNA";
import { createEmptyProfile } from "@/types/teacher-style";
import type { TeacherStyleProfile } from "@/types/teacher-style";

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

  const [showCreate, setShowCreate] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);
  const [styleProfile, setStyleProfile] = useState<TeacherStyleProfile | null>(null);

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

  useEffect(() => {
    loadDashboard(false);
    const interval = setInterval(() => loadDashboard(true), 30_000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  // Load teacher style profile
  useEffect(() => {
    if (!teacher) return;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("teachers")
          .select("style_profile")
          .eq("id", teacher.id)
          .single();
        if (data?.style_profile) {
          setStyleProfile(data.style_profile as TeacherStyleProfile);
        } else {
          setStyleProfile(createEmptyProfile(teacher.id));
        }
      } catch {
        setStyleProfile(createEmptyProfile(teacher?.id || ""));
      }
    })();
  }, [teacher]);

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

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="h-20 bg-gray-100 rounded-xl" />
            <div className="h-20 bg-gray-100 rounded-xl" />
            <div className="h-20 bg-gray-100 rounded-xl" />
          </div>
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-border">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => loadDashboard(false)}
            className="px-5 py-2.5 bg-brand-purple text-white rounded-xl text-sm font-medium hover:opacity-90 transition"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const hasClasses = data && data.classes.length > 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* ================================================================= */}
      {/* Row 1 — Header strip: welcome + refresh + New Class button        */}
      {/* ================================================================= */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Welcome back{teacher?.name ? `, ${teacher.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-text-secondary text-sm mt-0.5 flex items-center gap-2">
            {refreshing && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-pulse" />
            )}
            Updated {timeAgo(lastRefresh.toISOString())}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-sm"
          style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
        >
          + New Class
        </button>
      </div>

      {!hasClasses ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-border shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-purple/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14m-7-7h14" />
            </svg>
          </div>
          <p className="text-text-primary text-lg font-semibold">No classes yet</p>
          <p className="text-text-secondary text-sm mt-2 max-w-xs mx-auto">
            Create your first class to start building units and tracking student progress.
          </p>
        </div>
      ) : (
        <ThreeColumnDashboard data={data!} styleProfile={styleProfile} />
      )}

      {/* Create class modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl border border-border">
            <h2 className="text-lg font-bold text-text-primary mb-1">Create New Class</h2>
            <p className="text-sm text-text-secondary mb-4">Students will use a code to join.</p>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g. Grade 8 Design"
              className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all mb-4 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") createClass(); }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={createClass}
                disabled={!newClassName.trim() || creating}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
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
// Attention Bar — compact horizontal strip replacing the big panel
// Shows actionable alerts as clickable pills. Collapses to "All clear" when empty.
// ---------------------------------------------------------------------------

function AttentionBar({ stuckStudents }: { stuckStudents: StuckStudent[] }) {
  const [expanded, setExpanded] = useState(false);

  // Group by type of attention needed
  const stuckCount = stuckStudents.length;

  if (stuckCount === 0) {
    return (
      <div className="mb-5 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2DA05E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="text-sm text-emerald-700 font-medium">All students on track</span>
      </div>
    );
  }

  return (
    <div className="mb-5">
      {/* Compact pill row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100/60 transition text-left"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="text-sm text-amber-800 font-medium flex-1">
          {stuckCount} student{stuckCount !== 1 ? "s" : ""} stuck
          <span className="text-amber-600 font-normal"> · click to view</span>
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"
          className="shrink-0 transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable student list */}
      {expanded && (
        <div className="mt-2 bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="divide-y divide-border/50">
            {stuckStudents.slice(0, 8).map((s) => (
              <Link
                key={`${s.studentId}-${s.unitId}-${s.lastPageId}`}
                href={`/teacher/classes/${s.classId}/progress/${s.unitId}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-alt transition group"
              >
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {(s.studentName[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {s.studentName}
                    <span className="text-text-secondary font-normal"> · {s.className}</span>
                  </p>
                </div>
                <span className="text-xs text-amber-600 font-semibold whitespace-nowrap bg-amber-50 px-2 py-0.5 rounded-md">
                  {formatStuckTime(s.hoursSinceUpdate)}
                </span>
              </Link>
            ))}
            {stuckStudents.length > 8 && (
              <div className="px-4 py-2 text-xs text-text-secondary text-center">
                +{stuckStudents.length - 8} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatStuckTime(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Collapsible Section — reusable wrapper for secondary content
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  icon,
  count,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-surface-alt/50 transition text-left"
      >
        <div className="w-6 h-6 rounded-md bg-surface-alt flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[11px] font-bold text-text-secondary bg-surface-alt px-1.5 py-0.5 rounded-md">
            {count}
          </span>
        )}
        {subtitle && (
          <span className="text-xs text-text-secondary ml-1 truncate">{subtitle}</span>
        )}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="ml-auto text-text-secondary shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact Activity Feed — for inside the collapsible section
// ---------------------------------------------------------------------------

function CompactActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-text-secondary">
        No activity yet
      </div>
    );
  }

  return (
    <div className="max-h-[280px] overflow-y-auto divide-y divide-border/50">
      {events.map((e, i) => (
        <div
          key={`${e.studentId}-${e.pageId}-${i}`}
          className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface-alt/50 transition"
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: e.status === "complete" ? "#2DA05E" : "#F59E0B",
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary truncate">
              <span className="font-medium">{e.studentName}</span>
              <span className="text-text-secondary">
                {" "}{e.status === "complete" ? "completed" : "saved"}{" "}
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
  );
}

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
    <span className={`inline-block px-1.5 py-0.5 rounded-md text-[11px] font-mono font-semibold ${classes}`}>
      {pageId}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Three-Column Dashboard — Prepare / Deliver / Review
// ---------------------------------------------------------------------------

function ThreeColumnDashboard({
  data,
  styleProfile,
}: {
  data: DashboardData;
  styleProfile: TeacherStyleProfile | null;
}) {
  // Build flat list of all class-unit pairs
  const allItems: Array<{
    unitId: string; unitTitle: string; classId: string;
    className: string; classCode: string; completionPct: number;
    studentCount: number; inProgressCount: number; totalPages: number;
    openStudioCount: number; nmEnabled: boolean; badgeRequirementCount: number;
    completedCount: number; notStartedCount: number;
  }> = [];
  const seen = new Set<string>();
  for (const cls of data.classes) {
    for (const u of cls.units) {
      const key = `${u.unitId}-${cls.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        allItems.push({
          unitId: u.unitId, unitTitle: u.unitTitle,
          classId: cls.id, className: cls.name, classCode: cls.code,
          completionPct: u.completionPct, studentCount: cls.studentCount,
          inProgressCount: u.inProgressCount, totalPages: u.totalPages,
          openStudioCount: u.openStudioCount ?? 0,
          nmEnabled: u.nmEnabled ?? false,
          badgeRequirementCount: u.badgeRequirementCount ?? 0,
          completedCount: u.completedCount, notStartedCount: u.notStartedCount,
        });
      }
    }
  }

  // Prepare column: units that need attention (low completion, badges, NM config)
  const prepareItems = allItems.filter(
    (u) => u.completionPct < 100
  );

  // Deliver column: all teachable units (sorted by active students first)
  const deliverItems = [...allItems].sort(
    (a, b) => b.inProgressCount - a.inProgressCount
  );

  // Review column: units with progress to review
  const reviewItems = allItems.filter(
    (u) => u.completionPct > 0 || u.inProgressCount > 0
  );

  const COL_STYLES = {
    prepare: {
      headerBg: "linear-gradient(135deg, #3B82F6, #2563EB)",
      headerIcon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      ),
      accentColor: "#3B82F6",
      lightBg: "#EFF6FF",
      borderColor: "#BFDBFE",
    },
    deliver: {
      headerBg: "linear-gradient(135deg, #7C3AED, #6D28D9)",
      headerIcon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <polygon points="10 8 16 11 10 14" fill="white" stroke="none" />
        </svg>
      ),
      accentColor: "#7C3AED",
      lightBg: "#F5F3FF",
      borderColor: "#DDD6FE",
    },
    review: {
      headerBg: "linear-gradient(135deg, #10B981, #059669)",
      headerIcon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
      accentColor: "#10B981",
      lightBg: "#ECFDF5",
      borderColor: "#A7F3D0",
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PREPARE COLUMN                                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: COL_STYLES.prepare.headerBg }}
        >
          {COL_STYLES.prepare.headerIcon}
          <div>
            <h2 className="text-base font-bold text-white">Prepare</h2>
            <p className="text-blue-100 text-xs">Set up & configure</p>
          </div>
        </div>

        {prepareItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-6 text-center">
            <p className="text-sm text-text-secondary">All units set up</p>
          </div>
        ) : (
          prepareItems.map((u) => (
            <div
              key={`prep-${u.unitId}-${u.classId}`}
              className="bg-white rounded-xl border overflow-hidden"
              style={{ borderColor: COL_STYLES.prepare.borderColor }}
            >
              <div className="px-4 py-3">
                <p className="text-sm font-semibold text-text-primary truncate">{u.unitTitle}</p>
                <p className="text-xs text-text-secondary mt-0.5">{u.className} · {u.totalPages} pages</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {u.badgeRequirementCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded px-1.5 py-0.5" style={{ background: "#FEF3C7", color: "#92400E" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                      {u.badgeRequirementCount} badge{u.badgeRequirementCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {u.nmEnabled && (
                    <span className="inline-flex items-center text-[10px] font-black rounded px-1.5 py-0.5" style={{ background: "#FF2D78", color: "#fff", fontFamily: "'Arial Black', sans-serif" }}>
                      NM
                    </span>
                  )}
                  {u.openStudioCount > 0 && (
                    <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                      {u.openStudioCount} in Studio
                    </span>
                  )}
                </div>
              </div>
              <div className="px-4 py-2.5 flex gap-2 border-t" style={{ borderColor: COL_STYLES.prepare.borderColor, background: COL_STYLES.prepare.lightBg }}>
                <Link
                  href={`/teacher/units/${u.unitId}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-80"
                  style={{ background: COL_STYLES.prepare.accentColor, color: "#fff" }}
                >
                  Edit Unit
                </Link>
                <Link
                  href={`/teacher/units/${u.unitId}/class/${u.classId}`}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border transition hover:bg-white"
                  style={{ borderColor: COL_STYLES.prepare.borderColor, color: COL_STYLES.prepare.accentColor }}
                >
                  Class Settings
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DELIVER COLUMN                                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: COL_STYLES.deliver.headerBg }}
        >
          {COL_STYLES.deliver.headerIcon}
          <div>
            <h2 className="text-base font-bold text-white">Deliver</h2>
            <p className="text-purple-100 text-xs">Teach & present</p>
          </div>
        </div>

        {deliverItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-6 text-center">
            <p className="text-sm text-text-secondary">No units to teach yet</p>
          </div>
        ) : (
          deliverItems.map((u) => (
            <div
              key={`deliver-${u.unitId}-${u.classId}`}
              className="bg-white rounded-xl border overflow-hidden"
              style={{ borderColor: COL_STYLES.deliver.borderColor }}
            >
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{u.unitTitle}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {u.className} · {u.studentCount} student{u.studentCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {/* Mini progress ring */}
                  <div className="relative w-9 h-9 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                        stroke={COL_STYLES.deliver.accentColor}
                        strokeDasharray={`${u.completionPct * 0.942} 94.2`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-text-secondary">
                      {Math.round(u.completionPct)}%
                    </span>
                  </div>
                </div>
                {u.inProgressCount > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-medium text-blue-600">{u.inProgressCount} working now</span>
                  </div>
                )}
              </div>
              <div className="px-4 py-2.5 border-t" style={{ borderColor: COL_STYLES.deliver.borderColor, background: COL_STYLES.deliver.lightBg }}>
                <Link
                  href={`/teacher/teach/${u.unitId}?classId=${u.classId}`}
                  className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg transition hover:opacity-90 shadow-sm"
                  style={{ background: COL_STYLES.deliver.headerBg, color: "#fff" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none">
                    <polygon points="6 3 20 12 6 21 6 3" />
                  </svg>
                  Teach Now
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* REVIEW COLUMN                                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: COL_STYLES.review.headerBg }}
        >
          {COL_STYLES.review.headerIcon}
          <div>
            <h2 className="text-base font-bold text-white">Review</h2>
            <p className="text-emerald-100 text-xs">Track & assess</p>
          </div>
        </div>

        {/* Stuck students alert */}
        {data.stuckStudents.length > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-xs font-bold text-amber-800">{data.stuckStudents.length} student{data.stuckStudents.length !== 1 ? "s" : ""} stuck</span>
            </div>
            <div className="space-y-1.5">
              {data.stuckStudents.slice(0, 4).map((s) => (
                <Link
                  key={`stuck-${s.studentId}-${s.unitId}`}
                  href={`/teacher/classes/${s.classId}/progress/${s.unitId}`}
                  className="flex items-center gap-2 text-xs hover:bg-amber-100/60 rounded-lg px-2 py-1.5 transition"
                >
                  <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {(s.studentName[0] || "?").toUpperCase()}
                  </div>
                  <span className="text-amber-900 font-medium truncate">{s.studentName}</span>
                  <span className="text-amber-600 ml-auto whitespace-nowrap">{formatStuckTime(s.hoursSinceUpdate)}</span>
                </Link>
              ))}
              {data.stuckStudents.length > 4 && (
                <p className="text-[10px] text-amber-600 text-center">+{data.stuckStudents.length - 4} more</p>
              )}
            </div>
          </div>
        )}

        {reviewItems.length === 0 && data.stuckStudents.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-6 text-center">
            <p className="text-sm text-text-secondary">No progress to review yet</p>
          </div>
        ) : (
          reviewItems.map((u) => (
            <div
              key={`review-${u.unitId}-${u.classId}`}
              className="bg-white rounded-xl border overflow-hidden"
              style={{ borderColor: COL_STYLES.review.borderColor }}
            >
              <div className="px-4 py-3">
                <p className="text-sm font-semibold text-text-primary truncate">{u.unitTitle}</p>
                <p className="text-xs text-text-secondary mt-0.5">{u.className}</p>
                {/* Progress bar */}
                <div className="mt-2.5 flex items-center gap-2.5">
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{
                        width: `${u.completionPct}%`,
                        background: u.completionPct === 100
                          ? COL_STYLES.review.accentColor
                          : `linear-gradient(90deg, ${COL_STYLES.review.accentColor}, #34D399)`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold" style={{ color: u.completionPct === 100 ? COL_STYLES.review.accentColor : "#6B7280" }}>
                    {Math.round(u.completionPct)}%
                  </span>
                </div>
                {/* Stats row */}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-text-secondary">
                  <span>{u.completedCount} done</span>
                  <span>{u.inProgressCount} active</span>
                  <span>{u.notStartedCount} not started</span>
                </div>
              </div>
              <div className="px-4 py-2.5 border-t" style={{ borderColor: COL_STYLES.review.borderColor, background: COL_STYLES.review.lightBg }}>
                <Link
                  href={`/teacher/classes/${u.classId}/progress/${u.unitId}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-80"
                  style={{ background: COL_STYLES.review.accentColor, color: "#fff" }}
                >
                  View Progress
                </Link>
              </div>
            </div>
          ))
        )}

        {/* Recent Activity */}
        {data.recentActivity.length > 0 && (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              <span className="text-xs font-semibold text-text-primary">Recent Activity</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto divide-y divide-border/50">
              {data.recentActivity.slice(0, 6).map((e, i) => (
                <div
                  key={`act-${e.studentId}-${e.pageId}-${i}`}
                  className="px-4 py-2 flex items-center gap-2 text-xs"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: e.status === "complete" ? "#10B981" : "#F59E0B" }}
                  />
                  <span className="font-medium text-text-primary truncate">{e.studentName}</span>
                  <span className="text-text-secondary truncate">{e.status === "complete" ? "completed" : "saved"}</span>
                  <span className="text-text-secondary ml-auto whitespace-nowrap">{timeAgo(e.updatedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Teaching DNA */}
        {styleProfile && (
          <CollapsibleSection
            title="Teaching DNA"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>}
            subtitle={getArchetypeSummary(styleProfile)}
            defaultOpen={false}
          >
            <TeachingDNA profile={styleProfile} />
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: get archetype summary from style profile
// ---------------------------------------------------------------------------

function getArchetypeSummary(profile: TeacherStyleProfile): string {
  const level = profile.confidenceLevel || "cold_start";
  const units = profile.totalUnitsCreated || 0;
  if (level === "cold_start" && units === 0) return "Getting to know you…";
  const levelLabels: Record<string, string> = {
    cold_start: "Learning your style",
    learning: "Building your profile",
    established: "Profile established",
  };
  return `${levelLabels[level] || level} · ${units} unit${units !== 1 ? "s" : ""} created`;
}

// ---------------------------------------------------------------------------
// Class Overview Section
// ---------------------------------------------------------------------------

function ClassOverviewSection({ classes }: { classes: DashboardClass[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-primary tracking-tight">Your Classes</h2>
      {classes.map((cls) => (
        <ClassCard key={cls.id} cls={cls} />
      ))}
    </div>
  );
}

function ClassCard({ cls }: { cls: DashboardClass }) {
  const [expanded, setExpanded] = useState(true);

  const totalCompleted = cls.units.reduce((s, u) => s + u.completedCount, 0);
  const totalCells = cls.units.reduce(
    (s, u) => s + u.completedCount + u.inProgressCount + u.notStartedCount,
    0
  );
  const overallPct =
    totalCells > 0 ? Math.round((totalCompleted / totalCells) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="w-full px-4 py-3.5 flex items-center justify-between">
        <Link
          href={`/teacher/classes/${cls.id}`}
          className="flex items-center gap-3 flex-1 min-w-0 group"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
          >
            {cls.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left min-w-0">
            <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand-purple transition truncate">{cls.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-secondary">
                {cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}
              </span>
              <span className="font-mono text-xs font-semibold text-brand-purple bg-brand-purple/8 px-1.5 py-0.5 rounded-md">
                {cls.code}
              </span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {cls.units.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-1.5 rounded-full transition-all duration-700"
                  style={{
                    width: `${overallPct}%`,
                    background: overallPct === 100
                      ? "#2DA05E"
                      : "linear-gradient(90deg, #7B2FF2, #A855F7)",
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-text-primary w-8 text-right">
                {overallPct}%
              </span>
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-7 h-7 rounded-lg hover:bg-surface-alt flex items-center justify-center transition"
          >
            <svg
              className="text-text-secondary transition-transform duration-200"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {cls.units.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-secondary">
              No active units.{" "}
              <Link
                href={`/teacher/classes/${cls.id}`}
                className="text-brand-purple hover:underline font-medium"
              >
                Assign a unit
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
  const studioCount = unit.openStudioCount ?? 0;
  const nmEnabled = unit.nmEnabled ?? false;
  const badgeCount = unit.badgeRequirementCount ?? 0;
  const hasActiveStudents = unit.inProgressCount > 0;
  const isComplete = unit.completionPct === 100;

  return (
    <div className="px-4 py-3.5 flex items-start gap-3 group/row hover:bg-surface-alt/30 transition">
      {/* Left: title + stats line */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{unit.unitTitle}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Completion — readable text */}
          <span className={`text-xs font-medium ${isComplete ? "text-emerald-600" : "text-text-secondary"}`}>
            {isComplete ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5 mr-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Complete
              </>
            ) : (
              <>{unit.completionPct}% · {unit.totalPages} pages</>
            )}
          </span>

          {/* Active students chip */}
          {hasActiveStudents && (
            <>
              <span className="text-text-tertiary/40">·</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                {unit.inProgressCount} working
              </span>
            </>
          )}

          {/* Open Studio chip */}
          {studioCount > 0 && (
            <>
              <span className="text-text-tertiary/40">·</span>
              <span className="text-xs font-medium text-purple-600">
                {studioCount} in Studio
              </span>
            </>
          )}

          {/* NM badge */}
          {nmEnabled && (
            <>
              <span className="text-text-tertiary/40">·</span>
              <Link
                href={`/teacher/units/${unit.unitId}/class/${classId}`}
                className="inline-flex items-center gap-1 text-xs font-black rounded transition whitespace-nowrap"
                style={{
                  background: "#FF2D78",
                  color: "#fff",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  letterSpacing: "0.3px",
                  fontFamily: "'Arial Black', sans-serif",
                }}
                title="View NM Results"
              >
                NM
              </Link>
            </>
          )}

          {/* Safety badge requirement */}
          {badgeCount > 0 && (
            <>
              <span className="text-text-tertiary/40">·</span>
              <Link
                href={`/teacher/classes/${classId}/progress/${unit.unitId}`}
                className="inline-flex items-center gap-1 text-xs font-bold rounded transition whitespace-nowrap"
                style={{
                  background: "#D97706",
                  color: "#fff",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  fontSize: "10px",
                }}
                title={`${badgeCount} safety badge${badgeCount > 1 ? "s" : ""} required`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                {badgeCount}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <Link
          href={`/teacher/teach/${unit.unitId}?classId=${classId}`}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-semibold hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm flex items-center gap-1.5"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
          Teach
        </Link>
        <Link
          href={`/teacher/classes/${classId}/progress/${unit.unitId}`}
          className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-primary hover:bg-surface-alt transition"
        >
          Progress
        </Link>
      </div>
    </div>
  );
}
