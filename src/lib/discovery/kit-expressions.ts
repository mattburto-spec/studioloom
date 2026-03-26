/**
 * Kit Expression & Message Resolver
 *
 * Maps the current Discovery state to Kit's expression and optional
 * speech bubble message. Kit's expression changes per step to feel
 * responsive — she's not just sitting there blank.
 *
 * Expression mapping:
 * - intro steps → curious (she's inviting)
 * - story steps → empathetic (she's sharing)
 * - active interaction → neutral (she's watching)
 * - reveals → excited or proud (celebrating)
 * - text prompts → thoughtful (she's listening)
 *
 * @see docs/specs/discovery-engine-ux-design.md
 */

import type { DiscoveryState, KitExpression } from './types';

export interface KitState {
  expression: KitExpression;
  message: string | null;
}

/**
 * Step-level expression overrides.
 * Anything not listed defaults based on the step suffix pattern.
 */
const STEP_EXPRESSIONS: Partial<Record<DiscoveryState, KitExpression>> = {
  // S0: Identity Card
  station_0: 'curious',
  station_0_palette: 'curious',
  station_0_tools: 'excited',
  station_0_workspace: 'thoughtful',

  // S1: Campfire
  station_1: 'curious',
  station_1_intro: 'empathetic',
  station_1_quickfire: 'curious',
  station_1_reflection: 'thoughtful',

  // S2: Workshop
  station_2: 'curious',
  station_2_intro: 'empathetic',
  station_2_story: 'empathetic',
  station_2_text_prompt: 'thoughtful',
  station_2_scenarios: 'curious',
  station_2_people_grid: 'curious',
  station_2_reveal: 'excited',

  // S3: Collection Wall
  station_3: 'curious',
  station_3_intro: 'empathetic',
  station_3_interest_grid: 'excited',
  station_3_irritation: 'thoughtful',
  station_3_youtube: 'curious',
  station_3_values_sort: 'thoughtful',
  station_3_reveal: 'excited',

  // S4: Window
  station_4: 'curious',
  station_4_intro: 'empathetic',
  station_4_story: 'empathetic',
  station_4_scene: 'curious',
  station_4_zoom: 'thoughtful',
  station_4_sliders: 'neutral',
  station_4_text_prompt: 'thoughtful',
  station_4_reveal: 'proud',

  // S5: Toolkit
  station_5: 'curious',
  station_5_intro: 'empathetic',
  station_5_time: 'neutral',
  station_5_resources: 'curious',
  station_5_people: 'empathetic',
  station_5_efficacy: 'neutral',
  station_5_experience: 'curious',
  station_5_failure: 'empathetic',
  station_5_audience: 'curious',
  station_5_time_horizon: 'neutral',
  station_5_reveal: 'proud',

  // S6: Crossroads
  station_6: 'excited',
  station_6_intro: 'empathetic',
  station_6_generating: 'thoughtful',
  station_6_explore_1: 'curious',
  station_6_explore_2: 'curious',
  station_6_explore_3: 'curious',
  station_6_custom: 'excited',
  station_6_fear: 'empathetic',
  station_6_choose: 'proud',

  // S7: Launchpad
  station_7: 'excited',
  station_7_intro: 'empathetic',
  station_7_ascent: 'excited',
  station_7_statement: 'thoughtful',
  station_7_criteria: 'neutral',
  station_7_excitement: 'curious',
  station_7_grand_reveal: 'proud',
  station_7_share: 'proud',
};

/**
 * Get Kit's expression for the current state.
 */
export function getKitExpression(state: DiscoveryState): KitExpression {
  // Explicit mapping
  const explicit = STEP_EXPRESSIONS[state];
  if (explicit) return explicit;

  // Transitions → thoughtful (she's walking with you)
  if (state.startsWith('transition_')) return 'thoughtful';

  // Completed → proud
  if (state === 'completed') return 'proud';

  // Default
  return 'neutral';
}

/**
 * Kit messages shown at key moments (intro steps primarily).
 * Most interaction-level Kit dialogue is handled by the station
 * components themselves via their content pools. These are just
 * the ones that show in the floating speech bubble.
 */
const KIT_BUBBLE_MESSAGES: Partial<Record<DiscoveryState, string>> = {
  station_0: "Let's start with you. What does your creative space look like?",
  station_1_intro: "I'm going to throw some quick choices at you. Don't overthink — just go with your gut.",
  station_2_intro: "Let me tell you a story first. Then I've got some situations for you.",
  station_3_intro: "Now let's fill your wall with the things that make you, you.",
  station_4_intro: "Look out the window. What catches your eye?",
  station_5_intro: "Time to pack your bag. Let's see what you're working with.",
  station_6_intro: "Three doors. One path. But first — let me show you what I see.",
  station_7_intro: "Last stop. Let's make this real.",
};

/**
 * Get Kit's full state (expression + optional message) for the current step.
 */
export function getKitState(state: DiscoveryState): KitState {
  return {
    expression: getKitExpression(state),
    message: KIT_BUBBLE_MESSAGES[state] ?? null,
  };
}
