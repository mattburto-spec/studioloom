/**
 * Discovery Engine — Archetype Scoring Aggregation
 *
 * Computes final archetype scores (0-100 per archetype) by aggregating
 * signals from all completed stations using STATION_WEIGHTS.
 *
 * Architecture:
 * 1. Each station produces raw archetype signals (absolute numbers)
 * 2. Signals are normalized to 0-100 per station (percentage of max possible)
 * 3. Weighted average across stations produces final 0-100 scores
 *
 * Signal sources:
 * - s0_tools:             3 tool selections → archetype weights
 * - s2_scenarios:         6 scenario choices → archetype weights
 * - s2_people:            2-3 people icon selections → archetype weights (1.5× multiplier)
 * - s3_irritation_ai:     Free-text AI analysis → archetype signals (highest weight)
 * - s3_irritation_preset: Preset irritation selections → category mapping
 * - s3_interests:         5-7 interest icons → cluster mapping
 * - s5_efficacy:          7 self-efficacy sliders → archetype correlations
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Scoring
 */

import type {
  DesignArchetype,
  DiscoveryProfile,
  StationArchetypeSignal,
} from './types';
import { ALL_ARCHETYPES, STATION_WEIGHTS } from './types';
import { TOOLS } from './content/station-0-identity';
import { SCENARIOS, PEOPLE_ICONS, computeScenarioArchetypeSignals, computePeopleArchetypeSignals } from './content/station-2-workshop';
import { SELF_EFFICACY_DOMAINS } from './content/station-5-toolkit';
import { INTEREST_ICONS, IRRITATION_SCENARIOS } from './content/station-3-collection';

// ─── Zero Scores Helper ──────────────────────────────────────────

function zeroScores(): Record<DesignArchetype, number> {
  return { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 };
}

// ─── Per-Station Signal Extractors ───────────────────────────────

/**
 * S0: Tools — 3 selected tools, each with archetype weights (0-3).
 * Max possible = 3 tools × max weight 3 = 9 per archetype (theoretical).
 * Practical max ~9 (if all 3 tools max same archetype).
 */
function extractS0Tools(profile: DiscoveryProfile): StationArchetypeSignal {
  const raw = zeroScores();
  const selectedIds = profile.station0.tools;

  for (const toolId of selectedIds) {
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool) continue;
    for (const arch of ALL_ARCHETYPES) {
      raw[arch] += tool.archetypeWeights[arch] ?? 0;
    }
  }

  // Max possible: 3 tools × 3 (max weight per tool) = 9
  return { station: 's0_tools', raw, maxPossible: 9, signalQuality: selectedIds.length >= 3 ? 1 : selectedIds.length / 3 };
}

/**
 * S2: Scenarios — 6 scenarios, each choice has archetype weights (typically 3).
 * Max possible = 6 × 3 = 18 per archetype (theoretical).
 */
function extractS2Scenarios(profile: DiscoveryProfile): StationArchetypeSignal {
  const choices = profile.station2.scenarioChoices;
  const raw = computeScenarioArchetypeSignals(SCENARIOS, choices);
  const answeredCount = Object.keys(choices).length;

  // Max per scenario = 3, max scenarios = 6
  return { station: 's2_scenarios', raw, maxPossible: 18, signalQuality: answeredCount >= 6 ? 1 : answeredCount / 6 };
}

/**
 * S2: People icons — 2-3 selected, with 1.5× multiplier.
 * Uses the existing computePeopleArchetypeSignals function.
 */
function extractS2People(profile: DiscoveryProfile): StationArchetypeSignal {
  const raw = computePeopleArchetypeSignals(profile.station2.peopleIcons);
  const selectedCount = profile.station2.peopleIcons.length;

  // Max: 3 icons × max weight 3 × 1.5 multiplier = 13.5
  return { station: 's2_people', raw, maxPossible: 13.5, signalQuality: selectedCount >= 2 ? 1 : selectedCount / 2 };
}

/**
 * S3: Irritation AI analysis — free-text irritation analyzed by Haiku.
 * Returns archetype_signals directly from AI analysis (0-3 scale per archetype).
 * This is the highest-weighted signal (0.20).
 */
function extractS3IrritationAI(profile: DiscoveryProfile): StationArchetypeSignal {
  const analysis = profile.station3.irritationAiAnalysis;
  if (!analysis) {
    return { station: 's3_irritation_ai', raw: zeroScores(), maxPossible: 3, signalQuality: 0 };
  }

  const raw = zeroScores();
  for (const arch of ALL_ARCHETYPES) {
    raw[arch] = analysis.archetype_signals[arch] ?? 0;
  }

  return { station: 's3_irritation_ai', raw, maxPossible: 3, signalQuality: 1 };
}

/**
 * S3: Irritation presets — category-based mapping.
 * Each irritation category maps loosely to archetypes.
 */
const IRRITATION_CATEGORY_MAP: Record<string, Partial<Record<DesignArchetype, number>>> = {
  'Environmental / Systems': { Systems: 2, Maker: 1 },
  'Design / Systems': { Systems: 2, Creative: 1 },
  'Autonomy / Leader': { Leader: 2, Communicator: 1 },
  'Social / Communicator': { Communicator: 2, Leader: 1 },
  'Autonomy / Creative': { Creative: 2, Leader: 1 },
  'Systems / Design': { Systems: 2, Creative: 1 },
  'Environment / Creative': { Creative: 2, Maker: 1 },
  'Fairness / Leader': { Leader: 2, Systems: 1 },
  'Systems / Researcher': { Researcher: 2, Systems: 1 },
  'Justice / Systems': { Systems: 2, Researcher: 1 },
};

function extractS3IrritationPreset(profile: DiscoveryProfile): StationArchetypeSignal {
  const raw = zeroScores();
  const presetIds = profile.station3.irritationPresets;

  for (const id of presetIds) {
    const found = IRRITATION_SCENARIOS.find(s => s.id === id);
    if (!found) continue;
    const mapping = IRRITATION_CATEGORY_MAP[found.category];
    if (!mapping) continue;
    for (const [arch, weight] of Object.entries(mapping)) {
      raw[arch as DesignArchetype] += weight;
    }
  }

  // Max: 2 presets × max weight 2 = 4
  return { station: 's3_irritation_preset', raw, maxPossible: 4, signalQuality: presetIds.length > 0 ? 1 : 0 };
}

/**
 * S3: Interests — 5-7 selected interest icons.
 * Cluster → archetype mapping.
 */
const INTEREST_CLUSTER_MAP: Record<string, Partial<Record<DesignArchetype, number>>> = {
  'Physical creation': { Maker: 2 },
  'Creative expression': { Creative: 2 },
  'Technology': { Systems: 1, Researcher: 1 },
  'Communication': { Communicator: 2 },
  'Research': { Researcher: 2 },
  'Environment': { Systems: 1, Maker: 1 },
  'Exploration': { Researcher: 1, Creative: 1 },
  'Systems': { Systems: 2 },
  'Values': { Leader: 1, Communicator: 1 },
  'Physical': { Maker: 1 },
};

function extractS3Interests(profile: DiscoveryProfile): StationArchetypeSignal {
  const raw = zeroScores();
  const selectedIds = profile.station3.interests;

  for (const id of selectedIds) {
    const icon = INTEREST_ICONS.find(i => i.id === id);
    if (!icon) continue;
    const mapping = INTEREST_CLUSTER_MAP[icon.cluster];
    if (!mapping) continue;
    for (const [arch, weight] of Object.entries(mapping)) {
      raw[arch as DesignArchetype] += weight;
    }
  }

  // Max: 7 interests × max weight 2 = 14
  return { station: 's3_interests', raw, maxPossible: 14, signalQuality: selectedIds.length >= 5 ? 1 : selectedIds.length / 5 };
}

/**
 * S5: Self-efficacy — 7 domains, each 0-100 slider.
 * Each domain has archetype_correlation weights (0-3).
 * Signal = (slider / 100) × archetype_weight for each domain.
 */
function extractS5Efficacy(profile: DiscoveryProfile): StationArchetypeSignal {
  const raw = zeroScores();
  const efficacy = profile.station5.selfEfficacy;
  let answeredCount = 0;

  for (const domain of SELF_EFFICACY_DOMAINS) {
    const value = efficacy[domain.id];
    if (value == null) continue;
    answeredCount++;
    const normalizedValue = value / 100; // 0-1
    for (const [arch, weight] of Object.entries(domain.archetype_correlation)) {
      raw[arch as DesignArchetype] += normalizedValue * weight;
    }
  }

  // Max: 7 domains × max correlation 3 × 1.0 (full slider) = 21
  return { station: 's5_efficacy', raw, maxPossible: 21, signalQuality: answeredCount >= 7 ? 1 : answeredCount / 7 };
}

// ─── Normalization ───────────────────────────────────────────────

/**
 * Normalize raw signals to 0-100 scale.
 * raw[arch] / maxPossible × 100, clamped to [0, 100].
 */
function normalizeSignal(signal: StationArchetypeSignal): Record<DesignArchetype, number> {
  const normalized = zeroScores();
  if (signal.maxPossible === 0) return normalized;

  for (const arch of ALL_ARCHETYPES) {
    normalized[arch] = Math.min(100, Math.max(0, (signal.raw[arch] / signal.maxPossible) * 100));
  }
  return normalized;
}

// ─── Main Aggregation ────────────────────────────────────────────

/**
 * Compute final archetype scores (0-100 per archetype) from the full profile.
 *
 * Algorithm:
 * 1. Extract raw signals from each station
 * 2. Normalize each to 0-100
 * 3. Weighted average using STATION_WEIGHTS
 * 4. Re-normalize so max archetype = 100
 *
 * Only includes stations with signalQuality > 0 (student actually did it).
 * Weights are redistributed among completed stations.
 */
export function computeFinalArchetypeScores(
  profile: DiscoveryProfile,
): Record<DesignArchetype, number> {
  // Extract all signals
  const signals: StationArchetypeSignal[] = [
    extractS0Tools(profile),
    extractS2Scenarios(profile),
    extractS2People(profile),
    extractS3IrritationAI(profile),
    extractS3IrritationPreset(profile),
    extractS3Interests(profile),
    extractS5Efficacy(profile),
  ];

  // Filter to stations with actual data
  const activeSignals = signals.filter(s => s.signalQuality > 0);
  if (activeSignals.length === 0) return zeroScores();

  // Calculate total active weight for redistribution
  const totalActiveWeight = activeSignals.reduce(
    (sum, s) => sum + (STATION_WEIGHTS[s.station] ?? 0) * s.signalQuality,
    0,
  );

  if (totalActiveWeight === 0) return zeroScores();

  // Weighted average of normalized scores
  const weighted = zeroScores();
  for (const signal of activeSignals) {
    const normalized = normalizeSignal(signal);
    const weight = ((STATION_WEIGHTS[signal.station] ?? 0) * signal.signalQuality) / totalActiveWeight;

    for (const arch of ALL_ARCHETYPES) {
      weighted[arch] += normalized[arch] * weight;
    }
  }

  // Re-normalize so top archetype reaches ~100
  const maxScore = Math.max(...ALL_ARCHETYPES.map(a => weighted[a]), 1);
  const final = zeroScores();
  for (const arch of ALL_ARCHETYPES) {
    final[arch] = Math.round((weighted[arch] / maxScore) * 100);
  }

  return final;
}

/**
 * Determine primary and secondary archetypes from scores.
 */
export function determineArchetypeResult(
  scores: Record<DesignArchetype, number>,
): { primary: DesignArchetype; secondary: DesignArchetype | null; isPolymath: boolean } {
  const sorted = ALL_ARCHETYPES
    .map(a => ({ archetype: a, score: scores[a] }))
    .sort((a, b) => b.score - a.score);

  const primary = sorted[0].archetype;
  const secondary = sorted[1].score >= sorted[0].score * 0.75 ? sorted[1].archetype : null;

  // Polymath: top 3 archetypes are within 20 points of each other
  const isPolymath = sorted.length >= 3 &&
    (sorted[0].score - sorted[2].score) <= 20;

  return { primary, secondary, isPolymath };
}

/**
 * Get all station signals for debugging/display.
 */
export function getStationSignals(profile: DiscoveryProfile): StationArchetypeSignal[] {
  return [
    extractS0Tools(profile),
    extractS2Scenarios(profile),
    extractS2People(profile),
    extractS3IrritationAI(profile),
    extractS3IrritationPreset(profile),
    extractS3Interests(profile),
    extractS5Efficacy(profile),
  ];
}
