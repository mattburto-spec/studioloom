"use client";

import { useState, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// StudentDrawer — Slide-out panel showing comprehensive student snapshot
// ---------------------------------------------------------------------------
// Opens from any student name click in the Class Hub.
// Fetches all data for one student via /api/teacher/student-snapshot.
// ---------------------------------------------------------------------------

interface StudentDrawerProps {
  studentId: string;
  studentName: string;
  unitId: string;
  classId: string;
  onClose: () => void;
}

interface SnapshotData {
  pages: Array<{ id: string; title: string }>;
  progress: Record<string, { status: string; timeSpent: number; updatedAt: string; hasResponses: boolean }>;
  pagesCompleted: number;
  totalPages: number;
  totalTimeSpent: number;
  grades: {
    criterionScores: Record<string, number> | null;
    overallGrade: number | null;
    comments: string | null;
    strengths: string[] | null;
    growthAreas: string[] | null;
    isDraft: boolean;
    updatedAt: string;
  } | null;
  nmAssessments: Array<{ element: string; source: string; rating: number; comment: string | null; createdAt: string }>;
  badges: Array<{ badgeId: string; badgeTitle: string; status: string; score: number | null; attempt: number; awardedAt: string | null }>;
  openStudio: { status: string; unlockedAt: string | null; revokedAt: string | null; sessionCount: number } | null;
  paceFeedback: Array<{ pageId: string; pace: string | null; createdAt: string }>;
  recentWork: Array<{ pageId: string; pageTitle: string; updatedAt: string; preview: string; responseCount: number }>;
}

const CRITERION_COLORS: Record<string, string> = {
  A: "#6366F1", // indigo
  B: "#10B981", // emerald
  C: "#F59E0B", // amber
  D: "#8B5CF6", // violet
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function StudentDrawer({ studentId, studentName, unitId, classId, onClose }: StudentDrawerProps) {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/teacher/student-snapshot?studentId=${studentId}&unitId=${unitId}&classId=${classId}`)
      .then(r => {
        if (!r.ok) throw new Error("Failed to load student data");
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId, unitId, classId]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" />

      {/* Drawer */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-[420px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ animation: "slideInRight 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-lg font-bold shrink-0">
              {(studentName[0] || "?").toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">{studentName}</h2>
              <p className="text-xs text-gray-500">Student snapshot</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
                  <div className="h-8 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-5 text-center text-red-500 text-sm">{error}</div>
          ) : data ? (
            <div className="divide-y divide-gray-100">
              {/* Quick stats */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <Stat label="Progress" value={`${data.pagesCompleted}/${data.totalPages}`} color={data.pagesCompleted === data.totalPages ? "#10B981" : "#6B7280"} />
                  {data.grades && (
                    <Stat label="Grade" value={data.grades.overallGrade != null ? String(data.grades.overallGrade) : "—"} color={data.grades.isDraft ? "#F59E0B" : "#10B981"} suffix={data.grades.isDraft ? " draft" : ""} />
                  )}
                  <Stat label="Time" value={formatMinutes(data.totalTimeSpent)} color="#6B7280" />
                  {data.openStudio && (
                    <Stat
                      label="Studio"
                      value={data.openStudio.status === "unlocked" ? "Active" : data.openStudio.status}
                      color={data.openStudio.status === "unlocked" ? "#8B5CF6" : "#9CA3AF"}
                    />
                  )}
                </div>
              </div>

              {/* Progress strip */}
              <Section title="Page Progress">
                <div className="flex flex-wrap gap-1">
                  {data.pages.map(page => {
                    const p = data.progress[page.id];
                    const bg = p?.status === "complete" ? "#10B981" : p?.status === "in_progress" ? "#F59E0B" : "#E5E7EB";
                    const textColor = p?.status && p.status !== "not_started" ? "#fff" : "#9CA3AF";
                    return (
                      <div
                        key={page.id}
                        className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold"
                        style={{ background: bg, color: textColor }}
                        title={`${page.id}: ${page.title} — ${p?.status || "not started"}`}
                      >
                        {page.id.replace(/^L0?/, "")}
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* Grades */}
              {data.grades && data.grades.criterionScores && (
                <Section title="Grades">
                  <div className="flex gap-2 mb-2">
                    {Object.entries(data.grades.criterionScores).map(([crit, score]) => (
                      <div key={crit} className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-gray-400">{crit}</span>
                        <span
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                          style={{ background: CRITERION_COLORS[crit] || "#6B7280" }}
                        >
                          {score}
                        </span>
                      </div>
                    ))}
                  </div>
                  {data.grades.comments && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-3">{data.grades.comments}</p>
                  )}
                  {data.grades.strengths && data.grades.strengths.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {data.grades.strengths.map((s, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{s}</span>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {/* NM Assessments */}
              {data.nmAssessments.length > 0 && (
                <Section title="Melbourne Metrics">
                  {(() => {
                    // Group by element, show latest of each
                    const byElement = new Map<string, typeof data.nmAssessments>();
                    for (const a of data.nmAssessments) {
                      const arr = byElement.get(a.element) || [];
                      arr.push(a);
                      byElement.set(a.element, arr);
                    }
                    return Array.from(byElement.entries()).map(([element, assessments]) => {
                      const selfLatest = assessments.find(a => a.source === "student");
                      const teacherLatest = assessments.find(a => a.source === "teacher");
                      return (
                        <div key={element} className="flex items-center gap-2 py-1">
                          <span className="text-xs text-gray-700 flex-1 truncate">{element}</span>
                          {selfLatest && <RatingPill rating={selfLatest.rating} label="Self" />}
                          {teacherLatest && <RatingPill rating={teacherLatest.rating} label="Teacher" />}
                        </div>
                      );
                    });
                  })()}
                </Section>
              )}

              {/* Safety Badges */}
              {data.badges.length > 0 && (
                <Section title="Safety Badges">
                  <div className="space-y-1">
                    {data.badges.map(b => (
                      <div key={b.badgeId} className="flex items-center gap-2 py-1">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
                          b.status === "active" ? "bg-emerald-100 text-emerald-600" :
                          b.status === "failed" ? "bg-red-100 text-red-600" :
                          "bg-gray-100 text-gray-400"
                        }`}>
                          {b.status === "active" ? "✓" : b.status === "failed" ? "✗" : "—"}
                        </span>
                        <span className="text-xs text-gray-700 flex-1">{b.badgeTitle}</span>
                        {b.score != null && <span className="text-[10px] text-gray-400">{b.score}%</span>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Open Studio */}
              {data.openStudio && (
                <Section title="Open Studio">
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-1 rounded-full font-medium ${
                      data.openStudio.status === "unlocked" ? "bg-violet-100 text-violet-700" :
                      data.openStudio.status === "revoked" ? "bg-red-100 text-red-600" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {data.openStudio.status}
                    </span>
                    {data.openStudio.sessionCount > 0 && (
                      <span className="text-gray-500">{data.openStudio.sessionCount} session{data.openStudio.sessionCount !== 1 ? "s" : ""}</span>
                    )}
                    {data.openStudio.unlockedAt && (
                      <span className="text-gray-400">Since {timeAgo(data.openStudio.unlockedAt)}</span>
                    )}
                  </div>
                </Section>
              )}

              {/* Recent Work */}
              {data.recentWork.length > 0 && (
                <Section title="Recent Work">
                  <div className="space-y-2">
                    {data.recentWork.map((w, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">{w.pageTitle}</span>
                          <span className="text-[10px] text-gray-400">{timeAgo(w.updatedAt)}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{w.preview || "No text responses"}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Pace Feedback */}
              {data.paceFeedback.length > 0 && (
                <Section title="Pace Feedback">
                  <div className="flex flex-wrap gap-1">
                    {data.paceFeedback.map((f, i) => (
                      <span
                        key={i}
                        className="text-sm"
                        title={`${f.pageId} — ${timeAgo(f.createdAt)}`}
                      >
                        {f.pace === "too_slow" ? "🐢" : f.pace === "just_right" ? "👌" : f.pace === "too_fast" ? "🏃" : "—"}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Empty state */}
              {!data.grades && data.nmAssessments.length === 0 && data.badges.length === 0 && !data.openStudio && data.recentWork.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  No activity data yet for this student.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Animation keyframes (inline) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-3">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value, color, suffix }: { label: string; value: string; color: string; suffix?: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      <p className="text-lg font-bold" style={{ color }}>
        {value}
        {suffix && <span className="text-[10px] font-normal text-gray-400">{suffix}</span>}
      </p>
    </div>
  );
}

function RatingPill({ rating, label }: { rating: number; label: string }) {
  const colors = ["", "bg-amber-100 text-amber-700", "bg-cyan-100 text-cyan-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700"];
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colors[rating] || "bg-gray-100 text-gray-500"}`}>
      {label}: {rating}
    </span>
  );
}
