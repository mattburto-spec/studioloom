// Quest Journey System — Barrel Exports

// Types
export type {
  QuestPhase,
  MentorId,
  HelpIntensity,
  HealthLevel,
  MilestoneStatus,
  MilestoneSource,
  EvidenceType,
  QuestInteractionType,
  HealthScore,
  DiscoveryProfile,
  StudentContract,
  QuestJourney,
  QuestMilestone,
  QuestEvidence,
  QuestMentorInteraction,
  EvidenceAnalysis,
} from './types';

export { PHASE_ORDER, PHASE_LABELS, DEFAULT_HEALTH_SCORE } from './types';

// Phase machine
export {
  canTransition,
  isDiscoveryComplete,
  isPlanningComplete,
  isWorkingComplete,
  isSharingComplete,
  getNextPhase,
  getPhaseProgress,
  getPhaseMilestoneProgress,
} from './phase-machine';

// Health
export { computeHealthScore, getHealthSummary, getHealthColor } from './health';
export type { HealthInput } from './health';

// Mentors
export { MENTORS, getMentor, MENTOR_OPTIONS } from './mentors';
export type { MentorDefinition } from './mentors';

// Milestone templates
export {
  getWorkingMilestones,
  getAllDefaultMilestones,
  PLANNING_MILESTONES,
  SHARING_MILESTONES,
} from './milestone-templates';
export type { MilestoneTemplate } from './milestone-templates';

// Prompt composition
export { buildQuestPrompt } from './build-quest-prompt';
export type { QuestPromptContext } from './build-quest-prompt';
