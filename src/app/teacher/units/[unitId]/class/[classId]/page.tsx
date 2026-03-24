"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NMConfigPanel, NMResultsPanel } from "@/components/nm";
import { CertManager } from "@/components/teacher/CertManager";
import { LessonSchedule } from "@/components/teacher/LessonSchedule";
import type { ScheduleOverrides } from "@/components/teacher/LessonSchedule";
import type { NMUnitConfig } from "@/lib/nm/constants";
import { DEFAULT_NM_CONFIG } from "@/lib/nm/constants";
import { getPageList } from "@/lib/unit-adapter";
import type { Unit, UnitPage, UnitContentData } from "@/types";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";

// ---------------------------------------------------------------------------
// Manage Class Page (Tabbed)
// ---------------------------------------------------------------------------
// Per-class management hub for a unit template.
// Tabs: Overview | Progress | Grade | Safety
// Accessible from: Dashboard → Manage button
// URL: /teacher/units/[unitId]/class/[classId]
// ---------------------------------------------------------------------------

type ManageTab = "overview" | "progress" | "grade" | "safety";

const TABS: { id: ManageTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "progress", label: "Progress", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "grade", label: "Grade", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { id: "safety", label: "Safety", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
];

export default function ClassUnitSettingsPage({
  params,
}: {
  params: Promise<{ unitId: string; classId: string }>;
}) {
  const { unitId, classId } = use(params);
  const [activeTab, setActiveTab] = useState<ManageTab>("overview");
  const [unit, setUnit] = useState<Unit | null>(null);
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nmConfig, setNmConfig] = useState<NMUnitConfig>(DEFAULT_NM_CONFIG);
  const [globalNmEnabled, setGlobalNmEnabled] = useState(false);
  const [pages, setPages] = useState<Array<{ id: string; title: string }>>([]);
  const [students, setStudents] = useState<Array<{ student_id: string; display_name: string; username: string }>>([]);
  const [terms, setTerms] = useState<Array<{ id: string; academic_year: string; term_name: string; term_order: number; start_date?: string; end_date?: string }>>([]);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [savingTerm, setSavingTerm] = useState(false);
  const [termMessage, setTermMessage] = useState("");
  const [scheduleInfo, setScheduleInfo] = useState<{
    lessonCount: number | null;
    nextClass: {
      dateISO: string;
      dayOfWeek: string;
      cycleDay: number;
      periodNumber?: number;
      room?: string;
      formatted: string;
      short: string;
    } | null;
    reason?: string;
  } | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverrides>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [unitRes, classRes, studentsRes, classUnitRes, termsRes] = await Promise.all([
        supabase.from("units").select("*").eq("id", unitId).single(),
        supabase.from("classes").select("name, code").eq("id", classId).single(),
        supabase.from("class_students").select("student_id, students(id, display_name, username)").eq("class_id", classId).eq("is_active", true),
        supabase.from("class_units").select("term_id, schedule_overrides, content_data, forked_at, forked_from_version").eq("class_id", classId).eq("unit_id", unitId).single(),
        fetch("/api/teacher/school-calendar").then((r) => (r.ok ? r.json() : Promise.resolve({ terms: [] }))),
      ]);

      setUnit(unitRes.data);
      setClassName(classRes.data?.name || "");
      setClassCode(classRes.data?.code || "");
      const enrolledStudents = (studentsRes.data || [])
        .filter((row: any) => row.students)
        .map((row: any) => ({
          student_id: row.students.id,
          display_name: row.students.display_name || "",
          username: row.students.username || "",
        }));
      setStudentCount(enrolledStudents.length);
      setStudents(enrolledStudents);

      if (unitRes.data) {
        // Use class-local content if forked, otherwise master
        const resolvedContent = resolveClassUnitContent(
          unitRes.data.content_data as UnitContentData,
          (classUnitRes.data?.content_data as UnitContentData | null) ?? undefined
        );
        const pageList = getPageList(resolvedContent);
        setPages(
          pageList.map((p: UnitPage, i: number) => ({
            id: p.id,
            title: p.title || p.content?.title || `Page ${i + 1}`,
          }))
        );
      }

      // Load class-unit term_id + schedule overrides
      if (classUnitRes.data) {
        setSelectedTermId(classUnitRes.data.term_id || null);
        if (classUnitRes.data.schedule_overrides) {
          setScheduleOverrides(classUnitRes.data.schedule_overrides as ScheduleOverrides);
        }
      }

      // Load school calendar terms
      if (termsRes && termsRes.terms) {
        setTerms(termsRes.terms);
      }

      // Load class-specific NM config (with fallback to unit-level)
      try {
        const res = await fetch(
          `/api/teacher/nm-config?unitId=${unitId}&classId=${classId}`
        );
        if (res.ok) {
          const data = await res.json();
          setNmConfig(data.config || DEFAULT_NM_CONFIG);
          setGlobalNmEnabled(data.globalNmEnabled !== false);
        }
      } catch {
        // Fallback to unit-level
        if (unitRes.data?.nm_config) {
          setNmConfig(unitRes.data.nm_config as NMUnitConfig);
        }
      }

      setLoading(false);
    }
    load();
  }, [unitId, classId]);

  // Fetch schedule info when term is selected and timetable may exist
  useEffect(() => {
    async function loadSchedule() {
      // Find selected term's date range
      const term = terms.find((t) => t.id === selectedTermId);
      if (!term || !classId) {
        setScheduleInfo(null);
        return;
      }

      // We need start/end dates — terms from the API should have them
      const termWithDates = term as typeof term & { start_date?: string; end_date?: string };
      if (!termWithDates.start_date || !termWithDates.end_date) {
        setScheduleInfo(null);
        return;
      }

      setScheduleLoading(true);
      try {
        // Fetch lesson count for the term
        const today = new Date().toISOString().split("T")[0];
        const fromDate = termWithDates.start_date > today ? termWithDates.start_date : today;

        const [countRes, nextRes] = await Promise.all([
          fetch(
            `/api/teacher/schedule/lessons?classId=${classId}&mode=count&from=${termWithDates.start_date}&to=${termWithDates.end_date}`
          ).then((r) => (r.ok ? r.json() : null)),
          fetch(
            `/api/teacher/schedule/lessons?classId=${classId}&mode=next&from=${fromDate}&count=1`
          ).then((r) => (r.ok ? r.json() : null)),
        ]);

        const nextLesson = nextRes?.lessons?.[0] || null;

        setScheduleInfo({
          lessonCount: countRes?.lessonCount ?? null,
          nextClass: nextLesson
            ? {
                dateISO: nextLesson.dateISO,
                dayOfWeek: nextLesson.dayOfWeek,
                cycleDay: nextLesson.cycleDay,
                periodNumber: nextLesson.periodNumber,
                room: nextLesson.room,
                formatted: `${nextLesson.dayOfWeek} ${nextLesson.dateISO} (Day ${nextLesson.cycleDay}${nextLesson.periodNumber ? `, P${nextLesson.periodNumber}` : ""})`,
                short: `Day ${nextLesson.cycleDay}${nextLesson.periodNumber ? `, P${nextLesson.periodNumber}` : ""} — ${nextLesson.dayOfWeek?.slice(0, 3)}`,
              }
            : null,
          reason: nextRes?.lessons?.length === 0 ? "no_meetings" : undefined,
        });
      } catch {
        setScheduleInfo(null);
      } finally {
        setScheduleLoading(false);
      }
    }
    loadSchedule();
  }, [selectedTermId, classId, terms]);

  async function handleTermChange(termId: string | null) {
    setSelectedTermId(termId);
    setSavingTerm(true);
    setTermMessage("");

    try {
      const res = await fetch("/api/teacher/class-units", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          unitId,
          term_id: termId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setTermMessage(data.error || "Failed to save term");
        return;
      }

      setTermMessage("Term assigned!");
      setTimeout(() => setTermMessage(""), 3000);
    } catch {
      setTermMessage("Network error. Please try again.");
    } finally {
      setSavingTerm(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-32 bg-gray-50 rounded-xl" />
        </div>
      </main>
    );
  }

  if (!unit) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-text-secondary">Unit not found.</p>
        <Link
          href="/teacher/units"
          className="text-accent-blue text-sm mt-2 inline-block"
        >
          ← Back to units
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-4">
        <Link href="/teacher/units" className="hover:text-text-primary transition">
          Units
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <Link
          href={`/teacher/units/${unitId}`}
          className="hover:text-text-primary transition truncate max-w-[200px]"
        >
          {unit.title}
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-text-primary font-medium">{className}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-sm font-bold flex-shrink-0">
            {className.charAt(0).toUpperCase()}
          </div>
          {className}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage <span className="font-medium">{unit.title}</span>
        </p>
        <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
          <span>{studentCount} student{studentCount !== 1 ? "s" : ""}</span>
          <span>Code: {classCode}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link
          href={`/teacher/teach/${unitId}?classId=${classId}`}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium text-sm hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Teach
        </Link>
        <Link
          href={`/teacher/units/${unitId}/class/${classId}/edit`}
          className="px-4 py-2 rounded-xl border border-border text-text-primary font-medium text-sm hover:bg-surface-alt transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit Unit
        </Link>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB                                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (<>

      {/* ----------------------------------------------------------------- */}
      {/* Term Assignment                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 bg-surface-alt rounded-xl p-4 border border-border">
        <div className="mb-3">
          <label className="block text-xs font-semibold text-text-primary mb-2">
            Assign to Term
          </label>
          {terms.length === 0 ? (
            <div className="text-sm text-text-secondary">
              <p className="mb-2">No school calendar set up yet.</p>
              <Link
                href="/teacher/settings?tab=school"
                className="text-accent-blue text-xs font-medium hover:underline"
              >
                Set up your school calendar →
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedTermId || ""}
                onChange={(e) => handleTermChange(e.target.value || null)}
                disabled={savingTerm}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              >
                <option value="">— No term assigned —</option>
                {Array.from(new Map(terms.map((t) => [t.academic_year, t])).keys()).map((year) => (
                  <optgroup key={year} label={year}>
                    {terms
                      .filter((t) => t.academic_year === year)
                      .sort((a, b) => a.term_order - b.term_order)
                      .map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.term_name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
          {termMessage && (
            <p
              className={`mt-2 text-xs font-medium ${
                termMessage.includes("saved") || termMessage.includes("assigned")
                  ? "text-accent-green"
                  : "text-amber-600"
              }`}
            >
              {termMessage}
            </p>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Schedule Info (when timetable configured + term assigned)          */}
      {/* ----------------------------------------------------------------- */}
      {selectedTermId && (
        <div className="mb-6 bg-surface-alt rounded-xl p-4 border border-border">
          <h3 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Schedule
          </h3>

          {scheduleLoading ? (
            <div className="animate-pulse flex gap-4">
              <div className="h-14 bg-gray-200 rounded-lg flex-1" />
              <div className="h-14 bg-gray-200 rounded-lg flex-1" />
            </div>
          ) : scheduleInfo?.lessonCount !== null && scheduleInfo?.lessonCount !== undefined ? (
            <div className="flex gap-3">
              {/* Lesson count card */}
              <div className="flex-1 bg-white rounded-lg p-3 border border-border">
                <div className="text-2xl font-bold text-purple-600">
                  {scheduleInfo.lessonCount}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  lessons this term
                </div>
              </div>

              {/* Next class card */}
              <div className="flex-1 bg-white rounded-lg p-3 border border-border">
                {scheduleInfo.nextClass ? (
                  <>
                    <div className="text-sm font-semibold text-text-primary">
                      {scheduleInfo.nextClass.short}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      Next: {scheduleInfo.nextClass.dayOfWeek} {scheduleInfo.nextClass.dateISO}
                    </div>
                    {scheduleInfo.nextClass.room && (
                      <div className="text-xs text-text-tertiary mt-0.5">
                        Room {scheduleInfo.nextClass.room}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium text-text-secondary">—</div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                      No upcoming classes
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No timetable set up yet.{" "}
              <Link
                href="/teacher/settings?tab=school"
                className="text-purple-600 text-xs font-medium hover:underline"
              >
                Set up your timetable →
              </Link>
            </p>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Lesson Schedule                                                    */}
      {/* ----------------------------------------------------------------- */}
      {(() => {
        const term = terms.find((t) => t.id === selectedTermId);
        const termWithDates = term as typeof term & { start_date?: string; end_date?: string } | undefined;
        return (
          <div className="mb-6">
            <LessonSchedule
              unitId={unitId}
              classId={classId}
              pages={pages}
              termStart={termWithDates?.start_date}
              termEnd={termWithDates?.end_date}
              overrides={scheduleOverrides}
              onOverridesChange={setScheduleOverrides}
              onSave={async (newOverrides) => {
                const res = await fetch("/api/teacher/class-units", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    classId,
                    unitId,
                    schedule_overrides: newOverrides,
                  }),
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error || "Save failed");
                }
              }}
            />
          </div>
        );
      })()}

      {/* ----------------------------------------------------------------- */}
      {/* NM Config & Results (only when global NM toggle is on)             */}
      {/* ----------------------------------------------------------------- */}
      {globalNmEnabled ? (
        <>
          <div className="mb-6">
            <NMConfigPanel
              unitId={unitId}
              classId={classId}
              pages={pages}
              currentConfig={nmConfig}
              onSave={async (config) => {
                const res = await fetch("/api/teacher/nm-config", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ unitId, classId, config }),
                });
                if (!res.ok) {
                  const errData = await res.json().catch(() => ({}));
                  console.error("Failed to save NM config:", errData);
                  throw new Error(errData.error || "Save failed");
                }
                setNmConfig(config);
              }}
            />
          </div>
          {nmConfig.enabled && (
            <div className="mb-6">
              <NMResultsPanel unitId={unitId} classId={classId} />
            </div>
          )}
        </>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-border text-sm text-text-secondary">
          New Metrics is turned off. Enable it in <a href="/teacher/settings?tab=school" className="text-purple-600 underline">Settings → School &amp; Teaching</a> to configure competency assessments.
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Future: Open Studio, Timing Overrides, etc.                        */}
      {/* ----------------------------------------------------------------- */}

      </>)}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PROGRESS TAB                                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "progress" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-6 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="font-semibold text-text-primary mb-1">Student Progress</h3>
            <p className="text-sm text-text-secondary mb-4">
              Track student completion, time spent, and page-by-page progress.
            </p>
            <Link
              href={`/teacher/classes/${classId}/progress/${unitId}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open Progress View
            </Link>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* GRADE TAB                                                      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "grade" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-6 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h3 className="font-semibold text-text-primary mb-1">Grading</h3>
            <p className="text-sm text-text-secondary mb-4">
              Review student submissions and assess against MYP criteria.
            </p>
            <Link
              href={`/teacher/classes/${classId}/progress/${unitId}#grading`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open Grading View
            </Link>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SAFETY TAB                                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "safety" && (
        <div className="space-y-6">
          {/* Workshop Certifications — grant/revoke per student */}
          <CertManager classId={classId} students={students} />

          {/* Link to badge library */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Safety Badge Library
              </h3>
              <p className="text-sm text-gray-500 mt-1">Create new badges, edit questions, and manage unit requirements.</p>
            </div>
            <Link
              href="/teacher/safety"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-700 font-medium text-sm hover:bg-amber-100 transition shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Manage Badges
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
