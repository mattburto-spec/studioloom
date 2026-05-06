/**
 * Badge Computation Engine for StudioLoom
 *
 * Processes student progress data and returns computed badges with earned status,
 * tier progression, and human-readable next steps.
 */

import {
  BADGE_DEFINITIONS,
  getBadgeDefinition,
  BadgeCategory,
  BadgeTier,
} from './badge-definitions';

export interface ComputedBadge {
  id: string;
  category: BadgeCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
  tier: BadgeTier;
  earned: boolean;
  earnedAt: string | null;
  progress: number; // 0-100
  nextStep: string | null; // e.g. "Complete 2 more Criterion A pages for Silver"
}

export interface BadgeInput {
  // Student progress pages
  progress: Array<{
    page_id: string;
    criterion?: string;
    status: string;
    time_spent?: number;
    updated_at: string;
  }>;

  // Toolkit tool sessions
  toolSessions: Array<{
    tool_id: string;
    status: string;
    version: number;
    completed_at: string | null;
  }>;

  // Safety certificates (teacher-granted)
  safetyCerts: Array<{
    cert_type: string;
    granted_at: string;
  }>;

  // Open Studio status (per-unit unlock)
  studioStatus: Array<{
    unit_id: string;
    status: string;
  }>;

  // Open Studio sessions
  studioSessions: Array<{
    productivity_score: string | null;
    drift_flags: unknown[];
  }>;

  // Open Studio profiles (discovery completion)
  studioProfiles: Array<{
    completed_at: string | null;
  }>;
}

export interface BadgeStats {
  totalToolsUsed: number;
  totalPagesComplete: number;
  /**
   * Round 20 (6 May 2026) — `student_progress.time_spent` is now written
   * by the client autosave loop in seconds (was: never written, treated
   * inconsistently as ms). Surface seconds here and let consumers convert.
   */
  totalTimeSeconds: number;
  badgesEarned: number;
  badgesTotal: number;
}

/**
 * Compute all badges for a student based on their progress data
 */
export function computeBadges(input: BadgeInput): ComputedBadge[] {
  return BADGE_DEFINITIONS.map((def) => computeBadge(def, input));
}

/**
 * Compute a single badge
 */
function computeBadge(
  definition: typeof BADGE_DEFINITIONS[0],
  input: BadgeInput
): ComputedBadge {
  switch (definition.category) {
    case 'design-cycle':
      return computeDesignCycleBadge(definition, input);
    case 'safety':
      return computeSafetyBadge(definition, input);
    case 'toolkit':
      return computeToolkitBadge(definition, input);
    case 'growth':
      return computeGrowthBadge(definition, input);
    case 'studio':
      return computeStudioBadge(definition, input);
    default:
      return createEmptyBadge(definition);
  }
}

/**
 * Design Cycle badges: Track completion of Criterion A/B/C/D pages
 */
function computeDesignCycleBadge(
  definition: typeof BADGE_DEFINITIONS[0],
  input: BadgeInput
): ComputedBadge {
  if (definition.id === 'design-thinker') {
    // Special case: all 4 criteria at Silver+
    const counts = countCriterionPages(input.progress);
    const allSilver =
      counts.A >= 5 && counts.B >= 5 && counts.C >= 5 && counts.D >= 5;

    const earned = allSilver;
    const earnedAt = allSilver
      ? getEarliestTimestampForCriteria(input.progress, [
          'A',
          'B',
          'C',
          'D',
        ])
      : null;
    const progress = allSilver ? 100 : 0;
    const nextStep = allSilver
      ? null
      : 'Reach Silver in all four criteria (A, B, C, D)';

    return {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      tier: null,
      earned,
      earnedAt,
      progress,
      nextStep,
    };
  }

  // Regular criterion badges: A, B, C, D
  const criterionMap: Record<string, string> = {
    inquirer: 'A',
    'idea-generator': 'B',
    maker: 'C',
    evaluator: 'D',
  };
  const criterion = criterionMap[definition.id];
  const count = countCriterionPages(input.progress)[criterion as keyof typeof countCriterionPages];

  const tiers = definition.tiers!;
  const goldThreshold = tiers.gold.threshold;
  const silverThreshold = tiers.silver.threshold;
  const bronzeThreshold = tiers.bronze.threshold;

  let tier: BadgeTier = null;
  let progress = 0;
  let earned = false;
  let earnedAt: string | null = null;
  let nextStep: string | null = null;

  if (count >= goldThreshold) {
    tier = 'gold';
    earned = true;
    earnedAt = getEarliestTimestampForCriteria(input.progress, [criterion]);
    progress = 100;
    nextStep = null;
  } else if (count >= silverThreshold) {
    tier = 'silver';
    earned = true;
    earnedAt = getEarliestTimestampForCriteria(input.progress, [criterion]);
    progress = Math.round((count / goldThreshold) * 100);
    nextStep = `Complete ${goldThreshold - count} more for Gold`;
  } else if (count >= bronzeThreshold) {
    tier = 'bronze';
    earned = true;
    earnedAt = getEarliestTimestampForCriteria(input.progress, [criterion]);
    progress = Math.round((count / silverThreshold) * 100);
    nextStep = `Complete ${silverThreshold - count} more for Silver`;
  } else {
    tier = null;
    earned = false;
    earnedAt = null;
    progress = Math.round((count / bronzeThreshold) * 100);
    nextStep = `Complete ${bronzeThreshold - count} more for Bronze`;
  }

  return {
    id: definition.id,
    category: definition.category,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    color: definition.color,
    tier,
    earned,
    earnedAt,
    progress,
    nextStep,
  };
}

/**
 * Safety badges: Teacher-granted certifications (binary)
 */
function computeSafetyBadge(
  definition: typeof BADGE_DEFINITIONS[0],
  input: BadgeInput
): ComputedBadge {
  const safetyCertMap: Record<string, string> = {
    'general-workshop': 'general_workshop',
    'laser-cutter': 'laser_cutter',
    soldering: 'soldering',
    '3d-printer': '3d_printer',
    'hand-tools': 'hand_tools',
    'power-tools': 'power_tools',
  };

  const certType = safetyCertMap[definition.id];
  const cert = input.safetyCerts.find((c) => c.cert_type === certType);

  const earned = !!cert;
  const earnedAt = cert?.granted_at || null;

  return {
    id: definition.id,
    category: definition.category,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    color: definition.color,
    tier: null,
    earned,
    earnedAt,
    progress: earned ? 100 : 0,
    nextStep: earned ? null : `Request certification from your teacher`,
  };
}

/**
 * Toolkit badges: Specific tool completion or aggregate tool usage
 */
function computeToolkitBadge(
  definition: typeof BADGE_DEFINITIONS[0],
  input: BadgeInput
): ComputedBadge {
  const toolIdMap: Record<string, string> = {
    'scamper-explorer': 'scamper',
    'six-hats-thinker': 'six-hats',
    'root-cause-analyst': 'five-whys',
    'empathy-expert': 'empathy-map',
    'decision-maker': 'decision-matrix',
  };

  if (definition.id === 'toolkit-journeyman') {
    const uniqueTools = new Set(
      input.toolSessions
        .filter((s) => s.status === 'completed')
        .map((s) => s.tool_id)
    );
    const count = uniqueTools.size;
    const threshold = 5;

    const earned = count >= threshold;
    const earnedAt = earned
      ? getEarliestCompletedToolSession(input.toolSessions, 5)
      : null;
    const progress = Math.min(Math.round((count / threshold) * 100), 100);

    return {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      tier: null,
      earned,
      earnedAt,
      progress,
      nextStep: earned ? null : `Complete ${threshold - count} more different tools`,
    };
  }

  if (definition.id === 'toolkit-master') {
    const uniqueTools = new Set(
      input.toolSessions
        .filter((s) => s.status === 'completed')
        .map((s) => s.tool_id)
    );
    const count = uniqueTools.size;
    const threshold = 10;

    const earned = count >= threshold;
    const earnedAt = earned
      ? getEarliestCompletedToolSession(input.toolSessions, 10)
      : null;
    const progress = Math.min(Math.round((count / threshold) * 100), 100);

    return {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      tier: null,
      earned,
      earnedAt,
      progress,
      nextStep: earned ? null : `Complete ${threshold - count} more different tools`,
    };
  }

  // Single tool badges
  const toolId = toolIdMap[definition.id];
  if (!toolId) {
    return createEmptyBadge(definition);
  }

  const completed = input.toolSessions.some(
    (s) => s.tool_id === toolId && s.status === 'completed'
  );
  const earnedAt = completed
    ? input.toolSessions.find(
        (s) => s.tool_id === toolId && s.status === 'completed'
      )?.completed_at || null
    : null;

  return {
    id: definition.id,
    category: definition.category,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    color: definition.color,
    tier: null,
    earned: completed,
    earnedAt,
    progress: completed ? 100 : 0,
    nextStep: completed ? null : `Complete 1 ${definition.name} session`,
  };
}

/**
 * Growth badges: Effort, consistency, reflection, iteration
 */
function computeGrowthBadge(
  definition: typeof BADGE_DEFINITIONS[0],
  input: BadgeInput
): ComputedBadge {
  if (definition.id === 'deep-thinker') {
    // Count high-effort responses across all tools (effort > 70 or version > 1)
    const highEffortCount = input.toolSessions.filter(
      (s) => s.version > 1 || s.status === 'completed'
    ).length;
    const threshold = 10;

    const earned = highEffortCount >= threshold;
    const earnedAt = earned
      ? input.toolSessions[Math.min(9, input.toolSessions.length - 1)]
        ?.completed_at || null
      : null;

    return {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      tier: null,
      earned,
      earnedAt,
      progress: Math.min(Math.round((highEffortCount / threshold) * 100), 100),
      nextStep: earned ? null : `${threshold - highEffortCount} more high-effort responses`,
    };
  }

  if (definition.id === 'consistent-worker') {
    // Check if 5+ distinct dates with activity in last 7 days
    const last7Days = getActiveDaysInRange(input.progress, 7);
    const threshold = 5;
    const earned = last7Days >= threshold;

    return {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      tier: null,
      earned,
      earnedAt: earned ? new Date().toISOString() : null,
      progress: Math.min(Math.round((last7Days / threshold) * 100), 100),
      nextStep: earned ? null : `Active for ${threshold - last7Days} more days`,
    };
  }

  if (definition.id === 'reflective-practitioner') {
    // Count reflections with 20+ meaningful words
    const thoughtfulReflections = input.progress.filter(
      (p) =>
        p.status === 'complete' &&
        (p.time_spent || 0) > 120 // 2+ minutes spent = thoughtful (seconds, post-Round 20)
    ).length;
    const threshold = 5;
    const earned = thoughtfulReflections >= threshold;

    return {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      tier: null,
      earned,
      earnedAt: earned ? input.progress[input.progress.length - 1]?.updated_at || null : null,
      progress: Math.min(Math.round((thoughtfulReflections / threshold) * 100), 100),
      nextStep: earned
        ? null
        : `${threshold - thoughtfulReflections} more reflections with 20+ words`,
    };
  }

  if (definition.id === 'iterative-designer') {
    // Any tool session with version >= 2
    const hasIteration = input.toolSessions.some((s) => s.version >= 2);

    return {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      tier: null,
      earned: hasIteration,
      earnedAt: hasIteration
        ? input.toolSessions.find((s) => s.version >= 2)?.completed_at || null
        : null,
      progress: hasIteration ? 100 : 0,
      nextStep: hasIteration ? null : 'Create a v2 version of any toolkit tool',
    };
  }

  return createEmptyBadge(definition);
}

/**
 * Studio badges: Open Studio access, productivity, and discovery completion
 */
function computeStudioBadge(
  definition: typeof BADGE_DEFINITIONS[0],
  input: BadgeInput
): ComputedBadge {
  if (definition.id === 'studio-access') {
    const unlocked = input.studioStatus.some((s) => s.status === 'unlocked');

    return {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      tier: null,
      earned: unlocked,
      earnedAt: unlocked ? input.studioStatus[0]?.unit_id ? new Date().toISOString() : null : null,
      progress: unlocked ? 100 : 0,
      nextStep: unlocked ? null : 'Unlock Open Studio for a unit',
    };
  }

  if (definition.id === 'focused-worker') {
    const highProductivitySessions = input.studioSessions.filter(
      (s) => s.productivity_score === 'high' && (!s.drift_flags || s.drift_flags.length === 0)
    ).length;
    const threshold = 3;
    const earned = highProductivitySessions >= threshold;

    return {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      tier: null,
      earned,
      earnedAt: earned ? new Date().toISOString() : null,
      progress: Math.min(Math.round((highProductivitySessions / threshold) * 100), 100),
      nextStep: earned ? null : `Complete ${threshold - highProductivitySessions} more high-focus sessions`,
    };
  }

  if (definition.id === 'project-owner') {
    const discoveryComplete = input.studioProfiles.some((p) => p.completed_at !== null);
    const earnedAt = discoveryComplete
      ? input.studioProfiles.find((p) => p.completed_at)?.completed_at || null
      : null;

    return {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      tier: null,
      earned: discoveryComplete,
      earnedAt,
      progress: discoveryComplete ? 100 : 0,
      nextStep: discoveryComplete ? null : 'Complete the Open Studio Discovery phase',
    };
  }

  return createEmptyBadge(definition);
}

/**
 * Helper: Create empty badge for unknown definitions
 */
function createEmptyBadge(definition: typeof BADGE_DEFINITIONS[0]): ComputedBadge {
  return {
    id: definition.id,
    category: definition.category,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    color: definition.color,
    tier: null,
    earned: false,
    earnedAt: null,
    progress: 0,
    nextStep: null,
  };
}

// ===== Statistics =====

/**
 * Compute aggregate statistics for student dashboard stats strip
 */
export function computeStats(input: BadgeInput): BadgeStats {
  const uniqueTools = new Set(input.toolSessions.map((s) => s.tool_id));
  const completedPages = input.progress.filter(
    (p) => p.status === 'complete'
  ).length;
  const totalTime = input.progress.reduce((sum, p) => sum + (p.time_spent || 0), 0);

  const badges = computeBadges(input);
  const earned = badges.filter((b) => b.earned).length;

  return {
    totalToolsUsed: uniqueTools.size,
    totalPagesComplete: completedPages,
    totalTimeSeconds: totalTime,
    badgesEarned: earned,
    badgesTotal: BADGE_DEFINITIONS.length,
  };
}

// ===== Private Helpers =====

function countCriterionPages(
  progress: BadgeInput['progress']
): Record<string, number> {
  const counts: Record<string, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };

  progress.forEach((p) => {
    if (p.status === 'complete' && p.criterion && p.criterion in counts) {
      counts[p.criterion]++;
    }
  });

  return counts;
}

function getEarliestTimestampForCriteria(
  progress: BadgeInput['progress'],
  criteria: string[]
): string | null {
  const matching = progress.filter(
    (p) => p.status === 'complete' && p.criterion && criteria.includes(p.criterion)
  );

  if (matching.length === 0) return null;

  return matching.sort((a, b) =>
    new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  )[0]?.updated_at || null;
}

function getEarliestCompletedToolSession(
  sessions: BadgeInput['toolSessions'],
  n: number
): string | null {
  const completed = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) =>
      new Date(a.completed_at || '').getTime() -
      new Date(b.completed_at || '').getTime()
    );

  if (completed.length < n) return null;
  return completed[n - 1]?.completed_at || null;
}

function getActiveDaysInRange(
  progress: BadgeInput['progress'],
  days: number
): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const dates = new Set(
    progress
      .filter((p) => new Date(p.updated_at) > cutoff)
      .map((p) => new Date(p.updated_at).toDateString())
  );

  return dates.size;
}
