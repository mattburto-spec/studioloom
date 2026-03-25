// Quest Phase State Machine
// Pure functions — no side effects, no DB access

import type { QuestPhase, QuestJourney, QuestMilestone } from './types';

/** Valid phase transitions (strict forward-only) */
const TRANSITIONS: Record<QuestPhase, QuestPhase[]> = {
  not_started: ['discovery'],
  discovery: ['planning'],
  planning: ['working'],
  working: ['sharing'],
  sharing: ['completed'],
  completed: [],
};

/** Can the journey move from current phase to target? */
export function canTransition(current: QuestPhase, target: QuestPhase): boolean {
  return TRANSITIONS[current]?.includes(target) ?? false;
}

/** Check if Discovery phase is complete (all required fields populated) */
export function isDiscoveryComplete(journey: QuestJourney): boolean {
  const p = journey.discovery_profile;
  if (!p) return false;
  return (
    Array.isArray(p.strengths) && p.strengths.length > 0 &&
    Array.isArray(p.interests) && p.interests.length > 0 &&
    Array.isArray(p.needs) && p.needs.length > 0 &&
    typeof p.project_idea === 'string' && p.project_idea.trim().length >= 20
  );
}

/** Check if Planning phase is complete (contract confirmed + milestones set) */
export function isPlanningComplete(
  journey: QuestJourney,
  milestones: QuestMilestone[]
): boolean {
  const c = journey.contract;
  if (!c || !c.confirmed_at) return false;
  if (!Array.isArray(milestones)) return false;

  // Must have at least 3 milestones with target dates in the working phase
  const datedMilestones = milestones.filter(m => m.target_date && m.phase === 'working');
  return datedMilestones.length >= 3;
}

/** Check if Working phase is complete (all working milestones done or skipped) */
export function isWorkingComplete(milestones: QuestMilestone[]): boolean {
  if (!Array.isArray(milestones)) return false;
  const workingMilestones = milestones.filter(m => m.phase === 'working');
  if (workingMilestones.length === 0) return false;
  return workingMilestones.every(m => m.status === 'completed' || m.status === 'skipped');
}

/** Check if Sharing phase is complete */
export function isSharingComplete(
  milestones: QuestMilestone[],
  sharingEvidenceCount: number
): boolean {
  if (!Array.isArray(milestones)) return false;
  const sharingMilestones = milestones.filter(m => m.phase === 'sharing');
  const allDone = sharingMilestones.every(m => m.status === 'completed' || m.status === 'skipped');
  return allDone && sharingEvidenceCount > 0;
}

/** Get the next valid phase transition (if any) */
export function getNextPhase(
  journey: QuestJourney,
  milestones: QuestMilestone[],
  sharingEvidenceCount: number
): QuestPhase | null {
  switch (journey.phase) {
    case 'not_started': return 'discovery';
    case 'discovery': return isDiscoveryComplete(journey) ? 'planning' : null;
    case 'planning': return isPlanningComplete(journey, milestones) ? 'working' : null;
    case 'working': return isWorkingComplete(milestones) ? 'sharing' : null;
    case 'sharing': return isSharingComplete(milestones, sharingEvidenceCount) ? 'completed' : null;
    case 'completed': return null;
    default: return null;
  }
}

/** Get completion percentage (0-100) for progress display */
export function getPhaseProgress(phase: QuestPhase): number {
  const map: Record<QuestPhase, number> = {
    not_started: 0,
    discovery: 15,
    planning: 30,
    working: 65,
    sharing: 90,
    completed: 100,
  };
  return map[phase] ?? 0;
}

/** Count how many milestones are complete in a phase */
export function getPhaseMilestoneProgress(
  milestones: QuestMilestone[],
  phase: QuestPhase
): { completed: number; total: number } {
  if (!Array.isArray(milestones)) return { completed: 0, total: 0 };
  const phaseMilestones = milestones.filter(m => m.phase === phase);
  const completed = phaseMilestones.filter(m => m.status === 'completed').length;
  return { completed, total: phaseMilestones.length };
}
