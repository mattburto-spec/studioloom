"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getYearLevelNumber } from "@/lib/utils/year-level";

// ---------------------------------------------------------------------------
// StudentRosterDrawer — slide-out roster management surface
// ---------------------------------------------------------------------------
// Lifted from the inline StudentsTab function on
// /teacher/units/[unitId]/class/[classId] (DT canvas Phase 3.1 Step 4,
// 16 May 2026). Same Add Existing / Create New + edit + remove flow,
// now rendered as a right-side drawer triggered by the canvas student-
// grid's "+ Add student" button. The class code reveal (was at the
// bottom of the old Settings tab) gets folded in here too — it's the
// natural companion to "share this class with new students".
// ---------------------------------------------------------------------------

export interface RosterStudent {
  id: string;
  display_name: string;
  username: string;
  graduation_year?: string | null;
}

interface StudentRosterDrawerProps {
  classId: string;
  classCode?: string;
  className?: string;
  students: RosterStudent[];
  setStudents: React.Dispatch<React.SetStateAction<RosterStudent[]>>;
  onClose: () => void;
}

export default function StudentRosterDrawer({
  classId,
  classCode,
  className,
  students,
  setStudents,
  onClose,
}: StudentRosterDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [addTab, setAddTab] = useState<"existing" | "new">("existing");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  // Existing-students enrollment state
  const [existingStudents, setExistingStudents] = useState<RosterStudent[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [enrollingIds, setEnrollingIds] = useState<Set<string>>(new Set());

  // Click-outside + Escape close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Load teacher's existing students when the Existing tab is active
  useEffect(() => {
    if (addTab !== "existing") return;
    let cancelled = false;
    (async () => {
      setLoadingExisting(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: allStudents } = await supabase
          .from("students")
          .select("id, display_name, username, graduation_year")
          .eq("author_teacher_id", user.id)
          .order("display_name", { ascending: true });
        if (cancelled || !allStudents) return;
        const enrolledIds = new Set(students.map((s) => s.id));
        const available = allStudents.filter((s) => !enrolledIds.has(s.id));
        setExistingStudents(available as RosterStudent[]);
      } catch (e) {
        console.error("[StudentRosterDrawer] Failed to load existing students:", e);
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [addTab, classId, students]);

  async function enrollExistingStudent(student: RosterStudent) {
    setEnrollingIds((prev) => new Set(prev).add(student.id));
    setError("");
    try {
      const supabase = createClient();
      const { error: enrollErr } = await supabase.from("class_students").insert({
        student_id: student.id,
        class_id: classId,
        is_active: true,
      });
      if (enrollErr) {
        if (enrollErr.code === "23505") {
          await supabase
            .from("class_students")
            .update({ is_active: true })
            .eq("student_id", student.id)
            .eq("class_id", classId);
        } else {
          throw enrollErr;
        }
      }
      setStudents((prev) =>
        [...prev, student].sort((a, b) =>
          (a.display_name || a.username).localeCompare(b.display_name || b.username),
        ),
      );
      setExistingStudents((prev) => prev.filter((s) => s.id !== student.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to enrol student");
    } finally {
      setEnrollingIds((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
    }
  }

  async function createNewStudent() {
    if (!newDisplayName.trim() && !newUsername.trim()) return;
    setSaving(true);
    setError("");
    try {
      // FU-AV2-UI-STUDENT-INSERT-REFACTOR (30 Apr 2026): atomic create +
      // auth.users provision + class_students enrollment via the server
      // route. Preserved on the lift to the drawer.
      const res = await fetch("/api/teacher/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username:
            newUsername.trim() ||
            newDisplayName.trim().toLowerCase().replace(/\s+/g, "_"),
          displayName: newDisplayName.trim(),
          classId,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Failed to create student");
      }
      const routeStudent = body.student as {
        id: string;
        display_name: string | null;
        username: string;
        graduation_year: number | null;
      };
      const newStudent: RosterStudent = {
        id: routeStudent.id,
        display_name: routeStudent.display_name ?? "",
        username: routeStudent.username,
        graduation_year:
          routeStudent.graduation_year != null
            ? String(routeStudent.graduation_year)
            : null,
      };
      setStudents((prev) =>
        [...prev, newStudent].sort((a, b) =>
          (a.display_name || a.username).localeCompare(b.display_name || b.username),
        ),
      );
      setNewDisplayName("");
      setNewUsername("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add student");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(studentId: string) {
    if (!editName.trim() && !editUsername.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase
        .from("students")
        .update({
          display_name: editName.trim(),
          username: editUsername.trim(),
        })
        .eq("id", studentId);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, display_name: editName.trim(), username: editUsername.trim() }
            : s,
        ),
      );
      setEditingId(null);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function removeStudent(studentId: string) {
    setRemoving(true);
    try {
      const res = await fetch("/api/teacher/class-students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, classId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("[StudentRosterDrawer] remove error:", data.error);
        return;
      }
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setRemoveConfirmId(null);
    } catch {
      // silent
    } finally {
      setRemoving(false);
    }
  }

  const filteredExisting = searchQuery.trim()
    ? existingStudents.filter(
        (s) =>
          (s.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.username || "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : existingStudents;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" />
      <div
        ref={panelRef}
        data-testid="student-roster-drawer"
        className="fixed top-0 right-0 h-full w-[460px] max-w-[92vw] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ animation: "rosterDrawerSlideIn 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">
              Manage roster
            </h2>
            <p className="text-xs text-gray-500 truncate">
              {students.length} student{students.length !== 1 ? "s" : ""} in
              {className ? ` ${className}` : " this class"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close roster drawer"
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Class code reveal */}
          {classCode && (
            <div className="px-5 py-4 border-b border-gray-100 bg-purple-50/40">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 mb-1">
                Class code
              </div>
              <p className="text-lg font-mono font-bold text-purple-700">{classCode}</p>
              <p className="text-[11px] text-purple-500 mt-1">
                Students use this code to join the class via the join screen.
              </p>
            </div>
          )}

          {/* Add panel */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex gap-1 mb-3 bg-purple-100 rounded-lg p-0.5">
              <button
                onClick={() => { setAddTab("existing"); setError(""); }}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  addTab === "existing"
                    ? "bg-white text-purple-700 shadow-sm"
                    : "text-purple-600 hover:text-purple-800"
                }`}
              >
                Add Existing
              </button>
              <button
                onClick={() => { setAddTab("new"); setError(""); }}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  addTab === "new"
                    ? "bg-white text-purple-700 shadow-sm"
                    : "text-purple-600 hover:text-purple-800"
                }`}
              >
                Create New
              </button>
            </div>

            {addTab === "existing" ? (
              <div>
                <input
                  id="roster-student-search"
                  name="roster-student-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your students..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                />
                {loadingExisting ? (
                  <p className="text-xs text-gray-500 py-4 text-center">
                    Loading students...
                  </p>
                ) : filteredExisting.length === 0 ? (
                  <div className="py-3 text-center">
                    <p className="text-xs text-gray-500">
                      {existingStudents.length === 0
                        ? "No other students yet. Switch to Create New to add one."
                        : "No students match your search."}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                    {filteredExisting.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {(s.display_name || s.username || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {s.display_name || s.username}
                          </p>
                          {s.display_name && s.username && s.display_name !== s.username && (
                            <p className="text-[10px] text-gray-400 font-mono">{s.username}</p>
                          )}
                        </div>
                        <button
                          onClick={() => enrollExistingStudent(s)}
                          disabled={enrollingIds.has(s.id)}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50 flex-shrink-0"
                        >
                          {enrollingIds.has(s.id) ? "Adding..." : "Add"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label htmlFor="roster-new-display-name" className="block text-xs font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    <input
                      id="roster-new-display-name"
                      name="roster-new-display-name"
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="e.g. Sarah Chen"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="roster-new-username" className="block text-xs font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      id="roster-new-username"
                      name="roster-new-username"
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="auto-generated if blank"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createNewStudent}
                    disabled={saving || (!newDisplayName.trim() && !newUsername.trim())}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
                  >
                    {saving ? "Creating..." : "Create & Add"}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>

          {/* Student list */}
          <div className="px-2 py-2">
            {students.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p className="text-sm">No students in this class yet.</p>
                <p className="text-xs mt-1">
                  Add students above or share the class code for students to join.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2.5 group hover:bg-gray-50 transition rounded-md"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(s.display_name || s.username || "?").charAt(0).toUpperCase()}
                    </div>
                    {editingId === s.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          id={`roster-edit-name-${s.id}`}
                          name={`roster-edit-name-${s.id}`}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 min-w-0 px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <input
                          id={`roster-edit-username-${s.id}`}
                          name={`roster-edit-username-${s.id}`}
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="w-28 px-2 py-1 rounded border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          onClick={() => saveEdit(s.id)}
                          disabled={saving}
                          className="px-2 py-1 rounded bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {s.display_name || s.username}
                          </p>
                          {s.display_name && s.username && s.display_name !== s.username && (
                            <p className="text-xs text-gray-400 font-mono">{s.username}</p>
                          )}
                        </div>
                        {s.graduation_year && (
                          <span className="text-xs text-gray-400 font-mono">
                            Y{getYearLevelNumber(
                              typeof s.graduation_year === "number"
                                ? s.graduation_year
                                : parseInt(s.graduation_year, 10) || null,
                            )}
                          </span>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => {
                              setEditingId(s.id);
                              setEditName(s.display_name);
                              setEditUsername(s.username);
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-200 transition"
                            title="Edit"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          {removeConfirmId === s.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => removeStudent(s.id)}
                                disabled={removing}
                                className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-medium hover:bg-red-700 transition disabled:opacity-50"
                              >
                                {removing ? "..." : "Remove"}
                              </button>
                              <button
                                onClick={() => setRemoveConfirmId(null)}
                                className="px-2 py-1 rounded border border-gray-300 text-[10px] text-gray-600 hover:bg-gray-50 transition"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRemoveConfirmId(s.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition"
                              title="Remove from class"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rosterDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </>
  );
}
