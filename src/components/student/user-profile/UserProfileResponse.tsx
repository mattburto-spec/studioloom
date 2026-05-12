"use client";

/**
 * UserProfileResponse — v2 User Profile lesson-page activity.
 *
 * UNIVERSAL — no archetype picker. Two phases:
 *   1. Walker  — Q1-Q8 covering name + age + context + problem +
 *                alternatives + unique value + optional photo +
 *                optional quote.
 *   2. Card    — read-only summary.
 *
 * State lives in student_unit_user_profiles. Loads via GET
 * /api/student/user-profile; saves via POST partial-patch upsert.
 * Slot 7 image uploads go to the dedicated user-profile-photos bucket
 * via /api/student/user-profile/upload-photo.
 *
 * See docs/projects/project-spec-v2-split-brief.md §4 (👤 User Profile).
 */

import { useCallback, useEffect, useState } from "react";
import type { SlotAnswer } from "@/lib/project-spec/archetypes";
import { buildSummary, formatAnswer } from "@/lib/project-spec/format";
import { USER_PROFILE_SLOTS } from "@/lib/project-spec/user-profile";
import { SlotWalker } from "@/components/student/project-spec/shared/SlotWalker";
import { useSpecBridge } from "@/components/student/project-spec/shared/useSpecBridge";
import FromChoiceCardBanner from "@/components/student/choice-cards/FromChoiceCardBanner";

interface ProfileState {
  slot_1: SlotAnswer | null;
  slot_2: SlotAnswer | null;
  slot_3: SlotAnswer | null;
  slot_4: SlotAnswer | null;
  slot_5: SlotAnswer | null;
  slot_6: SlotAnswer | null;
  slot_7: SlotAnswer | null;
  slot_8: SlotAnswer | null;
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
  | "slot_8";

const SLOT_KEYS: SlotKey[] = [
  "slot_1",
  "slot_2",
  "slot_3",
  "slot_4",
  "slot_5",
  "slot_6",
  "slot_7",
  "slot_8",
];

const TOTAL_SLOTS = 8;

function emptyProfile(): ProfileState {
  return {
    slot_1: null,
    slot_2: null,
    slot_3: null,
    slot_4: null,
    slot_5: null,
    slot_6: null,
    slot_7: null,
    slot_8: null,
    completed_at: null,
  };
}

interface Props {
  unitId: string;
  sectionIndex: number;
  onChange?: (value: string) => void;
}

export default function UserProfileResponse({ unitId, onChange }: Props) {
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0);
  const [fromChoiceCard, setFromChoiceCard] = useState<{ cardId: string; label: string } | null>(
    null,
  );

  useSpecBridge(profile, onChange, (s) =>
    buildSummary(
      "User Profile",
      USER_PROFILE_SLOTS.map((slotDef, i) => ({
        slotDef,
        answer: s[SLOT_KEYS[i]],
      })),
      s.completed_at,
    ),
  );

  // Load on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/student/user-profile?unitId=${encodeURIComponent(unitId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`Load failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setProfile(data.profile ?? emptyProfile());
        setFromChoiceCard(data.from_choice_card ?? null);
        if (data.profile && !data.profile.completed_at) {
          const firstIncomplete = SLOT_KEYS.findIndex(
            (k) => !data.profile[k],
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
    async (patch: Partial<ProfileState> & { completed?: boolean; reopen?: boolean }) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/student/user-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId, ...patch }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        const data = await res.json();
        setProfile(data.profile);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [unitId],
  );

  // Image upload — POSTs to dedicated upload route, returns proxy URL.
  const handleUploadImage = useCallback(
    async (file: File): Promise<{ url: string }> => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("unitId", unitId);
      const res = await fetch("/api/student/user-profile/upload-photo", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Upload failed: ${res.status}`);
      }
      const data = await res.json();
      return { url: data.url };
    },
    [unitId],
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-6 text-center text-sm text-purple-700">
        Loading your user profile…
      </div>
    );
  }
  if (error || !profile) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Something went wrong loading your user profile. {error ?? ""}
      </div>
    );
  }

  // ─── Completed → Card
  if (profile.completed_at) {
    return (
      <ProfileCard
        profile={profile}
        onReopen={async () => {
          await save({ reopen: true });
          setCurrentSlotIdx(0);
        }}
        reopening={saving}
      />
    );
  }

  // ─── Walker
  const slotDef = USER_PROFILE_SLOTS[currentSlotIdx];
  const slotKey = SLOT_KEYS[currentSlotIdx];
  const currentAnswer = profile[slotKey];

  return (
    <>
      {fromChoiceCard && <FromChoiceCardBanner cardLabel={fromChoiceCard.label} />}
      <SlotWalker
        headerLabel={`👤 User Profile · Question ${currentSlotIdx + 1} of ${TOTAL_SLOTS}`}
      totalSlots={TOTAL_SLOTS}
      slotDef={slotDef}
      slotIndex={currentSlotIdx}
      currentAnswer={currentAnswer}
      saving={saving}
      onSave={async (answer) => {
        await save({ [slotKey]: answer } as Partial<ProfileState>);
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
        onUploadImage={handleUploadImage}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Card
// ────────────────────────────────────────────────────────────────────

function ProfileCard({
  profile,
  onReopen,
  reopening,
}: {
  profile: ProfileState;
  onReopen: () => void;
  reopening: boolean;
}) {
  return (
    <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-white to-purple-50/50 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-purple-200">
        <span className="text-4xl">👤</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
            User Profile
          </p>
          <h3 className="text-xl font-bold text-purple-900">
            Who you&apos;re designing for
          </h3>
        </div>
      </div>

      <div className="space-y-3">
        {USER_PROFILE_SLOTS.map((slotDef, i) => {
          const answer = profile[SLOT_KEYS[i]];
          const isImage =
            slotDef.input.kind === "image-upload" &&
            answer?.value?.kind === "image";
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
              ) : isImage && answer.value?.kind === "image" ? (
                <div className="flex gap-3 items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={answer.value.url}
                    alt={answer.value.alt ?? "User photo"}
                    className="w-24 h-24 object-cover rounded border border-gray-200"
                  />
                  {answer.value.alt && (
                    <p className="text-sm text-gray-700 italic">
                      &ldquo;{answer.value.alt}&rdquo;
                    </p>
                  )}
                </div>
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
          ✓ Saved — profile locked in. Move on to the next activity.
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
