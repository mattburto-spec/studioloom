"use client";

// First Move — studio-open orientation block.
//
// 4-section card:
//   1. Hero scrim: design philosophy (from Class 1 Strategy Canvas).
//   2. Where you left off: last journal NEXT + last completed kanban card.
//   3. Today's options: this_class kanban cards (tap one to pick).
//   4. Today I will… commitment field + Start studio → button.
//
// Fetches /api/student/first-move/[unitId] on mount (single round-trip).
// Posts /api/student/first-move/commit/[activityId] on Start →:
//   - Moves the chosen card to "doing" (demoting any current Doing
//     card back to this_class so WIP=1 holds).
//   - Logs a first-move.committed learning_event.
//   - Sets local "committed" state so the block collapses into a
//     ✓ confirmation strip.
//
// onChange pushes the commitment string into student_progress.responses
// so the marking page tile-detects a non-empty response.

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { FirstMoveConfig } from "@/components/teacher/lesson-editor/BlockPalette.types";
import type { KanbanCard } from "@/lib/unit-tools/kanban/types";

interface Payload {
  designPhilosophy: string | null;
  lastJournalNext: string | null;
  lastJournalUpdatedAt: string | null;
  thisClassCards: KanbanCard[];
  lastDoneCard: { id: string; title: string; doneAt: string | null } | null;
}

interface Props {
  activityId: string;
  config: FirstMoveConfig;
  unitId: string;
  value: string;
  onChange: (value: string) => void;
}

function wordCount(s: string): number {
  return s.trim().length === 0 ? 0 : s.trim().split(/\s+/).length;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export default function FirstMoveBlock({
  activityId,
  config,
  unitId,
  value,
  onChange,
}: Props) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<string>(() => value || "");
  const [chosenCardId, setChosenCardId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Fetch consolidated payload on mount.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/student/first-move/${encodeURIComponent(unitId)}`,
          { credentials: "same-origin", cache: "no-store" },
        );
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const data = (await res.json()) as Payload;
        if (!cancelled) setPayload(data);
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "Failed to load");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const updateCommitment = useCallback(
    (next: string) => {
      setCommitment(next);
      onChange(next);
    },
    [onChange],
  );

  const canStart = useMemo(() => {
    const wc = wordCount(commitment);
    if (wc < config.minCommitmentWords) return false;
    if (config.requireCardChoice && !chosenCardId) return false;
    return true;
  }, [commitment, chosenCardId, config]);

  async function handleStart() {
    if (!canStart || committing) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch(
        `/api/student/first-move/commit/${encodeURIComponent(activityId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            unitId,
            commitment: commitment.trim(),
            chosenCardId,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `Commit failed (${res.status})`,
        );
      }
      setCommitted(true);
    } catch (e) {
      setCommitError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setCommitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Couldn&apos;t load your studio context: {loadError}
      </div>
    );
  }

  if (payload === null) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
        Pulling up where you left off…
      </div>
    );
  }

  // Committed state — collapsed confirmation strip.
  if (committed) {
    const chosen = payload.thisClassCards.find((c) => c.id === chosenCardId);
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">✓</span>
          <div className="flex-1">
            <div className="text-sm font-bold text-emerald-900">
              Studio open. Today you said:
            </div>
            <div className="mt-0.5 text-sm italic text-emerald-800">
              &ldquo;{commitment}&rdquo;
            </div>
            {chosen && (
              <div className="mt-1 text-[11px] text-emerald-700">
                🃁 Moved to Doing: <strong>{chosen.title}</strong>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCommitted(false)}
            className="text-[11px] font-semibold text-emerald-700 hover:underline"
          >
            Edit
          </button>
        </div>
      </motion.div>
    );
  }

  // Shared label style — consistent across all four sections so the
  // composition reads as one card, not four boxes-in-a-box. Bumped to
  // 11.5px after Matt's smoke — 10.5px was too tight to scan in class.
  const LabelClass =
    "text-[11.5px] font-bold uppercase tracking-[0.08em] text-amber-700";

  const showPhilosophySection = config.showDesignPhilosophy;
  const showWhereLeftOffSection =
    config.showWhereLeftOff && (payload.lastJournalNext || payload.lastDoneCard);

  return (
    <div className="rounded-2xl border border-amber-200 bg-white shadow-sm">
      {/* Header strip — single visual anchor so the block has an
          identity without shouting. */}
      <div className="flex items-center gap-3 rounded-t-2xl border-b border-amber-100 bg-amber-50/60 px-6 py-3.5">
        <span className="text-xl" aria-hidden>
          ⚡
        </span>
        <div className="flex-1 leading-snug">
          <div className="text-[17px] font-bold text-amber-900">
            Today&apos;s first move
          </div>
          <div className="mt-0.5 text-[13.5px] text-amber-700/85">
            Five minutes before you dive in. Glance back, pick one card,
            name what you&apos;ll do.
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        {/* 1. Design philosophy */}
        {showPhilosophySection && (
          <div>
            <div className={LabelClass}>Your design philosophy</div>
            <div className="mt-1.5 text-[16px] leading-relaxed text-zinc-800">
              {payload.designPhilosophy ?? (
                <span className="italic text-zinc-500">
                  Not yet set — visit your Class 1 Strategy Canvas to write
                  one. You can still pick today&apos;s move below.
                </span>
              )}
            </div>
          </div>
        )}

        {/* 2. Where you left off — only renders when there's content + a
            hairline separator above if the previous section showed. */}
        {showWhereLeftOffSection && (
          <div
            className={showPhilosophySection ? "border-t border-amber-100 pt-5" : ""}
          >
            <div className={LabelClass}>Where you left off</div>
            {payload.lastJournalNext && (
              <div className="mt-1.5 text-[16px] leading-relaxed text-zinc-800">
                <span className="italic">
                  &ldquo;{payload.lastJournalNext}&rdquo;
                </span>
                {payload.lastJournalUpdatedAt && (
                  <span className="ml-2 text-[12.5px] text-zinc-500">
                    last NEXT · {relativeTime(payload.lastJournalUpdatedAt)}
                  </span>
                )}
              </div>
            )}
            {payload.lastDoneCard && (
              <div className="mt-2 text-[14px] text-zinc-700">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                    aria-hidden
                  />
                  Last completed:{" "}
                  <span className="font-medium">
                    {payload.lastDoneCard.title}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* 3. Today's options — this_class cards */}
        <div
          className={
            showPhilosophySection || showWhereLeftOffSection
              ? "border-t border-amber-100 pt-5"
              : ""
          }
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className={LabelClass}>Today&apos;s options</div>
            <span className="text-[12.5px] text-zinc-500">
              {payload.thisClassCards.length} in &ldquo;This Class&rdquo;
            </span>
          </div>
          {payload.thisClassCards.length === 0 ? (
            <div className="mt-2.5 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-3.5 py-2.5 text-[14px] text-zinc-600">
              Your &ldquo;This Class&rdquo; lane is empty. Open your Kanban,
              promote a card from Backlog, then come back.
            </div>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {payload.thisClassCards.map((card) => {
                const selected = chosenCardId === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setChosenCardId(selected ? null : card.id)}
                    aria-pressed={selected}
                    className={`inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-2 text-[15px] transition ${
                      selected
                        ? "border-amber-600 bg-amber-600 text-white shadow-sm"
                        : "border-zinc-300 bg-white text-zinc-800 hover:border-amber-400 hover:bg-amber-50"
                    }`}
                  >
                    <span aria-hidden className="text-[13px]">
                      {selected ? "✓" : "○"}
                    </span>
                    <span className="truncate">{card.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Today I will… commitment — the hero input. */}
        <div className="border-t border-amber-100 pt-5">
          <label className={LabelClass} htmlFor="first-move-commitment">
            Today I will…
          </label>
          <input
            id="first-move-commitment"
            type="text"
            value={commitment}
            onChange={(e) => updateCommitment(e.target.value)}
            placeholder="One sentence. Verbs, not adjectives."
            maxLength={200}
            className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-4 py-3 text-[17px] text-zinc-900 placeholder:text-zinc-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <div className="mt-1.5 flex items-center justify-between text-[12.5px] text-zinc-500">
            <span>
              {wordCount(commitment)} / {config.minCommitmentWords} words min
            </span>
            <span>{commitment.length} / 200</span>
          </div>
        </div>

        {commitError && (
          <div className="rounded border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
            ⚠ {commitError}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-[13px] text-zinc-500">
            {config.requireCardChoice && !chosenCardId
              ? "Pick a card above to enable Start."
              : !canStart
                ? `Need ${config.minCommitmentWords}+ words.`
                : "Ready when you are."}
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart || committing}
            className={`rounded-full px-6 py-2.5 text-[15px] font-bold transition ${
              canStart
                ? "bg-amber-600 text-white shadow-sm hover:bg-amber-700"
                : "cursor-not-allowed bg-zinc-200 text-zinc-500"
            }`}
          >
            {committing ? "Saving…" : "Start studio →"}
          </button>
        </div>
      </div>
    </div>
  );
}
