"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getYearLevelDisplay, yearLevelToGraduationYear, YEAR_LEVEL_OPTIONS } from "@/lib/utils/year-level";

// ── Types ──

interface StudentRow {
  id: string;
  username: string;
  display_name: string | null;
  class_id: string | null; // Legacy — may be null for students created post-migration 041
  author_teacher_id: string | null;
  ell_level?: number;
  graduation_year?: number | null;
  created_at: string;
  // Populated from class_students junction
  enrolledClassIds?: string[];
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

interface OpenStudioEntry {
  student_id: string;
  unit_id: string;
  status: string;
}

interface BadgeEntry {
  student_id: string;
  status: string;
}

// ── Colour helpers ──

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #7C3AED, #6D28D9)",
  "linear-gradient(135deg, #3B82F6, #2563EB)",
  "linear-gradient(135deg, #10B981, #059669)",
  "linear-gradient(135deg, #F59E0B, #D97706)",
  "linear-gradient(135deg, #EC4899, #DB2777)",
  "linear-gradient(135deg, #06B6D4, #0891B2)",
  "linear-gradient(135deg, #F97316, #EA580C)",
  "linear-gradient(135deg, #6366F1, #4F46E5)",
];

function avatarGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

const CLASS_COLORS: Record<string, { fill: string; light: string; text: string }> = {};
const COLOR_PALETTE = [
  { fill: "#3B82F6", light: "#EFF6FF", text: "#1E40AF" },
  { fill: "#10B981", light: "#ECFDF5", text: "#065F46" },
  { fill: "#F59E0B", light: "#FFFBEB", text: "#92400E" },
  { fill: "#8B5CF6", light: "#F5F3FF", text: "#5B21B6" },
  { fill: "#EC4899", light: "#FDF2F8", text: "#9D174D" },
  { fill: "#06B6D4", light: "#ECFEFF", text: "#155E75" },
  { fill: "#F97316", light: "#FFF7ED", text: "#9A3412" },
  { fill: "#6366F1", light: "#EEF2FF", text: "#3730A3" },
];

function getClassColor(classId: string, allClasses: ClassRow[]) {
  if (!CLASS_COLORS[classId]) {
    const idx = allClasses.findIndex((c) => c.id === classId);
    CLASS_COLORS[classId] = COLOR_PALETTE[(idx >= 0 ? idx : 0) % COLOR_PALETTE.length];
  }
  return CLASS_COLORS[classId];
}

// ── ELL labels ──

const ELL_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "ELL 1", color: "#B45309", bg: "#FEF3C7" },
  2: { label: "ELL 2", color: "#1D4ED8", bg: "#DBEAFE" },
  3: { label: "ELL 3", color: "#047857", bg: "#D1FAE5" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressSummary>>(new Map());
  const [studioMap, setStudioMap] = useState<Map<string, number>>(new Map()); // student_id → count of unlocked units
  const [badgeMap, setBadgeMap] = useState<Map<string, number>>(new Map()); // student_id → earned badge count
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "class" | "progress" | "recent" | "year">("name");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const [enrollmentMap, setEnrollmentMap] = useState<Map<string, string[]>>(new Map()); // student_id → class_ids
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newYearLevel, setNewYearLevel] = useState<number | "">("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch classes + students owned by this teacher + enrollment data
    const [classesRes, studentsRes, enrollmentsRes] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name, code")
        .eq("teacher_id", user.id)
        .neq("is_archived", true)
        .order("name"),
      supabase
        .from("students")
        .select("id, username, display_name, class_id, author_teacher_id, ell_level, graduation_year, created_at")
        .eq("author_teacher_id", user.id)
        .order("display_name"),
      supabase
        .from("class_students")
        .select("student_id, class_id")
        .eq("is_active", true),
    ]);

    const allClasses = (classesRes.data || []) as ClassRow[];
    const classIds = new Set(allClasses.map((c) => c.id));

    // Build enrollment map (student_id → array of class_ids they're in)
    const eMap = new Map<string, string[]>();
    for (const row of (enrollmentsRes.data || []) as { student_id: string; class_id: string }[]) {
      if (!classIds.has(row.class_id)) continue; // Only include teacher's classes
      const arr = eMap.get(row.student_id) || [];
      arr.push(row.class_id);
      eMap.set(row.student_id, arr);
    }
    setEnrollmentMap(eMap);

    // Include ALL teacher's students (even unassigned ones)
    const teacherStudents = ((studentsRes.data || []) as StudentRow[]).map((s) => ({
      ...s,
      enrolledClassIds: eMap.get(s.id) || [],
    }));

    setClasses(allClasses);
    setStudents(teacherStudents);

    if (teacherStudents.length > 0) {
      const studentIds = teacherStudents.map((s) => s.id);

      const [progressRes, studioRes, badgesRes] = await Promise.all([
        supabase.from("student_progress").select("student_id, status").in("student_id", studentIds),
        supabase
          .from("open_studio_status")
          .select("student_id, unit_id, status")
          .in("student_id", studentIds)
          .eq("status", "unlocked"),
        supabase
          .from("student_badges")
          .select("student_id, status")
          .in("student_id", studentIds)
          .eq("status", "earned"),
      ]);

      // Progress
      const pMap = new Map<string, ProgressSummary>();
      for (const row of (progressRes.data || []) as { student_id: string; status: string }[]) {
        const existing = pMap.get(row.student_id) || { student_id: row.student_id, total: 0, completed: 0 };
        existing.total++;
        if (row.status === "complete") existing.completed++;
        pMap.set(row.student_id, existing);
      }
      setProgressMap(pMap);

      // Studio — count of unlocked units per student
      const sMap = new Map<string, number>();
      for (const row of (studioRes.data || []) as OpenStudioEntry[]) {
        sMap.set(row.student_id, (sMap.get(row.student_id) || 0) + 1);
      }
      setStudioMap(sMap);

      // Badges — count earned per student
      const bMap = new Map<string, number>();
      for (const row of (badgesRes.data || []) as BadgeEntry[]) {
        bMap.set(row.student_id, (bMap.get(row.student_id) || 0) + 1);
      }
      setBadgeMap(bMap);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const classNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.id, c.name);
    return map;
  }, [classes]);

  const filtered = useMemo(() => {
    let list = students;
    if (classFilter === "unassigned") {
      list = list.filter((s) => !s.enrolledClassIds || s.enrolledClassIds.length === 0);
    } else if (classFilter !== "all") {
      list = list.filter((s) => s.enrolledClassIds?.includes(classFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          (s.display_name || "").toLowerCase().includes(q) ||
          s.username.toLowerCase().includes(q) ||
          (s.enrolledClassIds || []).some((cid) => (classNameMap.get(cid) || "").toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return (a.display_name || a.username).localeCompare(b.display_name || b.username);
      if (sortBy === "class") {
        const aClass = classNameMap.get(a.enrolledClassIds?.[0] || "") || "";
        const bClass = classNameMap.get(b.enrolledClassIds?.[0] || "") || "";
        return aClass.localeCompare(bClass);
      }
      if (sortBy === "progress") {
        const pa = progressMap.get(a.id);
        const pb = progressMap.get(b.id);
        return (pb && pb.total > 0 ? pb.completed / pb.total : 0) - (pa && pa.total > 0 ? pa.completed / pa.total : 0);
      }
      if (sortBy === "year") {
        const aYear = a.graduation_year || 9999;
        const bYear = b.graduation_year || 9999;
        return aYear - bYear; // Earlier graduation = higher year level = first
      }
      if (sortBy === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return 0;
    });
    return list;
  }, [students, classFilter, search, sortBy, classNameMap, progressMap]);

  // ── Summary stats ──
  const studioCount = studioMap.size;
  const avgProgress = useMemo(() => {
    if (students.length === 0) return 0;
    let totalPct = 0;
    for (const s of students) {
      const p = progressMap.get(s.id);
      if (p && p.total > 0) totalPct += (p.completed / p.total) * 100;
    }
    return Math.round(totalPct / students.length);
  }, [students, progressMap]);

  // ── Loading ──
  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-40" />
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Students</h1>
          <p className="text-sm text-gray-500 mt-1">
            {students.length} student{students.length !== 1 ? "s" : ""} across{" "}
            {classes.length} class{classes.length !== 1 ? "es" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowAddStudent(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
          style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14m-7-7h14" />
          </svg>
          Add Student
        </button>
      </div>

      {/* ── Add Student Modal ── */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowAddStudent(false); setAddError(""); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-gray-900 mb-1">Add Student</h2>
            <p className="text-sm text-gray-500 mb-5">Create a student in your roster. You can assign them to classes later.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Username *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. jsmith"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Year Level</label>
                <select
                  value={newYearLevel}
                  onChange={(e) => setNewYearLevel(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                >
                  <option value="">Not set</option>
                  {YEAR_LEVEL_OPTIONS.map((yl) => (
                    <option key={yl} value={yl}>Year {yl}</option>
                  ))}
                </select>
              </div>
            </div>

            {addError && (
              <p className="text-xs text-red-600 mt-3 bg-red-50 px-3 py-2 rounded-lg">{addError}</p>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => { setShowAddStudent(false); setAddError(""); setNewUsername(""); setNewDisplayName(""); setNewYearLevel(""); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition">Cancel</button>
              <button
                disabled={adding || !newUsername.trim()}
                onClick={async () => {
                  setAdding(true);
                  setAddError("");
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) { setAddError("Not authenticated"); setAdding(false); return; }

                  const { data: student, error } = await supabase
                    .from("students")
                    .insert({
                      username: newUsername.trim().toLowerCase(),
                      display_name: newDisplayName.trim() || null,
                      ell_level: 3,
                      author_teacher_id: user.id,
                      class_id: null,
                      graduation_year: newYearLevel ? yearLevelToGraduationYear(newYearLevel as number) : null,
                    })
                    .select()
                    .single();

                  if (error) {
                    setAddError(error.code === "23505" ? "A student with this username already exists." : error.message);
                    setAdding(false);
                    return;
                  }

                  setShowAddStudent(false);
                  setNewUsername("");
                  setNewDisplayName("");
                  setNewYearLevel("");
                  setAdding(false);
                  loadData();
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
              >
                {adding ? "Adding..." : "Add Student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary strip ── */}
      {students.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryCard
            label="Total Students"
            value={students.length.toString()}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            color="#7C3AED"
          />
          <SummaryCard
            label="Avg Progress"
            value={`${avgProgress}%`}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
            color="#10B981"
          />
          <SummaryCard
            label="In Studio"
            value={studioCount.toString()}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>}
            color="#8B5CF6"
            gradient
          />
          <SummaryCard
            label="Badges Earned"
            value={Array.from(badgeMap.values()).reduce((a, b) => a + b, 0).toString()}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15l-3.5 2 1-4L6 10l4-.5L12 6l2 3.5 4 .5-3.5 3 1 4z"/></svg>}
            color="#F59E0B"
          />
        </div>
      )}

      {/* ── Filters bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username, or class..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-white"
          />
        </div>

        {/* Class filter */}
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        >
          <option value="all">All classes</option>
          <option value="unassigned">Unassigned</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "class" | "progress" | "recent")}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        >
          <option value="name">Sort: Name</option>
          <option value="class">Sort: Class</option>
          <option value="year">Sort: Year Level</option>
          <option value="progress">Sort: Progress</option>
          <option value="recent">Sort: Newest</option>
        </select>

        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setViewMode("cards")}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${viewMode === "cards" ? "bg-white shadow-sm text-text-primary" : "text-text-tertiary"}`}
            title="Card view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${viewMode === "table" ? "bg-white shadow-sm text-text-primary" : "text-text-tertiary"}`}
            title="Table view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p className="text-base font-semibold text-text-primary mb-1">
            {search ? "No students match your search" : "No students yet"}
          </p>
          <p className="text-sm text-text-secondary">
            {search
              ? "Try a different name or class filter."
              : "Students join by entering your class code. Share it from the Classes page."}
          </p>
          {!search && (
            <Link
              href="/teacher/classes"
              className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-purple-600 hover:text-purple-700 transition"
            >
              Go to Classes
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
              </svg>
            </Link>
          )}
        </div>
      )}

      {/* ── Card view ── */}
      {filtered.length > 0 && viewMode === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((student) => {
            const name = student.display_name || student.username;
            const enrolledIds = student.enrolledClassIds || [];
            const prog = progressMap.get(student.id);
            const pct = prog && prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
            const studioUnits = studioMap.get(student.id) || 0;
            const badges = badgeMap.get(student.id) || 0;
            const ell = student.ell_level ? ELL_LABELS[student.ell_level] : null;
            const firstClassId = enrolledIds[0] || student.class_id;

            return (
              <div
                key={student.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-gray-300 transition-all group"
              >
                {/* Top band with avatar + name */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm"
                      style={{ background: avatarGradient(name) }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/teacher/students/${student.id}`}
                        className="text-sm font-bold text-gray-900 hover:text-purple-600 transition leading-snug block truncate"
                      >
                        {name}
                      </Link>
                      <span className="text-[11px] text-gray-400">{student.username}</span>
                    </div>
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    {/* Class pills — show ALL enrolled classes */}
                    {enrolledIds.length > 0 ? (
                      enrolledIds.map((cid) => {
                        const cc = getClassColor(cid, classes);
                        return (
                          <span
                            key={cid}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: cc.light, color: cc.text }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cc.fill }} />
                            {classNameMap.get(cid) || "—"}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-gray-400 italic px-2 py-0.5 rounded-full bg-gray-50 border border-dashed border-gray-200">
                        No class assigned
                      </span>
                    )}

                    {/* Year level badge */}
                    {(() => {
                      const yl = getYearLevelDisplay(student.graduation_year);
                      return yl ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {yl}
                        </span>
                      ) : null;
                    })()}

                    {/* ELL badge */}
                    {ell && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: ell.bg, color: ell.color }}
                      >
                        {ell.label}
                      </span>
                    )}

                    {/* Studio badge */}
                    {studioUnits > 0 && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: "linear-gradient(135deg, #06B6D4, #8B5CF6, #EC4899)" }}
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                        </svg>
                        Studio{studioUnits > 1 ? ` ×${studioUnits}` : ""}
                      </span>
                    )}

                    {/* Safety badges count */}
                    {badges > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                        {badges}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress section */}
                <div className="px-4 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background:
                            pct === 100
                              ? "linear-gradient(90deg, #10B981, #059669)"
                              : pct > 60
                              ? "linear-gradient(90deg, #7C3AED, #6D28D9)"
                              : pct > 30
                              ? "linear-gradient(90deg, #3B82F6, #2563EB)"
                              : "#D1D5DB",
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500 w-10 text-right">
                      {pct}%
                    </span>
                  </div>
                  {prog && prog.total > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {prog.completed}/{prog.total} pages complete
                    </p>
                  )}
                </div>

                {/* Actions footer */}
                <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-100 flex items-center gap-1.5">
                  <Link
                    href={`/teacher/students/${student.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 transition"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Profile
                  </Link>
                  {firstClassId && (
                    <Link
                      href={`/teacher/classes/${firstClassId}/progress`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                      </svg>
                      Progress
                    </Link>
                  )}
                  {studioUnits > 0 && (
                    <span className="ml-auto text-[10px] text-gray-400 italic">working independently</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Table view ── */}
      {filtered.length > 0 && viewMode === "table" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_60px_70px_100px_60px_150px] gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
            <span>Student</span>
            <span>Class</span>
            <span>Year</span>
            <span>ELL</span>
            <span>Progress</span>
            <span className="text-center">Status</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-gray-100">
            {filtered.map((student) => {
              const name = student.display_name || student.username;
              const enrolledIds = student.enrolledClassIds || [];
              const prog = progressMap.get(student.id);
              const pct = prog && prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
              const studioUnits = studioMap.get(student.id) || 0;
              const badges = badgeMap.get(student.id) || 0;
              const ell = student.ell_level ? ELL_LABELS[student.ell_level] : null;
              const firstClassId = enrolledIds[0] || student.class_id;

              return (
                <div
                  key={student.id}
                  className="grid grid-cols-[1fr_120px_60px_70px_100px_60px_150px] gap-2 px-5 py-3 items-center hover:bg-gray-50/50 transition-colors"
                >
                  {/* Name + avatar */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: avatarGradient(name) }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/teacher/students/${student.id}`}
                        className="text-sm font-semibold text-text-primary hover:text-purple-600 transition truncate block"
                      >
                        {name}
                      </Link>
                      <span className="text-[10px] text-text-tertiary">{student.username}</span>
                    </div>
                  </div>

                  {/* Class pills */}
                  <div className="flex flex-wrap gap-1">
                    {enrolledIds.length > 0 ? enrolledIds.slice(0, 2).map((cid) => {
                      const cc = getClassColor(cid, classes);
                      return (
                        <span key={cid} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: cc.light, color: cc.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cc.fill }} />
                          {classNameMap.get(cid) || "—"}
                        </span>
                      );
                    }) : (
                      <span className="text-[10px] text-gray-400 italic">None</span>
                    )}
                    {enrolledIds.length > 2 && (
                      <span className="text-[10px] text-gray-400">+{enrolledIds.length - 2}</span>
                    )}
                  </div>

                  {/* Year level */}
                  <div>
                    {(() => {
                      const yl = getYearLevelDisplay(student.graduation_year);
                      return yl ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          {yl}
                        </span>
                      ) : (
                        <span className="text-[10px] text-text-tertiary">—</span>
                      );
                    })()}
                  </div>

                  {/* ELL */}
                  <div>
                    {ell ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: ell.bg, color: ell.color }}>
                        {ell.label}
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-tertiary">—</span>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: pct === 100 ? "#10B981" : pct > 50 ? "#7C3AED" : "#D1D5DB",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-text-secondary w-7 text-right">{pct}%</span>
                  </div>

                  {/* Status icons */}
                  <div className="flex items-center justify-center gap-1">
                    {studioUnits > 0 && (
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                        style={{ background: "linear-gradient(135deg, #06B6D4, #8B5CF6, #EC4899)" }}
                        title={`Open Studio (${studioUnits} unit${studioUnits > 1 ? "s" : ""})`}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                        </svg>
                      </span>
                    )}
                    {badges > 0 && (
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-100 text-amber-700"
                        title={`${badges} badge${badges > 1 ? "s" : ""} earned`}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/teacher/students/${student.id}`}
                      className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
                    >
                      Profile
                    </Link>
                    {firstClassId && (
                      <Link
                        href={`/teacher/classes/${firstClassId}/progress`}
                        className="px-2.5 py-1 text-[11px] font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        Progress
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Results count ── */}
      {filtered.length > 0 && (search || classFilter !== "all") && (
        <p className="text-[11px] text-text-tertiary mt-3 text-center">
          Showing {filtered.length} of {students.length} students
        </p>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  color,
  gradient,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  gradient?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={
          gradient
            ? { background: "linear-gradient(135deg, #06B6D4, #8B5CF6, #EC4899)", color: "white" }
            : { background: `${color}14`, color }
        }
      >
        {icon}
      </div>
      <div>
        <p className="text-lg font-extrabold text-text-primary leading-none">{value}</p>
        <p className="text-[10px] text-text-tertiary font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}
