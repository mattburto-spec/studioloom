"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPageColor } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import type { Student, StudentProgress, Unit, UnitPage } from "@/types";
import type { AssessmentRecordRow } from "@/types/assessment";
import { OpenStudioUnlock, OpenStudioClassView } from "@/components/open-studio";
import { ObservationSnap } from "@/components/nm";
import { PaceFeedbackSummary } from "@/components/teacher/PaceFeedbackSummary";
import { AGENCY_ELEMENTS, type NMUnitConfig } from "@/lib/nm/constants";

interface ProgressCell {
  status: "not_started" | "in_progress" | "complete";
  hasResponses: boolean;
  timeSpent: number;
}

type GradingStatus = "ungraded" | "draft" | "published";

type StudentProgressMap = Record<string, Record<string, ProgressCell>>;

export default function ProgressTrackingPage({
  params,
}: {
  params: Promise<{ classId: string; unitId: string }>;
}) {
  const { classId, unitId } = use(params);
  const [students, setStudents] = useState<Student[]>([]);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [progressMap, setProgressMap] = useState<StudentProgressMap>({});
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);
  const [gradingStatusMap, setGradingStatusMap] = useState<Record<string, GradingStatus>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [detailResponses, setDetailResponses] = useState<Record<string, string> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [openStudioStatuses, setOpenStudioStatuses] = useState<Record<string, { unlocked_at: string | null }>>({});
  const [nmObserveStudent, setNmObserveStudent] = useState<Student | null>(null);
  const [nmConfig, setNmConfig] = useState<NMUnitConfig | null>(null);
  const [badgeRequirements, setBadgeRequirements] = useState<Array<{ badge_id: string; badge_name: string; badge_slug: string; is_required: boolean }>>([]);
  const [badgeStatusMap, setBadgeStatusMap] = useState<Record<string, Array<{ badge_id: string; status: "earned" | "failed" | "not_attempted"; score: number | null }>>>({});

  useEffect(() => {
    loadData();
  }, [classId, unitId]);

  async function loadData() {
    const supabase = createClient();

    const [classRes, studentsRes, unitRes, progressRes] = await Promise.all([
      supabase.from("classes").select("name").eq("id", classId).single(),
      supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .order("display_name"),
      supabase.from("units").select("*").eq("id", unitId).single(),
      supabase
        .from("student_progress")
        .select("*")
        .eq("unit_id", unitId)
        .in(
          "student_id",
          // We need to get student IDs first, but let's do a sub-select approach
          // Actually, RLS handles this — just query all progress for this unit
          // and it will only return progress for students in teacher's classes
          []
        ),
    ]);

    setClassName(classRes.data?.name || "");
    setStudents(studentsRes.data || []);
    setUnit(unitRes.data);

    // Now load progress with the actual student IDs
    const studentIds = (studentsRes.data || []).map((s: Student) => s.id);
    if (studentIds.length > 0) {
      const { data: progress } = await supabase
        .from("student_progress")
        .select("*")
        .eq("unit_id", unitId)
        .in("student_id", studentIds);

      // Build progress map: studentId -> pageNumber -> cell
      const map: StudentProgressMap = {};
      (progress || []).forEach((p: StudentProgress) => {
        if (!map[p.student_id]) map[p.student_id] = {};
        map[p.student_id][p.page_id] = {
          status: p.status as "not_started" | "in_progress" | "complete",
          hasResponses:
            p.responses !== null &&
            typeof p.responses === "object" &&
            Object.keys(p.responses as Record<string, unknown>).length > 0,
          timeSpent: p.time_spent || 0,
        };
      });
      setProgressMap(map);
    }

    // Fetch grading status
    try {
      const assessRes = await fetch(
        `/api/teacher/assessments?classId=${classId}&unitId=${unitId}`
      );
      if (assessRes.ok) {
        const { assessments } = (await assessRes.json()) as {
          assessments: AssessmentRecordRow[];
        };
        const statusMap: Record<string, GradingStatus> = {};
        for (const a of assessments) {
          statusMap[a.student_id] = a.is_draft ? "draft" : "published";
        }
        setGradingStatusMap(statusMap);
      }
    } catch {
      // grading status is non-critical — silently skip
    }

    // Load Open Studio statuses for this unit+class
    try {
      const osRes = await fetch(`/api/teacher/open-studio/status?unitId=${unitId}&classId=${classId}`);
      if (osRes.ok) {
        const data = await osRes.json();
        const statusMap: Record<string, { unlocked_at: string | null }> = {};
        for (const row of data.students || []) {
          if (row.openStudio?.status === "unlocked") {
            statusMap[row.student.id] = { unlocked_at: row.openStudio.unlocked_at };
          }
        }
        setOpenStudioStatuses(statusMap);
      }
    } catch {
      // Open Studio status is non-critical
    }

    // Load NM config: class-specific (class_units) with fallback to unit-level
    try {
      const { data: classUnit } = await supabase
        .from("class_units")
        .select("nm_config")
        .eq("class_id", classId)
        .eq("unit_id", unitId)
        .single();

      if (classUnit?.nm_config) {
        setNmConfig(classUnit.nm_config as NMUnitConfig);
      } else if (unitRes.data?.nm_config) {
        setNmConfig(unitRes.data.nm_config as NMUnitConfig);
      }
    } catch {
      // Fallback to unit-level config
      if (unitRes.data?.nm_config) {
        setNmConfig(unitRes.data.nm_config as NMUnitConfig);
      }
    }

    // Load badge requirements + student status for this unit
    try {
      const badgeRes = await fetch(`/api/teacher/badges/class-status?classId=${classId}&unitId=${unitId}`);
      if (badgeRes.ok) {
        const badgeData = await badgeRes.json();
        setBadgeRequirements(badgeData.requirements || []);
        setBadgeStatusMap(badgeData.student_status || {});
      }
    } catch {
      // Badge status is non-critical
    }

    setLoading(false);
  }

  async function loadStudentDetail(student: Student, pageId: string) {
    setSelectedStudent(student);
    setSelectedPage(pageId);
    setDetailLoading(true);
    setDetailResponses(null);

    const supabase = createClient();
    const { data } = await supabase
      .from("student_progress")
      .select("responses")
      .eq("student_id", student.id)
      .eq("unit_id", unitId)
      .eq("page_id", pageId)
      .single();

    setDetailResponses(
      (data?.responses as Record<string, string>) || {}
    );
    setDetailLoading(false);
  }

  function getStatusColor(status: string | undefined) {
    switch (status) {
      case "complete":
        return "bg-accent-green text-white";
      case "in_progress":
        return "bg-amber-400 text-white";
      default:
        return "bg-gray-100 text-gray-400";
    }
  }

  function getStatusIcon(status: string | undefined) {
    switch (status) {
      case "complete":
        return "✓";
      case "in_progress":
        return "●";
      default:
        return "—";
    }
  }

  // Calculate summary stats
  function getStudentCompletion(studentId: string): number {
    const sp = progressMap[studentId];
    if (!sp) return 0;
    return Object.values(sp).filter((c) => c.status === "complete").length;
  }

  function getPageCompletion(pageId: string): number {
    let count = 0;
    students.forEach((s) => {
      if (progressMap[s.id]?.[pageId]?.status === "complete") count++;
    });
    return count;
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </main>
    );
  }

  const unitPages: UnitPage[] = unit ? getPageList(unit.content_data) : [];

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
        <Link
          href="/teacher/dashboard"
          className="hover:text-text-primary transition"
        >
          Dashboard
        </Link>
        <span>›</span>
        <Link
          href={`/teacher/classes/${classId}`}
          className="hover:text-text-primary transition"
        >
          {className}
        </Link>
        <span>›</span>
        <span className="text-text-primary">Progress</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {unit?.title || "Unit Progress"}
          </h1>
          <p className="text-text-secondary mt-1">
            {students.length} students · {unitPages.length} pages
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-gray-400">
              —
            </div>
            <span className="text-text-secondary">Not started</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-amber-400 flex items-center justify-center text-white">
              ●
            </div>
            <span className="text-text-secondary">In progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-accent-green flex items-center justify-center text-white">
              ✓
            </div>
            <span className="text-text-secondary">Complete</span>
          </div>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-text-secondary">
            No students in this class yet. Add students from the class page.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                {/* Page ID header row */}
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-xs font-medium text-text-secondary min-w-[160px]">
                    Student
                  </th>
                  {badgeRequirements.length > 0 && (
                    <th className="px-2 py-2 text-center text-xs font-medium text-amber-700 min-w-[60px] bg-amber-50 border-b-2 border-amber-400" title="Safety badge status">
                      <span className="flex items-center justify-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        Safety
                      </span>
                    </th>
                  )}
                  {unitPages.map((page) => {
                    const color = getPageColor(page);
                    const completion = getPageCompletion(page.id);
                    const pct =
                      students.length > 0
                        ? Math.round((completion / students.length) * 100)
                        : 0;
                    return (
                      <th
                        key={page.id}
                        className="px-1 py-2 text-center text-xs font-medium min-w-[36px] cursor-default border-b-2"
                        title={`${page.id}: ${page.title}\n${completion}/${students.length} complete (${pct}%)`}
                        style={{ color, borderBottomColor: color }}
                      >
                        {page.id}
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-center text-xs font-medium text-text-secondary min-w-[48px]">
                    /{unitPages.length}
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const completed = getStudentCompletion(student.id);
                  return (
                    <tr
                      key={student.id}
                      className="border-b border-border/50 last:border-0 hover:bg-surface-alt/50"
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-primary truncate max-w-[140px] flex items-center gap-1.5">
                            {student.display_name || student.username}
                            {gradingStatusMap[student.id] === "published" && (
                              <span className="inline-block w-2 h-2 rounded-full bg-accent-green" title="Graded" />
                            )}
                            {gradingStatusMap[student.id] === "draft" && (
                              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="Draft grade" />
                            )}
                          </span>
                          {student.display_name && (
                            <span className="text-xs text-text-secondary font-mono">
                              {student.username}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <OpenStudioUnlock
                            studentId={student.id}
                            studentName={student.display_name || student.username}
                            classId={classId}
                            unitId={unitId}
                            unlocked={!!openStudioStatuses[student.id]}
                            unlockedAt={openStudioStatuses[student.id]?.unlocked_at}
                            onUnlocked={() => {
                              setOpenStudioStatuses(prev => ({
                                ...prev,
                                [student.id]: {
                                  unlocked_at: new Date().toISOString(),
                                },
                              }));
                            }}
                          />
                          {nmConfig?.enabled && (
                            <button
                              onClick={() => setNmObserveStudent(student)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                              title="Record NM observation"
                            >
                              NM
                            </button>
                          )}
                        </div>
                      </td>
                      {badgeRequirements.length > 0 && (
                        <td className="px-2 py-2 text-center bg-amber-50/50">
                          {(() => {
                            const statuses = badgeStatusMap[student.id] || [];
                            const allEarned = statuses.length > 0 && statuses.every(s => s.status === "earned");
                            const anyFailed = statuses.some(s => s.status === "failed");
                            const noneAttempted = statuses.every(s => s.status === "not_attempted");

                            if (allEarned) {
                              return (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-emerald-100 text-emerald-600" title={`All ${statuses.length} safety badge(s) earned`}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                </span>
                              );
                            }
                            if (anyFailed) {
                              const failedCount = statuses.filter(s => s.status === "failed").length;
                              return (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-red-100 text-red-600 text-xs font-bold" title={`${failedCount} badge(s) failed`}>
                                  ✗
                                </span>
                              );
                            }
                            if (noneAttempted) {
                              return (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-gray-100 text-gray-400 text-xs" title="Not attempted">
                                  —
                                </span>
                              );
                            }
                            // Mixed: some earned, some not
                            const earnedCount = statuses.filter(s => s.status === "earned").length;
                            return (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-amber-100 text-amber-700 text-[10px] font-bold" title={`${earnedCount}/${statuses.length} badges earned`}>
                                {earnedCount}/{statuses.length}
                              </span>
                            );
                          })()}
                        </td>
                      )}
                      {unitPages.map((page) => {
                        const cell =
                          progressMap[student.id]?.[page.id];
                        return (
                          <td
                            key={page.id}
                            className="px-1 py-2 text-center"
                          >
                            <button
                              onClick={() =>
                                loadStudentDetail(student, page.id)
                              }
                              className={`w-7 h-7 rounded text-xs font-medium transition hover:scale-110 ${getStatusColor(
                                cell?.status
                              )}`}
                              title={`${student.display_name || student.username} - ${page.id}: ${cell?.status || "not_started"}`}
                            >
                              {getStatusIcon(cell?.status)}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center">
                        <span
                          className={`text-sm font-medium ${
                            completed === unitPages.length
                              ? "text-accent-green"
                              : completed > 0
                              ? "text-text-primary"
                              : "text-text-secondary"
                          }`}
                        >
                          {completed}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Summary row */}
              <tfoot>
                <tr className="border-t border-border bg-surface-alt/30">
                  <td className="sticky left-0 z-10 bg-surface-alt/30 px-4 py-2 text-xs font-medium text-text-secondary">
                    Class completion
                  </td>
                  {badgeRequirements.length > 0 && (
                    <td className="px-2 py-2 text-center text-xs text-amber-700 bg-amber-50/30">
                      {(() => {
                        const totalStudents = students.length;
                        if (totalStudents === 0) return "—";
                        let allEarnedCount = 0;
                        for (const sid of students.map(s => s.id)) {
                          const statuses = badgeStatusMap[sid] || [];
                          if (statuses.length > 0 && statuses.every(s => s.status === "earned")) {
                            allEarnedCount++;
                          }
                        }
                        return `${Math.round((allEarnedCount / totalStudents) * 100)}%`;
                      })()}
                    </td>
                  )}
                  {unitPages.map((page) => {
                    const completion = getPageCompletion(page.id);
                    const pct =
                      students.length > 0
                        ? Math.round((completion / students.length) * 100)
                        : 0;
                    return (
                      <td
                        key={page.id}
                        className="px-1 py-2 text-center text-xs text-text-secondary"
                        title={`${completion}/${students.length} complete`}
                      >
                        {pct}%
                      </td>
                    );
                  })}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Student detail modal */}
      {selectedStudent && selectedPage !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {selectedStudent.display_name || selectedStudent.username}
                </h2>
                <p className="text-sm text-text-secondary">
                  {selectedPage}: {unitPages.find(p => p.id === selectedPage)?.title}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setSelectedPage(null);
                  setDetailResponses(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-secondary"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-20 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-20 bg-gray-200 rounded" />
                </div>
              ) : !detailResponses ||
                Object.keys(detailResponses).length === 0 ? (
                <p className="text-text-secondary text-center py-8">
                  No responses yet for this page.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Get page content sections to label responses */}
                  {(() => {
                    const selectedUnitPage = unitPages.find(p => p.id === selectedPage);
                    const page = selectedUnitPage?.content as { sections?: { prompt: string }[]; reflection?: { type: string; items: string[] } } | undefined;
                    const sections = page?.sections || [];

                    return Object.entries(detailResponses).map(
                      ([key, value]) => {
                        // Figure out label
                        let label = key;
                        if (key.startsWith("section_")) {
                          const idx = parseInt(key.replace("section_", ""));
                          label =
                            sections[idx]?.prompt ||
                            `Section ${idx + 1}`;
                        } else if (key.startsWith("check_")) {
                          const idx = parseInt(key.replace("check_", ""));
                          const items = page?.reflection?.items || [];
                          label = items[idx] || `Checklist item ${idx + 1}`;
                        } else if (key.startsWith("reflection_")) {
                          const idx = parseInt(
                            key.replace("reflection_", "")
                          );
                          label = `Reflection ${idx + 1}`;
                        } else if (key === "freeform") {
                          label = "Freeform notes";
                        }

                        return (
                          <div key={key}>
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                              {label}
                            </p>
                            <div className="bg-surface-alt rounded-lg p-3">
                              <p className="text-sm text-text-primary whitespace-pre-wrap">
                                {value === "true"
                                  ? "✓ Checked"
                                  : value === "false"
                                  ? "☐ Not checked"
                                  : value || "—"}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pace Feedback Summary */}
      <div className="mt-8 p-5 bg-white rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📊</span>
          <h2 className="text-base font-semibold text-text-primary">Lesson Pace Feedback</h2>
          <span className="text-xs text-text-secondary ml-auto">From student post-lesson surveys</span>
        </div>
        <PaceFeedbackSummary unitId={unitId} />
      </div>

      {/* Open Studio Management */}
      <div className="mt-8">
        <OpenStudioClassView unitId={unitId} classId={classId} />
      </div>

      {/* NM Observation Snap modal */}
      {nmObserveStudent && nmConfig?.enabled && (
        <ObservationSnap
          studentId={nmObserveStudent.id}
          studentName={nmObserveStudent.display_name || nmObserveStudent.username}
          unitId={unitId}
          classId={classId}
          elements={
            AGENCY_ELEMENTS
              .filter((e) => nmConfig.elements.includes(e.id))
              .map((e) => ({ id: e.id, name: e.name, definition: e.definition, color: e.color, studentDescription: e.studentDescription }))
          }
          onComplete={() => setNmObserveStudent(null)}
          onClose={() => setNmObserveStudent(null)}
        />
      )}
    </main>
  );
}
