"use client";

/**
 * ProjectSpecResponse — lesson-page activity for the Project Spec v1
 * intake. Three phases:
 *   1. Picker  — student chooses an archetype chip (Toy / Architecture).
 *   2. Walker  — Q1-Q7, one screen at a time, with skip + length nudge.
 *   3. Card    — read-only summary + "Continue to Timeline" CTA.
 *
 * State lives in student_unit_project_specs (one row per student+unit).
 * Loads via GET /api/student/project-spec?unitId=...; saves via POST
 * (whole-state upsert pattern, mirrors AG.2.1 kanban). Service-role API
 * + studentId from token session (Lesson #4) — no RLS path for writes.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ARCHETYPE_LIST,
  getArchetype,
  type ArchetypeDefinition,
  type SlotAnswer,
  type SlotDefinition,
  type SlotInputType,
  type SlotValue,
} from "@/lib/project-spec/archetypes";

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

interface SpecState {
  archetype_id: string | null;
  slot_1: SlotAnswer | null;
  slot_2: SlotAnswer | null;
  slot_3: SlotAnswer | null;
  slot_4: SlotAnswer | null;
  slot_5: SlotAnswer | null;
  slot_6: SlotAnswer | null;
  slot_7: SlotAnswer | null;
  completed_at: string | null;
}

type SlotKey = "slot_1" | "slot_2" | "slot_3" | "slot_4" | "slot_5" | "slot_6" | "slot_7";

const SLOT_KEYS: SlotKey[] = [
  "slot_1",
  "slot_2",
  "slot_3",
  "slot_4",
  "slot_5",
  "slot_6",
  "slot_7",
];

function emptySpec(): SpecState {
  return {
    archetype_id: null,
    slot_1: null,
    slot_2: null,
    slot_3: null,
    slot_4: null,
    slot_5: null,
    slot_6: null,
    slot_7: null,
    completed_at: null,
  };
}

// ────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────

interface Props {
  unitId: string;
  sectionIndex: number;
  /**
   * Standard ResponseInput onChange. We use it to push a readable
   * spec summary into student_progress.responses so the canonical
   * marking flow (which reads responses[tileId]) can see the spec
   * as a submission. Mirrors how every other response type plays
   * with the existing autosave pipeline.
   */
  onChange?: (value: string) => void;
}

export default function ProjectSpecResponse({ unitId, onChange }: Props) {
  const [spec, setSpec] = useState<SpecState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0);

  // Whenever the spec state changes (load, slot save, completion),
  // push a fresh summary string to the parent so the standard
  // student_progress.responses autosave picks it up. This is what
  // makes the Project Spec activity discoverable in the marking page
  // (which keys tile detection off non-empty response strings).
  useEffect(() => {
    if (!spec || !onChange) return;
    const archetype = getArchetype(spec.archetype_id);
    if (!archetype) return;
    onChange(buildSpecSummary(spec, archetype));
  }, [spec, onChange]);

  // Load on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/student/project-spec?unitId=${encodeURIComponent(unitId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Load failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setSpec(data.spec ?? emptySpec());
        // Resume at first incomplete slot (or first if all filled but not completed)
        if (data.spec?.archetype_id && !data.spec?.completed_at) {
          const firstIncomplete = SLOT_KEYS.findIndex((k) => !data.spec[k]);
          setCurrentSlotIdx(firstIncomplete === -1 ? 6 : firstIncomplete);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  // Save (partial patch → POST → reflect locally)
  const save = useCallback(
    async (patch: Partial<SpecState> & { completed?: boolean }) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/student/project-spec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId, ...patch }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        const data = await res.json();
        setSpec(data.spec);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [unitId]
  );

  // ─── Loading / error
  if (loading) {
    return (
      <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-6 text-center text-sm text-purple-700">
        Loading your project spec…
      </div>
    );
  }
  if (error || !spec) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Something went wrong loading your project spec. {error ?? ""}
      </div>
    );
  }

  const archetype = getArchetype(spec.archetype_id);

  // ─── Phase 1: Archetype picker
  if (!spec.archetype_id || !archetype) {
    return <ArchetypePicker onPick={(id) => save({ archetype_id: id })} saving={saving} />;
  }

  // ─── Phase 3: Project Card (completed)
  if (spec.completed_at) {
    return <ProjectCard archetype={archetype} spec={spec} />;
  }

  // ─── Phase 2: Walker
  const slotDef = archetype.slots[currentSlotIdx];
  const slotKey = SLOT_KEYS[currentSlotIdx];
  const currentAnswer = spec[slotKey];

  return (
    <SlotWalker
      archetype={archetype}
      slotDef={slotDef}
      slotIndex={currentSlotIdx}
      currentAnswer={currentAnswer}
      saving={saving}
      onSave={async (answer) => {
        await save({ [slotKey]: answer } as Partial<SpecState>);
        if (currentSlotIdx < 6) setCurrentSlotIdx(currentSlotIdx + 1);
      }}
      onBack={currentSlotIdx > 0 ? () => setCurrentSlotIdx(currentSlotIdx - 1) : null}
      onComplete={
        currentSlotIdx === 6
          ? async () => {
              await save({ completed: true });
            }
          : null
      }
    />
  );
}

// ────────────────────────────────────────────────────────────────────
// Phase 1 — Archetype picker (Q0 chip)
// ────────────────────────────────────────────────────────────────────

function ArchetypePicker({
  onPick,
  saving,
}: {
  onPick: (id: string) => void;
  saving: boolean;
}) {
  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-purple-50/50 to-white p-6">
      <h3 className="text-lg font-semibold text-purple-900 mb-1">
        Let&apos;s shape your project
      </h3>
      <p className="text-sm text-purple-700/80 mb-5">
        Pick the kind of thing you&apos;re going to design. You can&apos;t change this later, so think for a second.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ARCHETYPE_LIST.map((a) => (
          <button
            key={a.id}
            onClick={() => onPick(a.id)}
            disabled={saving}
            className="group flex flex-col items-start gap-2 rounded-xl border-2 border-purple-200 bg-white p-5 text-left transition hover:border-purple-500 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-4xl">{a.emoji}</span>
            <span className="font-semibold text-purple-900 group-hover:text-purple-700">
              {a.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Phase 2 — Slot walker (Q1-Q7)
// ────────────────────────────────────────────────────────────────────

interface WalkerProps {
  archetype: ArchetypeDefinition;
  slotDef: SlotDefinition;
  slotIndex: number;
  currentAnswer: SlotAnswer | null;
  saving: boolean;
  onSave: (answer: SlotAnswer) => Promise<void>;
  onBack: (() => void) | null;
  onComplete: (() => Promise<void>) | null;
}

function SlotWalker({
  archetype,
  slotDef,
  slotIndex,
  currentAnswer,
  saving,
  onSave,
  onBack,
  onComplete,
}: WalkerProps) {
  const [draftValue, setDraftValue] = useState<SlotValue | null>(
    currentAnswer && !currentAnswer.skipped ? currentAnswer.value ?? null : null
  );
  const [showExamples, setShowExamples] = useState(false);

  // Re-sync draft when slot changes
  useEffect(() => {
    setDraftValue(currentAnswer && !currentAnswer.skipped ? currentAnswer.value ?? null : null);
    setShowExamples(false);
  }, [slotIndex, currentAnswer]);

  const progress = ((slotIndex + 1) / 7) * 100;

  const lengthHint = useMemo(
    () => computeLengthHint(slotDef.input, draftValue),
    [slotDef.input, draftValue]
  );

  const canAdvance = draftValue !== null && isValueNonEmpty(draftValue);

  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-purple-50/40 to-white p-6">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-purple-600">
          {archetype.emoji} {archetype.label} · Question {slotIndex + 1} of 7
        </span>
        {slotDef.examples && (
          <button
            onClick={() => setShowExamples((s) => !s)}
            className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
          >
            {showExamples ? "Hide examples" : "🔍 Strong vs weak examples"}
          </button>
        )}
      </div>
      {/* Progress bar */}
      <div className="h-1 w-full bg-purple-100 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-purple-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mb-1">{slotDef.title}</h3>
      <p className="text-sm text-gray-600 mb-4">{slotDef.subhead}</p>

      {/* Examples drawer */}
      {showExamples && slotDef.examples && (
        <div className="mb-4 rounded-lg border border-purple-200 bg-white p-3 text-sm">
          {slotDef.examples.strong.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">
                Strong
              </p>
              <ul className="mb-3 space-y-0.5 text-gray-700 list-disc list-inside">
                {slotDef.examples.strong.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {slotDef.examples.weak.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-1">
                Weak
              </p>
              <ul className="space-y-0.5 text-gray-700 list-disc list-inside">
                {slotDef.examples.weak.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Input */}
      <SlotInput input={slotDef.input} value={draftValue} onChange={setDraftValue} />

      {/* Length nudge */}
      {lengthHint && (
        <p className="mt-2 text-xs text-amber-700">
          {lengthHint}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-5 gap-2 flex-wrap">
        <div className="flex gap-2">
          {onBack && (
            <button
              onClick={onBack}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              ← Back
            </button>
          )}
          <button
            onClick={async () => {
              await onSave({
                skipped: true,
                updated_at: new Date().toISOString(),
              });
            }}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50"
          >
            Skip for now →
          </button>
        </div>
        {onComplete ? (
          <button
            onClick={async () => {
              if (canAdvance && draftValue) {
                await onSave({
                  value: draftValue,
                  skipped: false,
                  updated_at: new Date().toISOString(),
                });
              }
              await onComplete();
            }}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Finish &amp; see Project Card →
          </button>
        ) : (
          <button
            onClick={async () => {
              if (!draftValue) return;
              await onSave({
                value: draftValue,
                skipped: false,
                updated_at: new Date().toISOString(),
              });
            }}
            disabled={saving || !canAdvance}
            className="px-5 py-2.5 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Slot input dispatcher
// ────────────────────────────────────────────────────────────────────

function SlotInput({
  input,
  value,
  onChange,
}: {
  input: SlotInputType;
  value: SlotValue | null;
  onChange: (v: SlotValue | null) => void;
}) {
  if (input.kind === "text") {
    const text = value?.kind === "text" ? value.text : "";
    return (
      <textarea
        value={text}
        onChange={(e) =>
          onChange(e.target.value ? { kind: "text", text: e.target.value } : null)
        }
        placeholder="Type here…"
        className="w-full min-h-[80px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
      />
    );
  }

  if (input.kind === "text-multifield") {
    const values = value?.kind === "text-multifield" ? value.values : input.fields.map(() => "");
    return (
      <div className="space-y-2">
        {input.fields.map((field, i) => (
          <div key={i}>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              {field.label}
            </label>
            <input
              type="text"
              value={values[i] ?? ""}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value;
                onChange({ kind: "text-multifield", values: next });
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        ))}
      </div>
    );
  }

  if (input.kind === "chip-picker") {
    const primary = value?.kind === "chip" ? value.primary : null;
    const secondary = value?.kind === "chip" ? value.secondary : undefined;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {input.chips.map((chip) => {
            const selected = chip.id === primary;
            return (
              <button
                key={chip.id}
                onClick={() =>
                  onChange({ kind: "chip", primary: chip.id, secondary })
                }
                className={`px-4 py-2 rounded-full text-sm border-2 transition ${
                  selected
                    ? "border-purple-600 bg-purple-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-purple-400"
                }`}
              >
                {chip.emoji ? `${chip.emoji} ` : ""}{chip.label}
              </button>
            );
          })}
        </div>
        {input.allowSecondary && primary && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">
              {input.allowSecondary.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {input.allowSecondary.chips.map((chip) => {
                const selected = chip.id === secondary;
                return (
                  <button
                    key={chip.id}
                    onClick={() =>
                      onChange({
                        kind: "chip",
                        primary,
                        secondary: selected ? undefined : chip.id,
                      })
                    }
                    className={`px-3 py-1 rounded-full text-xs border transition ${
                      selected
                        ? "border-purple-500 bg-purple-100 text-purple-900"
                        : "border-gray-300 bg-white text-gray-600 hover:border-purple-300"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (input.kind === "size-reference") {
    const ref = value?.kind === "size" ? value.ref : null;
    const cm = value?.kind === "size" ? value.cm : undefined;
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {input.references.map((r) => {
            const selected = r.id === ref;
            return (
              <button
                key={r.id}
                onClick={() => onChange({ kind: "size", ref: r.id, cm })}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-xs transition ${
                  selected
                    ? "border-purple-600 bg-purple-50"
                    : "border-gray-200 bg-white hover:border-purple-300"
                }`}
              >
                <span className="text-2xl">{r.emoji}</span>
                <span className="text-center text-gray-700">{r.label}</span>
              </button>
            );
          })}
        </div>
        {input.allowCm && ref && (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-600">Optional cm:</span>
            {(["w", "h", "d"] as const).map((axis) => (
              <input
                key={axis}
                type="number"
                placeholder={axis.toUpperCase()}
                value={cm?.[axis] ?? ""}
                onChange={(e) => {
                  const n = e.target.value ? Number(e.target.value) : undefined;
                  onChange({
                    kind: "size",
                    ref,
                    cm: { ...(cm ?? {}), [axis]: n },
                  });
                }}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (input.kind === "number-pair") {
    const first = value?.kind === "pair" ? value.first : NaN;
    const second = value?.kind === "pair" ? value.second : NaN;
    return (
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            {input.firstLabel}
          </label>
          <input
            type="number"
            value={Number.isFinite(first) ? first : ""}
            min={input.firstMin}
            max={input.firstMax}
            onChange={(e) => {
              const f = Number(e.target.value);
              onChange({
                kind: "pair",
                first: f,
                second: Number.isFinite(second) ? second : 0,
              });
            }}
            className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <span className="pb-2 text-gray-400">×</span>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            {input.secondLabel}
          </label>
          <input
            type="number"
            value={Number.isFinite(second) ? second : ""}
            min={input.secondMin}
            max={input.secondMax}
            onChange={(e) => {
              const s = Number(e.target.value);
              onChange({
                kind: "pair",
                first: Number.isFinite(first) ? first : 0,
                second: s,
              });
            }}
            className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        {input.unit && <span className="pb-2 text-sm text-gray-600">{input.unit}</span>}
      </div>
    );
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────
// Phase 3 — Project Card
// ────────────────────────────────────────────────────────────────────

function ProjectCard({
  archetype,
  spec,
}: {
  archetype: ArchetypeDefinition;
  spec: SpecState;
}) {
  return (
    <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-white to-purple-50/50 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-purple-200">
        <span className="text-4xl">{archetype.emoji}</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
            Project Spec
          </p>
          <h3 className="text-xl font-bold text-purple-900">{archetype.label}</h3>
        </div>
      </div>

      <div className="space-y-3">
        {archetype.slots.map((slotDef, i) => {
          const answer = spec[SLOT_KEYS[i]];
          return (
            <div key={i} className="rounded-lg bg-white border border-purple-100 p-3">
              <p className="text-xs font-semibold text-purple-600 mb-0.5">
                Q{i + 1} · {slotDef.title}
              </p>
              {!answer || answer.skipped ? (
                <p className="text-sm text-amber-700 italic">⚠ Not yet defined</p>
              ) : (
                <p className="text-sm text-gray-900">{formatAnswer(answer, slotDef.input)}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-xs text-purple-700/70 text-right">
        ✓ Saved — your spec is locked in. Move on to the next activity.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function isValueNonEmpty(v: SlotValue): boolean {
  switch (v.kind) {
    case "text":
      return v.text.trim().length > 0;
    case "text-multifield":
      return v.values.some((s) => s.trim().length > 0);
    case "chip":
      return Boolean(v.primary);
    case "size":
      return Boolean(v.ref);
    case "pair":
      return Number.isFinite(v.first) && Number.isFinite(v.second);
  }
}

function computeLengthHint(input: SlotInputType, value: SlotValue | null): string | null {
  if (!value) return null;
  if (input.kind === "text" && value.kind === "text") {
    const txt = value.text.trim();
    if (txt.length === 0) return null;
    if (txt.length < 10) {
      return "This feels thin. Try once more, or skip and come back?";
    }
    if (input.maxWords) {
      const words = txt.split(/\s+/).filter(Boolean).length;
      if (words > input.maxWords) {
        return `${words} words — aim for ${input.maxWords} or fewer.`;
      }
    }
  }
  return null;
}

/**
 * Format a completed (or in-progress) spec as readable multi-line text.
 * Pushed via onChange into student_progress.responses so the marking
 * page sees the spec as a submission (its tile-progress check requires
 * a non-empty string in responses[tileId]). Teachers will read this
 * directly in the marking detail pane.
 */
function buildSpecSummary(spec: SpecState, archetype: ArchetypeDefinition): string {
  const lines: string[] = [];
  lines.push(`Project Spec — ${archetype.emoji} ${archetype.label}`);
  archetype.slots.forEach((slotDef, i) => {
    const answer = spec[SLOT_KEYS[i]];
    lines.push("");
    lines.push(`Q${i + 1} — ${slotDef.title}`);
    if (!answer || answer.skipped) {
      lines.push("(skipped or not yet defined)");
    } else {
      lines.push(formatAnswer(answer, slotDef.input));
    }
  });
  if (spec.completed_at) {
    lines.push("");
    lines.push(`(completed ${spec.completed_at})`);
  }
  return lines.join("\n");
}

function formatAnswer(answer: SlotAnswer, input: SlotInputType): string {
  const v = answer.value;
  if (!v) return "—";
  switch (v.kind) {
    case "text":
      return v.text;
    case "text-multifield":
      return v.values.filter((s) => s.trim().length > 0).join(" · ");
    case "chip": {
      if (input.kind !== "chip-picker") return v.primary;
      const primaryChip = input.chips.find((c) => c.id === v.primary);
      const primary = primaryChip
        ? `${primaryChip.emoji ?? ""} ${primaryChip.label}`.trim()
        : v.primary;
      if (!v.secondary) return primary;
      const secChip = input.allowSecondary?.chips.find((c) => c.id === v.secondary);
      return `${primary} + ${secChip?.label ?? v.secondary}`;
    }
    case "size": {
      if (input.kind !== "size-reference") return v.ref;
      const refLabel = input.references.find((r) => r.id === v.ref)?.label ?? v.ref;
      if (v.cm && (v.cm.w || v.cm.h || v.cm.d)) {
        const parts = [v.cm.w, v.cm.h, v.cm.d].filter(Boolean).join(" × ");
        return `${refLabel} (${parts} cm)`;
      }
      return refLabel;
    }
    case "pair": {
      if (input.kind !== "number-pair") return `${v.first} × ${v.second}`;
      return `${v.first} × ${v.second}${input.unit ? " " + input.unit : ""}`;
    }
  }
}
