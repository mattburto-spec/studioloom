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

      {/* ================================================================= */}
      {/* Row 2 — Needs Attention bar (compact, single-line alerts)         */}
      {/* Replaces the old 50%-width panel. Scannable in <2 seconds.        */}
      {/* ================================================================= */}
      {hasClasses && (
        <AttentionBar stuckStudents={data!.stuckStudents} />
      )}

      {/* ================================================================= */}
      {/* Row 3 — Teach Now cards                                            */}
      {/* ================================================================= */}
      {hasClasses && (() => {
        const teachableUnits: Array<{
          unitId: string; unitTitle: string; classId: string;
          className: string; classCode: string; completionPct: number;
          studentCount: number; inProgressCount: number;
        }> = [];
        const seenUnits = new Set<string>();
        for (const cls of data!.classes) {
          for (const u of cls.units) {
            const key = `${u.unitId}-${cls.id}`;
            if (!seenUnits.has(key)) {
              seenUnits.add(key);
              teachableUnits.push({
                unitId: u.unitId,
                unitTitle: u.unitTitle,
                classId: cls.id,
                className: cls.name,
                classCode: cls.code,
                completionPct: u.completionPct,
                studentCount: cls.studentCount,
                inProgressCount: u.inProgressCount,
              });
            }
          }
        }
        if (teachableUnits.length === 0) return null;
        return (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-text-primary">Teach Now</span>
              <span className="text-xs text-text-secondary">One click to start</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teachableUnits.map((u) => (
                <Link
                  key={`${u.unitId}-${u.classId}`}
                  href={`/teacher/teach/${u.unitId}?classId=${u.classId}`}
                  className="group bg-white rounded-xl border border-border p-3.5 hover:border-purple-300 hover:shadow-md transition-all flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate group-hover:text-purple-700 transition-colors">
                      {u.unitTitle}
                    </p>
                    <p className="text-[11px] text-text-secondary truncate">
                      {u.className} · {u.studentCount} student{u.studentCount !== 1 ? "s" : ""}
                      {u.inProgressCount > 0 && (
                        <span className="text-blue-500 font-medium"> · {u.inProgressCount} working</span>
                      )}
                    </p>
                  </div>
                  {/* Mini progress ring */}
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15" fill="none" stroke="#7C3AED" strokeWidth="3"
                        strokeDasharray={`${u.completionPct * 0.942} 94.2`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-text-secondary">
                      {Math.round(u.completionPct)}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

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
        <>
          {/* ============================================================= */}
          {/* Row 4 — Class Overview (main content)                         */}
          {/* ============================================================= */}
          <ClassOverviewSection classes={data!.classes} />

          {/* ============================================================= */}
          {/* Row 5 — Secondary panels: Activity + Teaching DNA (compact)   */}
          {/* Collapsed by default. Teachers expand if they need them.      */}
          {/* ============================================================= */}
          <div className="mt-6 space-y-3">
            <CollapsibleSection
              title="Recent Activity"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E86AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
              count={data!.recentActivity.length}
              defaultOpen={false}
            >
              <CompactActivityFeed events={data!.recentActivity} />
            </CollapsibleSection>

            {styleProfile && (
              <CollapsibleSection
                title="Your Teaching DNA"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>}
                subtitle={getArchetypeSummary(styleProfile)}
                defaultOpen={false}
              >
                <TeachingDNA profile={styleProfile} />
              </CollapsibleSection>
            )}
          </div>
        </>
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
  const total = unit.completedCount + unit.inProgressCount + unit.notStartedCount;
  const completePct = total > 0 ? (unit.completedCount / total) * 100 : 0;
  const inProgressPct = total > 0 ? (unit.inProgressCount / total) * 100 : 0;
  const studioCount = unit.openStudioCount ?? 0;
  const nmEnabled = unit.nmEnabled ?? false;

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="w-40 shrink-0">
        <p className="text-sm font-medium text-text-primary truncate">{unit.unitTitle}</p>
        <p className="text-xs text-text-secondary mt-0.5">{unit.totalPages} pages</p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
          {completePct > 0 && (
            <div
              className="transition-all duration-500 rounded-l-full"
              style={{ width: `${completePct}%`, background: "#2DA05E" }}
            />
          )}
          {inProgressPct > 0 && (
            <div
              className="transition-all duration-500"
              style={{ width: `${inProgressPct}%`, background: "#F59E0B" }}
            />
          )}
        </div>
      </div>

      <span
        className="text-sm font-bold w-10 text-right"
        style={{
          color: unit.completionPct === 100 ? "#2DA05E" : unit.completionPct > 0 ? "#1A1A2E" : "#9CA3AF",
        }}
      >
        {unit.completionPct}%
      </span>

      <Link
        href={`/teacher/classes/${classId}/progress/${unit.unitId}`}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg transition whitespace-nowrap ${
          studioCount > 0
            ? "text-purple-700 bg-purple-100 hover:bg-purple-200"
            : "text-gray-500 bg-gray-50 hover:bg-gray-100"
        }`}
        title={studioCount > 0 ? `${studioCount} student${studioCount !== 1 ? "s" : ""} in Open Studio` : "Manage Open Studio"}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          {studioCount > 0 ? (
            <path d="M8 12l2 2 4-4" strokeWidth="2.5" />
          ) : (
            <path d="M12 8v4m0 4h.01" />
          )}
        </svg>
        {studioCount > 0 ? `${studioCount} Studio` : "Studio"}
      </Link>

      {nmEnabled && (
        <Link
          href={`/teacher/units/${unit.unitId}/class/${classId}`}
          className="inline-flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg transition whitespace-nowrap"
          style={{
            background: "#FF2D78",
            color: "#fff",
            border: "2px solid #1a1a1a",
            boxShadow: "2px 2px 0 #1a1a1a",
            fontFamily: "'Arial Black', sans-serif",
            fontSize: "10px",
            letterSpacing: "0.5px",
          }}
          title="View NM Results"
        >
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "16px", height: "16px", borderRadius: "4px",
            background: "#FFE135", border: "1.5px solid #1a1a1a",
            fontSize: "8px", fontWeight: 900, color: "#1a1a1a",
            lineHeight: 1,
          }}>
            NM
          </span>
          Results
        </Link>
      )}

      <Link
        href={`/teacher/classes/${classId}/progress/${unit.unitId}`}
        className="text-xs text-brand-purple hover:underline whitespace-nowrap font-medium"
      >
        View
      </Link>
    </div>
  );
}
