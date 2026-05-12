"use client";

/**
 * ProductBriefResponse — v2 Product Brief lesson-page activity.
 *
 * Three phases (mirrors v1):
 *   1. Picker  — archetype chip (Toy / Architecture, shared with v1).
 *   2. Walker  — Q1-Q9, one screen at a time.
 *   3. Card    — read-only summary.
 *
 * Adds 4 surfaces over v1's 7 slots: precedents (slot 8), constraints
 * multi-chip (slot 7), technical risks multifield (slot 9), and an
 * optional secondary material (slot 5).
 *
 * State lives in student_unit_product_briefs. Loads via GET
 * /api/student/product-brief; saves via POST partial-patch upsert.
 *
 * See docs/projects/project-spec-v2-split-brief.md §4 for slot defs.
 */

import { useCallback, useEffect, useState } from "react";
import type { SlotAnswer } from "@/lib/project-spec/archetypes";
import { buildSummary, formatAnswer } from "@/lib/project-spec/format";
import {
  PRODUCT_BRIEF_ARCHETYPE_LIST,
  getProductBriefArchetype,
  type ProductBriefArchetype,
} from "@/lib/project-spec/product-brief";
import { SlotWalker } from "@/components/student/project-spec/shared/SlotWalker";
import { ArchetypePicker } from "@/components/student/project-spec/shared/ArchetypePicker";
import { useSpecBridge } from "@/components/student/project-spec/shared/useSpecBridge";
import FromChoiceCardBanner from "@/components/student/choice-cards/FromChoiceCardBanner";

// ────────────────────────────────────────────────────────────────────
// State shape
// ────────────────────────────────────────────────────────────────────

interface BriefState {
  archetype_id: string | null;
  slot_1: SlotAnswer | null;
  slot_2: SlotAnswer | null;
  slot_3: SlotAnswer | null;
  slot_4: SlotAnswer | null;
  slot_5: SlotAnswer | null;
  slot_6: SlotAnswer | null;
  slot_7: SlotAnswer | null;
  slot_8: SlotAnswer | null;
  slot_9: SlotAnswer | null;
  completed_at: string | null;
}

type SlotKey =
  | "slot_1"
  | "slot_2"
  | "slot_3"
  | "slot_4"
  | "slot_5"
  | "slot_6"
  | "slot_7"
  | "slot_8"
  | "slot_9";

const SLOT_KEYS: SlotKey[] = [
  "slot_1",
  "slot_2",
  "slot_3",
  "slot_4",
  "slot_5",
  "slot_6",
  "slot_7",
  "slot_8",
  "slot_9",
];

const TOTAL_SLOTS = 9;

function emptyBrief(): BriefState {
  return {
    archetype_id: null,
    slot_1: null,
    slot_2: null,
    slot_3: null,
    slot_4: null,
    slot_5: null,
    slot_6: null,
    slot_7: null,
    slot_8: null,
    slot_9: null,
    completed_at: null,
  };
}

// ────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────

interface Props {
  unitId: string;
  sectionIndex: number;
  onChange?: (value: string) => void;
}

export default function ProductBriefResponse({ unitId, onChange }: Props) {
  const [brief, setBrief] = useState<BriefState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0);
  const [fromChoiceCard, setFromChoiceCard] = useState<{ cardId: string; label: string } | null>(
    null,
  );

  useSpecBridge(brief, onChange, (s) => {
    const archetype = getProductBriefArchetype(s.archetype_id);
    if (!archetype) return null;
    return buildSummary(
      `Product Brief — ${archetype.emoji} ${archetype.label}`,
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
          `/api/student/product-brief?unitId=${encodeURIComponent(unitId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`Load failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setBrief(data.brief ?? emptyBrief());
        setFromChoiceCard(data.from_choice_card ?? null);
        if (data.brief?.archetype_id && !data.brief?.completed_at) {
          const firstIncomplete = SLOT_KEYS.findIndex(
            (k) => !data.brief[k],
          );
          setCurrentSlotIdx(
            firstIncomplete === -1 ? TOTAL_SLOTS - 1 : firstIncomplete,
          );
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
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
    async (patch: Partial<BriefState> & { completed?: boolean; reopen?: boolean }) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/student/product-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId, ...patch }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        const data = await res.json();
        setBrief(data.brief);
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
        Loading your product brief…
      </div>
    );
  }
  if (error || !brief) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Something went wrong loading your product brief. {error ?? ""}
      </div>
    );
  }

  const archetype = getProductBriefArchetype(brief.archetype_id);

  // ─── Phase 1: Archetype picker
  if (!brief.archetype_id || !archetype) {
    return (
      <>
        {fromChoiceCard && <FromChoiceCardBanner cardLabel={fromChoiceCard.label} />}
        <ArchetypePicker
          archetypes={PRODUCT_BRIEF_ARCHETYPE_LIST}
          onPick={(id) => save({ archetype_id: id })}
          saving={saving}
          heading="Shape your product"
          subhead="Pick the kind of thing you're going to make. You can't change this later."
        />
      </>
    );
  }

  // ─── Phase 3: Brief Card (completed)
  if (brief.completed_at) {
    return (
      <BriefCard
        archetype={archetype}
        brief={brief}
        onReopen={async () => {
          await save({ reopen: true });
          setCurrentSlotIdx(0);
        }}
        reopening={saving}
      />
    );
  }

  // ─── Phase 2: Walker
  const slotDef = archetype.slots[currentSlotIdx];
  const slotKey = SLOT_KEYS[currentSlotIdx];
  const currentAnswer = brief[slotKey];

  return (
    <>
      {fromChoiceCard && (
        <FromChoiceCardBanner cardLabel={fromChoiceCard.label} appliedArchetype />
      )}
      <SlotWalker
        headerLabel={`${archetype.emoji} ${archetype.label} · Question ${currentSlotIdx + 1} of ${TOTAL_SLOTS}`}
        totalSlots={TOTAL_SLOTS}
        slotDef={slotDef}
        slotIndex={currentSlotIdx}
        currentAnswer={currentAnswer}
        saving={saving}
        onSave={async (answer) => {
          await save({ [slotKey]: answer } as Partial<BriefState>);
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
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Phase 3 — Brief Card (read-only summary)
// ────────────────────────────────────────────────────────────────────

function BriefCard({
  archetype,
  brief,
  onReopen,
  reopening,
}: {
  archetype: ProductBriefArchetype;
  brief: BriefState;
  onReopen: () => void;
  reopening: boolean;
}) {
  return (
    <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-white to-purple-50/50 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-purple-200">
        <span className="text-4xl">🧰</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
            Product Brief
          </p>
          <h3 className="text-xl font-bold text-purple-900">
            {archetype.emoji} {archetype.label}
          </h3>
        </div>
      </div>

      <div className="space-y-3">
        {archetype.slots.map((slotDef, i) => {
          const answer = brief[SLOT_KEYS[i]];
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

      <div className="mt-5 flex items-center justify-end gap-3 text-xs">
        <span className="text-purple-700/70">
          ✓ Saved — brief locked in. Move on to the next activity.
        </span>
        <button
          type="button"
          onClick={onReopen}
          disabled={reopening}
          className="text-purple-700 underline hover:text-purple-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reopening ? "Reopening…" : "Reopen to revise"}
        </button>
      </div>
    </div>
  );
}
