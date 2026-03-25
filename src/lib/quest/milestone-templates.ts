// Milestone Templates per Framework
// Generates default milestones for each quest phase

import type { QuestPhase, MilestoneSource } from './types';
import type { FrameworkDefinition } from '@/lib/frameworks';

export interface MilestoneTemplate {
  title: string;
  description: string;
  phase: QuestPhase;
  framework_phase_id: string;
  source: MilestoneSource;
}

/** Generate default milestones for a framework's Working phase */
export function getWorkingMilestones(framework: FrameworkDefinition): MilestoneTemplate[] {
  return framework.phases.map((fp) => ({
    title: `${fp.name} checkpoint`,
    description: fp.description,
    phase: 'working' as QuestPhase,
    framework_phase_id: fp.id,
    source: 'template' as MilestoneSource,
  }));
}

/** Planning phase always has these milestones */
export const PLANNING_MILESTONES: MilestoneTemplate[] = [
  {
    title: 'Vision of Done defined',
    description: 'Describe what the finished project looks like at presentation',
    phase: 'planning',
    framework_phase_id: '',
    source: 'template',
  },
  {
    title: 'Project contract confirmed',
    description: 'Complete and confirm your project contract',
    phase: 'planning',
    framework_phase_id: '',
    source: 'template',
  },
  {
    title: 'Resources identified',
    description: 'List people, materials, and tools you need',
    phase: 'planning',
    framework_phase_id: '',
    source: 'template',
  },
];

/** Sharing phase always has these milestones */
export const SHARING_MILESTONES: MilestoneTemplate[] = [
  {
    title: 'Presentation prepared',
    description: 'Story structure, visually ready, practice done',
    phase: 'sharing',
    framework_phase_id: '',
    source: 'template',
  },
  {
    title: 'Presented to audience',
    description: 'Delivered your presentation or exhibition',
    phase: 'sharing',
    framework_phase_id: '',
    source: 'template',
  },
  {
    title: 'Final reflection written',
    description: 'Compare original goals to actual outcomes',
    phase: 'sharing',
    framework_phase_id: '',
    source: 'template',
  },
];

/** Get all default milestones for a journey (planning + working + sharing) */
export function getAllDefaultMilestones(framework: FrameworkDefinition): MilestoneTemplate[] {
  return [
    ...PLANNING_MILESTONES,
    ...getWorkingMilestones(framework),
    ...SHARING_MILESTONES,
  ];
}
