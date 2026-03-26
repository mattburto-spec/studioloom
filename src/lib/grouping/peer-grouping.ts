/**
 * Peer Grouping Algorithm — Research-Backed Student Group Formation
 *
 * Uses student profile data to form optimal peer learning groups for
 * Class Gallery reviews and collaborative work.
 *
 * Research basis (from docs/research/student-influence-factors.md):
 * - Peer tutoring d=0.53 — most effective with mixed ability levels
 * - Language tier moderates peer learning — ELL students benefit most from
 *   same-language peers for deep discussion, cross-language for vocabulary
 * - Cultural background moderates feedback channel — collectivist students
 *   give better feedback in small, safe groups vs whole-class critique
 * - Feedback preference (private/public) affects critique quality
 * - Working style diversity improves ideation, similarity aids execution
 *
 * Algorithm: Weighted constraint satisfaction with soft preferences.
 * Hard constraints: group size bounds, ELL support guarantee.
 * Soft preferences: diversity scoring, feedback compatibility.
 */

import type { ELLTier } from "@/lib/toolkit/effort-assessment";

// ============================================================================
// Types
// ============================================================================

export interface StudentGroupingProfile {
  studentId: string;
  displayName: string;
  ellTier: ELLTier;
  languagesAtHome: string[];    // from intake survey
  countriesLivedIn: string[];   // from intake survey
  feedbackPreference: "private" | "public" | null;
  dominantStyle: "planner" | "doer" | "explorer" | "balanced" | null;
  // Performance signals (optional — used when available)
  avgCriterionScore: number | null;  // 1-8 scale from grading
  toolkitDepth: number | null;       // avg depth dots across tools
}

export interface GroupingConfig {
  /** Target group size (default: 3-4) */
  targetSize: number;
  /** Grouping strategy */
  strategy: "mixed_ability" | "similar_ability" | "random" | "diverse_style";
  /** Prioritise ELL language matching (default: true) */
  ellLanguageMatch: boolean;
  /** Weight for feedback compatibility (0-1, default: 0.3) */
  feedbackCompatWeight: number;
  /** Weight for style diversity (0-1, default: 0.3) */
  styleDiversityWeight: number;
  /** Weight for ability mixing (0-1, default: 0.4) */
  abilityMixWeight: number;
}

export interface StudentGroup {
  groupId: string;
  members: string[];  // student IDs
  /** Why this group was formed — human-readable for teacher */
  rationale: string;
  /** Group quality score 0-100 */
  qualityScore: number;
}

// ============================================================================
// Default Config
// ============================================================================

export const DEFAULT_GROUPING_CONFIG: GroupingConfig = {
  targetSize: 4,
  strategy: "mixed_ability",
  ellLanguageMatch: true,
  feedbackCompatWeight: 0.3,
  styleDiversityWeight: 0.3,
  abilityMixWeight: 0.4,
};

// ============================================================================
// Core Algorithm
// ============================================================================

/**
 * Form optimal peer groups from a class roster.
 *
 * Algorithm:
 * 1. Sort students by ability (criterion scores)
 * 2. Apply ELL constraint: ensure each ELL T1/T2 student has at least one
 *    same-language peer in their group (if possible)
 * 3. Distribute using serpentine draft:
 *    - For mixed_ability: interleave high/low scorers
 *    - For similar_ability: cluster similar scorers
 *    - For diverse_style: maximise working style variety per group
 * 4. Score groups and attempt swaps to improve quality
 */
export function formGroups(
  students: StudentGroupingProfile[],
  config: GroupingConfig = DEFAULT_GROUPING_CONFIG
): StudentGroup[] {
  if (students.length <= config.targetSize) {
    return [
      {
        groupId: "group_1",
        members: students.map((s) => s.studentId),
        rationale: "Single group — class size within target group size",
        qualityScore: 100,
      },
    ];
  }

  const numGroups = Math.ceil(students.length / config.targetSize);

  // Step 1: Sort by strategy
  const sorted = [...students];
  if (config.strategy === "mixed_ability" || config.strategy === "similar_ability") {
    sorted.sort((a, b) => (b.avgCriterionScore ?? 4) - (a.avgCriterionScore ?? 4));
  } else if (config.strategy === "diverse_style") {
    // Shuffle to avoid alphabetical bias, then we'll optimise
    for (let i = sorted.length - 1; i > 0; i--) {
      const j = Math.floor(deterministicRandom(i) * (i + 1));
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
  } else {
    // Random
    for (let i = sorted.length - 1; i > 0; i--) {
      const j = Math.floor(deterministicRandom(i) * (i + 1));
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
  }

  // Step 2: Serpentine draft into groups
  const groups: string[][] = Array.from({ length: numGroups }, () => []);

  if (config.strategy === "mixed_ability") {
    // Serpentine: [1,2,3,4], [4,3,2,1], [1,2,3,4]...
    let direction = 1;
    let groupIdx = 0;
    for (const student of sorted) {
      groups[groupIdx].push(student.studentId);
      groupIdx += direction;
      if (groupIdx >= numGroups || groupIdx < 0) {
        direction *= -1;
        groupIdx += direction;
      }
    }
  } else {
    // Simple round-robin for other strategies
    sorted.forEach((student, i) => {
      groups[i % numGroups].push(student.studentId);
    });
  }

  // Step 3: ELL language matching constraint
  if (config.ellLanguageMatch) {
    applyELLConstraint(groups, students);
  }

  // Step 4: Score and build output
  const studentMap = new Map(students.map((s) => [s.studentId, s]));

  return groups.map((memberIds, i) => {
    const members = memberIds.map((id) => studentMap.get(id)!).filter(Boolean);
    const score = scoreGroup(members, config);
    const rationale = buildRationale(members, config);

    return {
      groupId: `group_${i + 1}`,
      members: memberIds,
      rationale,
      qualityScore: Math.round(score),
    };
  });
}

// ============================================================================
// ELL Constraint
// ============================================================================

/**
 * Ensure ELL Tier 1/2 students have at least one same-language peer
 * in their group when possible. Uses swap-based repair.
 */
function applyELLConstraint(
  groups: string[][],
  students: StudentGroupingProfile[]
): void {
  const studentMap = new Map(students.map((s) => [s.studentId, s]));

  for (const group of groups) {
    const ellStudents = group
      .map((id) => studentMap.get(id)!)
      .filter((s) => s && s.ellTier <= 2);

    for (const ell of ellStudents) {
      // Check if there's already a same-language peer in the group
      const hasLanguagePeer = group.some((id) => {
        if (id === ell.studentId) return false;
        const peer = studentMap.get(id);
        if (!peer) return false;
        return peer.languagesAtHome.some((l) => ell.languagesAtHome.includes(l));
      });

      if (hasLanguagePeer) continue;

      // Try to swap a non-ELL student from this group with a same-language
      // student from another group
      let swapped = false;
      for (const otherGroup of groups) {
        if (otherGroup === group) continue;
        for (let j = 0; j < otherGroup.length && !swapped; j++) {
          const candidate = studentMap.get(otherGroup[j]);
          if (!candidate) continue;
          // Candidate must share a language with the ELL student
          if (!candidate.languagesAtHome.some((l) => ell.languagesAtHome.includes(l))) continue;
          // Candidate should not themselves be ELL T1/T2 needing support elsewhere
          if (candidate.ellTier <= 2) continue;

          // Find a non-ELL student in current group to swap out
          const swapIdx = group.findIndex((id) => {
            const s = studentMap.get(id);
            return s && s.ellTier === 3 && id !== ell.studentId;
          });
          if (swapIdx === -1) continue;

          // Perform swap
          const temp = group[swapIdx];
          group[swapIdx] = otherGroup[j];
          otherGroup[j] = temp;
          swapped = true;
        }
      }
    }
  }
}

// ============================================================================
// Group Scoring
// ============================================================================

function scoreGroup(members: StudentGroupingProfile[], config: GroupingConfig): number {
  if (members.length === 0) return 0;

  let score = 0;

  // Feedback compatibility (0-100)
  const feedbackScore = scoreFeedbackCompat(members);
  score += feedbackScore * config.feedbackCompatWeight;

  // Style diversity (0-100)
  const styleScore = scoreStyleDiversity(members);
  score += styleScore * config.styleDiversityWeight;

  // Ability mix (0-100)
  const abilityScore = scoreAbilityMix(members, config.strategy);
  score += abilityScore * config.abilityMixWeight;

  return Math.min(100, score);
}

function scoreFeedbackCompat(members: StudentGroupingProfile[]): number {
  // Groups with all-private preference students may produce less interaction
  // Groups with mix of private+public need a "safe" environment
  const privateCount = members.filter((m) => m.feedbackPreference === "private").length;
  const publicCount = members.filter((m) => m.feedbackPreference === "public").length;
  const total = members.length;

  // Best: mix (but not all private)
  if (privateCount > 0 && publicCount > 0) return 80;
  if (privateCount === 0) return 70; // all public is fine
  if (privateCount === total) return 50; // all private may be quiet
  return 60;
}

function scoreStyleDiversity(members: StudentGroupingProfile[]): number {
  const styles = new Set(members.map((m) => m.dominantStyle).filter(Boolean));
  // More unique styles = higher diversity score
  const diversityRatio = styles.size / Math.min(members.length, 4);
  return diversityRatio * 100;
}

function scoreAbilityMix(members: StudentGroupingProfile[], strategy: GroupingConfig["strategy"]): number {
  const scores = members
    .map((m) => m.avgCriterionScore)
    .filter((s): s is number => s !== null);

  if (scores.length < 2) return 50; // not enough data

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);

  if (strategy === "mixed_ability") {
    // High spread = good (target stddev ~1.5-2 on 1-8 scale)
    return Math.min(100, (stddev / 2) * 100);
  } else if (strategy === "similar_ability") {
    // Low spread = good
    return Math.max(0, 100 - stddev * 50);
  }
  return 50; // neutral for random/diverse
}

// ============================================================================
// Rationale Builder
// ============================================================================

function buildRationale(members: StudentGroupingProfile[], config: GroupingConfig): string {
  const parts: string[] = [];

  // ELL note
  const ellMembers = members.filter((m) => m.ellTier <= 2);
  if (ellMembers.length > 0) {
    const hasSupport = ellMembers.every((ell) =>
      members.some((m) => m.studentId !== ell.studentId &&
        m.languagesAtHome.some((l) => ell.languagesAtHome.includes(l)))
    );
    parts.push(
      hasSupport
        ? `${ellMembers.length} ELL student(s) with language-matched peer support`
        : `${ellMembers.length} ELL student(s) (no same-language peer available)`
    );
  }

  // Style diversity
  const styles = new Set(members.map((m) => m.dominantStyle).filter(Boolean));
  if (styles.size >= 3) {
    parts.push(`High style diversity (${[...styles].join(", ")})`);
  }

  // Ability spread
  const scores = members.map((m) => m.avgCriterionScore).filter((s): s is number => s !== null);
  if (scores.length >= 2) {
    const spread = Math.max(...scores) - Math.min(...scores);
    if (config.strategy === "mixed_ability" && spread >= 2) {
      parts.push(`Mixed ability (spread ${spread.toFixed(1)})`);
    }
  }

  return parts.length > 0 ? parts.join(". ") + "." : `${config.strategy} grouping applied.`;
}

// ============================================================================
// Helpers
// ============================================================================

/** Deterministic random for reproducible grouping (seeded by index) */
function deterministicRandom(seed: number): number {
  let x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}
