"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateClassCode, timeAgo } from "@/lib/utils";
import { useTeacher } from "../teacher-context";
import type { DashboardData } from "@/types/dashboard";
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
        }
      } catch {
        // no profile yet — fine
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
        {/* Class creation moved to Classes page */}
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
        <TwoColumnDashboard data={data!} styleProfile={styleProfile} />
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

function formatStuckTime(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Two-Column Dashboard — Sidebar (1/3) + Class Cards (2/3)
// ---------------------------------------------------------------------------

// Class color palette — deterministic per class index
const CLASS_COLORS = [
  { fill: "#3B82F6", light: "#EFF6FF", text: "#1E40AF" },  // blue
  { fill: "#10B981", light: "#ECFDF5", text: "#065F46" },  // emerald
  { fill: "#F59E0B", light: "#FFFBEB", text: "#92400E" },  // amber
  { fill: "#8B5CF6", light: "#F5F3FF", text: "#5B21B6" },  // purple
  { fill: "#EC4899", light: "#FDF2F8", text: "#9D174D" },  // pink
  { fill: "#06B6D4", light: "#ECFEFF", text: "#155E75" },  // cyan
  { fill: "#F97316", light: "#FFF7ED", text: "#9A3412" },  // orange
  { fill: "#6366F1", light: "#EEF2FF", text: "#3730A3" },  // indigo
];

function getClassColor(classIdx: number) {
  return CLASS_COLORS[classIdx % CLASS_COLORS.length];
}

interface ScheduleEntry {
  date: string;
  cycleDay: number;
  period?: number;
  room?: string;
  classId: string;
  className: string;
  unitId: string;
  unitTitle: string;
}

function TwoColumnDashboard({
  data,
  styleProfile,
}: {
  data: DashboardData;
  styleProfile: TeacherStyleProfile | null;
}) {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [hasTimetable, setHasTimetable] = useState(false);

  // Build class index map for consistent colors
  const classIndexMap = new Map<string, number>();
  data.classes.forEach((cls, idx) => classIndexMap.set(cls.id, idx));

  // Build flat list of all class-unit pairs for the cards
  const classCards: Array<{
    unitId: string; unitTitle: string; classId: string;
    className: string; classCode: string; completionPct: number;
    studentCount: number; inProgressCount: number;
    openStudioCount: number; nmEnabled: boolean; badgeRequirementCount: number;
    isForked: boolean;
    completedCount: number; notStartedCount: number;
    classIdx: number;
  }> = [];
  const seen = new Set<string>();
  for (const cls of data.classes) {
    for (const u of cls.units) {
      const key = `${u.unitId}-${cls.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        classCards.push({
          unitId: u.unitId, unitTitle: u.unitTitle,
          classId: cls.id, className: cls.name, classCode: cls.code,
          completionPct: u.completionPct, studentCount: cls.studentCount,
          inProgressCount: u.inProgressCount,
          openStudioCount: u.openStudioCount ?? 0,
          nmEnabled: u.nmEnabled ?? false,
          badgeRequirementCount: u.badgeRequirementCount ?? 0,
          isForked: u.isForked ?? false,
          completedCount: u.completedCount, notStartedCount: u.notStartedCount,
          classIdx: classIndexMap.get(cls.id) ?? 0,
        });
      }
    }
  }
  // Sort: active students first
  classCards.sort((a, b) => b.inProgressCount - a.inProgressCount);

  // Fetch today's schedule
  useEffect(() => {
    (async () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/teacher/schedule/today?days=7&tz=${encodeURIComponent(tz)}`);
        if (!res.ok) { setScheduleLoading(false); return; }
        const schedData = await res.json();
        setHasTimetable(schedData.hasTimetable ?? false);
        setSchedule(schedData.entries || []);
      } catch {
        // fine
      } finally {
        setScheduleLoading(false);
      }
    })();
  }, []);

  // Use local date (not UTC) so "today" matches the tz-aware API response
  const today = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD" in local timezone
  const todayEntries = schedule.filter((e) => e.date === today);
  const upcomingEntries = schedule.filter((e) => e.date > today).slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SIDEBAR — 1/3 width                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-4 space-y-4">

        {/* ── Today's Schedule ── */}
        <SidebarSection
          title="Today"
          subtitle={new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
          accentColor="#3B82F6"
        >
          {scheduleLoading ? (
            <div className="animate-pulse space-y-2 p-3">
              <div className="h-10 bg-gray-100 rounded-lg" />
              <div className="h-10 bg-gray-100 rounded-lg" />
            </div>
          ) : !hasTimetable ? (
            <div className="p-4 text-center">
              <p className="text-xs text-text-secondary mb-2">Add your timetable to see classes here.</p>
              <Link href="/teacher/settings" className="text-xs font-semibold text-blue-600 hover:underline">Go to Settings</Link>
            </div>
          ) : todayEntries.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-text-secondary">No classes today</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {todayEntries.map((entry, idx) => {
                const cIdx = classIndexMap.get(entry.classId) ?? idx;
                const c = getClassColor(cIdx);
                return (
                  <Link
                    key={`today-${idx}`}
                    href={`/teacher/teach/${entry.unitId}?classId=${entry.classId}`}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition group"
                  >
                    <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: c.fill }}>
                      {entry.period ? <span>P{entry.period}</span> : <span>-</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{entry.className}</p>
                      <p className="text-[11px] text-text-secondary truncate">{entry.unitTitle}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#7C3AED" stroke="none" className="shrink-0 opacity-0 group-hover:opacity-100 transition">
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          )}
          {/* Upcoming preview */}
          {upcomingEntries.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-2">
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Coming up</p>
              {upcomingEntries.slice(0, 3).map((entry, idx) => {
                const cIdx = classIndexMap.get(entry.classId) ?? idx;
                const c = getClassColor(cIdx);
                const d = new Date(entry.date + "T00:00:00");
                const dayName = d.toLocaleDateString("en-AU", { weekday: "short" });
                return (
                  <div key={`up-${idx}`} className="flex items-center gap-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.fill }} />
                    <span className="text-[11px] text-text-primary truncate flex-1">{entry.className}</span>
                    <span className="text-[10px] text-text-secondary">{dayName}{entry.period ? ` P${entry.period}` : ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SidebarSection>

        {/* ── Stuck Students ── */}
        {data.stuckStudents.length > 0 && (
          <SidebarSection
            title="Needs Attention"
            subtitle={`${data.stuckStudents.length} student${data.stuckStudents.length !== 1 ? "s" : ""}`}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
            accentColor="#F59E0B"
          >
            <div className="divide-y divide-gray-100">
              {data.stuckStudents.slice(0, 5).map((s) => (
                <Link
                  key={`stuck-${s.studentId}-${s.unitId}`}
                  href={`/teacher/classes/${s.classId}/progress/${s.unitId}`}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50/50 transition text-xs"
                >
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {(s.studentName[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary truncate">{s.studentName}</p>
                    <p className="text-[10px] text-text-secondary truncate">{s.className}</p>
                  </div>
                  <span className="text-amber-600 font-semibold whitespace-nowrap">{formatStuckTime(s.hoursSinceUpdate)}</span>
                </Link>
              ))}
              {data.stuckStudents.length > 5 && (
                <p className="text-[10px] text-text-secondary text-center py-2">+{data.stuckStudents.length - 5} more</p>
              )}
            </div>
          </SidebarSection>
        )}

        {/* ── Recent Activity ── */}
        {data.recentActivity.length > 0 && (
          <SidebarSection
            title="Activity"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
            accentColor="#10B981"
          >
            <div className="divide-y divide-gray-100">
              {data.recentActivity.slice(0, 5).map((e, i) => (
                <div key={`act-${e.studentId}-${e.pageId}-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.status === "complete" ? "#10B981" : "#F59E0B" }} />
                  <span className="font-medium text-text-primary truncate">{e.studentName}</span>
                  <span className="text-text-secondary ml-auto whitespace-nowrap">{timeAgo(e.updatedAt)}</span>
                </div>
              ))}
            </div>
          </SidebarSection>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MAIN — 2/3 width — Big class-unit cards                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-8 space-y-4">
        <h2 className="text-lg font-bold text-text-primary">Your Classes</h2>

        {classCards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-12 text-center">
            <p className="text-sm text-text-secondary">No units assigned to classes yet. Create a unit and assign it to get started.</p>
          </div>
        ) : (
          classCards.map((u) => {
            const c = getClassColor(u.classIdx);
            // Derive a darker shade for gradient end
            const darkerFill = c.fill + "CC";
            return (
              <div
                key={`card-${u.unitId}-${u.classId}`}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-stretch">
                  {/* Class identity panel — gradient with subtle pattern */}
                  <div
                    className="w-44 shrink-0 flex flex-col items-center justify-center py-6 text-white relative overflow-hidden"
                    style={{
                      background: `linear-gradient(160deg, ${c.fill}, ${darkerFill})`,
                    }}
                  >
                    {/* Decorative circles */}
                    <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-10" style={{ background: "#fff" }} />
                    <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10" style={{ background: "#fff" }} />
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full opacity-5" style={{ background: "#fff" }} />
                    <p className="text-lg font-extrabold leading-tight text-center px-3 relative z-10 drop-shadow-sm">{u.className}</p>
                    <p className="text-xs opacity-75 mt-1.5 relative z-10 font-medium">{u.studentCount} student{u.studentCount !== 1 ? "s" : ""}</p>
                  </div>

                  <div className="flex-1 px-5 py-4 flex flex-col">
                    {/* Unit title — bigger and bolder */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-xl font-extrabold text-text-primary leading-snug tracking-tight">{u.unitTitle}</h3>
                        {/* Status badges */}
                        {u.isForked && (
                          <div className="mt-2">
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" /><path d="M12 12v3" /></svg>
                              Customized
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Progress ring */}
                      <div className="relative w-14 h-14 flex-shrink-0">
                        <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="2.5" />
                          <circle cx="18" cy="18" r="15" fill="none" strokeWidth="2.5" stroke={c.fill} strokeDasharray={`${u.completionPct * 0.942} 94.2`} strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text-secondary">{Math.round(u.completionPct)}%</span>
                      </div>
                    </div>

                    {/* Bottom row — action buttons + feature badges */}
                    <div className="flex items-center justify-between gap-3 mt-auto pt-4">
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/teacher/teach/${u.unitId}?classId=${u.classId}`}
                          className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl text-white shadow-sm transition hover:opacity-90"
                          style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                          Teach
                        </Link>
                        <Link
                          href={`/teacher/units/${u.unitId}/class/${u.classId}`}
                          className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl text-white shadow-sm transition hover:opacity-90"
                          style={{ background: c.fill }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                          Manage
                        </Link>
                        <Link
                          href={`/teacher/units/${u.unitId}/class/${u.classId}/edit`}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border-2 border-gray-200 text-text-secondary transition hover:bg-gray-50"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          Edit Unit
                        </Link>
                        <Link
                          href={`/teacher/classes/${u.classId}/progress/${u.unitId}`}
                          className="inline-flex items-center gap-1.5 text-sm font-bold px-5 py-2 rounded-full text-white transition-all duration-200 hover:shadow-lg hover:scale-[1.03] active:scale-[0.97]"
                          style={{
                            background: u.openStudioCount > 0
                              ? "linear-gradient(135deg, #06B6D4, #8B5CF6, #EC4899)"
                              : "linear-gradient(135deg, #67E8F9, #A78BFA, #F9A8D4)",
                            boxShadow: u.openStudioCount > 0
                              ? "0 3px 12px rgba(139, 92, 246, 0.3), 0 1px 4px rgba(236, 72, 153, 0.2)"
                              : "0 2px 6px rgba(167, 139, 250, 0.2)",
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                          Studio
                          {u.openStudioCount > 0 && (
                            <span className="text-xs font-extrabold px-1.5 py-0.5 rounded-full ml-0.5" style={{ background: "rgba(255,255,255,0.3)" }}>
                              {u.openStudioCount}
                            </span>
                          )}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                        </Link>
                      </div>

                      {/* Feature badges — right side, bigger */}
                      <div className="flex items-center gap-2 shrink-0">
                        {u.nmEnabled && (
                          <span
                            className="inline-flex items-center justify-center text-xs font-black px-2.5 py-1.5 rounded-lg shadow-sm"
                            style={{ background: "#FF2D78", color: "#fff", fontFamily: "'Arial Black', sans-serif", letterSpacing: "0.02em" }}
                          >
                            NM
                          </span>
                        )}
                        {u.badgeRequirementCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-sm"
                            style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="#92400E" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                            {u.badgeRequirementCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarSection — clean card wrapper for sidebar items
// ---------------------------------------------------------------------------

function SidebarSection({
  title,
  subtitle,
  icon,
  accentColor,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: accentColor + "15", color: accentColor }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text-primary">{title}</p>
          {subtitle && <p className="text-[10px] text-text-secondary truncate">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

