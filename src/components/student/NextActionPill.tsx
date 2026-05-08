"use client";

/**
 * NextActionPill — compact hero-integrated variant of NextActionCard.
 *
 * Sits inside the ResumeHero next to the "Continue" button (where the
 * "Focus" button used to live before 8 May 2026 — Matt's call: the
 * Focus button's real estate is better spent surfacing the kanban
 * Next Action).
 *
 * Reuses the same selectNextAction() pure helper as NextActionCard,
 * but renders as a single white pill button matching the Continue
 * button's shape (white bg, rounded-full, bold text). Hidden while
 * loading or on error so the hero never shows a half-loaded state.
 */

import { useEffect, useState } from "react";
import {
  loadKanbanState,
  KanbanApiError,
} from "@/lib/unit-tools/kanban/client";
import {
  selectNextAction,
  type NextAction,
} from "@/lib/unit-tools/kanban/next-action";

interface Props {
  unitId: string;
}

export function NextActionPill({ unitId }: Props) {
  const [action, setAction] = useState<NextAction | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadKanbanState(unitId)
      .then((res) => {
        if (cancelled) return;
        setAction(selectNextAction(res.kanban));
      })
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn(
          "[next-action-pill] kanban load failed",
          err instanceof KanbanApiError ? err.message : err
        );
        // Silent — hero keeps rendering without the pill.
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  if (!action) return null;

  // Short label per state — keeps the pill visually compact alongside
  // the Continue button.
  const label =
    action.state === "in_progress"
      ? `Doing: ${truncate(action.headline)}`
      : action.state === "committed"
      ? `Today: ${truncate(action.headline)}`
      : action.state === "needs_pull"
      ? "Pull from Backlog"
      : "Add to Backlog";

  const iconChar =
    action.state === "in_progress"
      ? "▶"
      : action.state === "committed"
      ? "✱"
      : action.state === "needs_pull"
      ? "→"
      : "+";

  return (
    <a
      href={`/unit/${unitId}/board`}
      className="bg-white/15 backdrop-blur hover:bg-white/25 text-white rounded-full px-5 py-3 font-bold text-[13.5px] inline-flex items-center gap-1.5 transition"
      data-testid="hero-next-action-pill"
      data-next-action-state={action.state}
      aria-label={`Open project board — ${label}`}
    >
      <span aria-hidden="true">{iconChar}</span>
      <span className="truncate max-w-[200px]">{label}</span>
    </a>
  );
}

function truncate(text: string, max = 28): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 12 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
