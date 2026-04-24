"use client";

/**
 * LessonSkillsPanel — pins skill cards to the currently-edited lesson page.
 *
 * Lives in the lesson editor (not on the skill card edit page). Teacher's
 * mental model: "what skills does this lesson need?" is a lesson-authoring
 * question, not a skill-authoring one.
 *
 * UI shape (compact inline — slots above the phase sections):
 *   [icon] Skills for this lesson · N pinned      [+ Pin a skill]
 *   pills: [DM-S1 Ideation sketching  ×]  [DM-G1 3D Printing  ×]
 *
 * Picker: search the teacher's accessible cards by title (server-side
 * list + client-side filter — cards are ~60 items max per teacher, no
 * need for a dedicated search endpoint).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { SKILL_TIER_LABELS, type CardType, type SkillTier } from "@/types/skills";

interface RefRow {
  id: string;
  subject_label: string | null;
  gate_level: string;
  display_order: number;
  created_at: string;
}

interface CardSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tier: SkillTier | null;
  domain_id: string | null;
  estimated_min: number | null;
  card_type: CardType;
  is_published: boolean;
  is_built_in: boolean;
}

interface PinnedRow {
  ref: RefRow;
  card: CardSummary | null;
}

interface CardListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tier: SkillTier | null;
  domain_id: string | null;
  card_type: CardType;
  is_built_in: boolean;
  is_published: boolean;
  author_name: string | null;
}

interface Props {
  pageId: string;
  /** Optional — denormalised "Unit X · Lesson Y" label stored on each
   *  new pin so the skill card's "Used in" view (eventually) shows
   *  something human-readable. */
  subjectLabel?: string;
}

const TIER_CHIP_CLS: Record<SkillTier, string> = {
  bronze: "bg-amber-100 text-amber-800 border-amber-200",
  silver: "bg-slate-100 text-slate-700 border-slate-200",
  gold: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

export function LessonSkillsPanel({ pageId, subjectLabel }: Props) {
  const [refs, setRefs] = useState<PinnedRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerCards, setPickerCards] = useState<CardListItem[] | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [busyRemoveRefId, setBusyRemoveRefId] = useState<string | null>(null);

  const loadRefs = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/teacher/unit-pages/${encodeURIComponent(pageId)}/skill-refs`,
        { credentials: "include" }
      );
      if (!res.ok) {
        setLoadError("Failed to load pinned skills.");
        setRefs([]);
        return;
      }
      const json = await res.json();
      setRefs((json.refs ?? []) as PinnedRow[]);
      setLoadError(null);
    } catch {
      setLoadError("Network error.");
      setRefs([]);
    }
  }, [pageId]);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  async function openPicker() {
    setShowPicker(true);
    setPickerQuery("");
    if (pickerCards !== null) return; // already loaded
    try {
      const res = await fetch("/api/teacher/skills/cards?ownership=all", {
        credentials: "include",
      });
      if (!res.ok) {
        setPickerCards([]);
        return;
      }
      const json = await res.json();
      // Only published cards (including built-ins) are pin-able — a draft
      // card pinned to a lesson would render nothing on student side.
      const cards = (json.cards ?? []).filter(
        (c: CardListItem) => c.is_published || c.is_built_in
      );
      setPickerCards(cards);
    } catch {
      setPickerCards([]);
    }
  }

  const alreadyPinnedIds = useMemo(
    () => new Set((refs ?? []).map((r) => r.card?.id).filter(Boolean) as string[]),
    [refs]
  );

  const filteredPickerCards = useMemo(() => {
    if (!pickerCards) return [];
    const q = pickerQuery.trim().toLowerCase();
    const base = q
      ? pickerCards.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            (c.summary ?? "").toLowerCase().includes(q)
        )
      : pickerCards;
    return base.slice(0, 40);
  }, [pickerCards, pickerQuery]);

  async function pin(card: CardListItem) {
    setBusyCardId(card.id);
    try {
      const res = await fetch(
        `/api/teacher/unit-pages/${encodeURIComponent(pageId)}/skill-refs`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skill_card_id: card.id,
            subject_label: subjectLabel ?? null,
          }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to pin card.");
        return;
      }
      await loadRefs();
      // Keep picker open so teacher can pin several in a row — clear query
      setPickerQuery("");
    } finally {
      setBusyCardId(null);
    }
  }

  async function remove(refId: string) {
    setBusyRemoveRefId(refId);
    try {
      const res = await fetch(
        `/api/teacher/unit-pages/${encodeURIComponent(pageId)}/skill-refs?ref_id=${encodeURIComponent(refId)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to remove pin.");
        return;
      }
      await loadRefs();
    } finally {
      setBusyRemoveRefId(null);
    }
  }

  // ==========================================================================
  // Render
  // ==========================================================================
  if (refs === null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="animate-pulse h-5 bg-gray-100 rounded w-40" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-indigo-800">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 2l2.5 6 6.5.5-5 4.5 1.5 6.5L12 16l-5.5 3.5L8 13l-5-4.5 6.5-.5L12 2z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider">
            Skills for this lesson
          </span>
          {refs.length > 0 && (
            <span className="text-xs text-indigo-700/70">· {refs.length} pinned</span>
          )}
        </div>
        <button
          type="button"
          onClick={openPicker}
          className="ml-auto text-xs font-semibold text-indigo-700 hover:text-indigo-900 px-2 py-1 rounded"
        >
          + Pin a skill
        </button>
      </div>

      {loadError && (
        <div className="mt-2 text-xs text-rose-700">{loadError}</div>
      )}

      {refs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {refs.map((r) => {
            if (!r.card) {
              return (
                <span
                  key={r.ref.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-500 italic"
                >
                  (missing card)
                  <button
                    type="button"
                    onClick={() => remove(r.ref.id)}
                    disabled={busyRemoveRefId === r.ref.id}
                    className="hover:text-rose-600"
                    aria-label="Remove broken pin"
                  >
                    ×
                  </button>
                </span>
              );
            }
            const tierCls = r.card.tier ? TIER_CHIP_CLS[r.card.tier] : "bg-white border-gray-200 text-gray-600";
            return (
              <span
                key={r.ref.id}
                className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full border text-xs font-medium ${tierCls}`}
                title={r.card.summary ?? undefined}
              >
                <span>{r.card.title}</span>
                {r.card.tier && (
                  <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">
                    {SKILL_TIER_LABELS[r.card.tier]}
                  </span>
                )}
                {!r.card.is_published && !r.card.is_built_in && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1 rounded">
                    draft
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(r.ref.id)}
                  disabled={busyRemoveRefId === r.ref.id}
                  className="w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-white/60 disabled:opacity-40"
                  aria-label={`Remove ${r.card.title}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {showPicker && (
        <div className="mt-3 bg-white border border-indigo-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search skill cards by title…"
              autoFocus
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              Close
            </button>
          </div>
          {pickerCards === null ? (
            <div className="text-sm text-gray-500 italic">Loading skills…</div>
          ) : filteredPickerCards.length === 0 ? (
            <div className="text-sm text-gray-500 italic">
              {pickerQuery
                ? "No matching skill cards."
                : "No published or built-in skill cards available yet."}
            </div>
          ) : (
            <ul className="max-h-60 overflow-auto divide-y divide-gray-100">
              {filteredPickerCards.map((c) => {
                const pinned = alreadyPinnedIds.has(c.id);
                const busy = busyCardId === c.id;
                const tierCls = c.tier ? TIER_CHIP_CLS[c.tier] : "";
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={pinned || busy}
                      onClick={() => pin(c)}
                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">
                            {c.title}
                          </span>
                          {c.tier && (
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${tierCls}`}
                            >
                              {SKILL_TIER_LABELS[c.tier]}
                            </span>
                          )}
                          {c.is_built_in && (
                            <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              built-in
                            </span>
                          )}
                        </div>
                        {c.summary && (
                          <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                            {c.summary}
                          </div>
                        )}
                      </div>
                      {pinned && (
                        <span className="text-xs text-emerald-700 font-medium flex-shrink-0">
                          Pinned
                        </span>
                      )}
                      {busy && (
                        <span className="text-xs text-gray-500 flex-shrink-0">…</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
