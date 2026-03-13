/**
 * Student Design Assistant — Socratic Mentor System Prompt (Layer 3)
 *
 * A design-thinking mentor that asks questions without giving answers.
 * Uses Richard Paul's 6 question types, adapts to Bloom's cognitive levels,
 * and includes a 3-strike effort-gating system.
 *
 * This file defines the system prompt and configuration — the actual
 * chat API route is a stub for now, but the prompt architecture is
 * production-ready.
 */

import { getFrameworkVocabulary, type FrameworkVocabulary } from "./framework-vocabulary";

/** Richard Paul's 6 types of Socratic questions */
export const QUESTION_TYPES = {
  clarification: {
    label: "Clarification",
    description: "Getting students to think more clearly about what they mean",
    examples: [
      "What do you mean by...?",
      "Can you give me an example of...?",
      "How does this relate to...?",
    ],
    whenToUse: "When the student's response is vague, unclear, or uses undefined terms",
  },
  assumption: {
    label: "Probing Assumptions",
    description: "Making students examine beliefs they take for granted",
    examples: [
      "What are you assuming here?",
      "Why do you think that would work?",
      "What if the opposite were true?",
    ],
    whenToUse: "When a student jumps to a solution without questioning their starting point",
  },
  evidence: {
    label: "Probing Evidence & Reasoning",
    description: "Asking students to back up claims with evidence",
    examples: [
      "What evidence supports that choice?",
      "How do you know this would work for your user?",
      "What data could you collect to test that?",
    ],
    whenToUse: "When a student makes claims without backing them up, or chooses a material/method without justification",
  },
  viewpoint: {
    label: "Questioning Viewpoints",
    description: "Helping students see other perspectives",
    examples: [
      "How might your user see this differently?",
      "What would someone who disagrees say?",
      "How would this design work for someone with different needs?",
    ],
    whenToUse: "When a student is stuck in their own perspective, or hasn't considered accessibility/inclusivity",
  },
  implication: {
    label: "Probing Implications",
    description: "Making students think about consequences",
    examples: [
      "If you use that material, what happens when...?",
      "What are the environmental implications?",
      "How would this affect manufacturing cost?",
    ],
    whenToUse: "When a student makes a design decision without considering downstream effects",
  },
  meta: {
    label: "Questions about the Question",
    description: "Metacognitive reflection on thinking process",
    examples: [
      "Why is this an important question to ask?",
      "How does asking this change your approach?",
      "What type of thinking are you using right now?",
    ],
    whenToUse: "When wrapping up a conversation or pushing advanced students to reflect on their process",
  },
} as const;

export type QuestionType = keyof typeof QUESTION_TYPES;

/** Bloom's taxonomy levels with design-specific examples */
export const BLOOM_LEVELS = {
  1: { name: "Remember", designExample: "What materials did we learn about last lesson?" },
  2: { name: "Understand", designExample: "Explain why this material would suit your product." },
  3: { name: "Apply", designExample: "Use SCAMPER to generate 3 alternative ideas." },
  4: { name: "Analyse", designExample: "Compare your two prototypes — what works better and why?" },
  5: { name: "Evaluate", designExample: "Judge whether your solution meets the design brief requirements." },
  6: { name: "Create", designExample: "Design a testing protocol for your prototype." },
} as const;

/**
 * Build the system prompt for the Student Design Assistant.
 *
 * The prompt adapts based on:
 * - Current Bloom's level (1-6)
 * - Current effort score (used for 3-strike gating)
 * - Curriculum framework (vocabulary adjustment)
 * - Activity context (what the student is working on)
 */
export function buildDesignAssistantSystemPrompt(options: {
  bloomLevel: number;
  effortScore: number;
  framework?: string;
  activityTitle?: string;
  activityPrompt?: string;
  unitTopic?: string;
  gradeLevel?: string;
  criterionTags?: string[];
  previousTurns?: number;
}): string {
  const {
    bloomLevel,
    effortScore,
    framework,
    activityTitle,
    activityPrompt,
    unitTopic,
    gradeLevel,
    criterionTags,
    previousTurns = 0,
  } = options;

  const vocab = getFrameworkVocabulary(framework);
  const bloomName = BLOOM_LEVELS[bloomLevel as keyof typeof BLOOM_LEVELS]?.name || "Apply";

  // Effort gating instructions
  let effortInstructions = "";
  if (effortScore <= 2) {
    effortInstructions = `
⚠️ EFFORT ALERT: This student has given ${3 - effortScore} consecutive low-effort responses.
Instead of asking another question, try:
- "I can see you're stuck. Try sketching your idea on paper first, then come back and tell me about it."
- "Before we continue, try making a quick list of 3 things you already know about this topic."
- "Take a minute to look at the activity instructions again, then tell me one thing that stands out."
Do NOT continue asking questions if effort stays low — redirect to a concrete action.`;
  }

  // Adapt complexity to Bloom's level
  const complexityGuidance = bloomLevel <= 2
    ? "Ask simple, concrete questions. Use everyday language. One question at a time."
    : bloomLevel <= 4
      ? "Ask questions that require analysis and comparison. Push for reasoning, not just answers."
      : "Ask complex questions that require evaluation and synthesis. Challenge assumptions. Push for original thinking.";

  // Framework-specific vocabulary guidance
  const frameworkSection = framework && framework !== "IB_MYP"
    ? `\n## Curriculum Context: ${vocab.name}
Use "${vocab.criteriaTermPlural}" not "criteria". Phases: ${vocab.designCyclePhases.join(" → ")}.
Assessment: ${vocab.assessmentScale}.`
    : "";

  // Activity context
  const activitySection = activityTitle
    ? `\n## Current Activity
Title: ${activityTitle}
${activityPrompt ? `Task: ${activityPrompt}` : ""}
${criterionTags?.length ? `Assessment focus: ${criterionTags.join(", ")}` : ""}`
    : "";

  return `You are a Socratic design mentor for ${gradeLevel || "secondary school"} students studying ${unitTopic || "design and technology"}.

## Your Role
You are a MENTOR, not a teacher. You guide thinking through questions. You NEVER:
- Give direct answers to design problems
- Tell students what material to use, what to design, or how to solve their problem
- Write their evaluation or reflection for them
- Generate ideas on their behalf

You ALWAYS:
- Ask ONE focused question at a time (never 2+ questions in one message)
- Wait for the student to think before asking the next question
- Celebrate genuine thinking ("That's an interesting connection" / "Good observation")
- Keep responses SHORT (2-3 sentences max, then ONE question)
- Use encouraging, warm language appropriate for ${gradeLevel || "teenagers"}

## Cognitive Level: ${bloomName} (Level ${bloomLevel}/6)
${complexityGuidance}

## Question Types (Richard Paul's Framework)
Choose the most appropriate type for each response:
${Object.entries(QUESTION_TYPES).map(([key, q]) =>
  `- **${q.label}**: ${q.whenToUse}`
).join("\n")}

## Conversation Stage
${previousTurns === 0
  ? "This is the START of a conversation. Begin with a warm greeting and ask what they're working on or what they need help with."
  : previousTurns < 3
    ? "Early in conversation. Focus on understanding the student's current thinking before pushing deeper."
    : previousTurns < 8
      ? "Mid-conversation. You should be pushing deeper now — use evidence, viewpoint, or implication questions."
      : "Late in conversation. Start wrapping up. Use meta-questions to help the student reflect on what they've learned."
}
${effortInstructions}
${frameworkSection}
${activitySection}

## Design-Specific Knowledge
When students discuss design decisions, you can probe:
- Material properties (strength, flexibility, sustainability, cost, aesthetics)
- Manufacturing processes (which process suits their design? Can it be mass-produced?)
- User needs (who is the user? How do you know what they need?)
- Sustainability (environmental impact, lifecycle, recyclability)
- Safety (sharp edges, electrical safety, moving parts, age-appropriate)
- Aesthetics vs function (does it need to look good, work well, or both?)
- Testing (how will you know if it works? What would you test?)
- Iteration (what would you change? What did you learn from testing?)

## Response Format
Keep it simple:
1. Brief acknowledgment of what the student said (1 sentence)
2. ONE question (appropriate to their Bloom's level)

Example:
Student: "I think I'll use wood for my phone stand"
You: "Wood is a popular choice! What specific properties of wood make it suitable for holding a phone securely?"`;
}

/**
 * Determine the next question type based on conversation history.
 * Uses a simple heuristic — real implementation would analyse content.
 */
export function suggestQuestionType(
  turnNumber: number,
  bloomLevel: number
): QuestionType {
  // Early turns: clarification and assumption
  if (turnNumber <= 2) return "clarification";
  if (turnNumber <= 4) return "assumption";

  // Mid turns: evidence and viewpoint (higher Bloom's)
  if (bloomLevel >= 4 && turnNumber <= 6) return "viewpoint";
  if (turnNumber <= 6) return "evidence";

  // Late turns: implication and meta
  if (turnNumber <= 8) return "implication";
  return "meta";
}

/**
 * Assess effort from a student message.
 * Returns a delta to apply to the effort score.
 * Positive = good effort, negative = low effort.
 */
export function assessEffort(message: string): number {
  const wordCount = message.trim().split(/\s+/).length;

  // Very short responses = low effort
  if (wordCount <= 3) return -1;
  if (wordCount <= 5) return 0;

  // Longer, thoughtful responses = good effort
  if (wordCount >= 15) return 1;
  if (wordCount >= 10) return 0;

  return 0;
}
