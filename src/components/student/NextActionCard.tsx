"use client";

/**
 * NextActionCard — surfaces the single most-relevant kanban card the
 * student should focus on RIGHT NOW for their hero unit. Loads the
 * student's kanban for this unit and runs selectNextAction() on it.
 *
 * Mounts on the Bold student dashboard, sandwiched between the
 * ResumeHero (lesson-side: "continue Sketch 3 ideas") and MiddleRow
 * (priorities + badges). The two are complementary: ResumeHero is
 * "where you are in the LESSON", NextActionCard is "what's the next
 * thing to actually DO on your project board".
 *
 * Empty / loading / error states all render gracefully — never blocks
 * the rest of the dashboard from rendering.
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
  /** The student's hero unit color (matches ResumeHero gradient). */
  accentColor: string;
}

type LoadStatus = "loading" | "ready" | "error";

export function NextActionCard({ unitId, accentColor }: Props) {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [action, setAction] = useState<NextAction | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadKanbanState(unitId)
      .then((res) => {
        if (cancelled) return;
        setAction(selectNextAction(res.kanban));
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        // Non-fatal — the dashboard keeps working without this card.
        // eslint-disable-next-line no-console
        console.warn(
          "[next-action-card] kanban load failed",
          err instanceof KanbanApiError ? err.message : err
        );
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  if (status === "loading") {
    return (
      <section
        id="dashboard-next-action"
        className="max-w-[1400px] mx-auto px-6 mt-4"
        data-testid="next-action-loading"
      >
        <div className="rounded-2xl bg-white border border-[var(--sl-line)] p-4 flex items-center gap-3 text-[12.5px] text-[var(--sl-ink-3)]">
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />
          Loading your project board…
        </div>
      </section>
    );
  }

  if (status === "error" || !action) {
    // Silent fail — don't show an error UI, just hide the card. The
    // dashboard rest still renders and the kanban itself is reachable
    // via the unit page.
    return null;
  }

  const href = `/unit/${unitId}/board`;

  // Tone changes per state: in_progress = active green-ish, committed
  // = warm amber, needs_pull/empty = invitation purple.
  const toneClasses =
    action.state === "in_progress"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : action.state === "committed"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-violet-50 border-violet-200 text-violet-900";

  const eyebrowTone =
    action.state === "in_progress"
      ? "text-emerald-700"
      : action.state === "committed"
      ? "text-amber-700"
      : "text-violet-700";

  return (
    <section
      id="dashboard-next-action"
      className="max-w-[1400px] mx-auto px-6 mt-4"
      data-testid="next-action-card"
      data-next-action-state={action.state}
    >
      <a
        href={href}
        className={`block rounded-2xl border p-4 md:p-5 transition-all duration-150 hover:shadow-md ${toneClasses}`}
        data-testid="next-action-link"
      >
        <div className="flex items-start gap-4">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-[18px] font-bold text-white"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          >
            {action.state === "in_progress"
              ? "▶"
              : action.state === "committed"
              ? "✱"
              : action.state === "needs_pull"
              ? "→"
              : "+"}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={`text-[10.5px] font-bold uppercase tracking-wider ${eyebrowTone}`}
            >
              {action.eyebrow}
            </div>
            <div
              className="text-[15px] md:text-[17px] font-bold leading-snug mt-0.5 truncate"
              data-testid="next-action-headline"
            >
              {action.headline}
            </div>
          </div>
          <div
            className="flex-shrink-0 self-center text-[11.5px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap text-white"
            style={{ backgroundColor: accentColor }}
            data-testid="next-action-cta"
          >
            {action.ctaLabel} →
          </div>
        </div>
      </a>
    </section>
  );
}
