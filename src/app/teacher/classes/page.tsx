"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    const supabase = createClient();
    const { data: classData } = await supabase
      .from("classes")
      .select("id, name, code, created_at, is_archived")
      .order("created_at", { ascending: false });

    if (!classData) {
      setLoading(false);
      return;
    }

    // Get student counts and unit counts per class
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
  }

  async function createClass() {
    if (!newName.trim()) return;
    setCreating(true);
    const supabase = createClient();

    // Generate a 6-char class code
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();

    const { error } = await supabase.from("classes").insert({
      name: newName.trim(),
      code,
    });

    if (!error) {
      setNewName("");
      setShowCreate(false);
      loadClasses();
    }
    setCreating(false);
  }

  const active = classes.filter((c) => !c.is_archived);
  const archived = classes.filter((c) => c.is_archived);
  const displayClasses = showArchived ? classes : active;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Loading classes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Classes</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {active.length} active class{active.length !== 1 ? "es" : ""}
            {archived.length > 0 && ` · ${archived.length} archived`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition shadow-sm"
        >
          + New Class
        </button>
      </div>

      {/* Create class inline form */}
      {showCreate && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Class name (e.g. Year 10 DT)"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyDown={(e) => e.key === "Enter" && createClass()}
              autoFocus
            />
            <button
              onClick={createClass}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(""); }}
              className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Show archived toggle */}
      {archived.length > 0 && (
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="mb-4 text-xs text-text-secondary hover:text-text-primary transition"
        >
          {showArchived ? "Hide archived" : `Show ${archived.length} archived`}
        </button>
      )}

      {/* Class list */}
      {displayClasses.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-text-secondary">No classes yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayClasses.map((cls) => (
            <Link
              key={cls.id}
              href={`/teacher/classes/${cls.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-purple-200 hover:shadow-sm transition group"
              style={cls.is_archived ? { opacity: 0.5 } : undefined}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{
                      background: `hsl(${cls.name.charCodeAt(0) * 7 % 360}, 65%, 55%)`,
                    }}
                  >
                    {cls.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary text-sm group-hover:text-purple-700 transition">
                        {cls.name}
                      </span>
                      {cls.is_archived && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Archived</span>
                      )}
                    </div>
                    <span className="text-xs text-text-secondary">
                      Code: {cls.code}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span>{cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}</span>
                  <span>{cls.unitCount} unit{cls.unitCount !== 1 ? "s" : ""}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 group-hover:text-purple-400 transition">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
