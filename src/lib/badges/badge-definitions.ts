/**
 * Badge Definitions for StudioLoom Student Dashboard
 *
 * Defines all available badge categories, criteria, and visual properties.
 * Badges are computed at runtime based on student progress data.
 */

export type BadgeCategory = 'design-cycle' | 'safety' | 'toolkit' | 'growth' | 'studio';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | null;

export interface BadgeTierDefinition {
  threshold: number;
  label: string;
}

export interface BadgeDefinition {
  id: string;
  category: BadgeCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
  tiers?: {
    bronze: BadgeTierDefinition;
    silver: BadgeTierDefinition;
    gold: BadgeTierDefinition;
  };
}

/**
 * Complete badge definitions for StudioLoom.
 *
 * Design Cycle (5): inquirer, idea-generator, maker, evaluator, design-thinker
 * Safety (6): general-workshop, laser-cutter, soldering, 3d-printer, hand-tools, power-tools
 * Toolkit (8): scamper-explorer, six-hats-thinker, root-cause-analyst, empathy-expert,
 *              decision-maker, toolkit-journeyman, toolkit-master
 * Growth (4): deep-thinker, consistent-worker, reflective-practitioner, iterative-designer
 * Studio (3): studio-access, focused-worker, project-owner
 */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // === Design Cycle Badges (5) ===
  {
    id: 'inquirer',
    category: 'design-cycle',
    name: 'Inquirer',
    description: 'Complete Criterion A (Investigation) pages',
    icon: '🔍',
    color: '#6366F1',
    tiers: {
      bronze: { threshold: 3, label: 'Bronze' },
      silver: { threshold: 5, label: 'Silver' },
      gold: { threshold: 8, label: 'Gold' },
    },
  },
  {
    id: 'idea-generator',
    category: 'design-cycle',
    name: 'Idea Generator',
    description: 'Complete Criterion B (Ideation) pages',
    icon: '💡',
    color: '#10B981',
    tiers: {
      bronze: { threshold: 3, label: 'Bronze' },
      silver: { threshold: 5, label: 'Silver' },
      gold: { threshold: 8, label: 'Gold' },
    },
  },
  {
    id: 'maker',
    category: 'design-cycle',
    name: 'Maker',
    description: 'Complete Criterion C (Creating Solutions) pages',
    icon: '🔨',
    color: '#F59E0B',
    tiers: {
      bronze: { threshold: 3, label: 'Bronze' },
      silver: { threshold: 5, label: 'Silver' },
      gold: { threshold: 8, label: 'Gold' },
    },
  },
  {
    id: 'evaluator',
    category: 'design-cycle',
    name: 'Evaluator',
    description: 'Complete Criterion D (Evaluation) pages',
    icon: '📊',
    color: '#8B5CF6',
    tiers: {
      bronze: { threshold: 3, label: 'Bronze' },
      silver: { threshold: 5, label: 'Silver' },
      gold: { threshold: 8, label: 'Gold' },
    },
  },
  {
    id: 'design-thinker',
    category: 'design-cycle',
    name: 'Design Thinker',
    description: 'Master all four design cycle criteria (all at Silver+)',
    icon: '⭐',
    color: '#EC4899',
  },

  // === Safety Badges (6) ===
  {
    id: 'general-workshop',
    category: 'safety',
    name: 'Workshop Safety',
    description: 'General workshop safety certification',
    icon: '🛡️',
    color: '#10B981',
  },
  {
    id: 'laser-cutter',
    category: 'safety',
    name: 'Laser Cutter',
    description: 'Laser cutter operation certified',
    icon: '⚡',
    color: '#F97316',
  },
  {
    id: 'soldering',
    category: 'safety',
    name: 'Soldering',
    description: 'Soldering certification',
    icon: '🔥',
    color: '#EAB308',
  },
  {
    id: '3d-printer',
    category: 'safety',
    name: '3D Printer',
    description: '3D printer operation certified',
    icon: '🖨️',
    color: '#3B82F6',
  },
  {
    id: 'hand-tools',
    category: 'safety',
    name: 'Hand Tools',
    description: 'Hand tools safety certified',
    icon: '🔧',
    color: '#EF4444',
  },
  {
    id: 'power-tools',
    category: 'safety',
    name: 'Power Tools',
    description: 'Power tools operation certified',
    icon: '⚙️',
    color: '#8B5CF6',
  },

  // === Toolkit Badges (8) ===
  {
    id: 'scamper-explorer',
    category: 'toolkit',
    name: 'SCAMPER Explorer',
    description: 'Complete 1 SCAMPER ideation session',
    icon: '🎯',
    color: '#A855F7',
  },
  {
    id: 'six-hats-thinker',
    category: 'toolkit',
    name: 'Six Hats Thinker',
    description: 'Complete 1 Six Thinking Hats session',
    icon: '🎩',
    color: '#6366F1',
  },
  {
    id: 'root-cause-analyst',
    category: 'toolkit',
    name: 'Root Cause Analyst',
    description: 'Complete 1 Five Whys analysis',
    icon: '🔎',
    color: '#7C3AED',
  },
  {
    id: 'empathy-expert',
    category: 'toolkit',
    name: 'Empathy Expert',
    description: 'Complete 1 Empathy Map',
    icon: '💜',
    color: '#EC4899',
  },
  {
    id: 'decision-maker',
    category: 'toolkit',
    name: 'Decision Maker',
    description: 'Complete 1 Decision Matrix',
    icon: '⚖️',
    color: '#10B981',
  },
  {
    id: 'toolkit-journeyman',
    category: 'toolkit',
    name: 'Toolkit Journeyman',
    description: 'Complete 5 different toolkit tools',
    icon: '🧰',
    color: '#F59E0B',
  },
  {
    id: 'toolkit-master',
    category: 'toolkit',
    name: 'Toolkit Master',
    description: 'Complete 10 different toolkit tools',
    icon: '🏆',
    color: '#EAB308',
  },

  // === Growth Badges (4) ===
  {
    id: 'deep-thinker',
    category: 'growth',
    name: 'Deep Thinker',
    description: '10+ high-effort responses across all tools',
    icon: '🧠',
    color: '#8B5CF6',
  },
  {
    id: 'consistent-worker',
    category: 'growth',
    name: 'Consistent Worker',
    description: 'Active for 5+ consecutive school days',
    icon: '🔥',
    color: '#F97316',
  },
  {
    id: 'reflective-practitioner',
    category: 'growth',
    name: 'Reflective Practitioner',
    description: '5+ reflections with 20+ meaningful words each',
    icon: '📝',
    color: '#3B82F6',
  },
  {
    id: 'iterative-designer',
    category: 'growth',
    name: 'Iterative Designer',
    description: 'Create v2+ versions in any toolkit tool',
    icon: '🔄',
    color: '#10B981',
  },

  // === Studio Badges (3) ===
  {
    id: 'studio-access',
    category: 'studio',
    name: 'Studio Access',
    description: 'Open Studio unlocked for any unit',
    icon: '🔓',
    color: '#7C3AED',
  },
  {
    id: 'focused-worker',
    category: 'studio',
    name: 'Focused Worker',
    description: '3+ Open Studio sessions with high productivity',
    icon: '🎯',
    color: '#10B981',
  },
  {
    id: 'project-owner',
    category: 'studio',
    name: 'Project Owner',
    description: 'Completed Open Studio Discovery (project statement)',
    icon: '🚀',
    color: '#EC4899',
  },
];

/**
 * Get a badge definition by ID
 */
export function getBadgeDefinition(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.id === id);
}

/**
 * Get all badge definitions for a category
 */
export function getBadgesByCategory(
  category: BadgeCategory
): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter((b) => b.category === category);
}

/**
 * Get the count of badges per category
 */
export function getBadgeCategoryCounts(): Record<BadgeCategory, number> {
  return {
    'design-cycle': getBadgesByCategory('design-cycle').length,
    safety: getBadgesByCategory('safety').length,
    toolkit: getBadgesByCategory('toolkit').length,
    growth: getBadgesByCategory('growth').length,
    studio: getBadgesByCategory('studio').length,
  };
}
