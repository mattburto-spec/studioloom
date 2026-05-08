"use client";

import { motion } from "framer-motion";
import type { GradingScale } from "@/lib/constants";
import {
  classifyScorePillState,
  formatScoreForPill,
  getScorePillClasses,
  getScoreTier,
  type ScorePillState,
} from "./score-pill-helpers";

export interface ScorePillProps {
  /** Live score on the tile, null when not yet set. */
  score: number | null;
  /** Has the teacher confirmed this score? */
  confirmed: boolean;
  /** AI's suggested score (G1.3 wires this; G1.1 leaves null). */
  aiPreScore?: number | null;
  /** Framework-aware grading scale (drives max + display formatting). */
  scale: GradingScale;
  /** Polish-3 — Not Applicable. Renders as a grey "N/A" pill instead of a score. */
  isNa?: boolean;
  /** Optional click handler — opens the override panel in G1.2. */
  onClick?: () => void;
  /** Override the auto-classified state (for visual previews / Storybook-like demos). */
  forceState?: ScorePillState;
}

const SPARKLES_PATH = (
  <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
);
const CHECK_PATH = <polyline points="4 12 9 17 20 6" />;

export function ScorePill({
  score,
  confirmed,
  aiPreScore = null,
  scale,
  isNa = false,
  onClick,
  forceState,
}: ScorePillProps) {
  const state = forceState ?? classifyScorePillState({ score, confirmed, aiPreScore, isNa });
  const tier = getScoreTier(score, scale.max);
  const className = getScorePillClasses(state, tier);
  const displayScore = state === "na" ? "N/A" : formatScoreForPill(score, scale);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={onClick ? { scale: 0.94 } : undefined}
      className={className}
      aria-label={
        state === "na"
          ? "Not applicable"
          : state === "empty"
            ? "Score not yet set"
            : state === "ai-suggested"
              ? `AI suggested ${displayScore}, not confirmed`
              : state === "overridden"
                ? `Score ${displayScore}, teacher override`
                : `Score ${displayScore}, confirmed`
      }
      data-state={state}
      data-tier={tier}
    >
      {state === "ai-suggested" && (
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          {SPARKLES_PATH}
        </svg>
      )}
      <span className="font-mono tabular-nums">{displayScore}</span>
      {(state === "confirmed" || state === "overridden" || state === "na") && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {CHECK_PATH}
        </svg>
      )}
    </motion.button>
  );
}
