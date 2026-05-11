"use client";

/**
 * ProjectSpecResponse — v1 unified Project Spec lesson-page activity.
 *
 * Three phases:
 *   1. Picker  — archetype chip (Toy / Architecture).
 *   2. Walker  — Q1-Q7, one screen at a time, with skip + length nudge.
 *   3. Card    — read-only summary.
 *
 * State lives in student_unit_project_specs. Loads via GET
 * /api/student/project-spec; saves via POST partial-patch upsert.
 * Service-role API + studentId from token session (Lesson #4).
 *
 * v2 split — this v1 block stays running alongside the three new
 * v2 blocks (Product Brief / User Profile / Success Criteria). Shared
 * walker / picker / input-dispatcher / format helpers extracted to
 * @/components/student/project-spec/shared/* + @/lib/project-spec/format
 * and reused across all four blocks.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ARCHETYPE_LIST,
  getArchetype,
  type ArchetypeDefinition,
  type SlotAnswer,
} from "@/lib/project-spec/archetypes";
import { buildSummary, formatAnswer } from "@/lib/project-spec/format";
import { SlotWalker } from "./shared/SlotWalker";
import { ArchetypePicker } from "./shared/ArchetypePicker";
import { useSpecBridge } from "./shared/useSpecBridge";

// ────────────────────────────────────────────────────────────────────
// State shape
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

type SlotKey =
  | "slot_1"
  | "slot_2"
  | "slot_3"
  | "slot_4"
  | "slot_5"
  | "slot_6"
  | "slot_7";

const SLOT_KEYS: SlotKey[] = [
  "slot_1",
  "slot_2",
  "slot_3",
  "slot_4",
  "slot_5",
  "slot_6",
  "slot_7",
];

const TOTAL_SLOTS = 7;

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
  /** Standard ResponseInput onChange — pushed via useSpecBridge so the
   *  spec summary lands in student_progress.responses for marking. */
  onChange?: (value: string) => void;
}

export default function ProjectSpecResponse({ unitId, onChange }: Props) {
  const [spec, setSpec] = useState<SpecState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0);

  // Push a summary to student_progress.responses on every state change
  // so the marking page sees the spec as a submission. Pattern + ref-
  // capture rationale: see PR #184 + useSpecBridge.
  useSpecBridge(spec, onChange, (s) => {
    const archetype = getArchetype(s.archetype_id);
    if (!archetype) return null;
    return buildSummary(
      `Project Spec — ${archetype.emoji} ${archetype.label}`,
      archetype.slots.map((slotDef, i) => ({
        slotDef,
        answer: s[SLOT_KEYS[i]],
      })),
      s.completed_at,
    );
  });

  // Load on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/student/project-spec?unitId=${encodeURIComponent(unitId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`Load failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setSpec(data.spec ?? emptySpec());
        // Resume at first incomplete slot
        if (data.spec?.archetype_id && !data.spec?.completed_at) {
          const firstIncomplete = SLOT_KEYS.findIndex(
            (k) => !data.spec[k],
          );
          setCurrentSlotIdx(
            firstIncomplete === -1 ? TOTAL_SLOTS - 1 : firstIncomplete,
          );
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
    [unitId],
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
    return (
      <ArchetypePicker
        archetypes={ARCHETYPE_LIST}
        onPick={(id) => save({ archetype_id: id })}
        saving={saving}
      />
    );
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
      headerLabel={`${archetype.emoji} ${archetype.label} · Question ${currentSlotIdx + 1} of ${TOTAL_SLOTS}`}
      totalSlots={TOTAL_SLOTS}
      slotDef={slotDef}
      slotIndex={currentSlotIdx}
      currentAnswer={currentAnswer}
      saving={saving}
      onSave={async (answer) => {
        await save({ [slotKey]: answer } as Partial<SpecState>);
        if (currentSlotIdx < TOTAL_SLOTS - 1) {
          setCurrentSlotIdx(currentSlotIdx + 1);
        }
      }}
      onBack={
        currentSlotIdx > 0 ? () => setCurrentSlotIdx(currentSlotIdx - 1) : null
      }
      onComplete={
        currentSlotIdx === TOTAL_SLOTS - 1
          ? async () => {
              await save({ completed: true });
            }
          : null
      }
    />
  );
}

// ────────────────────────────────────────────────────────────────────
// Phase 3 — Project Card (read-only summary)
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
          <h3 className="text-xl font-bold text-purple-900">
            {archetype.label}
          </h3>
        </div>
      </div>

      <div className="space-y-3">
        {archetype.slots.map((slotDef, i) => {
          const answer = spec[SLOT_KEYS[i]];
          return (
            <div
              key={i}
              className="rounded-lg bg-white border border-purple-100 p-3"
            >
              <p className="text-xs font-semibold text-purple-600 mb-0.5">
                Q{i + 1} · {slotDef.title}
              </p>
              {!answer || answer.skipped ? (
                <p className="text-sm text-amber-700 italic">
                  ⚠ Not yet defined
                </p>
              ) : (
                <p className="text-sm text-gray-900">
                  {formatAnswer(answer, slotDef.input)}
                </p>
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
