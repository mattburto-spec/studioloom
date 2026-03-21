"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface StudentRow {
  id: string;
  username: string;
  display_name: string | null;
  class_id: string;
  created_at: string;
}

interface ClassRow {
  id: string;
  name: string;
  code: string;
}

interface ProgressSummary {
  student_id: string;
  total: number;
  completed: number;
}

interface OpenStudioStatus {
  student_id: string;
  status: string;
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressSummary>>(new Map());
  const [studioMap, setStudioMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "class" | "progress">("name");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Parallel: classes, students
      const [classesRes, studentsRes] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name, code")
          .eq("teacher_id", user.id)
          .neq("is_archived", true)
          .order("name"),
        supabase
          .from("students")
          .select("id, username, display_name, class_id, created_at")
          .order("display_name"),
      ]);

      const allClasses = (classesRes.data || []) as ClassRow[];
      const classIds = new Set(allClasses.map((c) => c.id));

      // Filter students to only those in teacher's classes
      const teacherStudents = ((studentsRes.data || []) as StudentRow[]).filter(
        (s) => classIds.has(s.class_id)
      );

      setClasses(allClasses);
      setStudents(teacherStudents);

      if (teacherStudents.length > 0) {
        const studentIds = teacherStudents.map((s) => s.id);

        // Get progress summaries + open studio status
        const [progressRes, studioRes] = await Promise.all([
          supabase
            .from("student_progress")
            .select("student_id, status")
            .in("student_id", studentIds),
          supabase
            .from("open_studio_status")
            .select("student_id, status")
            .in("student_id", studentIds)
            .eq("status", "unlocked"),
        ]);

        // Aggregate progress per student
        const pMap = new Map<string, ProgressSummary>();
        for (const row of (progressRes.data || []) as { student_id: string; status: string }[]) {
          const existing = pMap.get(row.student_id) || { student_id: row.student_id, total: 0, completed: 0 };
          existing.total++;
          if (row.status === "complete") existing.completed++;
          pMap.set(row.student_id, existing);
        }
        setProgressMap(pMap);

        // Studio status
        const sMap = new Map<string, string>();
        for (const row of (studioRes.data || []) as OpenStudioStatus[]) {
          sMap.set(row.student_id, row.status);
        }
        setStudioMap(sMap);
      }

      setLoading(false);
    }
    load();
  }, []);

  const classNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.id, c.name);
    return map;
  }, [classes]);

  const filtered = useMemo(() => {
    let list = students;

    // Class filter
    if (classFilter !== "all") {
      list = list.filter((s) => s.class_id === classFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          (s.display_name || "").toLowerCase().includes(q) ||
          s.username.toLowerCase().includes(q) ||
          (classNameMap.get(s.class_id) || "").toLowerCase().includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === "name") {
        return (a.display_name || a.username).localeCompare(b.display_name || b.username);
      }
      if (sortBy === "class") {
        return (classNameMap.get(a.class_id) || "").localeCompare(classNameMap.get(b.class_id) || "");
      }
      if (sortBy === "progress") {
        const pa = progressMap.get(a.id);
        const pb = progressMap.get(b.id);
        const pctA = pa && pa.total > 0 ? pa.completed / pa.total : 0;
        const pctB = pb && pb.total > 0 ? pb.completed / pb.total : 0;
        return pctB - pctA;
      }
      return 0;
    });

    return list;
  }, [students, classFilter, search, sortBy, classNameMap, progressMap]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-40" />
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Students</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {students.length} student{students.length !== 1 ? "s" : ""} across {classes.length} class{classes.length !== 1 ? "es" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2"
          >
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-white"
          />
        </div>

        {/* Class filter */}
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        >
          <option value="all">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "class" | "progress")}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        >
          <option value="name">Sort: Name</option>
          <option value="class">Sort: Class</option>
          <option value="progress">Sort: Progress</option>
        </select>
      </div>

      {/* Student list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-border">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" className="mx-auto mb-3">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <p className="text-text-secondary text-sm">
            {search ? "No students match your search." : "No students yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_140px_100px_140px] gap-2 px-5 py-3 bg-gray-50 border-b border-border text-xs font-semibold text-text-secondary uppercase tracking-wider">
            <span>Student</span>
            <span>Class</span>
            <span>Progress</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {filtered.map((student) => {
              const name = student.display_name || student.username;
              const cls = classNameMap.get(student.class_id) || "—";
              const prog = progressMap.get(student.id);
              const pct = prog && prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
              const hasStudio = studioMap.has(student.id);

              return (
                <div
                  key={student.id}
                  className="grid grid-cols-[1fr_140px_100px_140px] gap-2 px-5 py-3 items-center hover:bg-gray-50/50 transition-colors"
                >
                  {/* Name + badges */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/teacher/students/${student.id}`}
                        className="text-sm font-medium text-text-primary hover:text-purple-600 transition truncate block"
                      >
                        {name}
                      </Link>
                      <span className="text-[11px] text-text-secondary">{student.username}</span>
                    </div>
                    {hasStudio && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-600 rounded-full flex-shrink-0">
                        Studio
                      </span>
                    )}
                  </div>

                  {/* Class */}
                  <span className="text-sm text-text-secondary truncate">{cls}</span>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: pct === 100 ? "#10B981" : pct > 50 ? "#7B2FF2" : "#D1D5DB",
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-text-secondary w-8 text-right">{pct}%</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/teacher/students/${student.id}`}
                      className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition"
                    >
                      View
                    </Link>
                    <Link
                      href={`/teacher/classes/${student.class_id}/progress/${student.id}`}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition"
                      title="Class progress"
                    >
                      Progress
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
