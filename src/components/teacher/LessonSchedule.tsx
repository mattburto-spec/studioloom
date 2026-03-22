"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ScheduledLesson {
  pageId: string;
  pageTitle: string;
  pageIndex: number;
  /** Which class session this occupies (1-based). A lesson marked "continues" takes 2+ sessions. */
  sessionNumber: number;
  /** Is this a continuation session (2nd, 3rd class for the same lesson)? */
  isContinuation: boolean;
  /** The computed date for this session */
  dateISO: string;
  dayOfWeek: string;
  cycleDay: number;
  periodNumber?: number;
  room?: string;
}

interface ScheduleOverrides {
  /** pageId → number of EXTRA sessions (0 = normal 1 session, 1 = continues once, etc.) */
  extra_sessions?: Record<string, number>;
  /** Additional dates to skip for this class-unit (beyond global holidays) */
  skip_dates?: string[];
  /** pageId → teacher note */
  notes?: Record<string, string>;
}

interface LessonScheduleProps {
  unitId: string;
  classId: string;
  pages: Array<{ id: string; title: string }>;
  termStart?: string;
  termEnd?: string;
  overrides: ScheduleOverrides;
  onOverridesChange: (overrides: ScheduleOverrides) => void;
  onSave: (overrides: ScheduleOverrides) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function LessonSchedule({
  unitId,
  classId,
  pages,
  termStart,
  termEnd,
  overrides,
  onOverridesChange,
  onSave,
}: LessonScheduleProps) {
  const [schedule, setSchedule] = useState<ScheduledLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [dirty, setDirty] = useState(false);

  // ── Compute schedule from API ──
  const computeSchedule = useCallback(async () => {
    if (!classId || !termStart || !termEnd || pages.length === 0) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Calculate how many total sessions we need
      const extraSessions = overrides.extra_sessions || {};
      const totalSessions = pages.reduce((sum, p) => {
        return sum + 1 + (extraSessions[p.id] || 0);
      }, 0);

      // Fetch that many lesson dates from the schedule API
      const res = await fetch(
        `/api/teacher/schedule/lessons?classId=${classId}&mode=next&from=${termStart}&count=${totalSessions}&termStart=${termStart}&termEnd=${termEnd}`
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load schedule");
        setSchedule([]);
        return;
      }

      const data = await res.json();
      const lessonDates: Array<{
        dateISO: string;
        dayOfWeek: string;
        cycleDay: number;
        periodNumber?: number;
        room?: string;
      }> = data.lessons || [];

      // Filter out class-unit-specific skip dates
      const skipSet = new Set(overrides.skip_dates || []);
      const filteredDates = lessonDates.filter(
        (d) => !skipSet.has(d.dateISO)
      );

      // Map pages to dates, accounting for extra sessions (continues)
      const scheduled: ScheduledLesson[] = [];
      let dateIndex = 0;

      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        const page = pages[pageIdx];
        const extraCount = extraSessions[page.id] || 0;
        const sessionsNeeded = 1 + extraCount;

        for (let s = 0; s < sessionsNeeded; s++) {
          const dateInfo = filteredDates[dateIndex];
          if (dateInfo) {
            scheduled.push({
              pageId: page.id,
              pageTitle: page.title,
              pageIndex: pageIdx,
              sessionNumber: dateIndex + 1,
              isContinuation: s > 0,
              dateISO: dateInfo.dateISO,
              dayOfWeek: dateInfo.dayOfWeek,
              cycleDay: dateInfo.cycleDay,
              periodNumber: dateInfo.periodNumber,
              room: dateInfo.room,
            });
          } else {
            // Ran out of dates — lesson extends beyond the term
            scheduled.push({
              pageId: page.id,
              pageTitle: page.title,
              pageIndex: pageIdx,
              sessionNumber: dateIndex + 1,
              isContinuation: s > 0,
              dateISO: "",
              dayOfWeek: "",
              cycleDay: 0,
            });
          }
          dateIndex++;
        }
      }

      setSchedule(scheduled);
    } catch {
      setError("Failed to compute schedule");
    } finally {
      setLoading(false);
    }
  }, [classId, termStart, termEnd, pages, overrides]);

  useEffect(() => {
    computeSchedule();
  }, [computeSchedule]);

  // ── Actions ──

  function toggleContinues(pageId: string) {
    const current = overrides.extra_sessions?.[pageId] || 0;
    const newExtra = current > 0 ? 0 : 1; // Toggle between 0 and 1
    const newOverrides: ScheduleOverrides = {
      ...overrides,
      extra_sessions: {
        ...(overrides.extra_sessions || {}),
        [pageId]: newExtra,
      },
    };
    // Clean up zeros
    if (newExtra === 0) {
      delete newOverrides.extra_sessions![pageId];
    }
    onOverridesChange(newOverrides);
    setDirty(true);
  }

  function addExtraSession(pageId: string) {
    const current = overrides.extra_sessions?.[pageId] || 0;
    if (current >= 4) return; // Max 5 sessions per lesson
    const newOverrides: ScheduleOverrides = {
      ...overrides,
      extra_sessions: {
        ...(overrides.extra_sessions || {}),
        [pageId]: current + 1,
      },
    };
    onOverridesChange(newOverrides);
    setDirty(true);
  }

  function removeExtraSession(pageId: string) {
    const current = overrides.extra_sessions?.[pageId] || 0;
    if (current <= 0) return;
    const newOverrides: ScheduleOverrides = {
      ...overrides,
      extra_sessions: {
        ...(overrides.extra_sessions || {}),
        [pageId]: current - 1,
      },
    };
    if (current - 1 === 0) {
      delete newOverrides.extra_sessions![pageId];
    }
    onOverridesChange(newOverrides);
    setDirty(true);
  }

  function saveNote(pageId: string) {
    const newOverrides: ScheduleOverrides = {
      ...overrides,
      notes: {
        ...(overrides.notes || {}),
        [pageId]: noteText,
      },
    };
    if (!noteText.trim()) {
      delete newOverrides.notes![pageId];
    }
    onOverridesChange(newOverrides);
    setEditingNote(null);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(overrides);
      setDirty(false);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ── Helpers ──

  function formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  // Check if schedule extends beyond term
  const overflowCount = schedule.filter((s) => !s.dateISO).length;
  const totalSessions = schedule.length;
  const totalLessons = pages.length;
  const extraSessionCount = totalSessions - totalLessons;

  // ── Cycle day color palette ──
  const CYCLE_COLORS = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
    "bg-cyan-100 text-cyan-700",
    "bg-orange-100 text-orange-700",
    "bg-indigo-100 text-indigo-700",
    "bg-rose-100 text-rose-700",
    "bg-teal-100 text-teal-700",
  ];

  if (!termStart || !termEnd) {
    return (
      <div className="bg-surface-alt rounded-xl p-4 border border-border">
        <h3 className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Lesson Schedule
        </h3>
        <p className="text-sm text-text-secondary">
          Assign a term above to see when each lesson falls on the calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-alt rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <h3 className="text-xs font-semibold text-text-primary">Lesson Schedule</h3>
          <span className="text-xs text-text-tertiary">
            {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
            {extraSessionCount > 0 && ` · ${totalSessions} sessions`}
          </span>
        </div>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      {/* Overflow warning */}
      {overflowCount > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 font-medium flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {overflowCount} session{overflowCount !== 1 ? "s" : ""} extend{overflowCount === 1 ? "s" : ""} beyond the term end date.
          Consider removing extra sessions or adjusting the term dates.
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-6 flex justify-center">
          <div className="animate-pulse space-y-2 w-full">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      ) : schedule.length === 0 ? (
        <div className="p-6 text-center text-sm text-text-secondary">
          No timetable data found for this class. Set up class meetings in{" "}
          <a href="/teacher/settings?tab=school" className="text-purple-600 hover:underline">
            Settings → Timetable
          </a>.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {schedule.map((lesson, idx) => {
            const isFirst = !lesson.isContinuation;
            const extraCount = overrides.extra_sessions?.[lesson.pageId] || 0;
            const note = overrides.notes?.[lesson.pageId];
            const isPast = lesson.dateISO && lesson.dateISO < new Date().toISOString().split("T")[0];
            const isToday = lesson.dateISO === new Date().toISOString().split("T")[0];
            const cycleDayColor = lesson.cycleDay > 0
              ? CYCLE_COLORS[(lesson.cycleDay - 1) % CYCLE_COLORS.length]
              : "bg-gray-100 text-gray-500";

            return (
              <div
                key={`${lesson.pageId}-${idx}`}
                className={`px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                  isToday
                    ? "bg-purple-50"
                    : isPast
                    ? "bg-gray-50/50"
                    : "bg-white hover:bg-gray-50"
                } ${lesson.isContinuation ? "pl-10" : ""}`}
              >
                {/* Session number */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isToday
                    ? "bg-purple-600 text-white"
                    : isPast
                    ? "bg-gray-200 text-gray-500"
                    : "bg-gray-100 text-text-primary"
                }`}>
                  {lesson.sessionNumber}
                </div>

                {/* Lesson title */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {lesson.isContinuation ? (
                      <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        continued
                      </span>
                    ) : (
                      <span className="font-medium text-text-primary truncate">
                        {lesson.pageTitle}
                      </span>
                    )}
                    {isToday && (
                      <span className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wide">
                        Today
                      </span>
                    )}
                  </div>
                  {note && isFirst && (
                    <p className="text-xs text-text-tertiary mt-0.5 truncate">{note}</p>
                  )}
                </div>

                {/* Date */}
                <div className="text-xs text-text-secondary whitespace-nowrap text-right">
                  {lesson.dateISO ? (
                    <>
                      <span className={isPast ? "text-text-tertiary" : ""}>
                        {formatDate(lesson.dateISO)}
                      </span>
                    </>
                  ) : (
                    <span className="text-amber-500 font-medium">Beyond term</span>
                  )}
                </div>

                {/* Cycle day badge */}
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${cycleDayColor}`}>
                  {lesson.cycleDay > 0
                    ? `D${lesson.cycleDay}${lesson.periodNumber ? `·P${lesson.periodNumber}` : ""}`
                    : "—"}
                </div>

                {/* Actions (only on first session of each lesson) */}
                {isFirst && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Continues toggle */}
                    <button
                      onClick={() => {
                        if (extraCount > 0) {
                          removeExtraSession(lesson.pageId);
                        } else {
                          toggleContinues(lesson.pageId);
                        }
                      }}
                      title={extraCount > 0 ? "Remove extra session" : "Lesson continues next class"}
                      className={`p-1.5 rounded-lg transition-colors ${
                        extraCount > 0
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "text-text-tertiary hover:text-text-primary hover:bg-gray-100"
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 1 21 5 17 9" />
                        <path d="M3 11V9a4 4 0 014-4h14" />
                      </svg>
                    </button>

                    {/* Add extra session (if already has continues) */}
                    {extraCount > 0 && extraCount < 4 && (
                      <button
                        onClick={() => addExtraSession(lesson.pageId)}
                        title="Add another session"
                        className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-gray-100 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                    )}

                    {/* Note */}
                    <button
                      onClick={() => {
                        setEditingNote(editingNote === lesson.pageId ? null : lesson.pageId);
                        setNoteText(overrides.notes?.[lesson.pageId] || "");
                      }}
                      title="Add note"
                      className={`p-1.5 rounded-lg transition-colors ${
                        note
                          ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                          : "text-text-tertiary hover:text-text-primary hover:bg-gray-100"
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Note editor (inline) */}
          {editingNote && (
            <div className="px-4 py-3 bg-blue-50 border-t border-blue-200">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNote(editingNote);
                    if (e.key === "Escape") setEditingNote(null);
                  }}
                  placeholder="e.g. Ran overtime — students needed more prototyping time"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-blue-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  autoFocus
                />
                <button
                  onClick={() => saveNote(editingNote)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingNote(null)}
                  className="px-2 py-1.5 rounded-lg text-xs text-text-tertiary hover:text-text-primary transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer summary */}
      {schedule.length > 0 && (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-border flex items-center justify-between text-xs text-text-tertiary">
          <span>
            {schedule.filter((s) => s.dateISO && s.dateISO >= new Date().toISOString().split("T")[0]).length} remaining
            {extraSessionCount > 0 && (
              <span className="text-amber-600 ml-2">
                ({extraSessionCount} extra session{extraSessionCount !== 1 ? "s" : ""} for overtime)
              </span>
            )}
          </span>
          {schedule.length > 0 && schedule[schedule.length - 1].dateISO && (
            <span>Ends {formatDate(schedule[schedule.length - 1].dateISO)}</span>
          )}
        </div>
      )}
    </div>
  );
}

export type { ScheduleOverrides, ScheduledLesson };
