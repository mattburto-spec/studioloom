"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ── Class colour palette + mesh gradients (shared) ──
import { CLASS_COLORS, getClassColor, getMeshGradientStyle } from "@/lib/ui/mesh-gradient";

interface ClassRow {
  id: string;
  name: string;
  code: string;
  created_at: string;
  is_archived?: boolean;
  studentCount: number;
  unitCount: number;
  framework?: string;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFramework, setNewFramework] = useState("myp_design");
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ classId: string; name: string } | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  const loadClasses = useCallback(async () => {
    const supabase = createClient();
    const { data: classData } = await supabase
      .from("classes")
      .select("id, name, code, created_at, is_archived, framework")
      .order("created_at", { ascending: false });

    if (!classData) {
      setLoading(false);
      return;
    }

    const classIds = classData.map((c) => c.id);
    const [studentsRes, classUnitsRes] = await Promise.all([
      supabase
        .from("class_students")
        .select("class_id")
        .in("class_id", classIds)
        .eq("is_active", true),
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
      framework: newFramework,
    });
    if (!error) {
      setNewName("");
      setNewFramework("myp_design");
      setShowCreate(false);
      loadClasses();
    }
    setCreating(false);
  }

  async function deleteClass() {
    if (!deleteConfirm || deleteConfirmInput !== deleteConfirm.name) return;
    setDeleting(deleteConfirm.classId);

    const supabase = createClient();
    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("id", deleteConfirm.classId);

    if (!error) {
      setDeleteConfirm(null);
      setDeleteConfirmInput("");
      loadClasses();
    }
    setDeleting(null);
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
        <div className="mb-8 p-6 bg-white border border-purple-100 rounded-2xl shadow-sm" style={{ background: "linear-gradient(180deg, #FAFAFE 0%, #FFFFFF 100%)" }}>
          <p className="text-sm font-semibold text-text-primary mb-4">Create a new class</p>

          {/* Class name */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-text-secondary mb-2 block">Class Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Year 10 Design & Technology"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              onKeyDown={(e) => e.key === "Enter" && createClass()}
              autoFocus
            />
          </div>

          {/* Framework selector */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-text-secondary mb-2.5 block">Learning Framework</label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: "myp_design", label: "MYP Design", desc: "Design cycle", color: "#6366F1" },
                { id: "service_learning", label: "Service Learning", desc: "Community service", color: "#EC4899" },
                { id: "pyp_exhibition", label: "PYP Exhibition", desc: "Inquiry journey", color: "#F59E0B" },
                { id: "personal_project", label: "Personal Project", desc: "Year 10 PP", color: "#8B5CF6" },
              ].map((fw) => (
                <button
                  key={fw.id}
                  onClick={() => setNewFramework(fw.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border-2 text-left transition-all ${
                    newFramework === fw.id
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: newFramework === fw.id ? fw.color : "#F3F4F6" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={newFramework === fw.id ? "#fff" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5L2 10l10 5 10-5-10-5zM2 19l10 5 10-5M2 14.5l10 5 10-5" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-text-primary leading-tight">{fw.label}</div>
                    <div className="text-[10px] text-text-secondary">{fw.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
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
                setNewFramework("myp_design");
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
                    style={{ background: color.fill }}
                  />

                  {/* ── Card content ── */}
                  <div className="flex-1 px-5 py-4">
                    {/* Top row: name + badges + code */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm overflow-hidden"
                          style={{ ...getMeshGradientStyle(idx), color: color.text }}
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
                            {cls.framework && (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                style={{
                                  background:
                                    cls.framework === "myp_design"
                                      ? "#EEF2FF"
                                      : cls.framework === "service_learning"
                                      ? "#FDF2F8"
                                      : cls.framework === "pyp_exhibition"
                                      ? "#FFFBEB"
                                      : "#F5F3FF",
                                  color:
                                    cls.framework === "myp_design"
                                      ? "#3730A3"
                                      : cls.framework === "service_learning"
                                      ? "#9D174D"
                                      : cls.framework === "pyp_exhibition"
                                      ? "#92400E"
                                      : "#5B21B6",
                                  borderColor:
                                    cls.framework === "myp_design"
                                      ? "#C7D2FE"
                                      : cls.framework === "service_learning"
                                      ? "#FBCFE8"
                                      : cls.framework === "pyp_exhibition"
                                      ? "#FEF3C7"
                                      : "#EDE9FE",
                                }}
                              >
                                {cls.framework === "myp_design"
                                  ? "Design"
                                  : cls.framework === "service_learning"
                                  ? "Service"
                                  : cls.framework === "pyp_exhibition"
                                  ? "PYP"
                                  : "Project"}
                              </span>
                            )}
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

                        {/* Delete */}
                        <button
                          onClick={() => {
                            setDeleteConfirm({ classId: cls.id, name: cls.name });
                            setDeleteConfirmInput("");
                          }}
                          disabled={deleting === cls.id}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition"
                          title="Delete this class permanently"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 4 20 4 22 6" />
                            <line x1="19" y1="8" x2="5" y2="8" />
                            <line x1="10" y1="12" x2="10" y2="19" />
                            <line x1="14" y1="12" x2="14" y2="19" />
                          </svg>
                          {deleting === cls.id ? "..." : "Delete"}
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
                          <button
                            onClick={() => {
                              setDeleteConfirm({ classId: cls.id, name: cls.name });
                              setDeleteConfirmInput("");
                            }}
                            disabled={deleting === cls.id}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition"
                            title="Delete this class permanently"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 4 20 4 22 6" />
                              <line x1="19" y1="8" x2="5" y2="8" />
                              <line x1="10" y1="12" x2="10" y2="19" />
                              <line x1="14" y1="12" x2="14" y2="19" />
                            </svg>
                            {deleting === cls.id ? "..." : "Delete"}
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

      {/* ── Delete confirmation modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 4 20 4 22 6" />
                  <line x1="19" y1="8" x2="5" y2="8" />
                  <line x1="10" y1="12" x2="10" y2="19" />
                  <line x1="14" y1="12" x2="14" y2="19" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-text-primary">Delete Class</h2>
            </div>

            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              This will permanently delete <span className="font-semibold">{deleteConfirm.name}</span> and all associated data (students, progress, grades). This cannot be undone.
            </p>

            <div className="mb-4">
              <label className="text-xs font-semibold text-text-secondary mb-2 block">
                Type the class name to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={deleteConfirm.name}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteConfirm(null);
                  setDeleteConfirmInput("");
                }}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={deleteClass}
                disabled={deleteConfirmInput !== deleteConfirm.name || deleting === deleteConfirm.classId}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40 bg-red-600 hover:bg-red-700"
              >
                {deleting === deleteConfirm.classId ? "Deleting..." : "Delete Class"}
              </button>
            </div>
          </div>
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
