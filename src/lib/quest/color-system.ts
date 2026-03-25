// Quest Color System — Gris-inspired color-as-progression
// Each phase transitions from desaturated (not reached) to vivid (active/complete)
// CSS filter: saturate() is applied to the map regions

import type { QuestPhase } from './types';

export interface PhaseColorConfig {
  /** Base hue for the phase region (fully saturated) */
  baseColor: string;
  /** Muted version for incomplete/upcoming phases */
  mutedColor: string;
  /** Glow/accent color for active milestone markers */
  glowColor: string;
  /** Background tint for the map region */
  backgroundTint: string;
  /** CSS saturate() value: 0 = grayscale, 1 = full color */
  saturation: number;
}

/** Phase color palettes (Gris watercolor aesthetic) */
export const PHASE_COLORS: Record<QuestPhase, PhaseColorConfig> = {
  not_started: {
    baseColor: '#9CA3AF',   // gray-400
    mutedColor: '#D1D5DB',  // gray-300
    glowColor: '#E5E7EB',   // gray-200
    backgroundTint: 'rgba(156, 163, 175, 0.05)',
    saturation: 0,
  },
  discovery: {
    baseColor: '#F59E0B',   // amber-500
    mutedColor: '#D4C5A0',  // desaturated amber
    glowColor: '#FCD34D',   // amber-300
    backgroundTint: 'rgba(245, 158, 11, 0.08)',
    saturation: 0.3,
  },
  planning: {
    baseColor: '#6366F1',   // indigo-500
    mutedColor: '#A5A8D0',  // desaturated indigo
    glowColor: '#A5B4FC',   // indigo-300
    backgroundTint: 'rgba(99, 102, 241, 0.08)',
    saturation: 0.5,
  },
  working: {
    baseColor: '#10B981',   // emerald-500
    mutedColor: '#93C5B2',  // desaturated emerald
    glowColor: '#6EE7B7',   // emerald-300
    backgroundTint: 'rgba(16, 185, 129, 0.08)',
    saturation: 0.75,
  },
  sharing: {
    baseColor: '#8B5CF6',   // violet-500
    mutedColor: '#B8A8D8',  // desaturated violet
    glowColor: '#C4B5FD',   // violet-300
    backgroundTint: 'rgba(139, 92, 246, 0.08)',
    saturation: 0.9,
  },
  completed: {
    baseColor: '#EC4899',   // pink-500
    mutedColor: '#D4A0B8',  // desaturated pink
    glowColor: '#F9A8D4',   // pink-300
    backgroundTint: 'rgba(236, 72, 153, 0.08)',
    saturation: 1.0,
  },
};

/** Get the saturation level for a phase region based on the journey's current phase */
export function getRegionSaturation(
  regionPhase: QuestPhase,
  currentPhase: QuestPhase
): number {
  const phaseOrder: QuestPhase[] = ['not_started', 'discovery', 'planning', 'working', 'sharing', 'completed'];
  const regionIndex = phaseOrder.indexOf(regionPhase);
  const currentIndex = phaseOrder.indexOf(currentPhase);

  if (regionIndex <= currentIndex) {
    // Reached or passed this phase — show in full color
    return PHASE_COLORS[regionPhase].saturation;
  }

  // Not yet reached — desaturated
  return 0.05;
}

/** Get CSS filter string for a map region */
export function getRegionFilter(
  regionPhase: QuestPhase,
  currentPhase: QuestPhase
): string {
  const sat = getRegionSaturation(regionPhase, currentPhase);
  return `saturate(${sat})`;
}

/** Get the transition animation config for phase change */
export function getPhaseTransitionConfig(newPhase: QuestPhase): {
  duration: number;
  easing: string;
  colorBurst: string;
} {
  const config = PHASE_COLORS[newPhase];
  return {
    duration: 1.5,  // seconds
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    colorBurst: config.glowColor,
  };
}
