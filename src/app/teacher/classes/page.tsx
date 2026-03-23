"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ── Class colour palette (same as dashboard) ──
const CLASS_COLORS = [
  { fill: "#3B82F6", gradient: "linear-gradient(135deg, #3B82F6, #2563EB)", light: "#EFF6FF", text: "#1E40AF" },
  { fill: "#10B981", gradient: "linear-gradient(135deg, #10B981, #059669)", light: "#ECFDF5", text: "#065F46" },
  { fill: "#F59E0B", gradient: "linear-gradient(135deg, #F59E0B, #D97706)", light: "#FFFBEB", text: "#92400E" },
  { fill: "#8B5CF6", gradient: "linear-gradient(135deg, #8B5CF6, #7C3AED)", light: "#F5F3FF", text: "#5B21B6" },
  { fill: "#EC4899", gradient: "linear-gradient(135deg, #EC4899, #DB2777)", light: "#FDF2F8", text: "#9D174D" },
  { fill: "#06B6D4", gradient: "linear-gradient(135deg, #06B6D4, #0891B2)", light: "#ECFEFF", text: "#155E75" },
  { fill: "#F97316", gradient: "linear-gradient(135deg, #F97316, #EA580C)", light: "#FFF7ED", text: "#9A3412" },
  { fill: "#6366F1", gradient: "linear-gradient(135deg, #6366F1, #4F46E5)", light: "#EEF2FF", text: "#3730A3" },
];

function getClassColor(idx: number) {
  return CLASS_COLORS[idx % CLASS_COLORS.length];
}

interface ClassRow {
  id: string;
  name: string;
  code: string;
  created_at: string;
  is_archived?: boolean;
  studentCount: number;
  unitCount: number;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    const supabase = createClient();
    const { data: classData } = await supabase
      .from("classes")
      .select("id, name, code, created_at, is_archived")
      .order("created_at", { ascending: false });

    if (!classData) {
      setLoading(false);
      return;
    }

    const classIds = classData.map((c) => c.id);
    const [studentsRes, classUnitsRes] = await Promise.all([
      supabase
        .from("students")
        .select("class_id")
        .in("class_id", classIds),
      supabase
        .from("class_units")
        .select("class_id, is_active")
        .in("class_id", classIds),
    ]);

    const studentCounts: Record<string, number> = {};
    for (const s of studentsRes.data || []) {
      studentCounts[s.class_id] = (studentCounts[s.class_id] || 0) + 1;
    }

    const unitCounts: Record<string, number> = {};
    for (const cu of classUnitsRes.data || []) {
      if (cu.is_active !== false) {
        unitCounts[cu.class_id] = (unitCounts[cu.class_id] || 0) + 1;
      }
    }

    setClasses(
      classData.map((c) => ({
        ...c,
        studentCount: studentCounts[c.id] || 0,
        unitCount: unitCounts[c.id] || 0,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  async function createClass() {
    if (!newName.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from("classes").insert({
      name: newName.trim(),
      code,
      teacher_id: user.id,
    });
    if (!error) {
      setNewName("");
      setShowCreate(false);
      loadClasses();
    }
    setCreating(false);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function toggleArchive(classId: string, currentlyArchived: boolean) {
    setArchiving(classId);
    const supabase = createClient();
    await supabase
      .from("classes")
      .update({ is_archived: !currentlyArchived })
      .eq("id", classId);
    await loadClasses();
    setArchiving(null);
  }

  const active = classes.filter((c) => !c.is_archived);
  const archived = classes.filter((c) => c.is_archived);

  // ── Loading ──
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Loading classes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Classes</h1>
          <p className="text-sm text-text-secondary mt-1">
            {active.length} active class{active.length !== 1 ? "es" : ""}
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14m-7-7h14" />
          </svg>
          New Class
        </button>
      </div>

      {/* ── Create class form ── */}
      {showCreate && (
        <div className="mb-8 p-5 bg-white border border-purple-100 rounded-2xl shadow-sm" style={{ background: "linear-gradient(180deg, #FAFAFE 0%, #FFFFFF 100%)" }}>
          <p className="text-sm font-semibold text-text-primary mb-3">Create a new class</p>
          <div className="flex items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Year 10 Design & Technology"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              onKeyDown={(e) => e.key === "Enter" && createClass()}
              autoFocus
            />
            <button
              onClick={createClass}
              disabled={creating || !newName.trim()}
              className="px-5 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setNewName("");
              }}
              className="px-3 py-2.5 text-sm text-text-tertiary hover:text-text-primary transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {active.length === 0 && archived.length === 0 && (
        <div className="text-center py-20 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="text-base font-semibold text-text-primary mb-1">No classes yet</p>
          <p className="text-sm text-text-secondary mb-5">Create your first class to start assigning units and adding students.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl transition"
            style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14m-7-7h14" />
            </svg>
            Create Your First Class
          </button>
        </div>
      )}

      {/* ── Active class cards ── */}
      {active.length > 0 && (
        <div className="grid gap-4">
          {active.map((cls, idx) => {
            const color = getClassColor(idx);

            return (
              <div
                key={cls.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-md"
              >
                <div className="flex">
                  {/* ── Colour sidebar ── */}
                  <div
                    className="w-2 shrink-0"
                    style={{ background: color.gradient }}
                  />

                  {/* ── Card content ── */}
                  <div className="flex-1 px-5 py-4">
                    {/* Top row: name + badges + code */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm"
                          style={{ background: color.gradient }}
                        >
                          {cls.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/teacher/classes/${cls.id}`}
                              className="text-base font-bold text-text-primary hover:text-purple-700 transition leading-snug"
                            >
                              {cls.name}
                            </Link>
                          </div>
                          {/* Stats row */}
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                              </svg>
                              {cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                              </svg>
                              {cls.unitCount} unit{cls.unitCount !== 1 ? "s" : ""}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyCode(cls.code);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-md transition"
                              style={{
                                background: copiedCode === cls.code ? "#ECFDF5" : color.light,
                                color: copiedCode === cls.code ? "#065F46" : color.text,
                              }}
                              title="Click to copy class code"
                            >
                              {copiedCode === cls.code ? (
                                <>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Copied
                                </>
                              ) : (
                                <>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                  {cls.code}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: quick-link chevron */}
                      <Link
                        href={`/teacher/classes/${cls.id}`}
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-purple-500 hover:bg-purple-50 transition mt-1"
                        title="Class details"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    </div>

                    {/* ── Action buttons ── */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {/* Manage */}
                        <Link
                          href={`/teacher/classes/${cls.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition"
                          style={{ background: color.light, color: color.text }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                          Manage
                        </Link>

                        {/* Students */}
                        <Link
                          href={`/teacher/classes/${cls.id}#students`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-gray-200 text-text-secondary hover:bg-gray-50 transition"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          Students
                        </Link>

                        {/* Share Code */}
                        <button
                          onClick={() => copyCode(cls.code)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-gray-200 text-text-secondary hover:bg-gray-50 transition"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                          </svg>
                          {copiedCode === cls.code ? "Copied!" : "Share Code"}
                        </button>

                        {/* Archive */}
                        <button
                          onClick={() => toggleArchive(cls.id, false)}
                          disabled={archiving === cls.id}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-gray-200 text-text-tertiary hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition"
                          title="Archive this class"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="21 8 21 21 3 21 3 8" />
                            <rect x="1" y="3" width="22" height="5" />
                            <line x1="10" y1="12" x2="14" y2="12" />
                          </svg>
                          {archiving === cls.id ? "..." : "Archive"}
                        </button>

                        {/* Spacer + quick unit count link */}
                        {cls.unitCount > 0 && (
                          <Link
                            href={`/teacher/classes/${cls.id}#units`}
                            className="ml-auto text-[11px] text-text-tertiary hover:text-purple-600 transition"
                          >
                            {cls.unitCount} active unit{cls.unitCount !== 1 ? "s" : ""} →
                          </Link>
                        )}
                      </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Archived section ── */}
      {archived.length > 0 && (
        <div className="mt-10">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 mb-4 group"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="transition-transform"
              style={{ transform: showArchived ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="text-sm font-semibold text-gray-400 group-hover:text-gray-600 transition">
              Archived Classes ({archived.length})
            </span>
          </button>

          {showArchived && (
            <div className="grid gap-3">
              {archived.map((cls, idx) => {
                const color = getClassColor(active.length + idx);
                return (
                  <div
                    key={cls.id}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
                    style={{ opacity: 0.6 }}
                  >
                    <div className="flex">
                      <div className="w-2 shrink-0 bg-gray-300" />
                      <div className="flex-1 px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0"
                              style={{ background: "linear-gradient(135deg, #9CA3AF, #6B7280)" }}
                            >
                              {cls.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={`/teacher/classes/${cls.id}`}
                                  className="text-base font-bold text-text-primary hover:text-purple-700 transition leading-snug"
                                >
                                  {cls.name}
                                </Link>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                  Archived
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs text-text-secondary">{cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}</span>
                                <span className="text-xs text-text-secondary">{cls.unitCount} unit{cls.unitCount !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Link
                            href={`/teacher/classes/${cls.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-gray-200 text-text-secondary hover:bg-gray-50 transition"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            View
                          </Link>
                          <button
                            onClick={() => toggleArchive(cls.id, true)}
                            disabled={archiving === cls.id}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-gray-200 text-green-600 hover:bg-green-50 hover:border-green-200 transition"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="1 4 1 10 7 10" />
                              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                            </svg>
                            {archiving === cls.id ? "Restoring..." : "Restore"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tip ── */}
      {active.length > 0 && active.length <= 3 && (
        <div className="mt-8 px-4 py-3 bg-purple-50 border border-purple-100 rounded-xl">
          <p className="text-xs text-purple-700">
            <span className="font-semibold">Tip:</span> Share your class code with students so they can join. You can copy a code by clicking it on any class card above.
          </p>
        </div>
      )}
    </div>
  );
}
