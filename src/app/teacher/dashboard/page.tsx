"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateClassCode } from "@/lib/utils";
import type { Class } from "@/types";
import { useTeacher } from "../teacher-context";

export default function TeacherDashboard() {
  const { teacher } = useTeacher();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    const supabase = createClient();
    const { data } = await supabase
      .from("classes")
      .select("*")
      .order("created_at", { ascending: false });

    setClasses(data || []);
    setLoading(false);
  }

  async function createClass() {
    if (!newClassName.trim() || !teacher) return;
    setCreating(true);

    const supabase = createClient();
    const code = generateClassCode();

    const { error } = await supabase.from("classes").insert({
      teacher_id: teacher.id,
      name: newClassName.trim(),
      code,
    });

    if (!error) {
      setNewClassName("");
      setShowCreate(false);
      await loadClasses();
    }

    setCreating(false);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">My Classes</h1>
          <p className="text-text-secondary mt-1">
            Manage your classes and students
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition"
        >
          + New Class
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold mb-4">Create New Class</h2>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g. Grade 8 Design"
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") createClass();
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-alt transition"
              >
                Cancel
              </button>
              <button
                onClick={createClass}
                disabled={!newClassName.trim() || creating}
                className="flex-1 py-2 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition disabled:opacity-40"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-36" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-text-secondary text-lg">No classes yet.</p>
          <p className="text-text-secondary/70 text-sm mt-2">
            Create your first class to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/teacher/classes/${cls.id}`}
              className="bg-white rounded-xl p-6 hover:shadow-md transition group"
            >
              <h2 className="font-semibold text-lg text-text-primary group-hover:text-dark-blue transition">
                {cls.name}
              </h2>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-text-secondary">Class Code:</span>
                <span className="font-mono text-sm font-medium text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">
                  {cls.code}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
