"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CRITERIA, PAGES, type CriterionKey } from "@/lib/constants";
import type { Student, StudentProgress, Unit } from "@/types";

interface ProgressCell {
  status: "not_started" | "in_progress" | "complete";
  hasResponses: boolean;
  timeSpent: number;
}

type StudentProgressMap = Record<string, Record<number, ProgressCell>>;

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
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [detailResponses, setDetailResponses] = useState<Record<string, string> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
        map[p.student_id][p.page_number] = {
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

    setLoading(false);
  }

  async function loadStudentDetail(student: Student, pageNumber: number) {
    setSelectedStudent(student);
    setSelectedPage(pageNumber);
    setDetailLoading(true);
    setDetailResponses(null);

    const supabase = createClient();
    const { data } = await supabase
      .from("student_progress")
      .select("responses")
      .eq("student_id", student.id)
      .eq("unit_id", unitId)
      .eq("page_number", pageNumber)
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

  function getPageCompletion(pageNumber: number): number {
    let count = 0;
    students.forEach((s) => {
      if (progressMap[s.id]?.[pageNumber]?.status === "complete") count++;
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

  const pageContent = unit?.content_data?.pages || {};

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
            {students.length} students · {PAGES.length} pages
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
                {/* Criterion header row */}
                <tr>
                  <th className="sticky left-0 z-10 bg-white" />
                  {(Object.keys(CRITERIA) as CriterionKey[]).map((key) => {
                    const criterion = CRITERIA[key];
                    const pageCount = PAGES.filter(
                      (p) => p.criterion === key
                    ).length;
                    return (
                      <th
                        key={key}
                        colSpan={pageCount}
                        className="px-1 py-2 text-center text-xs font-semibold uppercase tracking-wider border-b-2"
                        style={{
                          borderBottomColor: criterion.color,
                          color: criterion.color,
                        }}
                      >
                        {criterion.name}
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-xs font-medium text-text-secondary border-b border-border">
                    Done
                  </th>
                </tr>
                {/* Page ID header row */}
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-xs font-medium text-text-secondary min-w-[160px]">
                    Student
                  </th>
                  {PAGES.map((page) => {
                    const criterion = CRITERIA[page.criterion];
                    const completion = getPageCompletion(page.number);
                    const pct =
                      students.length > 0
                        ? Math.round((completion / students.length) * 100)
                        : 0;
                    return (
                      <th
                        key={page.id}
                        className="px-1 py-2 text-center text-xs font-medium min-w-[36px] cursor-default"
                        title={`${page.id}: ${page.title}\n${completion}/${students.length} complete (${pct}%)`}
                        style={{ color: criterion.color }}
                      >
                        {page.id}
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-center text-xs font-medium text-text-secondary min-w-[48px]">
                    /16
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
                          <span className="text-sm font-medium text-text-primary truncate max-w-[140px]">
                            {student.display_name || student.username}
                          </span>
                          {student.display_name && (
                            <span className="text-xs text-text-secondary font-mono">
                              {student.username}
                            </span>
                          )}
                        </div>
                      </td>
                      {PAGES.map((page) => {
                        const cell =
                          progressMap[student.id]?.[page.number];
                        return (
                          <td
                            key={page.id}
                            className="px-1 py-2 text-center"
                          >
                            <button
                              onClick={() =>
                                loadStudentDetail(student, page.number)
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
                            completed === 16
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
                  {PAGES.map((page) => {
                    const completion = getPageCompletion(page.number);
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
                  {PAGES.find((p) => p.number === selectedPage)?.id}:{" "}
                  {PAGES.find((p) => p.number === selectedPage)?.title}
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
                    const pageId = PAGES.find(
                      (p) => p.number === selectedPage
                    )?.id;
                    const page = pageId
                      ? (pageContent as Record<string, { sections?: { prompt: string }[]; reflection?: { type: string; items: string[] } }>)[pageId]
                      : null;
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
    </main>
  );
}
