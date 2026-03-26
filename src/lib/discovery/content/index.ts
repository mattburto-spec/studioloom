/**
 * Discovery Engine — Content Pool Loader
 *
 * Loads content filtered by age band.
 * v1: All content is hardcoded TypeScript.
 * v2 (future): Teacher content control panel overrides via DB.
 *
 * Age bands:
 * - junior: MYP Years 1-3, ages 11-13
 * - senior: MYP Years 4-5, ages 14-16
 * - extended: DP/CP, ages 17-18
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2
 */

import type { AgeBand, BinaryPair } from '../types';
import { PALETTES, TOOLS, WORKSPACE_ITEMS, STATION_0_KIT_DIALOGUE } from './station-0-identity';
import { BINARY_PAIRS, QUICK_FIRE_REFLECTIONS, STATION_1_KIT_DIALOGUE } from './station-1-campfire';
import { SCENARIOS, PEOPLE_ICONS, STATION_2_KIT_DIALOGUE, getScenariosForAge } from './station-2-workshop';
import { INTEREST_ICONS, IRRITATION_SCENARIOS, YOUTUBE_TOPICS, VALUE_CARDS, STATION_3_KIT_DIALOGUE } from './station-3-collection';
import { SCENE_HOTSPOTS, STATION_4_KIT_DIALOGUE } from './station-4-window';
import {
  RESOURCE_CARDS, SUPPORT_PEOPLE, SELF_EFFICACY_DOMAINS,
  PAST_PROJECT_OPTIONS, LAST_PROJECT_OPTIONS,
  FAILURE_RESPONSE_OPTIONS, AUDIENCE_OPTIONS,
  STATION_5_KIT_DIALOGUE,
} from './station-5-toolkit';

// Re-exports
export { PALETTES, TOOLS, WORKSPACE_ITEMS, STATION_0_KIT_DIALOGUE } from './station-0-identity';
export { BINARY_PAIRS, QUICK_FIRE_REFLECTIONS, STATION_1_KIT_DIALOGUE, computeWorkingStyle, computeDominantStyle } from './station-1-campfire';
export { SCENARIOS, PEOPLE_ICONS, STATION_2_KIT_DIALOGUE, getScenariosForAge, computeScenarioArchetypeSignals, computePeopleArchetypeSignals } from './station-2-workshop';
export { INTEREST_ICONS, IRRITATION_SCENARIOS, YOUTUBE_TOPICS, VALUE_CARDS, STATION_3_KIT_DIALOGUE } from './station-3-collection';
export { SCENE_HOTSPOTS, STATION_4_KIT_DIALOGUE, analyzeClickPattern, getTextPrompt } from './station-4-window';
export {
  RESOURCE_CARDS, RESOURCE_KIT_LINES, SUPPORT_PEOPLE, SELF_EFFICACY_DOMAINS,
  EFFICACY_SLIDER_LABELS, EFFICACY_KIT_REACTIONS,
  PAST_PROJECT_OPTIONS, LAST_PROJECT_OPTIONS,
  FAILURE_RESPONSE_OPTIONS, AUDIENCE_OPTIONS,
  STATION_5_KIT_DIALOGUE,
} from './station-5-toolkit';

// ─── Age Band Detection ──────────────────────────────────────────

export function detectAgeBand(graduationYear: number | null, currentYear?: number): AgeBand {
  if (!graduationYear) return 'senior';
  const now = currentYear ?? new Date().getFullYear();
  const yearsUntilGrad = graduationYear - now;
  if (yearsUntilGrad >= 5) return 'junior';
  if (yearsUntilGrad >= 2) return 'senior';
  return 'extended';
}

export function ageBandFromAge(age: number): AgeBand {
  if (age <= 13) return 'junior';
  if (age <= 16) return 'senior';
  return 'extended';
}

// ─── Content Filtering ───────────────────────────────────────────

export function filterByAgeBand<T extends { ageBands: AgeBand[] }>(
  items: T[],
  band: AgeBand,
): T[] {
  return items.filter(item =>
    item.ageBands.length === 3 || item.ageBands.includes(band)
  );
}

export function getBinaryPairs(ageBand: AgeBand): BinaryPair[] {
  return filterByAgeBand(BINARY_PAIRS, ageBand);
}

// ─── Station-Level Content Loaders ───────────────────────────────

export function getStation0Content() {
  return { palettes: PALETTES, tools: TOOLS, workspaceItems: WORKSPACE_ITEMS, kitDialogue: STATION_0_KIT_DIALOGUE };
}

export function getStation1Content(ageBand: AgeBand) {
  return { binaryPairs: getBinaryPairs(ageBand), reflections: QUICK_FIRE_REFLECTIONS, kitDialogue: STATION_1_KIT_DIALOGUE };
}

export function getStation2Content(ageBand: AgeBand) {
  return { scenarios: getScenariosForAge(ageBand), peopleIcons: PEOPLE_ICONS, kitDialogue: STATION_2_KIT_DIALOGUE };
}

export function getStation3Content(ageBand: AgeBand) {
  return {
    interests: filterByAgeBand(INTEREST_ICONS, ageBand),
    irritations: filterByAgeBand(IRRITATION_SCENARIOS, ageBand),
    youtubeTopics: filterByAgeBand(YOUTUBE_TOPICS, ageBand),
    valueCards: VALUE_CARDS,
    kitDialogue: STATION_3_KIT_DIALOGUE,
  };
}

export function getStation4Content() {
  return { hotspots: SCENE_HOTSPOTS, kitDialogue: STATION_4_KIT_DIALOGUE };
}

export function getStation5Content() {
  return {
    resources: RESOURCE_CARDS,
    people: SUPPORT_PEOPLE,
    efficacy: SELF_EFFICACY_DOMAINS,
    pastProjectOptions: PAST_PROJECT_OPTIONS,
    lastProjectOptions: LAST_PROJECT_OPTIONS,
    failureOptions: FAILURE_RESPONSE_OPTIONS,
    audienceOptions: AUDIENCE_OPTIONS,
    kitDialogue: STATION_5_KIT_DIALOGUE,
  };
}
