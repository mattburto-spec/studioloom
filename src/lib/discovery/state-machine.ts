/**
 * Discovery Engine — State Machine
 *
 * Controls navigation between stations and sub-steps.
 * Uses useReducer pattern (no XState dependency).
 *
 * Key principles:
 * - Every state transition triggers auto-save
 * - Guards prevent advancing without required data
 * - Resume always goes to START of current incomplete station
 * - Backward navigation allowed within a station, not between stations
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 4
 */

import type {
  DiscoveryState,
  DiscoveryProfile,
  DiscoveryStation,
  WorkingStyleDimension,
} from './types';

// ─── Actions ─────────────────────────────────────────────────────

export type DiscoveryAction =
  | { type: 'START' }
  | { type: 'RESUME'; state: DiscoveryState }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GO_TO_STEP'; step: DiscoveryState }
  | { type: 'COMPLETE_STATION'; station: DiscoveryStation }
  | { type: 'COMPLETE_JOURNEY' }
  | { type: 'SET_LOADING'; loading: boolean };

// ─── Machine State ───────────────────────────────────────────────

export interface DiscoveryMachineState {
  current: DiscoveryState;
  currentStation: DiscoveryStation;
  canGoBack: boolean;
  canGoForward: boolean;
  isTransition: boolean;
  isLoading: boolean;
  completedStations: Set<DiscoveryStation>;
}

// ─── Station Flow Definitions ────────────────────────────────────

/**
 * Ordered sub-steps within each station.
 * The state machine advances through these in order.
 */
const STATION_FLOWS: Record<number, DiscoveryState[]> = {
  0: ['station_0', 'station_0_palette', 'station_0_tools', 'station_0_workspace'],
  1: ['station_1', 'station_1_intro', 'station_1_quickfire', 'station_1_reflection'],
  2: ['station_2', 'station_2_intro', 'station_2_story', 'station_2_text_prompt', 'station_2_scenarios', 'station_2_people_grid', 'station_2_reveal'],
  3: ['station_3', 'station_3_intro', 'station_3_interest_grid', 'station_3_irritation', 'station_3_youtube', 'station_3_values_sort', 'station_3_reveal'],
  4: ['station_4', 'station_4_intro', 'station_4_story', 'station_4_scene', 'station_4_zoom', 'station_4_sliders', 'station_4_text_prompt', 'station_4_reveal'],
  5: ['station_5', 'station_5_intro', 'station_5_time', 'station_5_resources', 'station_5_people', 'station_5_efficacy', 'station_5_experience', 'station_5_failure', 'station_5_audience', 'station_5_time_horizon', 'station_5_reveal'],
  6: ['station_6', 'station_6_intro', 'station_6_generating', 'station_6_explore_1', 'station_6_explore_2', 'station_6_explore_3', 'station_6_custom', 'station_6_fear', 'station_6_choose'],
  7: ['station_7', 'station_7_intro', 'station_7_ascent', 'station_7_statement', 'station_7_criteria', 'station_7_excitement', 'station_7_grand_reveal', 'station_7_share'],
};

/**
 * Transition states between stations.
 */
const TRANSITIONS: Record<string, DiscoveryState> = {
  '0_1': 'transition_0_1',
  '1_2': 'transition_1_2',
  '2_3': 'transition_2_3',
  '3_4': 'transition_3_4',
  '4_5': 'transition_4_5',
  '5_6': 'transition_5_6',
  '6_7': 'transition_6_7',
};

/**
 * The full linear journey order: all station steps + transitions.
 */
const JOURNEY_ORDER: DiscoveryState[] = [
  ...STATION_FLOWS[0],
  'transition_0_1',
  ...STATION_FLOWS[1],
  'transition_1_2',
  ...STATION_FLOWS[2],
  'transition_2_3',
  ...STATION_FLOWS[3],
  'transition_3_4',
  ...STATION_FLOWS[4],
  'transition_4_5',
  ...STATION_FLOWS[5],
  'transition_5_6',
  ...STATION_FLOWS[6],
  'transition_6_7',
  ...STATION_FLOWS[7],
  'completed',
];

// ─── Helpers ─────────────────────────────────────────────────────

export function getStationFromState(state: DiscoveryState): DiscoveryStation {
  if (state.startsWith('station_0') || state === 'transition_0_1') return 0;
  if (state.startsWith('station_1') || state === 'transition_1_2') return 1;
  if (state.startsWith('station_2') || state === 'transition_2_3') return 2;
  if (state.startsWith('station_3') || state === 'transition_3_4') return 3;
  if (state.startsWith('station_4') || state === 'transition_4_5') return 4;
  if (state.startsWith('station_5') || state === 'transition_5_6') return 5;
  if (state.startsWith('station_6') || state === 'transition_6_7') return 6;
  if (state.startsWith('station_7')) return 7;
  return 0;
}

export function isTransitionState(state: DiscoveryState): boolean {
  return state.startsWith('transition_');
}

export function getStationProgress(state: DiscoveryState, station: DiscoveryStation): number {
  const flow = STATION_FLOWS[station];
  if (!flow) return 0;
  const stateIdx = flow.indexOf(state);
  if (stateIdx === -1) return 0;
  return Math.round(((stateIdx + 1) / flow.length) * 100);
}

export function getTotalProgress(state: DiscoveryState): number {
  if (state === 'not_started' || state === 'loading') return 0;
  if (state === 'completed') return 100;
  const idx = JOURNEY_ORDER.indexOf(state);
  if (idx === -1) return 0;
  return Math.round((idx / (JOURNEY_ORDER.length - 1)) * 100);
}

/**
 * Find the resume point for a profile.
 * Resume at START of current incomplete station.
 */
export function getResumeState(profile: DiscoveryProfile): DiscoveryState {
  if (profile.completedAt) return 'completed';
  const nextStation = (profile.lastStationCompleted + 1) as DiscoveryStation;
  if (nextStation > 7) return 'completed';
  const flow = STATION_FLOWS[nextStation];
  return flow ? flow[0] : 'station_0';
}

// ─── Transition Guards ───────────────────────────────────────────

/**
 * Check if the student can advance from the current state.
 * Returns true if all required data for this step is present.
 */
export function canAdvance(state: DiscoveryState, profile: DiscoveryProfile): boolean {
  switch (state) {
    // S0: Need all selections before leaving
    case 'station_0_palette':
      return profile.station0.palette !== null;
    case 'station_0_tools':
      return profile.station0.tools.length === 3;
    case 'station_0_workspace':
      return profile.station0.workspaceItems.length === 4;

    // S1: Need all 12 pairs before reflection
    case 'station_1_quickfire':
      return Object.keys(profile.station1.dimensions).length >= 12;

    // S2: Need text prompt before scenarios
    case 'station_2_text_prompt':
      return (profile.station2.panicResponse?.trim().length ?? 0) >= 10;
    case 'station_2_scenarios':
      return Object.keys(profile.station2.scenarioChoices).length >= 4; // at least 4 of 6
    case 'station_2_people_grid':
      return profile.station2.peopleIcons.length >= 2;

    // S3: Need at least some selections
    case 'station_3_interest_grid':
      return profile.station3.interests.length >= 3;
    case 'station_3_irritation':
      return profile.station3.irritationPresets.length >= 1 || (profile.station3.irritationFreeText?.trim().length ?? 0) >= 5;
    case 'station_3_youtube':
      return profile.station3.youtubeTopics.length >= 2;
    case 'station_3_values_sort':
      return profile.station3.valuesRanking.core.length >= 1;

    // S4: Need 2+ scene clicks, problem text
    case 'station_4_scene':
      return profile.station4.sceneClicks.length >= 2;
    case 'station_4_zoom':
      return profile.station4.zoomChoice !== null;
    case 'station_4_text_prompt':
      return (profile.station4.problemText?.trim().length ?? 0) >= 10;

    // S5: Time + at least some data
    case 'station_5_time':
      return profile.station5.timeHoursPerWeek !== null;
    case 'station_5_resources':
      return (profile.station5.resources.have.length + profile.station5.resources.canGet.length + profile.station5.resources.dontHave.length) >= 3;
    case 'station_5_efficacy':
      return Object.keys(profile.station5.selfEfficacy).length >= 5;

    // S6: Doors must exist, fear card selected, door chosen
    case 'station_6_generating':
      return profile.station6.doors.length === 3;
    case 'station_6_fear':
      return profile.station6.fearCards.length >= 1;
    case 'station_6_choose':
      return profile.station6.chosenDoorIndex !== null;

    // S7: Statement needs 10+ words
    case 'station_7_statement':
      return (profile.station7.projectStatement?.trim().split(/\s+/).length ?? 0) >= 10;
    case 'station_7_criteria':
      return profile.station7.successCriteria.length >= 3;
    case 'station_7_excitement':
      return profile.station7.excitementScore !== null;
    case 'station_7_grand_reveal':
      return profile.archetypeResult !== null;
    case 'station_7_share':
      return true; // Final screen — always passable

    // Everything else can advance freely (intros, reveals, transitions)
    default:
      return true;
  }
}

// ─── Reducer ─────────────────────────────────────────────────────

export function discoveryReducer(
  machineState: DiscoveryMachineState,
  action: DiscoveryAction,
): DiscoveryMachineState {
  switch (action.type) {
    case 'START':
      return {
        ...machineState,
        current: 'station_0',
        currentStation: 0,
        canGoBack: false,
        canGoForward: true,
        isTransition: false,
        isLoading: false,
      };

    case 'RESUME':
      return {
        ...machineState,
        current: action.state,
        currentStation: getStationFromState(action.state),
        canGoBack: JOURNEY_ORDER.indexOf(action.state) > 0,
        canGoForward: true,
        isTransition: isTransitionState(action.state),
        isLoading: false,
      };

    case 'NEXT': {
      const currentIdx = JOURNEY_ORDER.indexOf(machineState.current);
      if (currentIdx === -1 || currentIdx >= JOURNEY_ORDER.length - 1) return machineState;
      const next = JOURNEY_ORDER[currentIdx + 1];
      return {
        ...machineState,
        current: next,
        currentStation: getStationFromState(next),
        canGoBack: true,
        canGoForward: next !== 'completed',
        isTransition: isTransitionState(next),
      };
    }

    case 'BACK': {
      const currentIdx = JOURNEY_ORDER.indexOf(machineState.current);
      if (currentIdx <= 0) return machineState;
      const prev = JOURNEY_ORDER[currentIdx - 1];
      return {
        ...machineState,
        current: prev,
        currentStation: getStationFromState(prev),
        canGoBack: currentIdx - 1 > 0,
        canGoForward: true,
        isTransition: isTransitionState(prev),
      };
    }

    case 'GO_TO_STEP': {
      const targetIdx = JOURNEY_ORDER.indexOf(action.step);
      if (targetIdx === -1) return machineState;
      return {
        ...machineState,
        current: action.step,
        currentStation: getStationFromState(action.step),
        canGoBack: targetIdx > 0,
        canGoForward: action.step !== 'completed',
        isTransition: isTransitionState(action.step),
      };
    }

    case 'COMPLETE_STATION':
      return {
        ...machineState,
        completedStations: new Set([...machineState.completedStations, action.station]),
      };

    case 'COMPLETE_JOURNEY':
      return {
        ...machineState,
        current: 'completed',
        canGoBack: true,
        canGoForward: false,
        isTransition: false,
      };

    case 'SET_LOADING':
      return {
        ...machineState,
        isLoading: action.loading,
      };

    default:
      return machineState;
  }
}

// ─── Initial State ───────────────────────────────────────────────

export function createInitialMachineState(): DiscoveryMachineState {
  return {
    current: 'not_started',
    currentStation: 0,
    canGoBack: false,
    canGoForward: false,
    isTransition: false,
    isLoading: true,
    completedStations: new Set(),
  };
}

// ─── Station Metadata ────────────────────────────────────────────

export interface StationMeta {
  station: DiscoveryStation;
  name: string;
  shortName: string;
  description: string;
  emoji: string;
  estimatedMinutes: number;
  color: string;           // Tailwind color class
  gradientFrom: string;
  gradientTo: string;
}

export const STATION_META: StationMeta[] = [
  { station: 0, name: 'Design Identity Card', shortName: 'Identity', description: 'Choose your colours, tools, and workspace', emoji: '🎨', estimatedMinutes: 3, color: 'purple', gradientFrom: 'from-purple-900', gradientTo: 'to-indigo-900' },
  { station: 1, name: 'The Campfire', shortName: 'Campfire', description: 'Quick-fire choices to reveal how you think', emoji: '🔥', estimatedMinutes: 5, color: 'orange', gradientFrom: 'from-orange-900', gradientTo: 'to-red-900' },
  { station: 2, name: 'The Workshop', shortName: 'Workshop', description: 'Scenarios that reveal your design strengths', emoji: '🔧', estimatedMinutes: 8, color: 'amber', gradientFrom: 'from-amber-900', gradientTo: 'to-yellow-900' },
  { station: 3, name: 'The Collection Wall', shortName: 'Interests', description: 'Build a wall of what you care about', emoji: '📌', estimatedMinutes: 7, color: 'teal', gradientFrom: 'from-teal-900', gradientTo: 'to-cyan-900' },
  { station: 4, name: 'The Window', shortName: 'Problems', description: 'Look out and notice what needs fixing', emoji: '🪟', estimatedMinutes: 7, color: 'blue', gradientFrom: 'from-blue-900', gradientTo: 'to-sky-900' },
  { station: 5, name: 'The Toolkit', shortName: 'Resources', description: 'What you have to work with — the reality check', emoji: '🧰', estimatedMinutes: 6, color: 'emerald', gradientFrom: 'from-emerald-900', gradientTo: 'to-green-900' },
  { station: 6, name: 'The Crossroads', shortName: 'Direction', description: 'Three doors — choose your project path', emoji: '🚪', estimatedMinutes: 9, color: 'violet', gradientFrom: 'from-violet-900', gradientTo: 'to-purple-900' },
  { station: 7, name: 'The Launchpad', shortName: 'Launch', description: 'Commit to your project and blast off', emoji: '🚀', estimatedMinutes: 5, color: 'rose', gradientFrom: 'from-rose-900', gradientTo: 'to-pink-900' },
];
