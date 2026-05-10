/**
 * QuickReplies — three sentiment pills under a teacher comment.
 *
 * Designer spec (TFL.2 Pass A): radiogroup pattern with arrow-key
 * navigation. Sentiment colours map:
 *   got_it    → emerald (selected) / white (resting)
 *   not_sure  → amber   (selected) / white (resting)
 *   pushback  → purple  (selected) / white (resting)  // label "I disagree"
 *
 * The got_it pill is disabled when `needsReply` is set — teacher has
 * flagged this turn as requiring a written reply. The disabled state
 * uses aria-disabled (not the `disabled` attribute) so the radiogroup
 * roving-tabindex still includes the pill for keyboard nav; clicks +
 * keyboard activation are intercepted in the handler.
 */

"use client";

import * as React from "react";
import type { Sentiment } from "./types";
import { SENTIMENT_LABELS } from "./types";

interface QuickRepliesProps {
  /** Currently selected sentiment, or null if none yet. */
  selected: Sentiment | null;
  /** Fired when a pill is activated (click or keyboard). The got_it
   *  case fires onSelect immediately and resolves the thread; the
   *  other two open a reply box first (parent's responsibility). */
  onSelect: (s: Sentiment) => void;
  /** Disable the got_it pill when teacher has set needs-reply on
   *  this turn. The other two stay enabled. */
  disableGotIt?: boolean;
  /** Optional. Used in the section's aria-labelledby. */
  labelId?: string;
}

const SENTIMENT_ORDER: Sentiment[] = ["got_it", "not_sure", "pushback"];

const PILL_TOKENS: Record<
  Sentiment,
  {
    selectedBg: string;
    selectedBorder: string;
    selectedText: string;
    selectedHalo: string;
    iconColor: string;
  }
> = {
  got_it: {
    selectedBg: "bg-emerald-50",
    selectedBorder: "border-emerald-500",
    selectedText: "text-emerald-800",
    selectedHalo: "shadow-[0_0_0_3px_rgba(16,185,129,0.15)]",
    iconColor: "text-emerald-600",
  },
  not_sure: {
    selectedBg: "bg-amber-50",
    selectedBorder: "border-amber-500",
    selectedText: "text-amber-800",
    selectedHalo: "shadow-[0_0_0_3px_rgba(245,158,11,0.15)]",
    iconColor: "text-amber-600",
  },
  pushback: {
    selectedBg: "bg-purple-50",
    selectedBorder: "border-purple-500",
    selectedText: "text-purple-800",
    selectedHalo: "shadow-[0_0_0_3px_rgba(168,85,247,0.15)]",
    iconColor: "text-purple-600",
  },
};

function SentimentIcon({
  sentiment,
  className,
}: {
  sentiment: Sentiment;
  className?: string;
}) {
  // Inline SVG icons matching the designer's references:
  //   got_it    → check
  //   not_sure  → question-in-circle
  //   pushback  → left-arrow ("back")
  const props = {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };
  if (sentiment === "got_it") {
    return (
      <svg {...props}>
        <polyline points="4 12 9 17 20 6" />
      </svg>
    );
  }
  if (sentiment === "not_sure") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function QuickReplies({
  selected,
  onSelect,
  disableGotIt = false,
  labelId,
}: QuickRepliesProps) {
  // Roving tabindex: only the active (or first) pill takes tab. Arrow
  // keys move focus between pills; Enter/Space activates.
  const [focusIdx, setFocusIdx] = React.useState(() =>
    selected ? SENTIMENT_ORDER.indexOf(selected) : 0,
  );

  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent) {
    const current = focusIdx;
    let next = current;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (current + 1) % SENTIMENT_ORDER.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (current - 1 + SENTIMENT_ORDER.length) % SENTIMENT_ORDER.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = SENTIMENT_ORDER.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    setFocusIdx(next);
    refs.current[next]?.focus();
  }

  function handleSelect(s: Sentiment) {
    if (s === "got_it" && disableGotIt) return;
    onSelect(s);
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-2 flex-wrap"
    >
      {SENTIMENT_ORDER.map((s, idx) => {
        const isSelected = selected === s;
        const isDisabled = s === "got_it" && disableGotIt;
        const tokens = PILL_TOKENS[s];
        const tabIndex = idx === focusIdx ? 0 : -1;
        return (
          <button
            key={s}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            tabIndex={tabIndex}
            data-testid={`teacher-feedback-pill-${s}`}
            onClick={() => handleSelect(s)}
            onFocus={() => setFocusIdx(idx)}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border transition-all",
              isSelected
                ? `${tokens.selectedBg} ${tokens.selectedBorder} ${tokens.selectedText} ${tokens.selectedHalo}`
                : "bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50",
              isDisabled
                ? "opacity-40 cursor-not-allowed"
                : "cursor-pointer",
            ].join(" ")}
            title={
              isDisabled
                ? "Teacher requires a written reply — pick 'Not sure' or 'I disagree'."
                : undefined
            }
          >
            <SentimentIcon
              sentiment={s}
              className={isSelected ? tokens.iconColor : "text-gray-400"}
            />
            <span>{SENTIMENT_LABELS[s]}</span>
          </button>
        );
      })}
    </div>
  );
}
