/**
 * Station 1: The Campfire — Quick-Fire Binary Pairs
 *
 * 12 pairs. Each maps to a working style dimension.
 * Must feel fast and fun — no overthinking.
 *
 * Voice rule: Prompts are micro-situations, not abstract traits.
 * Options are what you'd actually SAY. Both equally cool.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 1
 */

import type {
  BinaryPair,
  WorkingStyleVector,
  DominantStyle,
  WorkingStyleDimension,
} from '../types';

// ─── Binary Pairs ────────────────────────────────────────────────

export const BINARY_PAIRS: BinaryPair[] = [
  {
    id: 'pair_1',
    dimension: 'planning',
    prompt: 'New project, blank page. You...',
    optionA: { label: 'Grab a pencil and start sketching immediately', icon: '✏️', signal: 'improviser', value: 'a' },
    optionB: { label: 'Open a doc and write down a plan first', icon: '📝', signal: 'planner', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_2',
    dimension: 'social',
    prompt: "You're stuck on a problem. You...",
    optionA: { label: 'Find someone to talk it through with', icon: '💬', signal: 'collaborative', value: 'a' },
    optionB: { label: 'Put your headphones on and figure it out alone', icon: '🎧', signal: 'independent', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_3',
    dimension: 'structure',
    prompt: 'Your desk right now is...',
    optionA: { label: "Pretty organised — I like knowing where things are", icon: '🗂️', signal: 'structured', value: 'a' },
    optionB: { label: "A mess — but I know exactly where everything is", icon: '🎨', signal: 'flexible', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_4',
    dimension: 'energy',
    prompt: "Saturday morning, no plans. You'd rather...",
    optionA: { label: 'Pick one thing and go deep for hours', icon: '🎯', signal: 'deep_focus', value: 'a' },
    optionB: { label: 'Do a bunch of different stuff, switching when you feel like it', icon: '🎲', signal: 'burst', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_5',
    dimension: 'decision',
    prompt: "You're choosing between two project ideas. You...",
    optionA: { label: 'Just pick the one that feels right', icon: '💫', signal: 'gut', value: 'a' },
    optionB: { label: 'Make a list of pros and cons first', icon: '📊', signal: 'analytical', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_6',
    dimension: 'risk',
    prompt: "Your project is 'good enough' with 2 days left. You...",
    optionA: { label: 'Tear it apart and try something way more ambitious', icon: '🔥', signal: 'risk_taker', value: 'a' },
    optionB: { label: "Polish what you've got until it's really solid", icon: '💎', signal: 'reliable', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_7',
    dimension: 'pace',
    prompt: 'First day on a new project. You...',
    optionA: { label: 'Go slow — research, think, plan, then start', icon: '🐢', signal: 'slow_build', value: 'a' },
    optionB: { label: "Get something made by the end of the day, even if it's rough", icon: '🚀', signal: 'fast_start', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_8',
    dimension: 'feedback',
    prompt: 'A teacher hands back your work with notes. You look at...',
    optionA: { label: 'The specific marks and comments — what exactly needs fixing', icon: '🔍', signal: 'specific', value: 'a' },
    optionB: { label: 'The overall grade and vibe — do they get what I was going for?', icon: '🌊', signal: 'big_picture', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_9',
    dimension: 'scope',
    prompt: "If you had an extra week on a project, you'd...",
    optionA: { label: "Go deeper into what you've already got", icon: '⛏️', signal: 'depth', value: 'a' },
    optionB: { label: "Add something new you haven't tried yet", icon: '🌍', signal: 'breadth', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_10',
    dimension: 'expression',
    prompt: "You need to explain an idea to someone. You'd rather...",
    optionA: { label: 'Draw it, build it, or show them a picture', icon: '🖼️', signal: 'visual', value: 'a' },
    optionB: { label: 'Talk them through it or write it down', icon: '🗣️', signal: 'verbal', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_11',
    dimension: 'learning_intake',
    prompt: 'You need to learn how to use a new tool. You...',
    optionA: { label: 'Watch a video or read the instructions first', icon: '📖', signal: 'study', value: 'a' },
    optionB: { label: 'Just start pressing buttons and see what happens', icon: '🎮', signal: 'experiment', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'pair_12',
    dimension: 'learning_source',
    prompt: "You really 'get' something when...",
    optionA: { label: 'Someone shows you a great example of it done well', icon: '✨', signal: 'example', value: 'a' },
    optionB: { label: 'Someone explains the idea behind why it works', icon: '💡', signal: 'concept', value: 'b' },
    ageBands: ['junior', 'senior', 'extended'],
  },
];

// ─── Working Style Computation ───────────────────────────────────

/**
 * Convert dimension answers to a WorkingStyleVector.
 * Option A maps to the first trait, Option B to the second.
 */
const DIMENSION_MAP: Record<WorkingStyleDimension, { a: string; b: string }> = {
  planning: { a: 'improviser', b: 'planner' },
  social: { a: 'collaborative', b: 'independent' },
  structure: { a: 'structured', b: 'flexible' },
  energy: { a: 'deep_focus', b: 'burst' },
  decision: { a: 'gut', b: 'analytical' },
  risk: { a: 'risk_taker', b: 'reliable' },
  pace: { a: 'slow_build', b: 'fast_start' },
  feedback: { a: 'specific', b: 'big_picture' },
  scope: { a: 'depth', b: 'breadth' },
  expression: { a: 'visual', b: 'verbal' },
  learning_intake: { a: 'study', b: 'experiment' },
  learning_source: { a: 'example', b: 'concept' },
};

export function computeWorkingStyle(
  dimensions: Record<WorkingStyleDimension, 'a' | 'b'>,
): WorkingStyleVector {
  const vector: Partial<WorkingStyleVector> = {};
  for (const [dim, choice] of Object.entries(dimensions) as [WorkingStyleDimension, 'a' | 'b'][]) {
    const map = DIMENSION_MAP[dim];
    if (map) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vector as any)[dim] = map[choice];
    }
  }
  return vector as WorkingStyleVector;
}

export function computeDominantStyle(vector: WorkingStyleVector): DominantStyle {
  const plannerSignals = [
    vector.planning === 'planner',
    vector.structure === 'structured',
    vector.pace === 'slow_build',
    vector.decision === 'analytical',
  ].filter(Boolean).length;

  const doerSignals = [
    vector.planning === 'improviser',
    vector.pace === 'fast_start',
    vector.risk === 'risk_taker',
    vector.learning_intake === 'experiment',
  ].filter(Boolean).length;

  const explorerSignals = [
    vector.scope === 'breadth',
    vector.structure === 'flexible',
    vector.risk === 'risk_taker',
    vector.feedback === 'big_picture',
  ].filter(Boolean).length;

  const max = Math.max(plannerSignals, doerSignals, explorerSignals);
  if (max <= 1) return 'balanced';
  if (plannerSignals === max) return 'planner';
  if (doerSignals === max) return 'doer';
  return 'explorer';
}

// ─── Kit Reflections (Fallback Templates) ────────────────────────

/**
 * These reference SPECIFIC answers from the quick-fire.
 * Kit should feel like she was paying attention, not reading a script.
 * These are used when Haiku is unavailable — otherwise Haiku
 * generates a contextual reflection using the actual answers.
 */
export const QUICK_FIRE_REFLECTIONS: Record<DominantStyle, string> = {
  planner: "You went for the plan almost every time. I used to be like that — needed the whole map before I'd take a step. Here's what took me years to learn: the plan is never right. But planners who know that? They're unstoppable. Because you plan, then adapt, while everyone else is still figuring out where to start.",
  doer: "You barely hesitated on most of those. Straight to action. I love that — but I've also watched that instinct build the wrong thing really fast. The trick isn't slowing down. It's pointing your energy at something worth building before you start swinging the hammer.",
  explorer: "You kept picking the open-ended option. More things, wider scope, bigger picture. That's not indecision — that's how people who make unexpected connections think. Your challenge isn't going to be having ideas. It's going to be picking one.",
  balanced: "Interesting — you went back and forth on a lot of those. Some people would call that indecisive. I'd call it adaptable. You read the situation and adjust. That's actually harder than just having one mode.",
};

// ─── Kit Dialogue for Station 1 ─────────────────────────────────

export const STATION_1_KIT_DIALOGUE = {
  intro: "Welcome to the campfire. This is where it starts. I'm Kit — think of me as a smart older cousin who's been through the design thing and came out the other side. I'm going to ask you some questions. Not to test you — to help you see something about yourself you might not have noticed.",
  quickfire_setup: "Quick round. I'll give you two options. Pick the one that's more you. Don't overthink it — go with your gut. Ready?",
  quickfire_halfway: "Halfway there. You're doing this fast — that's the point. Keep going.",
  quickfire_done: "Done. Let me think about what I just saw...",
  reflection_intro: "Here's what I noticed:",
  complete: "That's your working style fingerprint. It doesn't mean you can't do the opposite — it just means this is where you start. Let's go somewhere you can show me what you're actually good at.",
};
