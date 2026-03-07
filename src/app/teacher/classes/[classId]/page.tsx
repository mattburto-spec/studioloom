"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ELL_LEVELS } from "@/lib/constants";
import type { Class, Student, Unit, ClassUnit } from "@/types";
import type { EllLevel } from "@/lib/constants";

export default function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [classUnits, setClassUnits] = useState<ClassUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, [classId]);

  async function loadData() {
    const supabase = createClient();

    const [classRes, studentsRes, unitsRes, classUnitsRes] = await Promise.all([
      supabase.from("classes").select("*").eq("id", classId).single(),
      supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .order("username"),
      supabase.from("units").select("*").order("title"),
      supabase.from("class_units").select("*").eq("class_id", classId),
    ]);

    setClassInfo(classRes.data);
    setStudents(studentsRes.data || []);
    setAllUnits(unitsRes.data || []);
    setClassUnits(classUnitsRes.data || []);
    setLoading(false);
  }

  async function addStudent() {
    if (!newUsername.trim()) return;
    setAdding(true);

    const supabase = createClient();
    const { error } = await supabase.from("students").insert({
      username: newUsername.trim().toLowerCase(),
      display_name: newDisplayName.trim() || null,
      class_id: classId,
    });

    if (!error) {
      setNewUsername("");
      setNewDisplayName("");
      setShowAddStudent(false);
      loadData();
    }

    setAdding(false);
  }

  async function updateEllLevel(studentId: string, level: EllLevel) {
    const supabase = createClient();
    await supabase
      .from("students")
      .update({ ell_level: level })
      .eq("id", studentId);

    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, ell_level: level } : s))
    );
  }

  async function toggleUnit(unitId: string, isActive: boolean) {
    const supabase = createClient();
    const existing = classUnits.find((cu) => cu.unit_id === unitId);

    if (existing) {
      await supabase
        .from("class_units")
        .update({ is_active: isActive })
        .eq("class_id", classId)
        .eq("unit_id", unitId);
    } else {
      await supabase.from("class_units").insert({
        class_id: classId,
        unit_id: unitId,
        is_active: isActive,
      });
    }

    loadData();
  }

  async function removeStudent(studentId: string) {
    const supabase = createClient();
    await supabase.from("students").delete().eq("id", studentId);
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
  }

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse h-8 w-48 bg-gray-200 rounded mb-8" />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-2">
        <Link
          href="/teacher/dashboard"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          &larr; All Classes
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {classInfo?.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-text-secondary text-sm">Class Code:</span>
            <span className="font-mono font-medium text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded text-sm">
              {classInfo?.code}
            </span>
          </div>
        </div>
      </div>

      {/* Students Section */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Students ({students.length})
          </h2>
          <button
            onClick={() => setShowAddStudent(true)}
            className="px-3 py-1.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition"
          >
            + Add Student
          </button>
        </div>

        {showAddStudent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
              <h3 className="text-lg font-semibold mb-4">Add Student</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Username (required)
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. jsmith"
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Display Name (optional)
                  </label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addStudent();
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowAddStudent(false)}
                  className="flex-1 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-alt transition"
                >
                  Cancel
                </button>
                <button
                  onClick={addStudent}
                  disabled={!newUsername.trim() || adding}
                  className="flex-1 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition disabled:opacity-40"
                >
                  {adding ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        )}

        {students.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-text-secondary">
              No students yet. Add students so they can log in with the class code.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase">
                    Username
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase">
                    Display Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase">
                    ELL Level
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-sm">
                      {student.username}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {student.display_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {([1, 2, 3] as EllLevel[]).map((level) => (
                          <button
                            key={level}
                            onClick={() => updateEllLevel(student.id, level)}
                            className={`w-8 h-8 rounded-full text-xs font-medium transition ${
                              student.ell_level === level
                                ? "bg-accent-blue text-white"
                                : "bg-surface-alt text-text-secondary hover:bg-gray-200"
                            }`}
                            title={ELL_LEVELS[level].label}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeStudent(student.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Units Section */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Assigned Units
        </h2>
        {allUnits.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-text-secondary">
              No units available. Upload units in the Units tab.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {allUnits.map((unit) => {
              const cu = classUnits.find((c) => c.unit_id === unit.id);
              const isActive = cu?.is_active ?? false;

              return (
                <div
                  key={unit.id}
                  className="bg-white rounded-xl px-5 py-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-text-primary">{unit.title}</p>
                    {unit.description && (
                      <p className="text-sm text-text-secondary mt-0.5">
                        {unit.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <Link
                        href={`/teacher/classes/${classId}/progress/${unit.id}`}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition"
                      >
                        View Progress
                      </Link>
                    )}
                    <button
                      onClick={() => toggleUnit(unit.id, !isActive)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? "bg-accent-green/10 text-accent-green hover:bg-accent-green/20"
                          : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                      }`}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
