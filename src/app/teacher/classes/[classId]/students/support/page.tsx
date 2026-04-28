"use client";

/* ================================================================
 * /teacher/classes/[classId]/students/support
 *
 * Phase 2.5 of language-scaffolding-redesign.
 *
 * Teacher control panel for student support settings (per-class
 * overrides). Two controls today:
 *   - L1 target override (tap-a-word translation language)
 *   - tap-a-word enabled toggle
 *
 * Inline edit per row + bulk multi-select. Apply-bulk requires a
 * confirmation modal.
 *
 * Authority model (Q1 locked 27 Apr): student is source of truth
 * (intake), teacher overrides per-context (per-class only on this page).
 * Per-student global edits land in Phase 4 unified settings page.
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import {
  SUPPORTED_L1_TARGETS,
  l1DisplayLabel,
  type L1Target,
} from "@/lib/tap-a-word/language-mapping";

interface StudentRow {
  studentId: string;
  name: string;
  ellLevel: number;
  ellLevelOverride: number | null;
  intakeFirstLanguage: string | null;
  intakeL1Code: L1Target | null;
  studentSupportSettings: {
    l1_target_override?: L1Target | null;
    tap_a_word_enabled?: boolean | null;
  };
  classSupportSettings: {
    l1_target_override?: L1Target | null;
    tap_a_word_enabled?: boolean | null;
  };
  resolved: {
    l1Target: L1Target;
    tapAWordEnabled: boolean;
    l1Source: "intake" | "student-override" | "class-override" | "default";
    tapASource: "default" | "student-override" | "class-override";
  };
}

type BulkPendingAction =
  | { kind: "l1"; value: L1Target | null }
  | { kind: "tap"; value: boolean | null }
  | null;

const ROW_BUSY = "opacity-50 pointer-events-none";

export default function SupportSettingsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState<BulkPendingAction>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/teacher/classes/${classId}/students/support-settings`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const body = (await res.json()) as { students: StudentRow[] };
      setStudents(body.students || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = useMemo(
    () => students.length > 0 && students.every((s) => selected.has(s.studentId)),
    [students, selected]
  );

  // ─── Single-row update ────────────────────────────────────────────
  const updateOne = useCallback(
    async (
      studentId: string,
      patch: { l1_target_override?: L1Target | null; tap_a_word_enabled?: boolean | null }
    ) => {
      setBusyIds((s) => new Set(s).add(studentId));
      try {
        const res = await fetch(
          `/api/teacher/classes/${classId}/students/${studentId}/support-settings`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(patch),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Update failed (${res.status})`);
        }
        await load(); // refresh resolved values
      } catch (e) {
        alert(e instanceof Error ? e.message : "Update failed");
      } finally {
        setBusyIds((s) => {
          const next = new Set(s);
          next.delete(studentId);
          return next;
        });
      }
    },
    [classId, load]
  );

  // ─── Bulk update (requires confirmation) ─────────────────────────
  const submitBulk = useCallback(async () => {
    if (!pendingBulk || selected.size === 0) return;
    setBulkSubmitting(true);
    try {
      const settings =
        pendingBulk.kind === "l1"
          ? { l1_target_override: pendingBulk.value }
          : { tap_a_word_enabled: pendingBulk.value };
      const res = await fetch(
        `/api/teacher/classes/${classId}/students/support-settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            studentIds: Array.from(selected),
            settings,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Bulk update failed (${res.status})`);
      }
      const body = (await res.json()) as { updated: number; failed: number };
      if (body.failed > 0) {
        alert(`Updated ${body.updated} students, ${body.failed} failed.`);
      }
      setPendingBulk(null);
      setSelected(new Set());
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBulkSubmitting(false);
    }
  }, [classId, load, pendingBulk, selected]);

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-6 text-gray-500">Loading students…</div>;
  }
  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600 mb-2">Error: {error}</div>
        <button onClick={() => void load()} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-4">
        <Link
          href={`/teacher/classes/${classId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to class
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Student support settings</h1>
      <p className="text-sm text-gray-600 mb-2">
        Per-class overrides for tap-a-word features. Edits here only apply within this class —
        students keep their global settings elsewhere. {students.length} student
        {students.length === 1 ? "" : "s"} enrolled.
      </p>
      <p className="text-xs text-gray-500 mb-6">
        Click a student name to manage <span className="font-semibold">all their settings</span>{" "}
        in one place — global + per-class + intake-derived defaults.
      </p>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
          <span className="font-medium text-blue-900">{selected.size} selected</span>
          <span className="text-blue-700">·</span>
          <span className="text-blue-700">Set L1:</span>
          {SUPPORTED_L1_TARGETS.map((t) => (
            <button
              key={t}
              onClick={() => setPendingBulk({ kind: "l1", value: t })}
              className="px-2 py-0.5 rounded bg-white border border-blue-200 hover:bg-blue-100 text-xs text-blue-900"
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setPendingBulk({ kind: "l1", value: null })}
            className="px-2 py-0.5 rounded bg-white border border-blue-200 hover:bg-blue-100 text-xs text-gray-700"
            title="Reset L1 override (use intake-derived)"
          >
            reset
          </button>
          <span className="text-blue-700 ml-2">·</span>
          <span className="text-blue-700">Tap-a-word:</span>
          <button
            onClick={() => setPendingBulk({ kind: "tap", value: true })}
            className="px-2 py-0.5 rounded bg-white border border-blue-200 hover:bg-blue-100 text-xs text-green-700"
          >
            on
          </button>
          <button
            onClick={() => setPendingBulk({ kind: "tap", value: false })}
            className="px-2 py-0.5 rounded bg-white border border-blue-200 hover:bg-blue-100 text-xs text-red-700"
          >
            off
          </button>
          <button
            onClick={() => setPendingBulk({ kind: "tap", value: null })}
            className="px-2 py-0.5 rounded bg-white border border-blue-200 hover:bg-blue-100 text-xs text-gray-700"
            title="Reset toggle (use parent default)"
          >
            reset
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto px-2 py-0.5 rounded text-xs text-blue-700 hover:bg-blue-100"
          >
            clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(students.map((s) => s.studentId)));
                    } else {
                      setSelected(new Set());
                    }
                  }}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Student</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">ELL</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">L1 (resolved)</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Tap-a-word</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Reset</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <StudentRowView
                key={s.studentId}
                row={s}
                checked={selected.has(s.studentId)}
                onToggle={(checked) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(s.studentId);
                    else next.delete(s.studentId);
                    return next;
                  })
                }
                busy={busyIds.has(s.studentId)}
                onUpdate={(patch) => void updateOne(s.studentId, patch)}
              />
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No students enrolled in this class.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation modal for bulk */}
      {pendingBulk && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-2">Confirm bulk update</h2>
            <p className="text-sm text-gray-700 mb-4">
              You are about to apply{" "}
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                {pendingBulk.kind === "l1"
                  ? pendingBulk.value === null
                    ? "L1 reset (use intake)"
                    : `L1 → ${l1DisplayLabel(pendingBulk.value)}`
                  : pendingBulk.value === null
                    ? "Tap-a-word reset (use parent default)"
                    : `Tap-a-word → ${pendingBulk.value ? "on" : "off"}`}
              </span>{" "}
              to <span className="font-semibold">{selected.size} student{selected.size === 1 ? "" : "s"}</span>.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              This only changes the per-class override for this class. Students keep their
              global settings elsewhere.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingBulk(null)}
                disabled={bulkSubmitting}
                className="px-3 py-1.5 rounded text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitBulk()}
                disabled={bulkSubmitting}
                className="px-3 py-1.5 rounded text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {bulkSubmitting ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Per-row view ─────────────────────────────────────────────────────

function StudentRowView({
  row,
  checked,
  onToggle,
  busy,
  onUpdate,
}: {
  row: StudentRow;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  busy: boolean;
  onUpdate: (patch: {
    l1_target_override?: L1Target | null;
    tap_a_word_enabled?: boolean | null;
  }) => void;
}) {
  const overrideBadge =
    row.resolved.l1Source === "class-override" || row.resolved.l1Source === "student-override"
      ? row.resolved.l1Source === "class-override"
        ? "🟦 class"
        : "🟪 student"
      : null;

  return (
    <tr className={`border-t border-gray-100 ${busy ? ROW_BUSY : ""}`}>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Select ${row.name}`}
        />
      </td>
      <td className="px-3 py-2 font-medium text-gray-900">
        <Link
          href={`/teacher/students/${row.studentId}?tab=support`}
          className="text-gray-900 hover:text-purple-700 hover:underline"
          title="Open unified support settings for this student"
        >
          {row.name}
        </Link>
      </td>
      <td className="px-3 py-2 text-gray-700">
        {row.ellLevel}
        {row.ellLevelOverride !== null && (
          <span className="ml-1 text-xs text-gray-400" title="ELL override on this class">
            (override)
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <select
          value={row.classSupportSettings.l1_target_override ?? "__inherit__"}
          onChange={(e) => {
            const val = e.target.value;
            onUpdate({
              l1_target_override: val === "__inherit__" ? null : (val as L1Target),
            });
          }}
          disabled={busy}
          className="rounded border border-gray-200 px-2 py-1 text-sm bg-white"
        >
          <option value="__inherit__">
            inherit ({row.intakeFirstLanguage || "—"} → {row.resolved.l1Target})
          </option>
          {SUPPORTED_L1_TARGETS.map((t) => (
            <option key={t} value={t}>
              {t} ({l1DisplayLabel(t)})
            </option>
          ))}
        </select>
        <span className="ml-2 text-xs text-gray-500">
          → <span className="font-mono">{row.resolved.l1Target}</span>
          {overrideBadge && <span className="ml-1">{overrideBadge}</span>}
        </span>
      </td>
      <td className="px-3 py-2">
        <select
          value={
            row.classSupportSettings.tap_a_word_enabled === null ||
            row.classSupportSettings.tap_a_word_enabled === undefined
              ? "__inherit__"
              : String(row.classSupportSettings.tap_a_word_enabled)
          }
          onChange={(e) => {
            const val = e.target.value;
            onUpdate({
              tap_a_word_enabled:
                val === "__inherit__" ? null : val === "true",
            });
          }}
          disabled={busy}
          className="rounded border border-gray-200 px-2 py-1 text-sm bg-white"
        >
          <option value="__inherit__">inherit</option>
          <option value="true">on</option>
          <option value="false">off</option>
        </select>
        <span className="ml-2 text-xs text-gray-500">
          → {row.resolved.tapAWordEnabled ? "on" : "off"}
          {row.resolved.tapASource !== "default" && (
            <span className="ml-1">
              ({row.resolved.tapASource === "class-override" ? "🟦 class" : "🟪 student"})
            </span>
          )}
        </span>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={() =>
            onUpdate({ l1_target_override: null, tap_a_word_enabled: null })
          }
          disabled={busy}
          className="text-xs text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50"
          title="Clear all per-class overrides for this student"
        >
          reset all
        </button>
      </td>
    </tr>
  );
}
