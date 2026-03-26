/**
 * Station 7: The Launchpad — Content Pool
 *
 * Success criteria templates, excitement reactions, Kit dialogue.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 6.1 + Part 8
 */

import type { DesignArchetype } from "../types";

// ─── Success Criteria Templates ──────────────────────────────────

/**
 * Per-archetype criteria. Student picks 3-5, can write custom.
 * AI (Haiku) may generate 1-2 personalized criteria at the top.
 */
export const SUCCESS_CRITERIA_TEMPLATES: Record<DesignArchetype, string[]> = {
  Maker: [
    "I built a working prototype that someone can actually use",
    "I learned a new making skill I didn't have before",
    "I tested my design with a real person and improved it based on their feedback",
    "The final version is noticeably better than my first attempt",
    "I documented my process so someone else could build it too",
    "I solved a problem that actually mattered to someone",
  ],
  Researcher: [
    "I found evidence that changed my understanding of the problem",
    "I talked to real people affected by the issue, not just read about it",
    "My research led to a specific, actionable recommendation",
    "I can explain my findings clearly to someone who knows nothing about the topic",
    "I discovered something that surprised me — not just confirmed what I already thought",
    "I connected information from multiple sources in a way nobody else has",
  ],
  Leader: [
    "I brought together a group of people who wouldn't have worked together otherwise",
    "The project continued making progress even when I wasn't pushing it",
    "I helped someone else develop a skill or confidence they didn't have",
    "I made a decision under pressure that I can defend with reasons",
    "The people involved would say the process was fair",
    "Something real changed because of what we did — not just a presentation",
  ],
  Communicator: [
    "Someone who didn't care about this issue started caring because of my work",
    "I told a true story in a way that was hard to ignore",
    "I listened to perspectives I disagreed with and represented them fairly",
    "My audience understood the message without me having to explain it",
    "I found the right medium for the message — not just the easiest one",
    "Someone told me my work made them feel something specific",
  ],
  Creative: [
    "I made something that didn't exist before — not a copy of something else",
    "I took a creative risk that scared me a little",
    "I can explain why my design choices work, not just that they look good",
    "I explored at least 3 different directions before committing to one",
    "Someone saw my work and said 'I've never seen it done that way'",
    "The final piece has a level of craft I'm proud of",
  ],
  Systems: [
    "I made something complicated easier to understand",
    "I found a pattern or connection that nobody else noticed",
    "My solution addresses the root cause, not just the symptom",
    "I can draw a diagram that explains how the system works — and where it breaks",
    "I tested my solution against edge cases, not just the obvious scenario",
    "Someone is actually using the system/process I designed",
  ],
};

/**
 * Generic criteria — always available regardless of archetype.
 */
export const GENERIC_CRITERIA: string[] = [
  "I'm proud enough to show this to someone I respect",
  "I learned something about myself through this project",
  "I managed my time well enough to finish without a last-minute panic",
  "I asked for help when I needed it instead of struggling alone",
  "I can point to a specific moment where the project got better because I iterated",
];

// ─── Criteria for Student's Chosen Door ──────────────────────────

/**
 * Get criteria list for a student based on their archetype.
 * Includes primary archetype (all 6), secondary archetype (top 3),
 * and all 5 generic criteria.
 */
export function getCriteriaForStudent(
  primaryArchetype: DesignArchetype,
  secondaryArchetype?: DesignArchetype | null,
): string[] {
  const seen = new Set<string>();
  const criteria: string[] = [];

  const addUnique = (items: string[]) => {
    for (const item of items) {
      if (!seen.has(item)) {
        seen.add(item);
        criteria.push(item);
      }
    }
  };

  // All primary archetype criteria
  addUnique(SUCCESS_CRITERIA_TEMPLATES[primaryArchetype]);

  // Top 3 from secondary archetype (if different from primary)
  if (secondaryArchetype && secondaryArchetype !== primaryArchetype) {
    addUnique(SUCCESS_CRITERIA_TEMPLATES[secondaryArchetype].slice(0, 3));
  }

  // All generic criteria
  addUnique(GENERIC_CRITERIA);

  return criteria;
}

// ─── Excitement Reactions ────────────────────────────────────────

/**
 * Kit's reaction at 3 breakpoints for the excitement slider.
 * Score < 20 triggers a "go back" option.
 */
export const EXCITEMENT_REACTIONS = {
  low: {
    threshold: 30,
    response:
      "Under 30. That's honest. If you're not excited, we should figure out why — because a project you're not into is a project that dies in week two. Want to go back and change your door?",
    offerBacktrack: true,
  },
  mid: {
    threshold: 70,
    response:
      "Cautiously optimistic. That's actually healthy. Pure excitement fades. Curiosity with a bit of nerves — that lasts.",
    offerBacktrack: false,
  },
  high: {
    threshold: 100,
    response:
      "You're ready. I can tell. That energy is going to carry you through the hard parts — just remember it when you're in the messy middle.",
    offerBacktrack: false,
  },
};

/**
 * Get Kit's excitement reaction for a given score.
 */
export function getExcitementReaction(score: number): {
  response: string;
  offerBacktrack: boolean;
} {
  if (score < EXCITEMENT_REACTIONS.low.threshold) {
    return EXCITEMENT_REACTIONS.low;
  }
  if (score < EXCITEMENT_REACTIONS.mid.threshold) {
    return EXCITEMENT_REACTIONS.mid;
  }
  return EXCITEMENT_REACTIONS.high;
}

// ─── Criteria Reaction ───────────────────────────────────────────

/**
 * Build Kit's reaction to the student's chosen success criteria.
 * Analyses what TYPE of criteria they picked (personal growth, impact, process, ambition).
 */
export function buildCriteriaReaction(
  criteria: string[],
  _archetype: DesignArchetype,
): string {
  const hasPersonalGrowth = criteria.some(
    (c) => c.includes("learned") || c.includes("myself") || c.includes("proud"),
  );
  const hasImpact = criteria.some(
    (c) => c.includes("someone") || c.includes("people") || c.includes("changed"),
  );
  const hasProcess = criteria.some(
    (c) => c.includes("tested") || c.includes("iterated") || c.includes("documented"),
  );
  const hasAmbition = criteria.some(
    (c) =>
      c.includes("never seen") || c.includes("risk") || c.includes("original"),
  );

  if (hasImpact && hasProcess)
    return "Impact AND process. You care about the result AND how you got there. That's mature.";
  if (hasAmbition && !hasProcess)
    return "Big ambitions. Love it. But I notice you didn't pick anything about process — the ambitious projects are the ones that need the most discipline.";
  if (hasPersonalGrowth && criteria.length <= 3)
    return "Personal growth criteria. This project is about YOU growing, not just making something. That's the kind of project you'll remember in ten years.";
  if (criteria.length >= 5)
    return `${criteria.length} criteria. That's a lot to hit. Make sure they're not contradicting each other — you can't go deep AND wide.`;
  return "Solid criteria. Keep these somewhere you can see them — not in a folder. On your wall.";
}

// ─── Kit S7 Dialogue ─────────────────────────────────────────────

export const S7_KIT_DIALOGUE = {
  intro:
    "Almost there. We've been on quite a journey — and now it's time to make it real. This is where ideas become commitments.",

  ascent:
    "Think of this as climbing the last hill. Every step from here is about making your project concrete. Not perfect — concrete.",

  beforeStatement:
    "Time to write it down. Not a polished pitch — just the core. What are you going to do, who is it for, and why does it matter to you?",

  statementPrompt:
    "I will _____, for _____, because _____.",

  afterStatement:
    "That's yours now. Not mine, not your teacher's. Yours. Let's make sure you know what success looks like.",

  beforeCriteria:
    "Pick the ones that feel true — not the ones that sound impressive. You're going to measure yourself against these, so be honest about what matters.",

  afterCriteria: null as string | null, // Dynamically generated by buildCriteriaReaction

  beforeExcitement:
    "Last thing before the big moment. Close your eyes for a second. Think about the project direction you chose and the criteria you just set. Now...",

  excitementPrompt:
    "How excited are you to actually start this?",

  beforeGrandReveal:
    "Alright. This is the moment. Everything you've shared — your style, your interests, what irritates you, what scares you, what excites you — it all adds up to something. Let me show you.",

  afterGrandReveal:
    "That's you. Not who someone else says you are — who you actually are, based on what YOU told me. Take this with you. It's your compass.",

  share:
    "One more thing — your teacher's going to see a summary of what we talked about. Not everything. Just enough to help them help you. Sound good?",
};

// ─── Go Back (low excitement) ────────────────────────────────────

export const GO_BACK_MESSAGE =
  "No shame in changing your mind. Better now than three weeks in.";
