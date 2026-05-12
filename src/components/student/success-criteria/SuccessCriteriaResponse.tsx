"use client";

/**
 * SuccessCriteriaResponse — v2 Success Criteria lesson-page activity.
 *
 * UNIVERSAL — no archetype picker. Two phases:
 *   1. Walker  — Q1-Q5 covering observable signal + measurement +
 *                test setup + failure mode + iteration trigger.
 *   2. Card    — read-only summary.
 *
 * State lives in student_unit_success_criteria. Loads via GET
 * /api/student/success-criteria; saves via POST partial-patch upsert.
 *
 * See docs/projects/project-spec-v2-split-brief.md §4 (🎯 Success Criteria).
 */

import { useCallback, useEffect, useState } from "react";
import type { SlotAnswer } from "@/lib/project-spec/archetypes";
import { buildSummary, formatAnswer } from "@/lib/project-spec/format";
import { SUCCESS_CRITERIA_SLOTS } from "@/lib/project-spec/success-criteria";
import { SlotWalker } from "@/components/student/project-spec/shared/SlotWalker";
import { useSpecBridge } from "@/components/student/project-spec/shared/useSpecBridge";

interface CriteriaState {
  slot_1: SlotAnswer | null;
  slot_2: SlotAnswer | null;
  slot_3: SlotAnswer | null;
  slot_4: SlotAnswer | null;
  slot_5: SlotAnswer | null;
  completed_at: string | null;
}

type SlotKey = "slot_1" | "slot_2" | "slot_3" | "slot_4" | "slot_5";

const SLOT_KEYS: SlotKey[] = ["slot_1", "slot_2", "slot_3", "slot_4", "slot_5"];

const TOTAL_SLOTS = 5;

function emptyCriteria(): CriteriaState {
  return {
    slot_1: null,
    slot_2: null,
    slot_3: null,
    slot_4: null,
    slot_5: null,
    completed_at: null,
  };
}

interface Props {
  unitId: string;
  sectionIndex: number;
  onChange?: (value: string) => void;
}

export default function SuccessCriteriaResponse({ unitId, onChange }: Props) {
  const [criteria, setCriteria] = useState<CriteriaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0);

  useSpecBridge(criteria, onChange, (s) =>
    buildSummary(
      "Success Criteria",
      SUCCESS_CRITERIA_SLOTS.map((slotDef, i) => ({
        slotDef,
        answer: s[SLOT_KEYS[i]],
      })),
      s.completed_at,
    ),
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/student/success-criteria?unitId=${encodeURIComponent(unitId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`Load failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setCriteria(data.criteria ?? emptyCriteria());
        if (data.criteria && !data.criteria.completed_at) {
          const firstIncomplete = SLOT_KEYS.findIndex(
            (k) => !data.criteria[k],
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

  const save = useCallback(
    async (patch: Partial<CriteriaState> & { completed?: boolean; reopen?: boolean }) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/student/success-criteria", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId, ...patch }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        const data = await res.json();
        setCriteria(data.criteria);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [unitId],
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-6 text-center text-sm text-purple-700">
        Loading your success criteria…
      </div>
    );
  }
  if (error || !criteria) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Something went wrong loading your success criteria. {error ?? ""}
      </div>
    );
  }

  if (criteria.completed_at) {
    return (
      <CriteriaCard
        criteria={criteria}
        onReopen={async () => {
          await save({ reopen: true });
          setCurrentSlotIdx(0);
        }}
        reopening={saving}
      />
    );
  }

  const slotDef = SUCCESS_CRITERIA_SLOTS[currentSlotIdx];
  const slotKey = SLOT_KEYS[currentSlotIdx];
  const currentAnswer = criteria[slotKey];

  return (
    <SlotWalker
      headerLabel={`🎯 Success Criteria · Question ${currentSlotIdx + 1} of ${TOTAL_SLOTS}`}
      totalSlots={TOTAL_SLOTS}
      slotDef={slotDef}
      slotIndex={currentSlotIdx}
      currentAnswer={currentAnswer}
      saving={saving}
      onSave={async (answer) => {
        await save({ [slotKey]: answer } as Partial<CriteriaState>);
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

function CriteriaCard({
  criteria,
  onReopen,
  reopening,
}: {
  criteria: CriteriaState;
  onReopen: () => void;
  reopening: boolean;
}) {
  return (
    <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-white to-purple-50/50 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-purple-200">
        <span className="text-4xl">🎯</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
            Success Criteria
          </p>
          <h3 className="text-xl font-bold text-purple-900">
            How you&apos;ll know it worked
          </h3>
        </div>
      </div>

      <div className="space-y-3">
        {SUCCESS_CRITERIA_SLOTS.map((slotDef, i) => {
          const answer = criteria[SLOT_KEYS[i]];
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
          ✓ Saved — criteria locked in. Now you can build with confidence.
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
