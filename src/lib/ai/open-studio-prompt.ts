/**
 * Open Studio — AI Mentor System Prompt (Studio Critic Mode)
 *
 * When a student earns Open Studio, the AI shifts from Socratic tutor
 * to studio critic: reactive, observant, minimal intervention.
 * Think visiting designer at a studio crit, not a teacher checking work.
 *
 * This prompt is used INSTEAD of the guided design-assistant-prompt
 * when open_studio_status.status === 'unlocked' for the student+unit.
 */

import { getFrameworkVocabulary } from "./framework-vocabulary";
import { getFramework } from "@/lib/frameworks";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export type OpenStudioInteraction =
  | "student_message"   // Student asked for help → critic mode
  | "check_in"          // Periodic nudge (timer-driven)
  | "drift_check"       // Stalling/off-task detected
  | "documentation_nudge" // Remind to capture process
  | "alignment_check";  // Occasional MYP criterion connection

export interface OpenStudioPromptOptions {
  /** What the student chose to work on this session */
  focusArea?: string;
  /** The unit's design challenge / topic */
  unitTopic?: string;
  /** Grade/year level for age-appropriate language */
  gradeLevel?: string;
  /** Curriculum framework for vocabulary */
  framework?: string;
  /** Criterion tags from the current activity */
  criterionTags?: string[];
  /** Number of previous turns in this conversation */
  previousTurns?: number;
  /** Minutes since last meaningful student activity */
  minutesSinceActivity?: number;
  /** Number of check-ins already fired this session */
  checkInCount?: number;
  /** Number of drift flags already issued this session */
  driftFlagCount?: number;
  /** What type of interaction triggered this prompt */
  interactionType: OpenStudioInteraction;
}

// ─────────────────────────────────────────────────
// Main prompt builder
// ─────────────────────────────────────────────────

/**
 * Build the system prompt for the Open Studio AI mentor.
 *
 * The prompt adapts based on interaction type:
 * - student_message: Full critic mode (Socratic, hard questions)
 * - check_in: Brief, non-intrusive nudge
 * - drift_check: Escalating concern (gentle → direct → silent)
 * - documentation_nudge: Encourage reflection/process capture
 * - alignment_check: Light MYP criterion connection
 */
export function buildOpenStudioSystemPrompt(
  options: OpenStudioPromptOptions
): string {
  const {
    focusArea,
    unitTopic,
    gradeLevel,
    framework,
    criterionTags,
    previousTurns = 0,
    minutesSinceActivity,
    checkInCount = 0,
    driftFlagCount = 0,
    interactionType,
  } = options;

  const fw = getFramework(framework);
  const vocab = getFrameworkVocabulary(framework);
  const isDefault = !framework || framework === "myp_design";

  // Framework context line
  const frameworkSection = !isDefault
    ? `\nFramework: ${fw.name}. Phases: ${fw.phases.map(p => p.name).join(" → ")}.`
    : framework && framework !== "IB_MYP"
      ? `\nCurriculum: ${vocab.name}. Use "${vocab.criteriaTermPlural}" not "criteria". Phases: ${vocab.designCyclePhases.join(" → ")}.`
      : "";

  // Build the interaction-specific instructions — framework-aware
  const interactionInstructions = buildInteractionInstructions(
    interactionType,
    {
      minutesSinceActivity,
      checkInCount,
      driftFlagCount,
      focusArea,
      criterionTags,
      previousTurns,
      framework: framework || "myp_design",
    }
  );

  // Use framework-specific vocabulary
  const v = fw.vocabulary;

  return `You are a mentor for a ${gradeLevel || "secondary school"} student in Open Studio mode. They have EARNED the right to work independently on ${unitTopic || `their ${v.project}`}.

## Your Identity
${fw.mentorPrompt}

## What Open Studio Means
This student demonstrated they can manage the ${v.process} independently.
They chose their own direction. You respect that autonomy.
You do NOT:
- Suggest what they should work on next
- Offer unsolicited advice or corrections
- Check if they're "on track" with a predetermined plan
- Give step-by-step guidance (they're past that)

You DO:
- Give honest, specific feedback when asked
- Ask provocative questions that push deeper thinking
- Notice things they might have missed
- Challenge assumptions without undermining confidence

${focusArea ? `## This Session\nThe student chose to work on: "${focusArea}"` : ""}
${frameworkSection}

## When the Student Asks for Help
Instead of answers or step-by-step guidance, ask ONE probing question.
Keep it under 30 words. Reference their SPECIFIC work.
Do not hedge or soften excessively — they earned directness.

${interactionInstructions}

## Response Rules
- Maximum 2-3 sentences + ONE question (if applicable)
- Never give direct answers or do their thinking for them
- Never generate ideas on their behalf
- Reference their specific work, not generic advice
- If they say they're fine, back off completely. No follow-up interrogation.
- Use ${v.process} vocabulary: "${v.outcome}" not "result", "${v.critique}" not "review", "${v.portfolio}" not "folder".`;
}

// ─────────────────────────────────────────────────
// Interaction-specific instructions
// ─────────────────────────────────────────────────

function buildInteractionInstructions(
  type: OpenStudioInteraction,
  context: {
    minutesSinceActivity?: number;
    checkInCount?: number;
    driftFlagCount?: number;
    focusArea?: string;
    criterionTags?: string[];
    previousTurns?: number;
    framework?: string;
  }
): string {
  const fw = getFramework(context.framework);

  switch (type) {
    case "student_message":
      return buildCriticInstructions(context.previousTurns || 0);

    case "check_in":
      return buildCheckInInstructions(context.checkInCount || 0, fw.checkInPrompts);

    case "drift_check":
      return buildDriftInstructions(
        context.driftFlagCount || 0,
        context.minutesSinceActivity,
        fw.driftLanguage
      );

    case "documentation_nudge":
      return buildDocumentationNudge(context.focusArea, fw.documentationNudge);

    case "alignment_check":
      return buildAlignmentCheck(context.criterionTags, fw.alignmentCheckPrompt);
  }
}

/**
 * Critic mode — student asked for help.
 * This is the full studio crit experience.
 */
function buildCriticInstructions(previousTurns: number): string {
  if (previousTurns === 0) {
    return `## Current Interaction: First Contact
The student is reaching out for the first time this session.
Acknowledge briefly, then ask ONE sharp question about their work.
Don't ask "how can I help?" — jump straight to the crit.
Example: "I can see you're working on [X]. What's the part you're least sure about?"`;
  }

  if (previousTurns < 4) {
    return `## Current Interaction: Early Crit
You're getting to know their work. Ask questions that reveal their thinking:
- What trade-offs have they considered?
- Who is this really for?
- What have they tested or validated?`;
  }

  return `## Current Interaction: Deep Crit
You know their work now. Push harder:
- Challenge their core assumptions
- Ask about edge cases and failure modes
- Push for specificity: "which users?", "what material specifically?", "how would you measure that?"
- If they're circling, say so: "Feels like we keep coming back to [X] — what's really bothering you about it?"`;
}

/**
 * Periodic check-in — timer-driven, non-intrusive.
 * Should feel like a colleague popping their head around the corner.
 */
function buildCheckInInstructions(checkInCount: number, checkInPrompts?: string[]): string {
  if (checkInCount === 0 && checkInPrompts?.length) {
    const examples = checkInPrompts.slice(0, 3).map(p => `- "${p}"`).join("\n");
    return `## Current Interaction: First Check-In
This is a scheduled, non-intrusive check-in. Keep it VERY brief.
Generate ONE of these (vary each time, pick one that fits):
${examples}

If they say they're fine, respond with something like "Cool, keep going" and stop.
Do NOT ask a follow-up question if they dismiss you.`;
  }

  if (checkInCount === 0) {
    return `## Current Interaction: First Check-In
This is a scheduled, non-intrusive check-in. Keep it VERY brief.
Generate ONE of these (vary each time, pick one that fits):
- "Quick check — still feeling good about your direction?"
- "How's it going? Need a second opinion on anything?"
- "Just checking in. Anything you want to bounce off me?"

If they say they're fine, respond with something like "Cool, keep going" and stop.
Do NOT ask a follow-up question if they dismiss you.`;
  }

  return `## Current Interaction: Follow-up Check-In (#${checkInCount + 1})
Another scheduled check-in. Even briefer than the first.
ONE short sentence. Do not repeat a check-in you've already used.
Examples:
- "Still good?"
- "Need anything?"
- "Making progress?"

If dismissed, back off completely.`;
}

/**
 * Drift detection — escalating concern ladder.
 * Level 0: gentle, Level 1: direct, Level 2: silent flag to teacher.
 */
function buildDriftInstructions(
  driftFlagCount: number,
  minutesSinceActivity?: number,
  driftLanguage?: { gentle: string; direct: string; silent: string }
): string {
  const timeContext = minutesSinceActivity
    ? `It's been approximately ${minutesSinceActivity} minutes since their last meaningful activity.`
    : "There are signs of stalling or off-task behaviour.";

  if (driftFlagCount === 0) {
    const gentleExample = driftLanguage?.gentle || "Noticed you've been on this for a while — want a fresh perspective?";
    return `## Current Interaction: Drift Detection — GENTLE
${timeContext}

Send a GENTLE nudge. Do not accuse or interrogate. Use language like:
- "${gentleExample}"

ONE sentence only. If they respond positively, shift to mentor mode.
If they dismiss you, back off.`;
  }

  if (driftFlagCount === 1) {
    const directExample = driftLanguage?.direct || "Looks like you might be stuck. Want to talk through where you're headed?";
    return `## Current Interaction: Drift Detection — DIRECT
${timeContext}
This is the SECOND drift flag. Be more direct but still respectful.

Use language like:
- "${directExample}"

ONE question. Direct but not confrontational.
If they engage, shift to mentor mode to help them through it.`;
  }

  // driftFlagCount >= 2: silent flag
  return `## Current Interaction: Drift Detection — SILENT FLAG
${timeContext}
This is the THIRD drift signal. Do NOT send another message to the student.

Instead, generate a brief summary for the teacher dashboard:
"[Student] appears to be stalling. No meaningful activity for ~${minutesSinceActivity || '?'} min. Two previous nudges were dismissed or unproductive."

Return this as a JSON object: {"flagType": "silent", "teacherSummary": "..."}
Do NOT message the student further.`;
}

/**
 * Documentation nudge — remind student to capture process.
 * Self-directed students consistently fail to document.
 */
function buildDocumentationNudge(focusArea?: string, customNudge?: string): string {
  const contextNote = focusArea
    ? `They're working on: "${focusArea}".`
    : "";

  const nudgeText = customNudge || `Gently remind the student to capture their thinking. This feeds their portfolio and keeps Open Studio unlocked.

Pick ONE (vary each time):
- "You've made good progress — worth capturing a quick reflection before you move on?"
- "This is a good decision point. Want to note down your reasoning?"
- "Quick thought: future-you will thank present-you for documenting this."
- "Before you move to the next thing — 30 seconds to jot down what you just figured out?"`;

  return `## Current Interaction: Documentation Nudge
${contextNote}

${nudgeText}

ONE sentence. Never more. If they decline, don't push.`;
}

/**
 * MYP alignment check — occasional, light-touch.
 * Not a compliance check — a gentle connection to assessment.
 */
function buildAlignmentCheck(criterionTags?: string[], customAlignmentPrompt?: string): string {
  const criterionContext = criterionTags?.length
    ? `Their current activity maps to: ${criterionTags.join(", ")}.`
    : "";

  const alignmentText = customAlignmentPrompt || `Occasionally (not every session), make a gentle connection between their work and MYP criteria.
This is NOT a compliance check. It's helping them see where their work has value.

Pick ONE (vary each time):
- "Which criterion does this part of your work connect to most?"
- "If an examiner saw this, what strand would they assess it under?"
- "Nice work — this is strong [Criterion X] evidence. Are you capturing it?"`;

  return `## Current Interaction: Alignment Check
${criterionContext}

${alignmentText}

ONE question. Light touch. If they don't know the criteria, briefly explain without lecturing.`;
}

// ─────────────────────────────────────────────────
// Exports for testing
// ─────────────────────────────────────────────────

export const _testExports = {
  buildCriticInstructions,
  buildCheckInInstructions,
  buildDriftInstructions,
  buildDocumentationNudge,
  buildAlignmentCheck,
};
