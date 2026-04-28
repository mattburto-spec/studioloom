"use client";

/* ================================================================
 * StudentSupportSettings — per-student unified settings panel
 *
 * Option A (28 Apr 2026 design pivot): single source of truth for one
 * student's L1 + tap-a-word settings across global + every class. Lives
 * inside the teacher's per-student profile page (`/teacher/students/[id]`)
 * as a new tab.
 *
 * UX intent (Matt's brief): primary surface is per-student global
 * settings. Per-class customizations exist (Phase 2.5) but are collapsed
 * by default — most teachers don't need them. Resolution chain is
 * explained inline so the teacher never has to ask "where did this value
 * come from?".
 *
 * Reads + writes to /api/teacher/students/[studentId]/support-settings
 * (GET shape includes per-class overrides too). Per-class edits still
 * route through /api/teacher/classes/[classId]/students/[studentId]/...
 * (no duplication of the merge logic).
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SUPPORTED_L1_TARGETS,
  l1DisplayLabel,
  type L1Target,
} from "@/lib/tap-a-word/language-mapping";
import { ELL_LEVELS, type EllLevel } from "@/lib/constants";

interface ResolvedSettings {
  l1Target: L1Target;
  tapAWordEnabled: boolean;
  l1Source: "intake" | "student-override" | "class-override" | "default";
  tapASource: "default" | "student-override" | "class-override";
}

interface ApiResponse {
  student: {
    id: string;
    displayName: string | null;
    username: string;
    ellLevel: number;
    intake: {
      firstLanguageRaw: string | null;
      intakeL1Code: L1Target | null;
    };
    globalSupportSettings: {
      l1_target_override?: L1Target | null;
      tap_a_word_enabled?: boolean | null;
    };
    resolvedGlobal: ResolvedSettings;
  };
  classes: Array<{
    classId: string;
    className: string;
    classCode: string;
    framework: string | null;
    classOverrides: {
      l1_target_override?: L1Target | null;
      tap_a_word_enabled?: boolean | null;
    };
    ellLevelOverride: number | null;
    resolved: ResolvedSettings;
    resolvedEll: number | null;
    ellSource: "class-override" | "student-global" | "default";
  }>;
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  intake: { label: "from intake", color: "bg-amber-100 text-amber-800" },
  "student-override": { label: "🟪 student", color: "bg-purple-100 text-purple-800" },
  "class-override": { label: "🟦 class", color: "bg-blue-100 text-blue-800" },
  default: { label: "default", color: "bg-gray-100 text-gray-700" },
};

function SourceBadge({ source }: { source: string }) {
  const b = SOURCE_BADGES[source] ?? SOURCE_BADGES.default;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${b.color}`}>
      {b.label}
    </span>
  );
}

export function StudentSupportSettings({ studentId }: { studentId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showClassSection, setShowClassSection] = useState(false);
  const [classBusy, setClassBusy] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/teacher/students/${studentId}/support-settings`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const body = (await res.json()) as ApiResponse;
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ─── Per-student global update ───────────────────────────────────
  const updateGlobal = useCallback(
    async (patch: {
      l1_target_override?: L1Target | null;
      tap_a_word_enabled?: boolean | null;
      ell_level?: EllLevel;
    }) => {
      setSaving(true);
      try {
        const res = await fetch(
          `/api/teacher/students/${studentId}/support-settings`,
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
        const body = (await res.json()) as ApiResponse;
        setData(body);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Update failed");
      } finally {
        setSaving(false);
      }
    },
    [studentId]
  );

  // ─── Per-class update (delegates to existing per-class endpoint) ─
  const updateClass = useCallback(
    async (
      classId: string,
      patch: {
        l1_target_override?: L1Target | null;
        tap_a_word_enabled?: boolean | null;
        ell_level_override?: number | null;
      }
    ) => {
      setClassBusy((s) => new Set(s).add(classId));
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
          throw new Error(body?.error || `Class update failed (${res.status})`);
        }
        // Per-class endpoint returns the merged class row + resolved, but our
        // panel needs the WHOLE shape (other classes' resolutions might also
        // change if class-level changes propagate — they don't right now, but
        // future-proof). Re-fetch the full payload.
        await load();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Class update failed");
      } finally {
        setClassBusy((s) => {
          const next = new Set(s);
          next.delete(classId);
          return next;
        });
      }
    },
    [studentId, load]
  );

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading support settings…</div>;
  }
  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600 text-sm mb-2">Error: {error}</div>
        <button
          onClick={() => void load()}
          className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!data) {
    return <div className="p-4 text-sm text-gray-500">No data.</div>;
  }

  const { student, classes } = data;
  const globalRaw = student.globalSupportSettings;
  const hasAnyClassOverride = classes.some(
    (c) =>
      c.classOverrides.l1_target_override !== undefined ||
      c.classOverrides.tap_a_word_enabled !== undefined
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ─── Resolution chain explainer ──────────────────────────── */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
        <div className="font-semibold text-amber-900 mb-2">
          How {student.displayName || student.username}&apos;s settings are decided
        </div>
        <ol className="list-decimal pl-5 space-y-1 text-amber-900">
          <li>
            <span className="font-medium">Intake</span> —{" "}
            {student.intake.firstLanguageRaw ? (
              <>
                first language at home is{" "}
                <span className="font-mono">{student.intake.firstLanguageRaw}</span>
                {student.intake.intakeL1Code ? (
                  <>
                    {" "}
                    (resolves to{" "}
                    <span className="font-mono">{student.intake.intakeL1Code}</span>)
                  </>
                ) : (
                  <> (no supported translation — falls back to English)</>
                )}
              </>
            ) : (
              <>no intake survey data — falls back to English default</>
            )}
            .
          </li>
          <li>
            <span className="font-medium">Per-student global override</span> — set
            below. Wins over intake.
          </li>
          <li>
            <span className="font-medium">Per-class override</span> — optional, set
            in the &quot;Customize for a specific class&quot; section. Wins over
            student global, only inside that class.
          </li>
        </ol>
      </div>

      {/* ─── Per-student global form ─────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Per-student settings
          </h3>
          <span className="text-xs text-gray-500">
            Applies everywhere unless a class overrides it.
          </span>
        </div>

        {/* ELL level — separate row, full-width because the labels are longer */}
        <label className="block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            ELL level (English language scaffolding)
          </span>
          <select
            value={student.ellLevel || 1}
            onChange={(e) =>
              void updateGlobal({ ell_level: Number(e.target.value) as EllLevel })
            }
            disabled={saving}
            className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm bg-white"
          >
            {([1, 2, 3] as EllLevel[]).map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl} — {ELL_LEVELS[lvl].label} — {ELL_LEVELS[lvl].description}
              </option>
            ))}
          </select>
          <div className="mt-1 text-xs text-gray-500">
            Global default. Each class can override below.
          </div>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* L1 target */}
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              L1 (translation language)
            </span>
            <select
              value={globalRaw.l1_target_override ?? "__inherit__"}
              onChange={(e) => {
                const val = e.target.value;
                void updateGlobal({
                  l1_target_override:
                    val === "__inherit__" ? null : (val as L1Target),
                });
              }}
              disabled={saving}
              className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm bg-white"
            >
              <option value="__inherit__">
                inherit ({student.intake.firstLanguageRaw || "—"} →{" "}
                {student.intake.intakeL1Code || "en"})
              </option>
              {SUPPORTED_L1_TARGETS.map((t) => (
                <option key={t} value={t}>
                  {t} ({l1DisplayLabel(t)})
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-gray-500">
              Resolved global:{" "}
              <span className="font-mono">{student.resolvedGlobal.l1Target}</span>{" "}
              <SourceBadge source={student.resolvedGlobal.l1Source} />
            </div>
          </label>

          {/* Tap-a-word */}
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Tap-a-word
            </span>
            <select
              value={
                globalRaw.tap_a_word_enabled === null ||
                globalRaw.tap_a_word_enabled === undefined
                  ? "__inherit__"
                  : String(globalRaw.tap_a_word_enabled)
              }
              onChange={(e) => {
                const val = e.target.value;
                void updateGlobal({
                  tap_a_word_enabled:
                    val === "__inherit__" ? null : val === "true",
                });
              }}
              disabled={saving}
              className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm bg-white"
            >
              <option value="__inherit__">inherit (default: on)</option>
              <option value="true">on</option>
              <option value="false">off</option>
            </select>
            <div className="mt-1 text-xs text-gray-500">
              Resolved global:{" "}
              <span className="font-mono">
                {student.resolvedGlobal.tapAWordEnabled ? "on" : "off"}
              </span>{" "}
              <SourceBadge source={student.resolvedGlobal.tapASource} />
            </div>
          </label>
        </div>

        {/* Reset all per-student global keys */}
        {(globalRaw.l1_target_override !== undefined ||
          globalRaw.tap_a_word_enabled !== undefined) && (
          <button
            onClick={() =>
              void updateGlobal({
                l1_target_override: null,
                tap_a_word_enabled: null,
              })
            }
            disabled={saving}
            className="mt-3 text-xs text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50"
          >
            Reset to inherit (clears per-student global overrides)
          </button>
        )}
      </div>

      {/* ─── Per-class section (collapsed by default) ────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <button
          onClick={() => setShowClassSection((s) => !s)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
        >
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Customize for a specific class
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {hasAnyClassOverride
                ? `${classes.filter((c) => c.classOverrides.l1_target_override !== undefined || c.classOverrides.tap_a_word_enabled !== undefined).length} of ${classes.length} active classes have overrides.`
                : `${classes.length} active class${classes.length === 1 ? "" : "es"}, no overrides set.`}
            </p>
          </div>
          <span className="text-gray-400 text-lg">{showClassSection ? "−" : "+"}</span>
        </button>

        {showClassSection && (
          <div className="border-t border-gray-100">
            {classes.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                No active enrollments in non-archived classes.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {classes.map((c) => (
                  <ClassRowView
                    key={c.classId}
                    cls={c}
                    busy={classBusy.has(c.classId)}
                    onUpdate={(patch) => void updateClass(c.classId, patch)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Per-class row ──────────────────────────────────────────────────────

function ClassRowView({
  cls,
  busy,
  onUpdate,
}: {
  cls: ApiResponse["classes"][number];
  busy: boolean;
  onUpdate: (patch: {
    l1_target_override?: L1Target | null;
    tap_a_word_enabled?: boolean | null;
    ell_level_override?: number | null;
  }) => void;
}) {
  const hasOverride = useMemo(
    () =>
      cls.classOverrides.l1_target_override !== undefined ||
      cls.classOverrides.tap_a_word_enabled !== undefined ||
      cls.ellLevelOverride !== null,
    [cls.classOverrides, cls.ellLevelOverride]
  );

  return (
    <div className={`p-4 ${busy ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="font-medium text-gray-900">{cls.className}</span>
          <span className="ml-2 text-xs text-gray-500 font-mono">{cls.classCode}</span>
        </div>
        {hasOverride && (
          <button
            onClick={() =>
              onUpdate({
                l1_target_override: null,
                tap_a_word_enabled: null,
                ell_level_override: null,
              })
            }
            disabled={busy}
            className="text-xs text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50"
          >
            Reset class overrides
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        {/* ELL override */}
        <div>
          <span className="text-xs text-gray-500">ELL: </span>
          <select
            value={cls.ellLevelOverride ?? "__inherit__"}
            onChange={(e) => {
              const val = e.target.value;
              onUpdate({
                ell_level_override:
                  val === "__inherit__" ? null : Number(val),
              });
            }}
            disabled={busy}
            className="rounded border border-gray-200 px-1.5 py-0.5 text-sm bg-white"
          >
            <option value="__inherit__">inherit</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          <span className="ml-2 text-xs text-gray-500">
            → <span className="font-mono">{cls.resolvedEll ?? "—"}</span>{" "}
            <SourceBadge
              source={
                cls.ellSource === "class-override"
                  ? "class-override"
                  : cls.ellSource === "student-global"
                    ? "student-override"
                    : "default"
              }
            />
          </span>
        </div>

        <div>
          <span className="text-xs text-gray-500">L1: </span>
          <select
            value={cls.classOverrides.l1_target_override ?? "__inherit__"}
            onChange={(e) => {
              const val = e.target.value;
              onUpdate({
                l1_target_override:
                  val === "__inherit__" ? null : (val as L1Target),
              });
            }}
            disabled={busy}
            className="rounded border border-gray-200 px-1.5 py-0.5 text-sm bg-white"
          >
            <option value="__inherit__">inherit</option>
            {SUPPORTED_L1_TARGETS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="ml-2 text-xs text-gray-500">
            → <span className="font-mono">{cls.resolved.l1Target}</span>{" "}
            <SourceBadge source={cls.resolved.l1Source} />
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-500">Tap-a-word: </span>
          <select
            value={
              cls.classOverrides.tap_a_word_enabled === null ||
              cls.classOverrides.tap_a_word_enabled === undefined
                ? "__inherit__"
                : String(cls.classOverrides.tap_a_word_enabled)
            }
            onChange={(e) => {
              const val = e.target.value;
              onUpdate({
                tap_a_word_enabled: val === "__inherit__" ? null : val === "true",
              });
            }}
            disabled={busy}
            className="rounded border border-gray-200 px-1.5 py-0.5 text-sm bg-white"
          >
            <option value="__inherit__">inherit</option>
            <option value="true">on</option>
            <option value="false">off</option>
          </select>
          <span className="ml-2 text-xs text-gray-500">
            → <span className="font-mono">{cls.resolved.tapAWordEnabled ? "on" : "off"}</span>{" "}
            <SourceBadge source={cls.resolved.tapASource} />
          </span>
        </div>
      </div>
    </div>
  );
}
