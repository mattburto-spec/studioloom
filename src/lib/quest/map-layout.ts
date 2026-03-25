import type { QuestPhase, QuestMilestone } from './types';

/**
 * Map node representing a milestone or phase gate on the overworld
 */
export interface MapNode {
  id: string; // milestone ID or phase gate ID
  type: 'gate' | 'milestone';
  x: number;
  y: number;
  phase: QuestPhase;
  label: string;
  status: string; // milestone status or 'gate'
  milestoneData?: QuestMilestone;
}

/**
 * Connection between two map nodes
 */
export interface MapEdge {
  from: string; // node ID
  to: string; // node ID
  phase: QuestPhase;
}

/**
 * Complete map layout with nodes, edges, and viewBox
 */
export interface MapLayout {
  nodes: MapNode[];
  edges: MapEdge[];
  viewBox: { width: number; height: number };
}

// ============================================================================
// Constants
// ============================================================================

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 400;
const MAP_PADDING = 60;

// Phase gate X positions (evenly spaced across map)
const PHASE_GATE_X: Record<string, number> = {
  discovery: 120,
  planning: 380,
  working: 640,
  sharing: 900,
  completed: 1100,
};

// Vertical center of map
const CENTER_Y = MAP_HEIGHT / 2;

// Vertical spread amount for milestones within a phase
const SPREAD_AMOUNT = 80;

// Phase order for computation
const PHASE_ORDER: QuestPhase[] = ['discovery', 'planning', 'working', 'sharing'];

// ============================================================================
// Main Function
// ============================================================================

/**
 * Compute the complete map layout from milestones and current phase
 *
 * Layout strategy:
 * - Phase gates are fixed at horizontal positions
 * - Milestones are spread vertically between phases
 * - X position interpolates based on sort_order within the phase
 * - Y position uses sinusoidal spread (alternating above/below center)
 * - Edges connect gate → milestone → milestone → gate
 */
export function computeMapLayout(
  milestones: QuestMilestone[],
  currentPhase: QuestPhase
): MapLayout {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];

  // Add all phase gates first
  const gateIds = getPhaseGateIds();
  for (const gateId of gateIds) {
    const phaseKey = gateId.replace('gate_', '') as QuestPhase;
    nodes.push({
      id: gateId,
      type: 'gate',
      x: PHASE_GATE_X[phaseKey],
      y: CENTER_Y,
      phase: phaseKey,
      label: phaseKey.charAt(0).toUpperCase() + phaseKey.slice(1),
      status: 'gate',
    });
  }

  // Group milestones by phase
  const milestonesByPhase = groupMilestonesByPhase(milestones);

  // Process each phase
  for (const phase of PHASE_ORDER) {
    const phaseMilestones = milestonesByPhase[phase] || [];

    if (phaseMilestones.length === 0) {
      continue;
    }

    // Add milestone nodes
    const phaseNodeIds: string[] = [];
    const currentGateX = PHASE_GATE_X[phase];
    const nextPhaseIndex = PHASE_ORDER.indexOf(phase) + 1;
    const nextPhase = nextPhaseIndex < PHASE_ORDER.length ? PHASE_ORDER[nextPhaseIndex] : 'completed';
    const nextGateX = PHASE_GATE_X[nextPhase];

    for (let i = 0; i < phaseMilestones.length; i++) {
      const milestone = phaseMilestones[i];
      const progress = (i + 1) / (phaseMilestones.length + 1); // Spread between gates

      // X position: interpolate between current gate and next gate
      const x = currentGateX + (nextGateX - currentGateX) * progress;

      // Y position: sinusoidal spread alternating above/below center
      const isAbove = i % 2 === 0;
      const normalizedPos = (i / Math.max(1, phaseMilestones.length - 1)) * Math.PI;
      const sinOffset = Math.sin(normalizedPos) * SPREAD_AMOUNT;
      const y = CENTER_Y + (isAbove ? -sinOffset : sinOffset);

      const nodeId = `milestone_${milestone.id}`;
      phaseNodeIds.push(nodeId);

      nodes.push({
        id: nodeId,
        type: 'milestone',
        x,
        y,
        phase,
        label: milestone.title,
        status: milestone.status,
        milestoneData: milestone,
      });
    }

    // Add edges: gate → milestones → next gate
    if (phaseNodeIds.length > 0) {
      // Gate to first milestone
      edges.push({
        from: `gate_${phase}`,
        to: phaseNodeIds[0],
        phase,
      });

      // Milestone to milestone
      for (let i = 0; i < phaseNodeIds.length - 1; i++) {
        edges.push({
          from: phaseNodeIds[i],
          to: phaseNodeIds[i + 1],
          phase,
        });
      }

      // Last milestone to next gate
      edges.push({
        from: phaseNodeIds[phaseNodeIds.length - 1],
        to: `gate_${nextPhase}`,
        phase,
      });
    }
  }

  return {
    nodes,
    edges,
    viewBox: { width: MAP_WIDTH, height: MAP_HEIGHT },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the ID of the currently active node
 * - If there are incomplete milestones in the current phase, return the first one
 * - Otherwise, return the current phase gate
 */
export function getActiveNodeId(
  milestones: QuestMilestone[],
  currentPhase: QuestPhase
): string {
  const phaseMilestones = milestones.filter((m) => m.phase === currentPhase);
  const incompleteMilestone = phaseMilestones.find(
    (m) => m.status === 'upcoming' || m.status === 'active'
  );

  if (incompleteMilestone) {
    return `milestone_${incompleteMilestone.id}`;
  }

  return `gate_${currentPhase}`;
}

/**
 * Get all phase gate IDs in order
 */
export function getPhaseGateIds(): string[] {
  return [
    'gate_discovery',
    'gate_planning',
    'gate_working',
    'gate_sharing',
    'gate_completed',
  ];
}

/**
 * Get X position for a phase gate
 */
export function getPhaseGateX(phase: QuestPhase): number {
  return PHASE_GATE_X[phase] || 0;
}

/**
 * Get Y position for center line (where phase gates sit)
 */
export function getCenterY(): number {
  return CENTER_Y;
}

/**
 * Get the next phase in the quest progression
 */
export function getNextPhase(currentPhase: QuestPhase): QuestPhase | 'completed' {
  const index = PHASE_ORDER.indexOf(currentPhase);
  if (index === -1 || index >= PHASE_ORDER.length - 1) {
    return 'completed';
  }
  return PHASE_ORDER[index + 1];
}

/**
 * Check if a phase is accessible (has already been reached or is current)
 */
export function isPhaseAccessible(phase: QuestPhase, currentPhase: QuestPhase): boolean {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  const phaseIndex = PHASE_ORDER.indexOf(phase);

  if (phaseIndex === -1) return false; // 'completed' is always accessible
  return phaseIndex <= currentIndex;
}

// ============================================================================
// Internal Utilities
// ============================================================================

/**
 * Group milestones by their phase and sort by sort_order within each phase
 */
function groupMilestonesByPhase(milestones: QuestMilestone[]): Record<QuestPhase, QuestMilestone[]> {
  const grouped: Record<string, QuestMilestone[]> = {
    not_started: [],
    discovery: [],
    planning: [],
    working: [],
    sharing: [],
    completed: [],
  };

  for (const milestone of milestones) {
    if (grouped[milestone.phase]) {
      grouped[milestone.phase].push(milestone);
    }
  }

  // Sort each phase by sort_order
  for (const phase of PHASE_ORDER) {
    grouped[phase].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  return grouped;
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
