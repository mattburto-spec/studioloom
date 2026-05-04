/**
 * Visual onboarding picks — 9 aesthetic mood tiles students choose from on
 * their first login. Each tile carries an affinity score toward each of the
 * three mentors (Kit / Sage / Spark). The total across the picks suggests a
 * mentor on the next screen — the student still chooses freely.
 *
 * Designed to be 100% self-rendered (SVG/CSS motifs, no photo dependency).
 * v2 (Designer Mentor System) will replace this with real designer imagery
 * and the cosine-similarity algorithm — the data captured here can feed
 * that system later if persisted.
 *
 * See: docs/projects/studioloom-designer-mentor-spec.md (v2 destination)
 */

import type { MentorId } from "./mentors";
import { THEMES, type ThemeId } from "./themes";

export type Motif =
  | "warm-wood"
  | "pencil-sketch"
  | "textile-weave"
  | "soft-minimal"
  | "bauhaus-grid"
  | "ink-brush"
  | "memphis-pop"
  | "vibrant-chaos"
  | "cyber-neon";

export interface OnboardingImage {
  id: string;
  /** Single-word mood label shown on the tile */
  label: string;
  /** Visual motif identifier — rendered by VisualPicksScreen */
  motif: Motif;
  /** Affinity scores 0..1 toward each mentor. Sum across picks → suggestion. */
  weights: Record<MentorId, number>;
}

export const ONBOARDING_IMAGES: OnboardingImage[] = [
  // ── Kit-affined (warm, hands-on, crafted) ──────────────────────────────
  { id: "warm",    label: "Warm",     motif: "warm-wood",     weights: { kit: 1.0, sage: 0,   spark: 0   } },
  { id: "sketch",  label: "Crafted",  motif: "pencil-sketch", weights: { kit: 0.9, sage: 0.1, spark: 0   } },
  { id: "textile", label: "Soft",     motif: "textile-weave", weights: { kit: 0.8, sage: 0.2, spark: 0   } },

  // ── Sage-affined (calm, ordered, precise) ──────────────────────────────
  { id: "minimal", label: "Calm",     motif: "soft-minimal",  weights: { kit: 0,   sage: 1.0, spark: 0   } },
  { id: "bauhaus", label: "Ordered",  motif: "bauhaus-grid",  weights: { kit: 0.1, sage: 0.8, spark: 0.1 } },
  { id: "ink",     label: "Quiet",    motif: "ink-brush",     weights: { kit: 0,   sage: 0.9, spark: 0.1 } },

  // ── Spark-affined (bold, loud, energetic) ──────────────────────────────
  { id: "pop",     label: "Loud",     motif: "memphis-pop",   weights: { kit: 0.1, sage: 0,   spark: 0.9 } },
  { id: "chaos",   label: "Wild",     motif: "vibrant-chaos", weights: { kit: 0,   sage: 0,   spark: 1.0 } },
  { id: "neon",    label: "Electric", motif: "cyber-neon",    weights: { kit: 0,   sage: 0.1, spark: 0.9 } },
];

const MENTOR_IDS_ORDER: readonly MentorId[] = ["kit", "sage", "spark"] as const;

/**
 * Sum the per-mentor weights across the picked image IDs and return the
 * highest-scoring mentor. Tie-breaker order: kit → sage → spark (stable).
 */
export function computeMentorSuggestion(pickedIds: string[]): MentorId {
  const totals: Record<MentorId, number> = { kit: 0, sage: 0, spark: 0 };
  for (const id of pickedIds) {
    const img = ONBOARDING_IMAGES.find((i) => i.id === id);
    if (!img) continue;
    for (const m of MENTOR_IDS_ORDER) {
      totals[m] += img.weights[m];
    }
  }
  let best: MentorId = "kit";
  let bestScore = -Infinity;
  for (const m of MENTOR_IDS_ORDER) {
    if (totals[m] > bestScore) {
      bestScore = totals[m];
      best = m;
    }
  }
  return best;
}

/**
 * v1 maps each mentor to a single theme — students no longer pick a theme
 * during onboarding; it derives from the chosen mentor. Settings cog still
 * exposes the full theme picker for students who want to change later.
 */
export const MENTOR_THEME_MAP: Record<MentorId, ThemeId> = {
  kit: "warm",
  sage: "clean",
  spark: "bold",
};

export function themeForMentor(mentorId: MentorId): ThemeId {
  const t = MENTOR_THEME_MAP[mentorId];
  // Defensive: ensure theme exists in registry (cheap guard for future renames)
  return THEMES[t] ? t : "clean";
}
