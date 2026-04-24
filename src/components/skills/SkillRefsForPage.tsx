"use client";

/**
 * SkillRefsForPage — student-facing inline panel that surfaces skill
 * cards pinned to the unit page they're currently viewing.
 *
 * Renders nothing when there are no pins (noise-free default). Renders
 * a compact horizontal strip of skill card chips when pins exist, each
 * linking to the card viewer with its current state chip.
 *
 * Mounted on /unit/[unitId]/[pageId] near the top of the page content.
 * Data comes from GET /api/student/unit-pages/[pageId]/skill-refs.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { SKILL_TIER_LABELS, type CardType, type SkillTier } from "@/types/skills";

interface PinnedCard {
  card: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    tier: SkillTier | null;
    domain_id: string | null;
    estimated_min: number | null;
    card_type: CardType;
  };
  ref: {
    id: string;
    gate_level: string;
    display_order: number;
  };
  state: {
    state: "untouched" | "viewed" | "quiz_passed" | "demonstrated" | "applied";
    freshness: "fresh" | "cooling" | "stale" | null;
    last_passed_at: string | null;
  };
}

const STATE_CHIP_LABELS: Record<PinnedCard["state"]["state"], string> = {
  untouched: "New",
  viewed: "Started",
  quiz_passed: "Quiz passed",
  demonstrated: "Demonstrated",
  applied: "Applied",
};
const STATE_CHIP_CLS: Record<PinnedCard["state"]["state"], string> = {
  untouched: "bg-gray-100 text-gray-600",
  viewed: "bg-sky-100 text-sky-700",
  quiz_passed: "bg-indigo-100 text-indigo-700",
  demonstrated: "bg-violet-100 text-violet-700",
  applied: "bg-emerald-100 text-emerald-700",
};
const TIER_CHIP_CLS: Record<SkillTier, string> = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-100 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
};

export function SkillRefsForPage({ pageId }: { pageId: string }) {
  const [cards, setCards] = useState<PinnedCard[] | null>(null);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/student/unit-pages/${encodeURIComponent(pageId)}/skill-refs`,
          { credentials: "include" }
        );
        if (abort) return;
        if (!res.ok) {
          setCards([]);
          return;
        }
        const json = await res.json();
        setCards(json.cards ?? []);
      } catch {
        if (abort) return;
        setCards([]);
      }
    })();
    return () => {
      abort = true;
    };
  }, [pageId]);

  // Hide entirely when loading or empty — zero visual noise if nothing's pinned.
  if (cards === null || cards.length === 0) return null;

  return (
    <section
      className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"
      aria-label="Skills for this lesson"
    >
      <div className="flex items-center gap-2 mb-3">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-indigo-700"
        >
          <path d="M12 2l2.5 6 6.5.5-5 4.5 1.5 6.5L12 16l-5.5 3.5L8 13l-5-4.5 6.5-.5L12 2z" />
        </svg>
        <h3 className="text-sm font-bold text-indigo-900 tracking-wide uppercase">
          Skills for this lesson
        </h3>
        <span className="text-xs text-indigo-700/80 ml-auto">
          {cards.length} card{cards.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cards.map((c) => (
          <li key={c.ref.id}>
            <Link
              href={`/skills/cards/${c.card.slug}`}
              className="block bg-white border border-indigo-100 rounded-xl p-3 hover:border-indigo-300 hover:shadow-sm transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900 leading-tight flex-1 min-w-0">
                  {c.card.title}
                </span>
                {c.card.tier && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${TIER_CHIP_CLS[c.card.tier]}`}
                  >
                    {SKILL_TIER_LABELS[c.card.tier]}
                  </span>
                )}
              </div>
              {c.card.summary && (
                <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                  {c.card.summary}
                </p>
              )}
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span
                  className={`font-medium px-2 py-0.5 rounded-full ${STATE_CHIP_CLS[c.state.state]}`}
                >
                  {STATE_CHIP_LABELS[c.state.state]}
                </span>
                <div className="flex items-center gap-2 text-gray-500">
                  {c.card.card_type === "routine" && (
                    <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">
                      Routine
                    </span>
                  )}
                  {c.card.estimated_min && (
                    <span>~{c.card.estimated_min}m</span>
                  )}
                  {c.state.freshness && c.state.freshness !== "fresh" && (
                    <span className="text-amber-600 font-medium">
                      {c.state.freshness === "cooling" ? "Cooling" : "Stale"}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
