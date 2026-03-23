"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ELL_LEVELS } from "@/lib/constants";
import type { Class, Student, Unit, ClassUnit } from "@/types";
import type { EllLevel } from "@/lib/constants";

interface LMSClassOption {
  id: string;
  name: string;
}

interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
  total: number;
}

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
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{ added: number; skipped: string[] } | null>(null);

  // LMS sync state
  const [hasIntegration, setHasIntegration] = useState(false);
  const [lmsClasses, setLmsClasses] = useState<LMSClassOption[]>([]);
  const [selectedLmsClass, setSelectedLmsClass] = useState("");
  const [loadingLmsClasses, setLoadingLmsClasses] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    loadData();
    checkIntegration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function addStudentsBulk() {
    if (!bulkText.trim()) return;
    setAdding(true);
    setBulkResult(null);

    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const existingUsernames = new Set(students.map((s) => s.username.toLowerCase()));
    const skipped: string[] = [];
    const toInsert: { username: string; display_name: string | null; class_id: string }[] = [];

    for (const line of lines) {
      // Support formats:
      // "username, Display Name"
      // "username\tDisplay Name"
      // "Display Name" (auto-generate username)
      // "username"
      let username: string;
      let displayName: string | null = null;

      // Check for comma or tab separator
      const separatorMatch = line.match(/^([^,\t]+)[,\t]\s*(.+)$/);
      if (separatorMatch) {
        username = separatorMatch[1].trim().toLowerCase().replace(/\s+/g, "");
        displayName = separatorMatch[2].trim();
      } else if (line.includes(" ")) {
        // "John Smith" → username "jsmith", display name "John Smith"
        displayName = line;
        const parts = line.toLowerCase().split(/\s+/);
        username = parts.length >= 2
          ? parts[0][0] + parts[parts.length - 1]
          : parts[0];
        username = username.replace(/[^a-z0-9]/g, "");
      } else {
        username = line.toLowerCase().replace(/[^a-z0-9._-]/g, "");
      }

      if (!username) {
        skipped.push(line);
        continue;
      }

      // Check for duplicates (existing + within this batch)
      if (existingUsernames.has(username) || toInsert.some((s) => s.username === username)) {
        skipped.push(`${line} (duplicate: ${username})`);
        continue;
      }

      toInsert.push({
        username,
        display_name: displayName || null,
        class_id: classId,
      });
    }

    if (toInsert.length > 0) {
      const supabase = createClient();
      const { error } = await supabase.from("students").insert(toInsert);
      if (error) {
        setBulkResult({ added: 0, skipped: [`Database error: ${error.message}`] });
        setAdding(false);
        return;
      }
    }

    setBulkResult({ added: toInsert.length, skipped });

    if (toInsert.length > 0) {
      loadData();
    }

    if (skipped.length === 0 && toInsert.length > 0) {
      setBulkText("");
      // Auto-close after a short delay on full success
      setTimeout(() => {
        setShowAddStudent(false);
        setBulkResult(null);
        setAddMode("single");
      }, 1500);
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

    // Optimistic update for instant feedback
    setClassUnits((prev) => {
      const idx = prev.findIndex((cu) => cu.unit_id === unitId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], is_active: isActive };
        return updated;
      }
      // Add a new entry optimistically
      return [...prev, { class_id: classId, unit_id: unitId, is_active: isActive } as ClassUnit];
    });

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("class_units")
        .update({ is_active: isActive })
        .eq("class_id", classId)
        .eq("unit_id", unitId));
    } else {
      ({ error } = await supabase.from("class_units").insert({
        class_id: classId,
        unit_id: unitId,
        is_active: isActive,
      }));
    }

    if (error) {
      console.error("toggleUnit error:", error);
      // Revert optimistic update on failure
      loadData();
    }
  }

  async function removeStudent(studentId: string) {
    const supabase = createClient();
    await supabase.from("students").delete().eq("id", studentId);
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
  }

  async function checkIntegration() {
    try {
      const res = await fetch("/api/teacher/integrations");
      const data = await res.json();
      setHasIntegration(!!data.integration?.has_api_token);
    } catch {
      // Integration not configured — that's fine
    }
  }

  async function loadLmsClasses() {
    setLoadingLmsClasses(true);
    setSyncError("");
    try {
      const res = await fetch("/api/teacher/integrations/classes");
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || "Failed to load LMS classes");
        return;
      }
      setLmsClasses(data.classes || []);
    } catch {
      setSyncError("Network error loading LMS classes");
    } finally {
      setLoadingLmsClasses(false);
    }
  }

  async function syncStudents(overrideClassId?: string) {
    const lmsClassId = overrideClassId || selectedLmsClass;
    if (!lmsClassId) return;
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);

    try {
      const res = await fetch("/api/teacher/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          externalClassId: lmsClassId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSyncError(data.error || "Sync failed");
        return;
      }

      setSyncResult(data.summary);
      loadData(); // Refresh student list
    } catch {
      setSyncError("Network error during sync");
    } finally {
      setSyncing(false);
    }
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

      {/* LMS Sync Section */}
      {hasIntegration && (
        <section className="mb-6 bg-white rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent-blue">
                <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
              </svg>
              <h3 className="text-sm font-semibold text-text-primary">LMS Sync</h3>
            </div>
            {classInfo?.last_synced_at && (
              <span className="text-xs text-text-secondary">
                Last synced: {new Date(classInfo.last_synced_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {lmsClasses.length === 0 ? (
              <button
                onClick={loadLmsClasses}
                disabled={loadingLmsClasses}
                className="px-3 py-1.5 text-sm bg-accent-blue/10 text-accent-blue rounded-lg hover:bg-accent-blue/20 transition disabled:opacity-50"
              >
                {loadingLmsClasses ? "Loading..." : classInfo?.external_class_id ? "Change LMS Class" : "Link LMS Class"}
              </button>
            ) : (
              <>
                <select
                  value={selectedLmsClass}
                  onChange={(e) => setSelectedLmsClass(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue"
                >
                  <option value="">Select LMS class...</option>
                  {lmsClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => syncStudents()}
                  disabled={!selectedLmsClass || syncing}
                  className="px-3 py-1.5 text-sm bg-accent-green text-white rounded-lg hover:bg-accent-green/90 transition disabled:opacity-50"
                >
                  {syncing ? "Syncing..." : "Sync Students"}
                </button>
              </>
            )}

            {classInfo?.external_class_id && lmsClasses.length === 0 && (
              <button
                onClick={() => syncStudents(classInfo.external_class_id!)}
                disabled={syncing}
                className="px-3 py-1.5 text-sm bg-accent-green text-white rounded-lg hover:bg-accent-green/90 transition disabled:opacity-50"
                title="Re-sync with previously linked class"
              >
                {syncing ? "Syncing..." : "Re-sync"}
              </button>
            )}
          </div>

          {syncError && (
            <p className="text-xs text-red-500 mt-2">{syncError}</p>
          )}

          {syncResult && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="text-accent-green font-medium">{syncResult.created} created</span>
              <span className="text-accent-blue font-medium">{syncResult.updated} updated</span>
              <span className="text-text-secondary">{syncResult.unchanged} unchanged</span>
              <span className="text-text-secondary">({syncResult.total} total)</span>
            </div>
          )}
        </section>
      )}

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
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Add Students</h3>

              {/* Mode tabs */}
              <div className="flex gap-1 bg-surface-alt rounded-lg p-1 mb-4">
                <button
                  onClick={() => { setAddMode("single"); setBulkResult(null); }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                    addMode === "single"
                      ? "bg-white text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => { setAddMode("bulk"); setBulkResult(null); }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                    addMode === "bulk"
                      ? "bg-white text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Bulk Add
                </button>
              </div>

              {addMode === "single" ? (
                <>
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
                      onClick={() => { setShowAddStudent(false); setBulkResult(null); setAddMode("single"); }}
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
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Paste student list (one per line)
                    </label>
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={`John Smith\nJane Doe\njsmith, John Smith\njdoe, Jane Doe`}
                      rows={8}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent text-sm font-mono resize-none"
                      autoFocus
                    />
                    <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                      Accepted formats per line:<br />
                      <span className="font-mono text-text-primary">Full Name</span> — auto-generates username<br />
                      <span className="font-mono text-text-primary">username, Display Name</span> — comma-separated<br />
                      <span className="font-mono text-text-primary">username</span> — no display name
                    </p>
                  </div>

                  {bulkResult && (
                    <div className="mt-3 p-3 rounded-lg bg-surface-alt text-sm">
                      {bulkResult.added > 0 && (
                        <p className="text-accent-green font-medium">
                          {bulkResult.added} student{bulkResult.added !== 1 ? "s" : ""} added
                        </p>
                      )}
                      {bulkResult.skipped.length > 0 && (
                        <div className="mt-1">
                          <p className="text-amber-600 font-medium">
                            {bulkResult.skipped.length} skipped:
                          </p>
                          <ul className="text-xs text-text-secondary mt-0.5 space-y-0.5">
                            {bulkResult.skipped.map((s, i) => (
                              <li key={i} className="font-mono">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { setShowAddStudent(false); setBulkText(""); setBulkResult(null); setAddMode("single"); }}
                      className="flex-1 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-alt transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addStudentsBulk}
                      disabled={!bulkText.trim() || adding}
                      className="flex-1 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition disabled:opacity-40"
                    >
                      {adding ? "Adding..." : `Add ${bulkText.trim() ? bulkText.trim().split("\n").filter((l) => l.trim()).length : 0} Students`}
                    </button>
                  </div>
                </>
              )}
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

      {/* Units Section — Current + History */}
      <UnitsSection
        allUnits={allUnits}
        classUnits={classUnits}
        classId={classId}
        onToggle={toggleUnit}
      />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Units Section — Current Units + Unit History
// ---------------------------------------------------------------------------

function UnitsSection({
  allUnits,
  classUnits,
  classId,
  onToggle,
}: {
  allUnits: Unit[];
  classUnits: ClassUnit[];
  classId: string;
  onToggle: (unitId: string, isActive: boolean) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);

  // Split into current (active class_units) and inactive/unassigned
  const currentUnits: Array<{ unit: Unit; cu: ClassUnit }> = [];
  const historyUnits: Array<{ unit: Unit; cu?: ClassUnit }> = [];

  for (const unit of allUnits) {
    const cu = classUnits.find((c) => c.unit_id === unit.id);
    if (cu?.is_active) {
      currentUnits.push({ unit, cu });
    } else if (cu) {
      // Was assigned but now inactive — history
      historyUnits.push({ unit, cu });
    }
    // Units never assigned to this class are not shown
  }

  // Unassigned units (never had a class_units record) — for the "Add Unit" picker
  const unassignedUnits = allUnits.filter(
    (u) => !classUnits.some((cu) => cu.unit_id === u.id)
  );

  return (
    <section className="space-y-6">
      {/* ── Current Units ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Current Units
            {currentUnits.length > 0 && (
              <span className="text-sm font-normal text-text-tertiary ml-1">({currentUnits.length})</span>
            )}
          </h2>
        </div>

        {currentUnits.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14m-7-7h14" />
              </svg>
            </div>
            <p className="text-sm text-text-secondary mb-1">No active units for this class.</p>
            <p className="text-xs text-text-tertiary">Activate a unit below or assign one from the Units page.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentUnits.map(({ unit, cu }) => (
              <div
                key={unit.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-primary leading-snug">{unit.title}</h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </div>
                      {unit.description && (
                        <p className="text-sm text-text-secondary mt-1 line-clamp-2">{unit.description}</p>
                      )}
                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-tertiary">
                        {(unit as Record<string, unknown>).grade_level && (
                          <span>{(unit as Record<string, unknown>).grade_level as string}</span>
                        )}
                        {(unit as Record<string, unknown>).estimated_duration && (
                          <span>{(unit as Record<string, unknown>).estimated_duration as string}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Link
                      href={`/teacher/teach/${unit.id}?classId=${classId}`}
                      className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl text-white shadow-sm transition hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                      Teach
                    </Link>
                    <Link
                      href={`/teacher/units/${unit.id}/class/${classId}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-text-secondary transition hover:bg-gray-50"
                    >
                      Manage
                    </Link>
                    <Link
                      href={`/teacher/classes/${classId}/progress/${unit.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-text-secondary transition hover:bg-gray-50"
                    >
                      Progress
                    </Link>
                    <Link
                      href={`/teacher/classes/${classId}/grading/${unit.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-text-secondary transition hover:bg-gray-50"
                    >
                      Grade
                    </Link>
                    <Link
                      href={`/teacher/units/${unit.id}/class/${classId}/edit`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-text-secondary transition hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <div className="ml-auto">
                      <button
                        onClick={() => onToggle(unit.id, false)}
                        className="text-xs text-text-tertiary hover:text-red-500 transition px-2 py-1"
                      >
                        Deactivate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Unit ── */}
      {unassignedUnits.length > 0 && (
        <AddUnitPicker units={unassignedUnits} onActivate={(unitId) => onToggle(unitId, true)} />
      )}

      {/* ── Unit History ── */}
      {historyUnits.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition mb-3"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${showHistory ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            Unit History
            <span className="text-xs font-normal text-text-tertiary">({historyUnits.length} past unit{historyUnits.length !== 1 ? "s" : ""})</span>
          </button>

          {showHistory && (
            <div className="space-y-2 pl-1">
              {historyUnits.map(({ unit }) => (
                <div
                  key={unit.id}
                  className="bg-gray-50 rounded-xl px-5 py-3 flex items-center justify-between border border-gray-100"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-secondary">{unit.title}</p>
                    {unit.description && (
                      <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{unit.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/teacher/classes/${classId}/progress/${unit.id}`}
                      className="text-xs text-text-tertiary hover:text-text-secondary transition px-2 py-1"
                    >
                      View Progress
                    </Link>
                    <Link
                      href={`/teacher/classes/${classId}/grading/${unit.id}`}
                      className="text-xs text-text-tertiary hover:text-text-secondary transition px-2 py-1"
                    >
                      Grades
                    </Link>
                    <button
                      onClick={() => onToggle(unit.id, true)}
                      className="text-xs font-medium text-purple-600 hover:text-purple-700 transition px-2 py-1"
                    >
                      Reactivate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Add Unit Picker — collapsible dropdown to assign new units
// ---------------------------------------------------------------------------

function AddUnitPicker({
  units,
  onActivate,
}: {
  units: Unit[];
  onActivate: (unitId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-700 transition px-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14m-7-7h14" />
        </svg>
        Add a unit to this class
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {units.map((unit) => (
            <div
              key={unit.id}
              className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between hover:border-purple-200 transition"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{unit.title}</p>
                {unit.description && (
                  <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{unit.description}</p>
                )}
              </div>
              <button
                onClick={() => {
                  onActivate(unit.id);
                  setOpen(false);
                }}
                className="text-sm font-semibold text-purple-600 hover:text-purple-700 transition px-3 py-1.5 rounded-lg hover:bg-purple-50 shrink-0"
              >
                + Assign
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
