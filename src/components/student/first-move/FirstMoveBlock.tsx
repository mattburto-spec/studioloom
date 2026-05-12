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
// Posts /api/student/first-move/[activityId]/commit on Start →:
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
        `/api/student/first-move/${encodeURIComponent(activityId)}/commit`,
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

  return (
    <div className="space-y-3 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 p-4 shadow-sm">
      {/* 1. Hero scrim */}
      {config.showDesignPhilosophy && (
        <div className="rounded-lg bg-white/70 px-3 py-2 ring-1 ring-amber-200/60">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
            Your design philosophy
          </div>
          <div className="mt-0.5 text-sm leading-snug text-zinc-800">
            {payload.designPhilosophy ?? (
              <span className="italic text-zinc-500">
                Not yet set — visit your Class 1 Strategy Canvas to write
                one. (You can still pick today&apos;s move below.)
              </span>
            )}
          </div>
        </div>
      )}

      {/* 2. Where you left off */}
      {config.showWhereLeftOff &&
        (payload.lastJournalNext || payload.lastDoneCard) && (
          <div className="rounded-lg bg-white/70 px-3 py-2 ring-1 ring-amber-200/60">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
              Where you left off
            </div>
            {payload.lastJournalNext && (
              <div className="mt-1 text-sm text-zinc-800">
                <span className="text-zinc-500">Last NEXT prompt</span>
                {payload.lastJournalUpdatedAt && (
                  <span className="text-[10.5px] text-zinc-400">
                    {" "}
                    · {relativeTime(payload.lastJournalUpdatedAt)}
                  </span>
                )}
                <div className="mt-0.5 italic">
                  &ldquo;{payload.lastJournalNext}&rdquo;
                </div>
              </div>
            )}
            {payload.lastDoneCard && (
              <div className="mt-1.5 text-[12px] text-zinc-700">
                <span className="text-zinc-500">Last completed:</span>{" "}
                🟢 {payload.lastDoneCard.title}
              </div>
            )}
          </div>
        )}

      {/* 3. Today's options — this_class cards */}
      <div>
        <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
          Today&apos;s options ({payload.thisClassCards.length})
        </div>
        {payload.thisClassCards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-3 text-[12px] text-zinc-600">
            Your &ldquo;This Class&rdquo; lane is empty. Open your Kanban,
            promote a card from Backlog, then come back. (You can still
            write today&apos;s commitment below without picking one.)
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {payload.thisClassCards.map((card) => {
              const selected = chosenCardId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setChosenCardId(selected ? null : card.id)}
                  className={`group inline-flex max-w-full items-start gap-2 rounded-full border px-3 py-1.5 text-left text-[12px] transition ${
                    selected
                      ? "border-amber-600 bg-amber-600 text-white shadow"
                      : "border-amber-300 bg-white text-zinc-800 hover:border-amber-500 hover:bg-amber-50"
                  }`}
                >
                  <span aria-hidden>{selected ? "●" : "○"}</span>
                  <span className="truncate">{card.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Today I will… commitment */}
      <div>
        <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
          Today I will…
        </label>
        <input
          type="text"
          value={commitment}
          onChange={(e) => updateCommitment(e.target.value)}
          placeholder="One sentence. Verbs, not adjectives."
          maxLength={200}
          className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        <div className="mt-1 flex items-center justify-between text-[10.5px] text-zinc-500">
          <span>
            {wordCount(commitment)} / {config.minCommitmentWords} words min
          </span>
          <span>{commitment.length} / 200 chars</span>
        </div>
      </div>

      {commitError && (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          ⚠ {commitError}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-[11px] text-zinc-500">
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
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            canStart
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "cursor-not-allowed bg-zinc-200 text-zinc-500"
          }`}
        >
          {committing ? "Saving…" : "Start studio →"}
        </button>
      </div>
    </div>
  );
}
