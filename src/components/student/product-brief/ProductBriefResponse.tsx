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

type PitchStatus = "pending" | "approved" | "revise" | "rejected" | null;

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
  pitch_text?: string | null;
  pitch_status?: PitchStatus;
  pitch_teacher_note?: string | null;
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
    async (
      patch: Partial<BriefState> & {
        completed?: boolean;
        reopen?: boolean;
        pitch_text?: string | null;
      },
    ) => {
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

  // ─── Phase 1.5: Pitch gate (Other archetype only)
  // Students who picked "Other / Pitch your own" must submit a pitch
  // and get teacher approval before the slot walker unlocks. See
  // FU-PLATFORM-CUSTOM-PROJECT-PITCH (MVP shipped 12 May 2026).
  if (archetype.id === "other") {
    const status = brief.pitch_status ?? null;
    if (status !== "approved") {
      return (
        <PitchGate
          archetype={archetype}
          currentPitch={brief.pitch_text ?? ""}
          status={status}
          teacherNote={brief.pitch_teacher_note ?? null}
          onSubmit={async (pitchText) => {
            await save({ pitch_text: pitchText });
          }}
          onRedoArchetype={async () => {
            await save({ archetype_id: null, pitch_text: null });
            setCurrentSlotIdx(0);
          }}
          submitting={saving}
        />
      );
    }
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

// ────────────────────────────────────────────────────────────────────
// Pitch Gate — appears when archetype="other" and pitch_status != approved
// ────────────────────────────────────────────────────────────────────

function PitchGate({
  archetype,
  currentPitch,
  status,
  teacherNote,
  onSubmit,
  onRedoArchetype,
  submitting,
}: {
  archetype: ProductBriefArchetype;
  currentPitch: string;
  status: PitchStatus;
  teacherNote: string | null;
  onSubmit: (pitchText: string) => Promise<void>;
  onRedoArchetype: () => Promise<void>;
  submitting: boolean;
}) {
  const [draft, setDraft] = useState(currentPitch);

  // Re-sync draft when the persisted pitch changes (e.g. after teacher
  // requests revision and the student wants to edit their existing one).
  useEffect(() => {
    setDraft(currentPitch);
  }, [currentPitch]);

  const isLocked = status === "pending";
  const isApprovedWaiting = status === "approved";

  // Status banner
  const statusBanner = (() => {
    if (status === null) return null;
    if (status === "pending") {
      return (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 mb-4 text-sm text-amber-900">
          <strong>Submitted — waiting for your teacher.</strong> They&apos;ll
          approve, request a revision, or redirect you to a preset
          archetype. The brief slots will unlock once approved.
        </div>
      );
    }
    if (status === "revise") {
      return (
        <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-3 mb-4 text-sm text-orange-900">
          <strong>Your teacher wants a revision.</strong>
          {teacherNote ? (
            <div className="mt-2 italic">&ldquo;{teacherNote}&rdquo;</div>
          ) : null}
          <div className="mt-1">Edit your pitch below and resubmit.</div>
        </div>
      );
    }
    if (status === "rejected") {
      return (
        <div className="rounded-lg border-2 border-rose-300 bg-rose-50 p-3 mb-4 text-sm text-rose-900">
          <strong>Pitch declined.</strong>
          {teacherNote ? (
            <div className="mt-2 italic">&ldquo;{teacherNote}&rdquo;</div>
          ) : null}
          <div className="mt-1">
            <button
              type="button"
              onClick={onRedoArchetype}
              className="underline hover:text-rose-700"
            >
              ← Go back and pick a preset archetype
            </button>
          </div>
        </div>
      );
    }
    if (isApprovedWaiting) {
      // Shouldn't render — PitchGate isn't shown when approved. Defensive.
      return null;
    }
    return null;
  })();

  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-purple-50/40 to-white p-6">
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-purple-600">
          {archetype.emoji} {archetype.label} · Pitch your idea
        </span>
        <button
          type="button"
          onClick={onRedoArchetype}
          disabled={submitting || isLocked}
          className="text-xs text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-50"
        >
          ← Pick a preset archetype instead
        </button>
      </div>

      {statusBanner}

      <h3 className="text-xl font-semibold text-gray-900 mb-1">
        What&apos;s your project idea?
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Write a short pitch (1–3 paragraphs). Cover: what you want to make,
        who it&apos;s for, why it matters to you, and why none of the
        preset archetypes fit. Your teacher will read this and approve,
        ask for revisions, or redirect you to a preset.
      </p>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="My idea is…"
        rows={8}
        disabled={isLocked || submitting}
        maxLength={2000}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
      />
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-gray-500">{draft.length} / 2000 characters</span>
        <button
          type="button"
          onClick={async () => {
            const trimmed = draft.trim();
            if (trimmed.length < 20) return;
            await onSubmit(trimmed);
          }}
          disabled={submitting || isLocked || draft.trim().length < 20}
          className="px-5 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Submitting…"
            : status === "revise"
              ? "Resubmit pitch"
              : "Submit pitch for review"}
        </button>
      </div>
      {draft.trim().length > 0 && draft.trim().length < 20 && (
        <p className="text-xs text-amber-700 mt-1">
          Write at least a sentence — your teacher needs enough to decide.
        </p>
      )}
    </div>
  );
}
