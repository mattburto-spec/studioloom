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

// ELL-level color tokens — matched to the static badge on the class page so
// the same level looks the same wherever it appears.
const ELL_TONES: Record<number, { bg: string; text: string; ring: string; ringOff: string }> = {
  1: { bg: "#DBEAFE", text: "#1E40AF", ring: "#1E40AF", ringOff: "#F3F4F6" },
  2: { bg: "#FEF3C7", text: "#92400E", ring: "#92400E", ringOff: "#F3F4F6" },
  3: { bg: "#D1FAE5", text: "#065F46", ring: "#065F46", ringOff: "#F3F4F6" },
};

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
  "student-override": { label: "student override", color: "bg-purple-100 text-purple-700" },
  "class-override": { label: "class override", color: "bg-blue-100 text-blue-700" },
  default: { label: "default", color: "bg-gray-100 text-gray-600" },
};

function SourceBadge({ source, className = "" }: { source: string; className?: string }) {
  const b = SOURCE_BADGES[source] ?? SOURCE_BADGES.default;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${b.color} ${className}`}
    >
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
  const [showExplainer, setShowExplainer] = useState(false);
  const [classBusy, setClassBusy] = useState<Set<string>>(new Set());
  // Tiny "Saved" indicator — fades out after a moment. Polish-pass addition;
  // teachers were getting no feedback that a successful save had landed
  // because every PATCH triggers a silent re-render. aria-live region below.
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    if (savedAt === null) return;
    const t = setTimeout(() => setSavedAt(null), 2400);
    return () => clearTimeout(t);
  }, [savedAt]);

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
        setSavedAt(Date.now());
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
        setSavedAt(Date.now());
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
    return (
      <div className="p-4 text-sm text-gray-500" role="status" aria-busy="true">
        Loading support settings…
      </div>
    );
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
      c.classOverrides.tap_a_word_enabled !== undefined ||
      c.ellLevelOverride !== null
  );
  const overrideClassCount = classes.filter(
    (c) =>
      c.classOverrides.l1_target_override !== undefined ||
      c.classOverrides.tap_a_word_enabled !== undefined ||
      c.ellLevelOverride !== null
  ).length;
  const hasGlobalOverride =
    globalRaw.l1_target_override !== undefined ||
    globalRaw.tap_a_word_enabled !== undefined;
  const ellLevel = (student.ellLevel || 1) as EllLevel;
  const ellTone = ELL_TONES[ellLevel];

  return (
    <div className="space-y-6 relative">
      {/* ─── Saved indicator ──────────────────────────────────────── */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {savedAt ? "Saved" : ""}
      </div>
      {savedAt && (
        <div
          className="absolute top-0 right-0 -mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-1 pointer-events-none z-10"
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 8 7 12 13 4" />
          </svg>
          Saved
        </div>
      )}

      {/* ─── HERO — Currently effective settings ──────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-purple-600">
              Currently effective
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">
              {student.displayName || student.username}&apos;s support settings
            </h2>
          </div>
          <button
            onClick={() => setShowExplainer((s) => !s)}
            className="text-xs font-medium text-purple-600 hover:text-purple-800 hover:underline focus:outline-none focus-visible:underline"
            aria-expanded={showExplainer}
          >
            {showExplainer ? "Hide" : "How does this resolve?"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* ELL */}
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              ELL level
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                style={{ background: ellTone.bg, color: ellTone.text }}
              >
                {ellLevel}
              </span>
              <span className="text-xs text-gray-600 font-medium">
                {ELL_LEVELS[ellLevel].label}
              </span>
            </div>
          </div>

          {/* L1 */}
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              L1 (translations)
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold font-mono text-gray-900">
                {student.resolvedGlobal.l1Target}
              </span>
              <span className="text-xs text-gray-600">
                {l1DisplayLabel(student.resolvedGlobal.l1Target)}
              </span>
            </div>
            <SourceBadge source={student.resolvedGlobal.l1Source} className="mt-1" />
          </div>

          {/* Tap-a-word */}
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Tap-a-word
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                  student.resolvedGlobal.tapAWordEnabled
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {student.resolvedGlobal.tapAWordEnabled ? "ON" : "OFF"}
              </span>
            </div>
            <SourceBadge source={student.resolvedGlobal.tapASource} className="mt-1" />
          </div>
        </div>

        {showExplainer && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-600 space-y-1.5">
            <div className="flex gap-1.5">
              <span className="font-semibold text-gray-900">1. Intake →</span>
              <span>
                {student.intake.firstLanguageRaw ? (
                  <>
                    L1 at home is{" "}
                    <span className="font-mono text-gray-900">
                      {student.intake.firstLanguageRaw}
                    </span>
                    {student.intake.intakeL1Code ? (
                      <>
                        {" "}→ resolves to{" "}
                        <span className="font-mono text-gray-900">
                          {student.intake.intakeL1Code}
                        </span>
                      </>
                    ) : (
                      <> (no supported translation, falls back to en)</>
                    )}
                  </>
                ) : (
                  <>no intake data, defaults to English</>
                )}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-900">2. Per-student override →</span>{" "}
              set below. Wins over intake.
            </div>
            <div>
              <span className="font-semibold text-gray-900">3. Per-class override →</span>{" "}
              expand the class section below. Wins inside that class only.
            </div>
            <div className="pt-2 mt-2 border-t border-gray-100">
              <span className="font-semibold text-gray-900">Tap-a-word default:</span> ON
              for ELL 1-2 OR L1 ≠ English (translation safety). OFF for ELL 3 monolingual
              English readers (clean reading view).
            </div>
          </div>
        )}
      </div>

      {/* ─── Per-student global form ─────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Per-student defaults</h3>
          <span className="text-xs text-gray-500">
            Applies everywhere unless a class overrides
          </span>
        </div>

        {/* ELL level — pill buttons */}
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
            ELL level
          </div>
          <div className="flex items-center gap-2">
            {([1, 2, 3] as EllLevel[]).map((lvl) => {
              const tone = ELL_TONES[lvl];
              const active = ellLevel === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() =>
                    void updateGlobal({ ell_level: lvl })
                  }
                  disabled={saving}
                  title={`${ELL_LEVELS[lvl].label} — ${ELL_LEVELS[lvl].description}`}
                  className="group flex-1 rounded-xl border-2 px-3 py-2.5 text-left transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                  style={{
                    borderColor: active ? tone.ring : "#E5E7EB",
                    background: active ? tone.bg : "white",
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold flex-shrink-0"
                      style={{
                        background: active ? tone.ring : tone.ringOff,
                        color: active ? "white" : "#9CA3AF",
                      }}
                    >
                      {lvl}
                    </span>
                    <div>
                      <div
                        className="text-sm font-semibold leading-tight"
                        style={{ color: active ? tone.text : "#374151" }}
                      >
                        {ELL_LEVELS[lvl].label}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                        {ELL_LEVELS[lvl].description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* L1 target */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              L1 (translation language)
            </div>
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 disabled:opacity-50"
            >
              <option value="__inherit__">
                Inherit from intake ({student.intake.firstLanguageRaw || "—"} →{" "}
                {student.intake.intakeL1Code || "en"})
              </option>
              {SUPPORTED_L1_TARGETS.map((t) => (
                <option key={t} value={t}>
                  {t} — {l1DisplayLabel(t)}
                </option>
              ))}
            </select>
          </div>

          {/* Tap-a-word */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Tap-a-word
            </div>
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 disabled:opacity-50"
            >
              <option value="__inherit__">
                Inherit (default: {student.resolvedGlobal.tapAWordEnabled ? "on" : "off"})
              </option>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </div>
        </div>

        {hasGlobalOverride && (
          <button
            onClick={() =>
              void updateGlobal({
                l1_target_override: null,
                tap_a_word_enabled: null,
              })
            }
            disabled={saving}
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50 focus:outline-none focus-visible:underline"
          >
            <span aria-hidden="true">↺</span> Clear per-student overrides
          </button>
        )}
      </div>

      {/* ─── Per-class section ────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowClassSection((s) => !s)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500/40"
          aria-expanded={showClassSection}
          aria-controls="support-per-class-section"
        >
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-900">
              Per-class overrides
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {hasAnyClassOverride ? (
                <>
                  <span className="font-semibold text-purple-700">{overrideClassCount}</span>{" "}
                  of {classes.length} active class{classes.length === 1 ? "" : "es"} have overrides
                </>
              ) : (
                <>
                  {classes.length} active class{classes.length === 1 ? "" : "es"}, no overrides set
                </>
              )}
            </p>
          </div>
          <span
            className="ml-3 inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-sm font-bold"
            aria-hidden="true"
          >
            {showClassSection ? "−" : "+"}
          </span>
        </button>

        {showClassSection && (
          <div id="support-per-class-section" className="border-t border-gray-100">
            {classes.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">
                No active enrollments in non-archived classes.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {classes.map((c) => (
                  <ClassRowView
                    key={c.classId}
                    cls={c}
                    busy={classBusy.has(c.classId)}
                    studentEllLevel={student.ellLevel}
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
  studentEllLevel,
  onUpdate,
}: {
  cls: ApiResponse["classes"][number];
  busy: boolean;
  studentEllLevel: number | null;
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
  const ellTone = cls.resolvedEll
    ? ELL_TONES[cls.resolvedEll as 1 | 2 | 3]
    : null;

  return (
    <div className={`p-5 transition ${busy ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">{cls.className}</span>
          <span className="text-[11px] font-mono text-gray-400 px-1.5 py-0.5 rounded bg-gray-100">
            {cls.classCode}
          </span>
          {hasOverride && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
              CUSTOMIZED
            </span>
          )}
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
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50 focus:outline-none focus-visible:underline"
          >
            <span aria-hidden="true">↺</span> Clear class overrides
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* ELL */}
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
            ELL
          </div>
          <select
            value={cls.ellLevelOverride ?? "__inherit__"}
            onChange={(e) => {
              const val = e.target.value;
              onUpdate({
                ell_level_override: val === "__inherit__" ? null : Number(val),
              });
            }}
            disabled={busy}
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 disabled:opacity-50"
          >
            <option value="__inherit__">Inherit ({studentEllLevel ?? "—"})</option>
            <option value="1">1 — Beginner</option>
            <option value="2">2 — Intermediate</option>
            <option value="3">3 — Advanced/Native</option>
          </select>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-500">→</span>
            {ellTone && cls.resolvedEll ? (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                style={{ background: ellTone.bg, color: ellTone.text }}
              >
                {cls.resolvedEll}
              </span>
            ) : (
              <span className="text-xs font-mono text-gray-400">—</span>
            )}
            <SourceBadge
              source={
                cls.ellSource === "class-override"
                  ? "class-override"
                  : cls.ellSource === "student-global"
                    ? "student-override"
                    : "default"
              }
            />
          </div>
        </div>

        {/* L1 */}
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
            L1
          </div>
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
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 disabled:opacity-50"
          >
            <option value="__inherit__">Inherit</option>
            {SUPPORTED_L1_TARGETS.map((t) => (
              <option key={t} value={t}>
                {t} — {l1DisplayLabel(t)}
              </option>
            ))}
          </select>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-500">→</span>
            <span className="text-xs font-mono font-semibold text-gray-900">
              {cls.resolved.l1Target}
            </span>
            <SourceBadge source={cls.resolved.l1Source} />
          </div>
        </div>

        {/* Tap-a-word */}
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
            Tap-a-word
          </div>
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
                tap_a_word_enabled:
                  val === "__inherit__" ? null : val === "true",
              });
            }}
            disabled={busy}
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 disabled:opacity-50"
          >
            <option value="__inherit__">Inherit</option>
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-500">→</span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                cls.resolved.tapAWordEnabled
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {cls.resolved.tapAWordEnabled ? "ON" : "OFF"}
            </span>
            <SourceBadge source={cls.resolved.tapASource} />
          </div>
        </div>
      </div>
    </div>
  );
}
